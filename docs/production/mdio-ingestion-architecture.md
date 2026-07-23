# MDIO ingestion job — architecture handoff

> **TEMP** — durable-ish ops reference; not tied to a user story.  
> **Path:** `docs/production/mdio-ingestion-architecture.md`  
> **Updated:** 2026-07-17 (throttler + DAG diagrams + AWS/EKS plane)  
> **Scope:** AWS CloudDM path (GCP API Gateway / Composer retired for this surface). Cross-link cancel: `78473-kill-ingestion-jobs.md`.

---

## What “an ingestion job” is

One **request** can contain one or many SEG-Y files for one or more `work_product_id`s.

| Concept | Storage | Meaning |
|---|---|---|
| **Request** | `dl_multidim_ingestion_request_log` | One API submit; has `request_id`, overall status |
| **Task** | `dl_multidim_ingestion_task_log` | One SEG-Y → MDIO attempt; has `task_id`, `dag_run_id`, URIs, status |
| **DAG run** | MWAA Airflow | Throttler triggers composer run; worker executes `segy_mdio` (+ related) for a task |

Typical lifecycle for a task:

```
Received  →  (throttler DAG)  →  In-queue  →  Processing  →  Success | Failed
                 ↑
   RequestProcessor only creates task rows (still Received);
   it does not trigger Airflow
```

Request rollup (simplified): all Success → `CompletedSuccess`; all Failed → `CompletedFailed`; mix → `CompletedPartial`.

---

## End-to-end architecture (AWS)

```
┌──────────────────┐
│ Ingestion UI /   │  POST JSON { work_product_id: [segy_uris…] }
│ submit_ingestion │  Authorization: Bearer <Okta JWT>
│ scripts          │  optional ?overwrite=true
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│ AWS API Gateway                                              │
│ Name: tgs-dm-services-apigw-dev   ID: 1u63hjas0a             │
│ Host: seismic-api-aws-dev.datalake.tgs.com                   │
│ Authorizer: okta_jwt (CUSTOM)                                │
│ Maps Authorization → X-Forwarded-Authorization               │
│ Integration: HTTP_PROXY + VPC_LINK → internal ALBs           │
└────────┬─────────────────────────────────────────────────────┘
         │
         │  POST /seismic/datastore/segy_to_multidim
         ▼
┌──────────────────────────────────────────────────────────────┐
│ Datastore (seismic-store-framework)                          │
│ Pod: dl-seismic-datastore-srvc  ns: ns-seismic-framework     │
│ Claim gate: CA_GC_DataStore.Write                            │
│ Resolves headers / multidim_index_spec / builds body         │
│ Proxies to ApiHook via ingestion_url host                    │
└────────┬─────────────────────────────────────────────────────┘
         │
         │  POST /segy_to_multidim?overwrite=…
         ▼
┌──────────────────────────────────────────────────────────────┐
│ AWS APIGW again → multidimio ALB                             │
│ POST /segy_to_multidim                                       │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│ ApiHook (multidimio-ingestion-framework)                     │
│ Pod: dl-mdio-webhook-srvc  ns: ns-multidimio-framework       │
│ Claim gate: CA_GC_MdioCloudIngestion                         │
│ Auth header: X-Forwarded-Authorization                       │
│ Inserts request_log + task_log (status=Received)             │
│ Enqueues Celery: request_processor.subscribe                 │
│ Returns { message, requestId }                               │
└────────┬─────────────────────────────────────────────────────┘
         │
         │  Celery: request_processor.subscribe
         ▼
┌──────────────────────────────────────────────────────────────┐
│ RequestProcessor (subscriber pod)                            │
│ Pod: dl-mdio-subscriber-srvc  ns: ns-multidimio-framework    │
│ Fans request payload out to per-file task_log rows           │
│ Tasks remain status=Received until throttler picks them      │
└────────┬─────────────────────────────────────────────────────┘
         │
         │  Postgres task rows (Received)
         ▼
┌──────────────────────────────────────────────────────────────┐
│ MWAA — throttler DAG                                         │
│ DAG: dl_multidim_ingestion_throttler (every 1 min)           │
│ Reads Received vs Processing/In-queue; applies limits        │
│ Sets selected tasks → In-queue; TriggerDagRun → composer     │
└────────┬─────────────────────────────────────────────────────┘
         │
         │  trigger_dag(conf={request_id, task_id, …})
         ▼
┌──────────────────────────────────────────────────────────────┐
│ MWAA — composer / ingest DAG                                 │
│ DAG: dl_multidim_ingestion_composer_dag                      │
│ Worker: segy_mdio (+ QC, cleanup, optional FAPOC trigger)    │
│ Reads SEG-Y from S3 → writes MDIO → updates task status      │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────┐     ┌────────────────────┐
│ S3 SEG-Y / MDIO    │     │ Postgres RDS       │
│ load + seismic     │     │ task + request log │
│ buckets            │     │                    │
└────────────────────┘     └─────────┬──────────┘
                                     │
                                     ▼
                           ┌────────────────────┐
                           │ MSSQL SDE (on-prem)│
                           │ PPOC / Product hdr │
                           │ work_product_id    │
                           └────────────────────┘
```

---

## What happens inside each box

### Box A — Ingestion UI / `submit_ingestion.py`

**Role:** Human or agent entry point. Does **not** talk to Postgres or Airflow directly.

**Inside:**

1. User (or script) picks project/product or explicit `work_product_id` + SEG-Y S3 URIs.
2. Obtains Okta JWT (UI DevTools, or `generate_ingestion_token.py` → `~/.ingestion_bearer_token`).
3. Builds body map: `{ "<work_product_id>": ["s3://…/file.sgy", …] }`.
4. Optional checks (scripts): MSSQL path lookup, S3 storage-class / Glacier restore filter, exclusions YAML.
5. `POST` to public datastore ingest URL with `Authorization: Bearer …`, `Content-Type: application/json`, and on aws-dev often `Referer: https://dm-ingestion-dev.datalake.tgs.com/`.
6. Query flag `?overwrite=true|false` when re-ingesting over existing MDIO.
7. Parses response for **`requestId`**; later polls status / Postgres via `--track`.

**Outputs:** HTTP call into APIGW. **Does not** create DB rows itself.

---

### Box B — AWS API Gateway (first hop — datastore)

**Role:** Public edge for `seismic-api-aws-dev`. TLS termination, auth, routing to private ALBs.

**Inside:**

1. Match path/method against deployed OpenAPI (from GitLab IaC `openapi-paths-rest.yaml.tftpl` fragments).
2. Run **CUSTOM** authorizer `okta_jwt` on `Authorization` header (validate JWT signature/issuer/audience/expiry).
3. If path **not** in API → classic 403 `Invalid key=value pair…` / Missing Authentication Token (looks like SigV4; usually means “no resource”).
4. If auth fails → 401/403 from authorizer.
5. On success: **HTTP_PROXY** integration over **VPC Link** to seismic-framework internal ALB.
6. Rewrite headers: `integration.request.header.X-Forwarded-Authorization = method.request.header.Authorization` (pods never see raw APIGW IAM).
7. Forward body + query (`overwrite`) unchanged to datastore service.

**Config source:** GitLab `iac-tgsprod-nonprod-dm20-dev` → `seismic-api/` Terraform using module `dm20-terraform-aws-api-gateway`.

**Does not:** enrich SEG-Y metadata, write DB, or start Airflow.

---

### Box C — Datastore (`dl-seismic-datastore-srvc`)

**Role:** UI-facing business wrapper. Turns “WP + file list” into ApiHook’s rich `file_collection`.

**Inside (`file_ingestion` in `ingestion_router.py`):**

1. Read `X-Forwarded-Authorization`; claim gate **`CA_GC_DataStore.Write`** (`app-settings.json`).
2. For each `work_product_id` + each SEG-Y path in the map:
   - Load product config from **MSSQL SDE** (header attributes / bytes, MDIO index order, chunking, sparsity limits, non-regularized attrs).
   - Fail fast if **`multidim_index_spec` not available** for that WP (common UI misconfig).
   - Derive `seismic_linename` from filename patterns when needed (e.g. shot/line).
   - Append object to `file_collection`: `work_product_id`, `segy_uri`, `external_reference_id`, `extension_properties` (`multidim_index_spec`, `seismic_linename`, …).
3. Build ApiHook body:
   ```json
   { "external_application_id": "TGSONE", "file_collection": [ … ] }
   ```
4. `POST` to configured `ingestion_url` (dev: `https://seismic-api-aws-dev…/segy_to_multidim?overwrite=…`) with:
   - `Authorization: <same JWT string from X-Forwarded-Authorization>`
   - `X-TGS-Traceparent` for OTEL
5. Return ApiHook JSON (`requestId`) or map error `ErrorDescription` to client.

**Does not:** insert request/task rows (ApiHook does). **Does** heavy SDE / product-config work so UI stays thin.

---

### Box D — AWS API Gateway (second hop — ApiHook ingest)

**Role:** Same APIGW, different OpenAPI path: `POST /segy_to_multidim`.

**Inside:** Same authorizer + VPC Link pattern, but integration target is **multidimio-framework** ALB / ARN (`${multidimio_framework_url}`), not seismic datastore.

Again maps `Authorization` → `X-Forwarded-Authorization` for the webhook pod.

Why go public again? Datastore is configured with the **public** ingest URL (same host UI uses), so traffic exits pod → APIGW → back into cluster. (Could be internal URL in theory; today it is public host.)

---

### Box E — ApiHook webhook (`dl-mdio-webhook-srvc`)

**Role:** System of record for “ingest accepted.” Creates the **request** and kicks async fan-out.

**Inside (`hook_topic_publisher` / `POST /segy_to_multidim`):**

1. `HTTPTokenAuth` on **`X-Forwarded-Authorization`**; claim **`CA_GC_MdioCloudIngestion`**.
2. Parse JSON: `external_application_id`, `file_collection`; read `overwrite` query → `is_overwrite`.
3. Resolve `UserEmail`, `SapCustomerId` → SAP parent customer via MSSQL helper.
4. **Insert** `dl_multidim_ingestion_request_log` with status **`Received`** (email, overwrite, sap parent, full `file_collection` JSON).
5. **Celery** `send_task("request_processor.subscribe", kwargs={ request_id, opentelemetry traceparent })`.
6. Return `200 { "message": "Success", "requestId": <id> }` immediately — **does not wait** for task rows, Airflow, or MDIO write.

**Also hosts:** status `GET …/status/task/{id}`, cancel `POST …/cancel/request/{id}` (Received-only).

**Does not:** insert per-file task rows (RequestProcessor does), read SEG-Y, write MDIO, or call MWAA.

---

### Box F — Celery / message path

**Role:** Decouple HTTP accept from per-file task materialization.

**Inside:**

1. ApiHook uses `datalake_utils.CeleryFactory` + secrets for broker (MQ).
2. Task name `request_processor.subscribe` carries `request_id` (+ trace headers).
3. RequestProcessor workers consume the queue (Keda-scaled `dl-mdio-subscriber-srvc`).

If Celery/broker is down: **request** row exists as `Received` but **no task rows** yet — stuck before throttler can see work.

---

### Box G — RequestProcessor / subscriber (`dl-mdio-subscriber-srvc`)

**Role:** Fan-out. Turn one request payload into per-file **task_log** rows. **Does not** throttle or trigger Airflow.

**Code:** `RequestProcessor/` — Celery task `request_processor.subscribe` → `process_ingestion_request`.

**Inside:**

1. Load `dl_multidim_ingestion_request_log` by `request_id`; read stored `file_collection`.
2. Enrich from **MSSQL SDE** (project/product, bucket, region); validate one region per WP.
3. Ensure MDIO object-store bucket exists (GCP create/reuse; AWS uses configured bucket).
4. **Insert** one `dl_multidim_ingestion_task_log` row per SEG-Y — normally status **`Received`** (or `Failed` if bucket/index validation failed).
5. Done. Tasks sit in Postgres until the **throttler DAG** picks them.

**Race with cancel:** cancel only updates `status = 'Received'`. Once throttler sets `In-queue`, cancel no longer touches that task.

**Does not:** call MWAA, apply concurrency limits, or run SEG-Y→MDIO.

---

### Box H1 — MWAA throttler DAG (`dl_multidim_ingestion_throttler`)

**Role:** Concurrency gate + scheduler. Bridge between “tasks in DB as Received” and “composer DAG running.”

**Code:** `dags/airflow/{dev,test,prod,sm}/dl_multidim_ingestion_throttler.py`  
**Schedule:** every **1 minute** (`*/1 * * * *`), `max_active_runs=1`.  
**Config:** Airflow Variable `{env}mdio_ingest_throttle_spec` (`dag_run_concurrency_limit`, per-`project_type` `product_filesize_gb_limit` / `product_concurrency_limit`, target `dag_name`).

**Inside (`trigger_mdio_ingestion`):**

1. Postgres query: all tasks `status='Received'` (object_store = s3/gcs for this env), ordered by `created_date`, then sorted by **priority** desc.
2. Also load `Processing` + `In-queue` to compute how many slots are already used.
3. If `RUNNING_NOW < MAX_JOBS` (`dag_run_concurrency_limit`):
   - Walk Received tasks; respect **per-product** file-size (GB) and concurrency limits from `RUN_CONFIG`.
   - For each selected task: `UPDATE … SET status='In-queue'`, then **yield** conf `{request_id, task_id, application_id, resource_region, tenant_id, object_store}`.
4. `TriggerMultiDagRunOperator` calls `trigger_dag` for each conf → target DAG = `RUN_CONFIG["dag_name"]` (composer ingest DAG).

**Why it matters for cancel:** window where task is still `Received` = cancelable. After throttler run flips to `In-queue`, Phase-1 cancel skips it.

**Does not:** read SEG-Y or write MDIO (composer worker does).

---

### Box H2 — MWAA composer / ingest DAG (`dl_multidim_ingestion_composer_dag`)

**Role:** Actual SEG-Y → MDIO compute.

**Inside:**

1. Triggered by throttler with conf pointing at one task (`request_id` / `task_id` / …).
2. Scheduler places `segy_mdio` (and related QC/cleanup; optional FAPOC trigger) on workers.
3. Worker:
   - Reads SEG-Y from **S3** (`segy_uri`).
   - Uses MDIO library + index spec / chunking from task metadata.
   - Writes MDIO dataset to seismic bucket (`mdio_uri`).
   - Updates **Postgres** task status → `Success` or `Failed` (+ `comments` / JSON errors).
   - May update **PPOC** / cloud flags in SDE on success paths.
4. Wall-clock in Postgres spans scheduling + pod start + Dask/etc.; **authoritative phase timings** are in Airflow task logs (`Time taken to ingest…`, QC lines).

**Env:** `tgs-dev-mwaa` (dev). Logs via MWAA API or CloudWatch `airflow-*-Task`.

---

## Airflow DAGs — what each one does

Three DAGs in the ingest path (dev ids; test may prefix `test_`).

```
                         Postgres task_log
                               │
                               │  status = Received
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ 1) dl_multidim_ingestion_throttler                               │
│    Schedule: every 1 minute   max_active_runs=1                  │
│    Role: CAPACITY GATE + DISPATCHER                              │
│                                                                  │
│    • SELECT Received (+ count Processing/In-queue)               │
│    • Apply global dag_run_concurrency_limit                      │
│    • Apply per-product GB + concurrency limits (2D/3D/…)         │
│    • UPDATE selected → In-queue                                  │
│    • trigger_dag → composer (one run per selected task)          │
│                                                                  │
│    Does NOT: read SEG-Y, write MDIO, touch SDE PPOC              │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               │  conf = { request_id, task_id,
                               │           application_id, tenant_id,
                               │           resource_region, object_store }
                               │  schedule_interval = None (manual only)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2) dl_multidim_ingestion_composer_dag                            │
│    Role: ONE FILE SEG-Y → MDIO PIPELINE (K8s pods)               │
│                                                                  │
│    See task graph below. Ends with Success/Failed in Postgres.   │
│    Optionally triggers FAPOC DAG if product is FAPOC-eligible.   │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               │  only if ingest HTTP 200
                               │  AND AttributeCode includes FAPOC
                               │  conf = { multidim_path, work_product_id,
                               │           task_id, tenant_id, … }
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3) dl_multidim_fapoc_ingestion_dag                               │
│    Role: POST-INGEST ACCESS PATTERNS (FAPOC)                     │
│                                                                  │
│    • log_dag_start → config_collector → fapoc_job → log_dag_end  │
│    • Writes AccessPatternOnCloud / FAPOC catalog side effects    │
│                                                                  │
│    Not on critical path for “MDIO exists”; viewer/empty cuts     │
│    often fail here when FAPOC skipped or failed.                 │
└──────────────────────────────────────────────────────────────────┘
```

### DAG cheat sheet

| DAG | Trigger | Writes status? | Heavy compute? |
|---|---|---|---|
| **throttler** | Cron `*/1 * * * *` | `Received` → `In-queue` | No — SQL + `trigger_dag` only |
| **composer** | Throttler (manual run) | Via pods → Success/Failed (+ request rollup) | Yes — `segy_mdio_ingestion` |
| **fapoc** | Composer `fapoc_handler` (conditional) | FAPOC / access-pattern tables | Medium — separate K8s job |

Config Variable: `{env}mdio_ingest_throttle_spec` → `dag_name` (composer target), `dag_run_concurrency_limit`, per-`project_type` limits.

---

### Composer DAG — internal task graph (one ingest run)

```
config_collector
      │  Load kube config for region; stamp dag_run_id on task_log
      ▼
metadata_handler_task          (K8s: image__metadata_handler)
      │  Build multidim metadata / paths / QC flags for this task
      ▼
nodepool_selector_task
      │  Pick nodepool + resource sizing for ingest pod
      ▼
segy_mdio_ingestion_task       (K8s: image__segy_mdio_ingestion)
      │  THE WORK: SEG-Y → MDIO write; returns http_status / message
      ▼
ingest_status_check_task       (BranchPythonOperator)
      │
      ├─ http_status == 200 ──────────────────► product_onCloud_updater
      │                                         (K8s: mark MDIO on PPOC / SDE)
      │
      └─ else ────────────────────────────────► cleanup_task
                                                (K8s: remove partial MDIO)
      │
      └──────── both paths converge ──────────► task_table_updater
                                                (K8s: final task_log + request rollup)
                                                      │
                                                      ▼
                                                fapoc_handler
                                                (Python: maybe TriggerDagRun → FAPOC DAG;
                                                 else Skip)
```

**Branch rule:** success path updates cloud product metadata; failure path cleans orphan objects; **both** still run `task_table_updater` so Postgres reflects the outcome.

**Pod images** (from Variable `images__multidimio_ingestion_framework_{env}`):

| Task | Image key |
|---|---|
| metadata | `image__metadata_handler` |
| ingest | `image__segy_mdio_ingestion` |
| PPOC update | `image__product_onCloud_updater` |
| cleanup | `image__gcs_cleanup` (name historical; used on AWS too) |
| task log | `image__task_table_updater` |

---

### Status handoffs across DAGs

```
RequestProcessor          Throttler                 Composer pods              FAPOC
     │                        │                           │                      │
     │ INSERT task            │                           │                      │
     │ status=Received        │                           │                      │
     │───────────────────────►│                           │                      │
     │                        │ UPDATE In-queue           │                      │
     │                        │ + trigger_dag ───────────►│                      │
     │                        │                           │ Processing…          │
     │                        │                           │ Success | Failed     │
     │                        │                           │ (+ request rollup)   │
     │                        │                           │ optional trigger ───►│
     │                        │                           │                      │ access patterns
```

**Cancel window:** only while task still `Received` (before throttler). After `In-queue`, Phase-1 cancel does not touch it.

---

### Box I — S3 (SEG-Y / MDIO)


**Role:** Object store for inputs and outputs.

**Inside:**

| Direction | What |
|---|---|
| **Read** | Original SEG-Y in load buckets (`tgs-dm-seismic-load-…`) |
| **Write** | MDIO Zarr/store trees in seismic buckets |
| **Checks** | Storage class (Standard vs Glacier); restore before ingest |
| **Overwrite** | When `overwrite=true`, prior MDIO for that product/file may be replaced/deleted per worker logic |

Not a “service” with business logic — just storage the worker and UI paths reference by URI.

---

### Box J — Postgres RDS

**Role:** Operational source of truth for request/task lifecycle (for APIs, UI status, ops scripts).

**Inside:**

| Table | Written by | Contents |
|---|---|---|
| `dl_multidim_ingestion_request_log` | ApiHook (insert); later updates from RequestProcessor/DAG/cancel | `request_id`, status, email, overwrite, timestamps, `file_collection` |
| `dl_multidim_ingestion_task_log` | RequestProcessor (insert Received); throttler (`In-queue`); composer DAG; cancel | `task_id`, `request_id`, `dag_run_id`, URIs, status, comments, sizes, timings |

Status API and cancel read/update these tables. IAM auth via SSO profile (`tgs-sso`).

---

### Box K — MSSQL SDE (on-prem)

**Role:** Product catalog and SEG-Y→MDIO **configuration**, not the live job queue.

**Inside (used mainly by datastore submit path):**

1. Resolve **`work_product_id`** = `ProjectProduct.ProjectProductID`.
2. Load **`ProductHeaderAttribute`** (MDIO index dimension order, flags).
3. Load **`ProductHeaderBytes`** (byte ranges / types for headers).
4. **`ProjectProductOnCloud` / views** — which SEG-Y files exist on which bucket (script lookups).
5. Sap customer → parent customer mapping (ApiHook also uses MSSQL for this).

If index spec missing in SDE → datastore returns **400** before ApiHook is called.

---

## Mental model (one sentence per box)

| Box | One-liner |
|---|---|
| UI / script | Authenticated client that POSTs WP→SEG-Y map |
| APIGW (1) | JWT gate + route to datastore ALB |
| Datastore | Enrich from SDE; rebuild ApiHook payload; proxy |
| APIGW (2) | JWT gate + route to ApiHook ALB |
| ApiHook | Insert Received **request**; Celery notify; return requestId |
| Celery | Async transport of `request_id` |
| RequestProcessor | Fan-out → per-file task rows still **Received** |
| Throttler DAG | Every 1 min: Received→In-queue + trigger composer |
| Composer DAG | Convert SEG-Y→MDIO; update statuses |
| S3 | Bytes in / bytes out |
| Postgres | Job ledger |
| SDE | Product/header truth for how to index |

---

## Public API surface (ingestion)

### Hosts

| Env | Base host | Notes |
|---|---|---|
| **dev (AWS)** | `https://seismic-api-aws-dev.datalake.tgs.com` | What CloudDM AWS uses now |
| test | `https://seismic-api-test.datalake.tgs.com` | |
| prod | `https://seismic-api.datalake.tgs.com` | |

GCP seismic-api hosts / ADO `Infrastructure` GCP APIGW are **retired** for this path.

### Submit (UI / scripts)

```http
POST /seismic/datastore/segy_to_multidim?overwrite=true|false
Authorization: Bearer <JWT>
Content-Type: application/json
Referer: https://dm-ingestion-dev.datalake.tgs.com/   # used by submit_ingestion.py on aws-dev

{
  "<work_product_id>": [
    "s3://bucket/project/product/file.sgy",
    ...
  ]
}
```

Response (shape): success message + **`requestId`** (integer).

### Direct ApiHook ingest (internal / second hop)

```http
POST /segy_to_multidim?overwrite=…
```

Datastore `ingestion_url` in kustomize (dev example):

`https://seismic-api-aws-dev.datalake.tgs.com/segy_to_multidim?overwrite=true`

### Status

```http
GET /seismic/segy_to_multidim/status/task/{taskId}
GET /seismic/datastore/segy_to_multidim/status/task/{taskId}   # also registered; backends to ApiHook
```

### Cancel (related; see US 78473 handoff)

```http
POST /seismic/datastore/segy_to_multidim/cancel/request/{requestId}
POST /seismic/segy_to_multidim/cancel/request/{requestId}
```

Only cancels tasks still in **`Received`**. Architecture detail: `78473-kill-ingestion-jobs.md`.

---

## Auth model

| Hop | Mechanism |
|---|---|
| Browser / script → APIGW | `Authorization: Bearer` Okta JWT |
| APIGW | CUSTOM authorizer `okta_jwt`; rejects unregistered paths with SigV4-looking 403 |
| APIGW → pods | Injects `X-Forwarded-Authorization` from `Authorization` |
| Datastore | Claim allowlist `CA_GC_DataStore.Write` (+ SapCustomerId for submit) |
| ApiHook | Claim allowlist `CA_GC_MdioCloudIngestion`; **only** reads `X-Forwarded-Authorization` |
| Impersonation | Header `impersonated-organization` when JWT has `Impersonation: true` |

Token tooling: `pipeline-helper/ingestion-helper/scripts/generate_ingestion_token.py`  
Save path: `~/.ingestion_bearer_token`  
Submit: `scripts/submit_ingestion.py` (`--token` / env / file).

---

## Control plane vs data plane

### AWS accounts / SSO (region = `us-east-1`)

| Env | Account | SSO profile | EKS (typical) | MWAA | APIGW host |
|---|---|---|---|---|---|
| **dev** | `020028129893` | `tgs-sso` | `dm-dev-eks` | `tgs-dev-mwaa` | `seismic-api-aws-dev.datalake.tgs.com` |
| **test** | `960596858857` | `tgs-sso-test` | (env twin) | `tgs-test-mwaa` | `seismic-api-test.datalake.tgs.com` |
| **prod** | `320708867173` | `tgs-sso-prod` | `dm-eks` | `tgs-mwaa` | `seismic-api.datalake.tgs.com` |

Login on this VM: `aws sso login --profile <profile> --use-device-code` (never plain PKCE login).

---

### AWS topology diagram (dev)

```
                         Internet / UI / scripts
                                    │
                                    │  HTTPS + Bearer Okta JWT
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ AWS API Gateway                                                           │
│ tgs-dm-services-apigw-dev   id 1u63hjas0a                                 │
│ Host: seismic-api-aws-dev.datalake.tgs.com                                │
│ Authorizer: okta_jwt (CUSTOM)                                             │
│ Integration: HTTP_PROXY + VPC_LINK → private ALBs                         │
│ IaC: GitLab iac-tgsprod-nonprod-dm20-dev (NOT ADO Infrastructure / GCP)   │
└───────────────┬─────────────────────────────────────┬─────────────────────┘
                │                                     │
                │ /seismic/datastore/…                │ /segy_to_multidim
                │ → seismic ALB                       │ → multidimio ALB
                ▼                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Amazon EKS — dm-dev-eks   (acct 020028129893)                             │
│ Manifests: GitLab dm20-tgs-epam-aws-kubernetes  →  ArgoCD sync main       │
│ Images: ADO CI → ECR → kustomize newTag                                   │
│                                                                           │
│  ┌─ ns-seismic-framework ──────────────────────────────────────────────┐  │
│  │  dl-seismic-datastore-srvc   UI proxy + SDE enrich + cancel proxy   │  │
│  │  dl-seismic-filestore-srvc   SEG-Y header / inspect (related)       │  │
│  │  Ingress Prefix: /seismic/datastore/segy_to_multidim                │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─ ns-multidimio-framework ───────────────────────────────────────────┐  │
│  │  dl-mdio-webhook-srvc      ApiHook (accept / status / cancel)       │  │
│  │  dl-mdio-subscriber-srvc   RequestProcessor (Celery consumer)       │  │
│  │  Ingress Prefix: /segy_to_multidim , …/status/task                  │  │
│  │  Broker: Celery → MQ (ApiHook enqueue → subscriber drain)           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─ ingest worker pods (spawned by MWAA KubernetesPodOperator) ────────┐  │
│  │  Namespace from Airflow Variable kube_namespace (ingest config)     │  │
│  │  metadata_handler | segy_mdio_ingestion | product_onCloud_updater   │  │
│  │  cleanup | task_table_updater | fapoc_job                           │  │
│  │  Scheduled onto Karpenter nodepools (x86 / graviton highcpu, …)     │  │
│  │  e.g. np-c4-highcpu-96-mdio-ingest-on-demand                        │  │
│  │       np-c4-highcpu-96-mdio-ingest-graviton-on-demand               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
                ▲                     │                       │
                │ K8s API             │ Postgres IAM          │ s3://
                │ (pod launch)        │                       │
┌───────────────┴──────────┐  ┌───────▼──────────┐  ┌─────────▼──────────────┐
│ Amazon MWAA              │  │ RDS Postgres     │  │ S3                     │
│ tgs-dev-mwaa             │  │ tgs-dm-postgres- │  │ load: SEG-Y input      │
│ Schedules:               │  │   dev.…rds…      │  │   tgs-dm-seismic-load- │
│  • throttler (*/1)       │  │ DB: segyfile-    │  │   dev-us-east-1-1      │
│  • composer (triggered)  │  │   cuttingdatabase│  │ seismic: MDIO output   │
│  • fapoc (optional)      │  │ Auth: RDS IAM    │  │   tgs-dm-seismic-…     │
│ UI: *.airflow.us-east-1  │  │   + SSO profile  │  │ Glacier: restore first │
│   .on.aws                │  └──────────────────┘  └────────────────────────┘
└──────────────────────────┘
                │
                │ also reads/writes via hooks
                ▼
        ┌───────────────────┐
        │ MSSQL SDE (on-prem│
        │ 10.x — not AWS)   │
        │ Product headers / │
        │ PPOC / FAPOC flags│
        └───────────────────┘
```

**Key split:** long-lived **API pods** live in EKS namespaces above. **Heavy ingest pods** are short-lived — created by MWAA `KubernetesPodOperator`, not by Argo Deployments.

---

### Control plane — AWS API Gateway

| Item | Dev value |
|---|---|
| Name | `tgs-dm-services-apigw-dev` |
| ID | `1u63hjas0a` |
| Account | `020028129893` |
| Region | `us-east-1` |
| Stage | `dev` |
| Public host | `seismic-api-aws-dev.datalake.tgs.com` |
| Integration | `HTTP_PROXY` + `VPC_LINK` → internal ALBs |
| Terraform module | `dm20-terraform-aws-api-gateway` (GitLab Energize) |

**OpenAPI template vars:** `${conn_id}` (VPC Link), `${seismic_framework_url|arn}`, `${multidimio_framework_url|arn}`.

**Route definitions (OpenAPI fragments):**

GitLab IaC (dev):

https://gitlab.pgs.com/energize/aws/account-landing-zones/nonproduction/tgsprod-nonprod-dm20-dev/iac-tgsprod-nonprod-dm20-dev

Key file for ingest paths:

`seismic-api/static-assets/specs/ingestion-api/openapi-paths-rest.yaml.tftpl`

Also: datastore-api, filestore-api, delivery-api, … under `seismic-api/static-assets/specs/`.

Module (generic OpenAPI→APIGW):

https://gitlab.pgs.com/energize/aws/modules/dm20-tgs-epam-aws/dm20-terraform-aws-api-gateway

| Env | IaC repo |
|---|---|
| test | `…/iac-tgsprod-nonprod-dm20-test` |
| prod | `…/iac-tgsprod-prod-dm20` |

**Deploy APIGW changes:** MR on IaC → Terraform apply for `seismic-api` (infra pipeline). **Not** ArgoCD. **Not** ADO Infrastructure GCP.

**Missing route symptom:** `403 Invalid key=value pair…` on Bearer (APIGW treats JWT as SigV4).

---

### Data plane — EKS

| Item | Dev |
|---|---|
| Cluster | `dm-dev-eks` |
| ARN | `arn:aws:eks:us-east-1:020028129893:cluster/dm-dev-eks` |
| Account | `020028129893` |
| Region | `us-east-1` |
| Manifests | GitLab `dm20-tgs-epam-aws-kubernetes` (kustomize `newTag`) |
| Sync | ArgoCD → GitLab **`main`** |
| Scaling | Karpenter nodepools (ingest on-demand / graviton) |
| App logs | kubectl preferred; also `/aws/containerinsights/dm-dev-eks/application` |

| Workload | Namespace | Role |
|---|---|---|
| `dl-seismic-datastore-srvc` | `ns-seismic-framework` | UI API proxy + SDE lookups |
| `dl-seismic-filestore-srvc` | `ns-seismic-framework` | SEG-Y inspect / headers (related) |
| `dl-mdio-webhook-srvc` | `ns-multidimio-framework` | ApiHook — accept ingest, cancel, status |
| `dl-mdio-subscriber-srvc` | `ns-multidimio-framework` | RequestProcessor — fan-out task rows |
| `metadata_handler` / `segy_mdio_ingestion` / … | ingest ns (from Airflow var) | Ephemeral MWAA-launched pods |

Example images observed 2026-07-17:

- webhook: `tgs-segy-multidim-ingest-webhook:2026.07-dev-301118`
- datastore: `tgs-segy-datastore-webhook:2026.07-dev-301110`
- subscriber: `tgs-segy-multidim-subscriber:2026.05-sm-291306`

**kubectl (dev):**

```bash
export AWS_PROFILE=tgs-sso
aws eks update-kubeconfig --name dm-dev-eks --region us-east-1
kubectl -n ns-multidimio-framework get pods -l app=dl-mdio-webhook-srvc
kubectl -n ns-seismic-framework get pods -l app=dl-seismic-datastore-srvc
kubectl -n ns-multidimio-framework logs -l app=dl-mdio-subscriber-srvc --tail=100
```

#### Deploy path — API pods vs ingest images

```
ADO build (multidimio / seismic-store)
        │
        ▼
     Amazon ECR   (repos per image — see table below)
        │
        ├──────────────────────────────────────┐
        │                                      │
        ▼                                      ▼
 GitLab kustomize newTag              MWAA Variable
 dm20-tgs-epam-aws-kubernetes         images__multidimio_ingestion_framework_{env}
        │                                      │
        ▼                                      ▼
     ArgoCD sync                          KubernetesPodOperator
   API Deployments                        (composer / fapoc tasks)
   webhook + datastore + subscriber       metadata / segy_mdio / …
```

| Kind | How it lands on cluster |
|---|---|
| ApiHook / datastore / subscriber | ECR tag pinned in GitLab kustomize → Argo |
| Composer / FAPOC worker images | ECR URI in MWAA Variable → pod created at run time |
| DAGs themselves | ADO CD **1657** / MWAA DAG sync — **does not** deploy API webhooks |

#### ECR repos (ingest workers)

| Airflow image key | ECR repository |
|---|---|
| `image__metadata_handler` | `tgs-segy-multidim-metadata` |
| `image__segy_mdio_ingestion` | `multidimio-ingestion` |
| `image__product_onCloud_updater` | `tgs-segy-multidim-product-on-cloud` |
| `image__task_table_updater` | `tgs-segy-multidim-task-log-updater` |
| `image__gcs_cleanup` | `tgs-segy-multidim-gcs-cleanup` (name historical; used on AWS) |

API images (examples): `tgs-segy-multidim-ingest-webhook`, `tgs-segy-datastore-webhook`, `tgs-segy-multidim-subscriber`.

#### Ingress (ALB path Prefixes)

**Multidimio** (`ns-multidimio-framework`):

- `/segy_to_multidim`
- `/seismic/segy_to_multidim/status/task`
- Cancel may need Prefix `/seismic/segy_to_multidim/cancel` after APIGW routes exist (verify)

**Seismic** (`ns-seismic-framework`):

- `/seismic/datastore/segy_to_multidim` (Prefix covers nested cancel once APIGW routes it)

APIGW owns public reachability; ALB Prefixes must still match what APIGW forwards.

#### Nodepools (large-file ingest)

Composer `nodepool_selection_handler` picks pool from Airflow Variable (file size + graviton flag). Examples on dev:

- `np-c4-highcpu-96-mdio-ingest-on-demand` (x86)
- `np-c4-highcpu-96-mdio-ingest-graviton-on-demand` (arm64)

Karpenter consolidation can evict long-running ingest pods if `do-not-disrupt` / PDB missing — common large-file failure mode (see US 80158 notes).

---

### Compute — MWAA

| Env | MWAA name | Account | Throttler DAG | Composer DAG |
|---|---|---|---|---|
| dev | `tgs-dev-mwaa` | `020028129893` | `dl_multidim_ingestion_throttler` | `dl_multidim_ingestion_composer_dag` |
| test | `tgs-test-mwaa` | `960596858857` | `test_dl_multidim_ingestion_throttler` | `test_dl_multidim_ingestion_composer_dag` |
| prod | `tgs-mwaa` | `320708867173` | `dl_multidim_ingestion_throttler` | `dl_multidim_ingestion_composer_dag` |

| Item | Dev notes |
|---|---|
| Region | `us-east-1` |
| Web UI | `https://563db91c-b7a6-400f-a8dc-11c553929b14.c21.airflow.us-east-1.on.aws` (or `aws mwaa get-environment`) |
| Throttler | every **1 minute** |
| Composer | `schedule_interval=None` — only via throttler `trigger_dag` |
| Image Variable | `images__multidimio_ingestion_framework_dev` |
| Throttle Variable | `mdio_ingest_throttle_spec` → `dag_name`, limits |
| Task logs | MWAA UI / `InvokeRestApi`; CloudWatch `airflow-tgs-dev-mwaa-Task` |
| Prod Task logs | `airflow-tgs-mwaa-Task` (acct `320708867173`) |
| Container Insights | `/aws/containerinsights/dm-dev-eks/…` (dev); prod often `dm-eks` |

Ops scripts: `download_airflow_logs.py`, `diagnose_failures.py` in `pipeline-helper/ingestion-helper/`.

**MWAA ↔ EKS:** composer tasks call EKS API (conn / service account from Airflow Variables) to create pods. Throttler only talks to **RDS** + Airflow metadata (no heavy pods).

---

### Data stores on AWS

| Store | Dev example | Auth |
|---|---|---|
| RDS Postgres | `tgs-dm-postgres-dev.cqni46acoh38.us-east-1.rds.amazonaws.com` / `segyfilecuttingdatabase` | RDS IAM + SSO |
| S3 SEG-Y load | `s3://tgs-dm-seismic-load-dev-us-east-1-1/…` | IAM |
| S3 MDIO / seismic | `s3://tgs-dm-seismic-…` (env-specific) | IAM |
| ECR | account ECR repos above | IAM |
| Secrets | Vault / AWS secrets referenced by pods | IRSA / SA |

MSSQL SDE stays **on-prem** (`10.x`) — reached from EKS / tooling over private network, not an AWS managed DB.

---

## Application layers (code repos)

| Layer | ADO / GitLab repo | Responsibility |
|---|---|---|
| Datastore API | ADO `seismic-store-framework` | `/seismic/datastore/segy_to_multidim` wrapper; builds `file_collection`, calls ApiHook |
| ApiHook | ADO `multidimio-ingestion-framework` | Persist **request**; Celery enqueue; status; cancel |
| RequestProcessor | same repo + image `tgs-segy-multidim-subscriber` | Fan-out → task_log (`Received`) |
| Throttler DAG | `dags/airflow/*/dl_multidim_ingestion_throttler.py` | Concurrency gate; Received→In-queue; trigger composer |
| Composer DAG / worker | `dl_multidim_ingestion_composer_dag` + MDIO lib | SEG-Y→MDIO, QC, PPOC updates |
| K8s manifests | GitLab `dm20-tgs-epam-aws-kubernetes` | Deployments, ingress, env config |
| APIGW OpenAPI | GitLab `iac-tgsprod-nonprod-dm20-*` | Public routes |

### ApiHook accept path (high level)

1. Validate JWT / claims.
2. Parse body (`external_application_id`, `file_collection` with `segy_uri`, `work_product_id`, `multidim_index_spec`, …).
3. Insert `dl_multidim_ingestion_request_log` → `request_id` (status `Received`).
4. `request_processor.subscribe` on Celery.
5. Return `requestId` to caller.

### RequestProcessor + throttler (high level)

1. RequestProcessor: enrich from SDE; insert per-file `task_log` rows status **`Received`**.
2. Throttler DAG (cron 1 min): pick eligible Received under global + per-product limits.
3. Set those tasks **`In-queue`**; `trigger_dag` → composer with task conf.
4. Composer worker: SEG-Y→MDIO; status → Success/Failed.

### Datastore wrapper (high level)

1. Validate Write claim.
2. Expand WP → SEG-Y list / enrich from SDE (header bytes, index spec, line name).
3. POST enriched payload to ApiHook ingest URL.
4. Return ApiHook `requestId` to UI.

---

## Data stores

### Postgres (`segyfilecuttingdatabase` via RDS IAM)

| Table | Use |
|---|---|
| `dl_multidim_ingestion_request_log` | request_id, status, timestamps, email, overwrite flag, … |
| `dl_multidim_ingestion_task_log` | task_id, request_id, dag_run_id, segy_uri, mdio_uri, status, comments, sizes, timings |
| `dl_mdio_store_catalog` | MDIO catalog |
| `dl_mdio_fapoc_log` | FAPOC (post-ingest access patterns) — separate DAG |

Connect via `pipeline-helper` `utils.db.connect(env=…)`. Needs AWS SSO (`tgs-sso` / `tgs-sso-prod`).

### MSSQL SDE

| Object | Use |
|---|---|
| `ProjectProduct` / `ProjectProductOnCloud` | SEG-Y paths, buckets, `work_product_id` (= `ProjectProductID`) |
| `ProductHeaderAttribute` / `ProductHeaderBytes` | MDIO index order + SEG-Y byte locations |
| `v_ProjectProductOnCloud` | Joined view (eligibility / FAPOC) |

### Object storage

- Load buckets (SEG-Y): e.g. `tgs-dm-seismic-load-dev-us-east-1-1`
- Seismic / MDIO buckets: env-specific `tgs-dm-seismic-…`
- Glacier / archive: check before submit (`submit_ingestion.py` archive filter)

---

## Status model (tasks / requests)

**Task statuses (common):** `Received`, `In-queue` / queue variants, `Processing`, `Success`, `Failed`, …

**Request statuses (common):** `Received`, `Submitted`, `CompletedSuccess`, `CompletedFailed`, `CompletedPartial`, …

**Cancel (current product behavior):** only `Received` → `Failed` + `comments = 'Cancelled by <email>'`; request rollup via existing helper. See `78473-kill-ingestion-jobs.md`.

---

## Ingress notes (EKS ALB)

See **Data plane — EKS → Ingress** above (Prefixes + APIGW vs ALB split). Detail for cancel path: `78473-kill-ingestion-jobs.md`.

---

## Operator toolkit (`pipeline-helper`)

Always: `source ~/mdio/bin/activate` and AWS SSO device-code login.

| Script | Use |
|---|---|
| `scripts/submit_ingestion.py` | Submit / track requests |
| `scripts/generate_ingestion_token.py` | Save UI/machine token |
| `scripts/diagnose_failures.py` | Failure classification |
| `scripts/download_airflow_logs.py` | Raw MWAA/CloudWatch task logs |
| `scripts/collect_ingestion_metrics.py` | Counts / volume |
| `scripts/resolve_ingestion_runs.py` | Map product/date → runs |

Config: `ingestion-helper/config/config.yaml` (postgres, mssql, mwaa per env).

---

## Sequence — successful ingest

```
UI/script  APIGW  Datastore  APIGW  ApiHook  ReqProcessor  ThrottlerDAG  ComposerDAG  Postgres/S3
    │        │        │        │       │          │             │             │            │
    │ POST WP→segys   │        │       │          │             │             │            │
    │───────►│───────►│        │       │          │             │             │            │
    │        │        │ enrich │       │          │             │             │            │
    │        │        │ POST /segy_to_multidim    │             │             │            │
    │        │        │───────►│──────►│          │             │             │            │
    │        │        │        │       │ INSERT request Received│             │            │
    │        │        │        │       │──────────────────────────────────────────────────►│
    │        │        │        │       │ Celery subscribe       │             │            │
    │        │        │◄───────│◄──────│ requestId│             │             │            │
    │◄───────│◄───────│        │       │          │             │             │            │
    │        │        │        │       │          │ INSERT tasks Received     │            │
    │        │        │        │       │          │───────────────────────────────────────►│
    │        │        │        │       │          │             │ poll every 1m            │
    │        │        │        │       │          │             │◄── SELECT Received ──────│
    │        │        │        │       │          │             │ UPDATE In-queue ────────►│
    │        │        │        │       │          │             │ trigger_dag ─►│          │
    │        │        │        │       │          │             │             │ read SGY   │
    │        │        │        │       │          │             │             │ write MDIO │
    │        │        │        │       │          │             │             │ UPDATE Success/Failed
```

---

## Common failure points

| Layer | Failure | What to check |
|---|---|---|
| APIGW | 403 Invalid key=value with Bearer | Path not in OpenAPI / not applied |
| APIGW | 401 Unauthorized | Bad/expired JWT |
| Datastore | 403 Not Authorized | Missing Write claim / missing X-Fwd-Auth |
| ApiHook | 401 | Missing Mdio claim or wrong auth header |
| Submit | Rejected archive | Glacier without restore |
| Task Failed | App error in `comments` / Airflow log | `diagnose_failures`, download logs |
| Stuck before tasks | Celery / RequestProcessor down | Subscriber pod logs; request row exists, task_log empty |
| Stuck Received (tasks exist) | Throttler / capacity | MWAA throttler DAG runs; `mdio_ingest_throttle_spec` limits; In-queue/Processing count |
| Success but viewer empty | FAPOC / AccessPatternOnCloud | Separate FAPOC flow |

---

## Env cheat sheet

| Need | Dev |
|---|---|
| SSO profile | `tgs-sso` (device code) |
| EKS context | `dm-dev-eks` |
| APIGW host | `seismic-api-aws-dev.datalake.tgs.com` |
| UI | `https://dm-ingestion-dev.datalake.tgs.com/` |
| MWAA | `tgs-dev-mwaa` |
| Postgres | via `connect(env='dev')` |
| kubectl logs webhook | `-n ns-multidimio-framework -l app=dl-mdio-webhook-srvc` |
| kubectl logs datastore | `-n ns-seismic-framework -l app=dl-seismic-datastore-srvc` |
| kubectl logs subscriber | `-n ns-multidimio-framework -l app=dl-mdio-subscriber-srvc` |

---

## Related handoffs / docs

| Doc | Topic |
|---|---|
| `~/pipeline-helper/handoffs/78473-kill-ingestion-jobs.md` | Cancel API full architecture |
| `~/pipeline-helper/handoffs/00000-ingestion-otel-grafana.md` | OTEL + Grafana / Mimir / Loki wiring |
| `pipeline-helper/.cursor/rules/python-venv.mdc` | Scripts, DB tables, SSO |
| `pipeline-helper/.cursor/rules/aws-sso-login.mdc` | Device-code login |
| `../ai-dm/` (if present) | Cross-repo MDIO KB |

---

## Takeaways

1. **One ingest = request + N tasks + throttler handoff + composer DAG run(s).**
2. **RequestProcessor ≠ throttler.** Subscriber fans out task rows; **`dl_multidim_ingestion_throttler`** (every 1 min) moves Received→In-queue and triggers composer.
3. **AWS split:** APIGW (GitLab IaC) → EKS API pods (Argo) → MWAA schedules work → **ephemeral EKS pods** do SEG-Y→MDIO → RDS/S3.
4. **Two image paths:** API Deployments via GitLab kustomize+Argo; ingest images via MWAA Variable + `KubernetesPodOperator`.
5. **Public entry is always datastore path** for UI; ApiHook is second hop (and status/cancel can be direct).
6. **Auth:** APIGW JWT → `X-Forwarded-Authorization` → claim allowlists in each app.
7. **Authoritative timings** for “how long did ingest take?” are Airflow logs, not only Postgres timestamps.
8. **work_product_id** = SDE `ProjectProduct.ProjectProductID` when no Postgres history.
9. **Phase-1 cancel** only hits tasks still `Received` — race against the next throttler tick.
10. **GCP APIGW / ADO Infrastructure** retired for this surface — use GitLab AWS IaC + `dm-*-eks` only.
