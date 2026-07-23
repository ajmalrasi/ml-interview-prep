# Failure Scenarios & Production Debugging

**TL;DR:** Debug by the last trustworthy boundary, not by reading every log. Start with the trace and version chain, identify whether the failure is freshness, extraction, indexing, retrieval, generation, or authorization, then inspect that stage’s evidence.

## The debugging model

For every incident, ask:

1. Which user query or source update is affected?
2. Which source, index, embedding, prompt, model, and service versions were used?
3. What is the last stage with trustworthy output?
4. Is the symptom isolated to one object/project/query cohort or system-wide?
5. Is retry safe, or would it duplicate/overwrite work?
6. What is the correct degraded behavior?

One trace narrows the search. Version metadata explains which artifacts participated.

## Debug an offline update

```text
S3 event
  → SQS consumer
  → Airflow workflow
  → extraction
  → normalization
  → embedding
  → candidate index
  → evaluation
  → promotion
```

Walk left to right:

- **No event or growing event age:** inspect S3 notification configuration, queue policy, and reconciliation results.
- **Queue age grows:** inspect consumer health, permissions, deduplication, and submission errors.
- **Workflow did not start:** inspect MWAA submission, throttling, pools, and quota.
- **Extraction failed:** inspect object version, range access, parser/encoding confidence, and quarantine reason.
- **Embedding failed:** inspect batch size, provider quota, model revision, and checkpoint.
- **Index count differs:** inspect bulk item failures and deterministic IDs; do not promote.
- **Evaluation fails:** compare the failed question cohorts and candidate versions; keep the old alias.
- **Promotion succeeded but data is stale:** verify source-to-index lineage and cache generation.

The goal is not to memorize workflow statuses. It is to identify which contract stopped being true.

## Debug an online query

```text
API Gateway
  → authorization
  → query routing
  → retrieval
  → rerank/context
  → LLM
  → citation/output validation
```

- **401/403:** inspect token validity, claims, route configuration, and project policy.
- **Zero results:** verify allowed scope, validated filters, index generation, and source freshness.
- **Wrong evidence:** compare BM25/vector candidates, fusion, reranking, duplicates, and corpus labels.
- **Good evidence, wrong answer:** inspect context formatting, prompt/model version, citation support, and abstention.
- **High p95 latency:** use spans to attribute time to auth, search, rerank, provider queue, or generation.
- **High cost:** inspect candidate count, context size, output length, retries, and routing.
- **Cross-project result:** treat as a security incident; fail closed, preserve audit evidence, invalidate affected caches, and inspect retrieval filters.

## Common failure decisions

| Failure | Detection | Containment and recovery |
|---|---|---|
| Duplicate S3 event | repeated immutable identity | Idempotent no-op or resume same work |
| Malformed header | decode/schema/semantic validation | Preserve provenance, quarantine, retry with new parser only |
| Worker eviction | missing heartbeat/pod event | Resume checkpointed stage with same work identity |
| S3/provider throttling | 429/503 and latency | Jittered backoff, lower concurrency, protect fresh-work capacity |
| Partial bulk index | item errors/count mismatch | Retry deterministic items; reject candidate generation |
| Bad embedding/index release | golden/canary regression | Keep or restore prior alias |
| Search outage | timeout/circuit open | Clear failure or safe scoped cache; no memory-based generation |
| LLM outage | provider errors/deadline | Evidence-only response or approved fallback |
| Broken trace chain | missing parent/link at async hop | Repair carrier, persisted context, or workflow injection |
| Telemetry outage | export errors/missing signals | Keep safe workload running, retain local logs, alert |

## Use all three observability signals

- **Trace:** where did time or failure occur?
- **Log:** what error and safe input metadata explain it?
- **Metric:** is it one request or a capacity/system pattern?

Example:

> A query is slow. The trace shows retrieval is normal but LLM time-to-first-token is high. Provider-latency metrics are elevated across projects, while EKS CPU is normal. The correct response is provider fallback/load shedding—not adding FastAPI replicas.

## Debug ML quality without guessing

### Retrieval regression

Run the golden set on the current and candidate version. Slice by exact, semantic, mixed, vendor, source type, and project-filter cohort. Inspect top candidates before changing the prompt.

### Generation regression

Hold the retrieved evidence fixed and compare prompt/model versions. This isolates generation from retrieval.

### Extraction regression

Compare normalized fields and source evidence before re-embedding. A model change cannot fix a wrong parsed identifier.

## Fire drills

Run these before claiming production readiness:

- duplicate and reordered object events;
- DLQ and redrive;
- worker termination during embedding;
- corrupted candidate index;
- missed source event recovered by reconciliation;
- expired/invalid JWT and unauthorized project request;
- OpenSearch timeout;
- hosted-LLM outage;
- prompt injection inside a retrieved document;
- telemetry collector outage;
- rollback to prior index, prompt/model, and container.

Record detection time, containment, recovery time, data correctness, and user-visible behavior.

## Interview summary

> “I debug from the last trustworthy boundary. For an update, I follow the trace from S3 event through Airflow, extraction, embedding, candidate index, evaluation, and promotion. For a query, I follow auth, retrieval, rerank, model, and citation validation. Traces locate the stage, logs explain the error, and metrics show whether it is isolated or systemic. Because every artifact is versioned and work is idempotent, recovery is replay or rollback rather than manual repair.”

→ Next: **[The Two-Minute Answer](09-two-minute-answer.md)**
