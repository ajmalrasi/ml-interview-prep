# Deployment, Observability & Security

**TL;DR:** Keep FastAPI stateless, externalize durable state, observe every stage with one correlation ID, enforce access before retrieval, and design explicit degraded behavior for each dependency.

> **In simple words — what this page teaches:** Learn how the system is deployed, how traces, logs, and metrics reveal where a file or query failed, and how security and recovery work in production.

## Deployment model

Containerize the FastAPI service with pinned dependencies and a non-root runtime. Deploy to EKS/GKE or a managed container service according to team/platform needs.

- readiness: process can serve and required dependencies/policies are available
- liveness: process/event loop is healthy; do not restart merely because one provider is down
- autoscaling: concurrency, CPU, in-flight requests, and latency—not CPU alone
- rollout: rolling or canary deployment with automated health/quality checks
- rollback: prior container image, prompt/config version, and stable OpenSearch alias

OpenSearch, object storage, the ingestion manifest, and provider services remain external state. FastAPI replicas can be replaced without data loss.

Terraform defines IAM, networking, storage, compute, OpenSearch, observability, and environment configuration. CI/CD runs unit/contract tests, security scans, evaluation regressions, image publication, deployment, and post-deploy checks.

## Control plane vs data plane

Keep expensive file processing separate from the services that accept and schedule it:

| Plane | Responsibilities | Typical components |
|---|---|---|
| Control plane | authenticate, accept, persist status, fan out tasks, throttle, schedule, cancel | API gateway, stateless APIs, queue, request/task database, Airflow scheduler |
| Data plane | range-read files, decode, convert, validate, embed, write outputs | short-lived Kubernetes workers, object storage, embedding workers, OpenSearch bulk indexer |

This separation lets the API respond quickly and lets interrupted data-plane work replay from durable state. Retrying a control-plane message must not create duplicate expensive work, which is why immutable versions and deterministic task/document IDs matter.

## Spot vs on-demand

Use spot for idempotent, checkpointed Airflow extraction, embedding, reindex, and backfill workers. Expect interruption.

Do not make the always-on serving baseline exclusively spot. Keep reliable minimum replicas for availability; use spot only as optional burst capacity when the platform supports safe fallback.

## Observability: traces, logs, and metrics

Observability must continue across HTTP, queues, databases, Airflow, and short-lived workers:

```text
API span
  → trace context in queue message
  → subscriber span
  → trace context stored with task_id
  → Airflow reads it into workflow state
  → worker receives it through environment/config
  → extraction, QC, embedding, and indexing spans
```

Use a W3C-compatible trace carrier. Continue the parent trace when the next operation is a direct child. Use a span link when work starts much later or is scheduled independently. Persisting trace context with the task bridges the gap between the queue consumer and a later scheduler run.

| Signal | What it answers | Useful correlation fields |
|---|---|---|
| Traces | Which hop or phase was slow or failed? | `trace_id`, `request_id`, `task_id`, workflow run |
| Logs | What happened, with what error and inputs? | request/task IDs, product/file ID, safe object locator |
| Metrics | Is the system unhealthy or approaching capacity? | service, environment, queue, worker pool, index generation |

Application traces and structured logs are exported through OTLP. Infrastructure and worker CPU/memory metrics are collected separately and visualized with the same safe business identifiers in Grafana. Do not put secrets, tokens, raw confidential headers, or unrestricted object contents into telemetry.

### Debug one file from start to finish

1. Start with `request_id`; confirm that the accepted request exists.
2. Find its `task_id` and current state.
3. If no task exists, inspect queue delivery and the subscriber.
4. If it is `Received`, inspect throttler capacity and configuration.
5. If it is `In-queue`, inspect scheduler launch and worker placement.
6. If it is `Processing` or `Failed`, open the linked trace and workflow logs.
7. Confirm output/QC publication and the RAG index generation before checking online retrieval.
8. Use Grafana metrics to decide whether the incident is isolated or system-wide.

Telemetry itself can fail. Ingestion should normally continue if OTLP export is unavailable, while local logs and an alert reveal the observability gap.

## Observability: six operational views

| View | Examples |
|---|---|
| Infrastructure | CPU, memory, disk, network, pod restart/eviction, node and OpenSearch health |
| Application | request rate, p50/p95/p99, errors, queue depth, retries, 429s, circuit state |
| Data quality | decode failure, missing fields, schema drift, quarantine rate, freshness, duplicates |
| Retrieval | zero results, filters, source mix, score/margin shifts, sampled Recall@K |
| Generation | faithfulness/citation samples, abstention, tokens, provider latency, cost |
| Business | adoption, successful search, time-to-answer, feedback, escalation rate |

Instrument discovery, extraction, normalization, embedding, indexing, authentication, retrieval, reranking, and generation with OpenTelemetry. Export traces/metrics/log correlation through OTLP. Grafana dashboards and alerts join them by correlation ID, object version, ingestion run, index generation, and query ID.

Alerts should be actionable: ingestion freshness breach, sustained 429s, quarantine spike by vendor, OpenSearch shard/latency issue, citation coverage drop, p95/cost budget breach, or authorization-denied anomaly.

## Security and governance

- workload identity and least-privilege IAM per component
- TLS in transit and managed encryption keys at rest
- private subnets/endpoints and controlled egress
- secrets manager, rotation, and no secrets in images/logs
- server-derived tenant/project filters applied before retrieval
- field/document-level restrictions where project policy requires them
- audit user, query, filters, sources, index/model/prompt versions, and outcome
- redact or exclude restricted fields before indexing
- cache keys include permission context and data/index generation
- retention, re-index deletion, and source-object deletion propagation

Prompt instructions are a soft control. IAM, query filters, network policy, schemas, and output validation are hard controls.

## Failure playbook

| Failure | Detection | Response |
|---|---|---|
| Request exists, no tasks | accepted request has no child rows | inspect queue delivery/subscriber; replay fan-out idempotently |
| Tasks stuck `Received` | task age and queue-depth alert | inspect throttler schedule, limits, and active capacity |
| Task stuck `In-queue` | scheduler/startup latency alert | inspect workflow trigger, worker placement, quota, and image pull |
| Malformed EBCDIC | decode plausibility/schema failure | preserve bytes, fallback decode, confidence flag, quarantine |
| Parser crash | task exception/heartbeat | bounded retry, checkpoint, dead-letter with parser version |
| S3/GCS throttling | 429/503 metrics | jittered backoff, lower concurrency, quota coordination |
| Worker eviction | task heartbeat/lost pod | replay same work ID from last durable stage |
| Partial index update | bulk item failures/count mismatch | retry deterministic items; never publish incomplete generation |
| Broken trace chain | missing parent/link after an async hop | verify queue carrier, persisted trace context, workflow handoff, and worker injection |
| Telemetry exporter outage | export errors or missing spans/metrics | keep workload running, retain local logs, alert and repair export path |
| OpenSearch outage | timeout/circuit open | fail clearly or serve only explicitly safe versioned cache |
| LLM outage | provider timeout/errors | approved fallback or return retrieved evidence without synthesis |
| Re-ingestion | new immutable object version | build replacement generation, verify, publish, retire stale docs |
| Embedding migration | new vector space | dual/versioned index, evaluate, backfill, alias cutover, rollback |

## Drift and degradation

- **Data drift:** new vendors/encodings, schema-field distribution shifts, quarantine changes.
- **Retrieval degradation:** lower labeled Recall@K, more zero-result queries, score/source-mix shifts.
- **Generation degradation:** citation/faithfulness/abstention shifts after model or prompt changes.
- **Cost drift:** longer contexts, more reranking, provider price/model changes, repeated retries.

Every detection needs a runbook owner, threshold rationale, and a tested response. A dashboard without a decision is decoration.
