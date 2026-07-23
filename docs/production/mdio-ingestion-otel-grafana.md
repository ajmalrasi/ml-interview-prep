# MDIO ingestion — OpenTelemetry (OTEL) + Grafana integration

> **TEMP** — durable-ish ops / architecture reference; not tied to a user story.  
> **Path:** `docs/production/mdio-ingestion-otel-grafana.md`  
> **Updated:** 2026-07-17  
> **Related:** `00000-mdio-ingestion-architecture.md` (job path), package `telemetry-utils` (shared).

---

## What this covers

How **OpenTelemetry** is wired through the MDIO ingestion stack, where signals go (**traces / logs / metrics**), and how that feeds **Grafana** (via shared PGS backends: Mimir / Loki / trace collector).

**Not covered:** owning/editing Grafana dashboards themselves (platform/observability team); this doc is the **ingestion code + export path**.

---

## Mental model

| Signal | Produced by | Primary export path | Typical Grafana use |
|---|---|---|---|
| **Traces** | App spans via `telemetry_utils` | OTLP HTTP → shared traces collector (`10.21.58.4`) | Trace view / Tempo-like UI; join by `trace_id` / `request_id` |
| **Logs** | Same helper (`LoggingHandler` + stdout) | OTLP HTTP → shared logs collector (`10.21.58.6`) → **Loki** | Log panels; filter by promoted attrs (`request_id`, `task_id`, …) |
| **Metrics (pod CPU/mem)** | Sidecar `otelcol-contrib` in **ingest image** | OTLP HTTP → **Mimir** (`mimir.prod.shared.internal.pgsapps.io`) | % of allocated CPU/mem dashboards |
| **Business metrics (legacy)** | `tgs_dl_metrics` rows from ingest client | Postgres insert | Older / secondary; not the Grafana OTEL path |

Shared library: **`telemetry-utils`** (`get_otel_helper`, `OTelHelper`, Celery mixin in newer builds).  
Installed in images + local venv; not vendored inside this repo.

---

## End-to-end OTEL flow (ingestion)

```
UI / script
    │
    ▼
┌─────────────────────────────────────┐
│ Datastore API                       │
│ get_otel_helper("datastore-api"…)   │
│ Span: POST /seismic/datastore/…     │
│ Forwards header X-TGS-Traceparent   │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│ ApiHook                             │
│ get_otel_helper("ApiHook","dm20")   │
│ Span: POST /segy_to_multidim        │
│ Attrs: request_id, work_product_id, │
│        cloud.storage.object.name    │
│ Celery kwargs.opentelemetry =       │
│   { X-TGS-Traceparent: <parent> }   │
│ Logs: attrs promoted → Loki fields  │
└─────────────────┬───────────────────┘
                  │  Celery (SQS) + OTelCeleryTaskMixin
                  ▼
┌─────────────────────────────────────┐
│ RequestProcessor (subscriber)       │
│ Span: request_processor - subscriber│
│ Continues parent from Celery kwargs │
│ Writes task_log.trace_parent        │
└─────────────────┬───────────────────┘
                  │  Postgres (trace_parent column)
                  │  later: throttler → composer DAG
                  ▼
┌─────────────────────────────────────┐
│ MetadataHandler (K8s pod)           │
│ Span: metadatahandler               │
│ is_link=True from DB trace_parent   │
│ XCom: X-TGS-Traceparent + IDs       │
└─────────────────┬───────────────────┘
                  │  env X-TGS-Traceparent + REQUEST_ID/…
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Multidimio-Ingestion pod (segy_mdio_ingestion_task)          │
│                                                             │
│  ┌─ process: client.py ───────────────────────────────────┐ │
│  │ get_otel_helper("Multidimio-Ingestion", resource=IDs)  │ │
│  │ Span: segy_mdio_ingestion_task (parent from env)       │ │
│  │ Attr: ingestion_status = Success|Failed                │ │
│  │ Traces/logs → telemetry_utils default OTLP endpoints   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ same container: otelcol-contrib (command.sh) ─────────┐ │
│  │ Config: Multidimio-Ingestion/otel_config.yaml          │ │
│  │ Receiver: kubeletstats (pod CPU/mem, 20s)              │ │
│  │ Labels: request_id, task_id, project/product,          │ │
│  │         cpu_request/limit, memory_*_gb, dag_run_id…    │ │
│  │ Exporter: otlphttp → Mimir                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                  │
                  ▼
        Shared observability (PGS)
        traces / Loki / Mimir  →  Grafana dashboards
```

---

## Trace continuity (how one ingest stays one story)

Header / carrier name everywhere: **`X-TGS-Traceparent`** (W3C `traceparent` value).

| Hop | How context moves |
|---|---|
| Datastore → ApiHook | HTTP header `X-TGS-Traceparent` (datastore also sets from its span) |
| ApiHook → RequestProcessor | Celery task kwargs `opentelemetry.X-TGS-Traceparent`; `OTelCeleryTaskMixin` opens root span |
| RequestProcessor → DB | Column `dl_multidim_ingestion_task_log.trace_parent` |
| DB → MetadataHandler | Read at start; `@start_new_span(..., is_link=True)` links to prior context |
| MetadataHandler → ingest pod | XCom → DAG env var `X-TGS-Traceparent` |
| Ingest `client.main` | `@start_new_span("segy_mdio_ingestion_task", trace_parent=os.environ["X-TGS-Traceparent"])` |

**Link vs continue:** MetadataHandler uses **`is_link=True`** (span *link* to stored parent). Ingest client uses parent as **trace context** (continues chain). Either way Grafana/Tempo can correlate via shared IDs + links.

**Cancel path:** ApiHook cancel route also has `@start_new_span(...)`; datastore cancel proxy forwards `X-TGS-Traceparent` the same way as submit.

---

## Shared library: `telemetry_utils`

**Package:** `telemetry-utils` (e.g. 0.1.36 in local mdio venv). Author contact in package metadata: Saran.Viswa@tgs.com.

**Entry:** `get_otel_helper(service_name, service_namespace, environment, resource_attributes=..., is_test=...)`.

Typical service names in this stack:

| Component | `service.name` | `service.namespace` |
|---|---|---|
| Datastore | `datastore-api` | `dm20` |
| ApiHook | `ApiHook` | `dm20` |
| RequestProcessor | `RequestProcessor` | `dm20` |
| MetadataHandler | `MetadataHandler` | `dm20` |
| Ingest worker | `Multidimio-Ingestion` | `dm20` |

Also set: `service.environment.name` = `env` (dev/test/prod), and often `service.product` = `ingestion` on spans.

### Default OTLP endpoints (app SDK)

From `OTelHelper.__init__` defaults (unless overridden):

| Signal | Default URL |
|---|---|
| Traces | `http://10.21.58.4:80/v1/traces` |
| Logs | `http://10.21.58.6:80/otlp/v1/logs` |
| Metrics (SDK default; ingest pod metrics use sidecar→Mimir instead) | `http://10.21.58.3:80/otlp/v1/metrics` |

`is_test=True` → console exporters (nox / unit tests). `OTEL_SDK_DISABLED` used in some CI configs.

### Span decorator

`@otel_helper.start_new_span(name, trace_parent=..., attributes=..., is_link=...)`

- Pulls `X-TGS-Traceparent` from Flask/FastAPI request headers when present.
- `get_trace_parent_from_current_span()` for outbound propagation.

### Loki-friendly log fields

ApiHook / RequestProcessor / MetadataHandler add a logging **filter** that copies span attributes onto `LogRecord` (`request_id`, `task_id`, `work_product_id`, `cloud_storage_object_name`, …) so Loki can index them as structured metadata (comments in code say “for Loki”).

---

## Ingest pod: dual process (app + collector)

### Image build

`Multidimio-Ingestion/Dockerfile.aws` (and `.gcp`):

1. Copies **`otelcol-contrib` 0.149.0** into `/usr/bin/otelcol-contrib`
2. Copies **`otel_config.yaml`** → `/etc/otelcol/config.yaml`
3. Entrypoint **`command.sh`**

### `command.sh`

```bash
# background collector
/usr/bin/otelcol-contrib --config /etc/otelcol/config.yaml | tee otel-output.log &
# foreground ingest
exec …/python -u client.py -d "$1"
```

So metrics collection is **in-process sidecar** (same container), not a separate K8s sidecar pod.

### `otel_config.yaml` (metrics → Mimir)

| Piece | Value |
|---|---|
| Receiver | `kubeletstats` every **20s**, pod metrics, auth `serviceAccount`, endpoint `http://${NODE_NAME}:10255` |
| Filter | Keep only metrics for this pod (`k8s.pod.name` == `${POD_NAME}`) |
| Resource | `service.name=Multidimio-Ingestion`, `service.namespace=dm20`, `k8s.pod.name` |
| Attributes | `service.environment.name`, `service.product=ingestion`, `project_id`, `product_id`, `work_product_id`, `task_id`, `request_id`, `cloud.storage.object.name`, `dag_run_id`, **`cpu_request` / `cpu_limit` / `memory_request_gb` / `memory_limit_gb`** |
| Exporter | `otlphttp` → `http://mimir.prod.shared.internal.pgsapps.io:80/otlp` |

**Why CPU/mem request env vars:** Grafana dashboards compute **% of allocated**. Composer DAG `nodepool_selection_handler` returns request/limit; DAG injects:

- `CPU_REQUEST`, `CPU_LIMIT`, `MEMORY_REQUEST_GB`, `MEMORY_LIMIT_GB`
- Plus `NODE_NAME`, `POD_NAME` (Downward API)
- Plus business IDs from MetadataHandler XCom (`REQUEST_ID`, `TASK_ID`, `PROJECT_ID`, …)

See comments in `dags/airflow/*/dl_multidim_ingestion_composer_dag.py` (“OTel collector can label kubeletstats”).

---

## Code map (where to look)

| Area | Path |
|---|---|
| Datastore spans + outbound header | `seismic-store-framework/.../ingestion_router.py` |
| ApiHook spans + Celery propagate | `ApiHook/code/main.py` |
| Celery OTEL mixin task | `RequestProcessor/code/tasks.py` |
| Persist `trace_parent` | `RequestProcessor/code/utils.py` → `task_log_insertion` |
| Metadata link + XCom | `MetadataHandler/main.py`, `MetadataHandler/utils.py` `construct_xcom_results` |
| Ingest span + resource attrs | `Multidimio-Ingestion/client.py` |
| Collector config | `Multidimio-Ingestion/otel_config.yaml` |
| Collector start | `Multidimio-Ingestion/command.sh` |
| Image bake | `Multidimio-Ingestion/Dockerfile.aws` |
| Env for Mimir labels | `dags/airflow/*/dl_multidim_ingestion_composer_dag.py` (`segy_mdio_ingestion_env_vars`, nodepool selector) |
| Shared helper | site-packages `telemetry_utils/otel_helper.py` |

Other modules also call `get_otel_helper()` for nested spans: `ingestor.py`, `ingestion_qc.py`, `dask_tasks.py`, ApiHook `utils.py`, etc.

---

## Grafana (how to use it for ingestion)

Exact dashboard UIDs/URLs are **platform-owned** and not hard-coded in this repo. Practical filters that *do* work because of the wiring above:

| Goal | Filter / join on |
|---|---|
| One API submit | `request_id` (span attr + Loki field + Mimir label on ingest pod) |
| One file / Airflow run | `task_id`, `dag_run_id` |
| Product slice | `project_id`, `product_id`, `work_product_id` |
| SEG-Y object | `cloud.storage.object.name` / `SEGY_FILE_PATH` |
| Env | `service.environment.name` or `env` |
| Service hop | `service.name` ∈ {ApiHook, RequestProcessor, MetadataHandler, Multidimio-Ingestion, datastore-api} |
| Product tag | `service.product` = `ingestion`, `service.namespace` = `dm20` |
| CPU/mem pressure | Mimir kubeletstats series labeled with `cpu_*` / `memory_*_gb` |

**Trace search:** start from ApiHook or datastore span for the `request_id`, follow links through Celery → MetadataHandler → `segy_mdio_ingestion_task`.

**Log search (Loki):** same IDs after promotion filters; also plain stdout still in CloudWatch / kubectl for the pod.

---

## What is *not* OTEL/Grafana

| Thing | Notes |
|---|---|
| Postgres `tgs_dl_metrics` | Client still inserts max CPU/mem / timing rows — separate from Mimir |
| Airflow UI timings | Wall clock for DAG tasks; authoritative phase lines still in Airflow task logs |
| APIGW / ALB metrics | AWS native; not this `telemetry_utils` pipeline |
| Throttler DAG | No heavy OTEL pod; only SQL + `trigger_dag` |

---

## Failure / debug tips

| Symptom | Check |
|---|---|
| No traces for a request | Pods can reach `10.21.58.4`? `is_test` / `OTEL_SDK_DISABLED`? Batch export delay (~30s) |
| Broken chain after submit | Celery kwargs missing `opentelemetry`; subscriber mixin version; empty `task_log.trace_parent` |
| Metadata/ingest not linked | XCom missing `X-TGS-Traceparent`; env not injected in DAG |
| Empty Grafana CPU panels | Collector not started (`command.sh`); kubeletstats endpoint; filter dropped other pods; missing `CPU_REQUEST` env on retry XCom |
| Mimir export fail | Network to `mimir.prod.shared.internal.pgsapps.io`; see `otel-output.log` in pod |
| Loki missing IDs | Span attrs never set; promotion filter not attached to that service’s logger |

Local unit tests: mock `telemetry_utils` or set `is_test=true` so exporters stay console.

---

## Takeaways

1. **One library (`telemetry-utils`) + one header (`X-TGS-Traceparent`)** stitch the whole ingest path for traces/logs.
2. **Ingest metrics for Grafana % panels** come from **in-image `otelcol-contrib` + `otel_config.yaml` → Mimir**, labeled with Airflow-injected request/limit and business IDs.
3. **App traces/logs** go to shared internal OTLP collectors (`10.21.58.x`), then Grafana datasources (Tempo/Loki-style).
4. **`trace_parent` in Postgres** bridges async gap between Celery fan-out and MWAA-launched MetadataHandler/ingest pods.
5. Grafana dashboards are downstream of this export contract — change labels/`service.*` carefully or dashboards break.
6. Cross-link job architecture: `00000-mdio-ingestion-architecture.md`.
