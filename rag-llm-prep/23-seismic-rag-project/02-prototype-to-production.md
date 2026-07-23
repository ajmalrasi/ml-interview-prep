# From Prototype to Production Architecture

**TL;DR:** Keep the RAG algorithm, replace local assumptions with production boundaries. S3 and SQS make updates durable, MWAA/Airflow coordinates expensive work, EKS runs replaceable services and workers, API Gateway and Okta protect the query path, and OpenTelemetry makes the whole system observable.

## Architecture in one picture

```rawhtml
<div class="diagram"><div class="vflow" style="align-items:stretch">
  <div class="flow"><span class="flow-lbl">offline:</span><span class="node data">S3 knowledge source</span><span class="arw"></span><span class="node">SQS + DLQ</span><span class="arw"></span><span class="node">EKS trigger</span><span class="arw"></span><span class="node">MWAA workers</span><span class="arw"></span><span class="node out">versioned search index</span></div>
  <div class="flow"><span class="flow-lbl">online:</span><span class="node data">user</span><span class="arw"></span><span class="node">API Gateway + Okta</span><span class="arw"></span><span class="node">RAG API on EKS</span><span class="arw"></span><span class="node">authorized hybrid retrieval</span><span class="arw"></span><span class="node out">LLM answer + citations</span></div>
  <div class="flow"><span class="flow-lbl">across both:</span><span class="node soft">OpenTelemetry</span><span class="arw"></span><span class="node">traces · Loki logs · Mimir metrics</span><span class="arw"></span><span class="node out">Grafana</span></div>
</div></div>
```

This is one RAG product. The offline path changes what the system knows. The online path answers from the currently approved knowledge generation.

## What is reused and what is adapted

| Production pattern you used | What it demonstrated | RAG adaptation |
|---|---|---|
| S3 object notifications → SQS → Kubernetes worker | Durable, asynchronous reaction to file changes | Use a dedicated RAG queue and trigger-only consumer for knowledge updates |
| SQS DLQ and at-least-once delivery | Messages can repeat or fail permanently | Deduplicate by bucket/key/version or ETag and quarantine non-retryable updates |
| API Gateway + Okta/JWT claims | Authentication and claim enforcement at the edge and service | Protect the query API and derive allowed projects server-side |
| EKS long-lived APIs | Replaceable, scalable container services | Run the stateless RAG API and lightweight event consumer |
| MWAA/Airflow + short-lived EKS workers | Throttled orchestration of expensive, replayable work | Run extraction, embedding, reindexing, evaluation, and backfills |
| Global/per-product throttling | Protect shared capacity from large jobs | Separate fresh indexing from backfills and respect provider/index quotas |
| OpenTelemetry across HTTP, queue, DB, workflow, and pod | Trace continuity through asynchronous work | Carry a correlation ID from update/query through every RAG stage |
| Loki, Mimir, traces, and Grafana | Joined logs, resource metrics, and traces | Observe freshness, retrieval, generation, cost, and failures together |

The dedicated RAG queue, search cluster, and production RAG deployment are **adaptations**. The underlying patterns are evidenced by the production handoff documents.

## Why the SQS consumer stays small

The event consumer should:

1. parse and validate the S3 event;
2. derive immutable object identity;
3. deduplicate;
4. record or submit a small work request;
5. trigger the appropriate Airflow workflow;
6. acknowledge the message after submission is durable.

It should not download a large file, run OCR, generate embeddings, or build an index.

Long work inside a queue listener creates visibility-timeout problems, duplicate compute, poor resource isolation, and hard deployments. Airflow and short-lived workers are better places for work that needs retries, checkpoints, dependencies, and different CPU/GPU sizes.

## Why MWAA/Airflow is the orchestrator

RAG indexing is a dependency graph:

```text
discover
  → extract
  → validate
  → normalize
  → chunk
  → embed
  → index
  → evaluate
  → promote
```

Airflow is useful because each stage can retry independently, pass versioned artifacts, expose timing, and block promotion after a failed quality gate. A scheduled reconciliation workflow can catch missed object events. Backfills can run in a separate pool so they do not delay new content.

Airflow is not used for the online question path. A user request should not wait for a DAG scheduler.

## Why EKS has two workload shapes

### Long-lived services

- RAG query API;
- lightweight SQS consumer;
- optional reranking or embedding service when self-hosted;
- telemetry collectors/platform agents.

### Short-lived workers

- document/header extraction;
- normalization and validation;
- batch embedding;
- index build and regression tests;
- historical reprocessing.

The long-lived API needs predictable latency and a reliable baseline. Short-lived workers are replayable and can use elastic or spot capacity when checkpoints and idempotency make interruption safe.

## Why a production search service replaces local FAISS

FAISS was the right prototype choice: simple, fast, and easy to benchmark. A multi-replica cloud service needs a shared, durable search layer that supports:

- lexical search for exact seismic identifiers;
- vector search for semantic questions;
- metadata and authorization filters;
- replicas and operational health;
- versioned indexes and atomic cutover;
- concurrent indexing and querying.

OpenSearch is a reasonable **target choice**, not a documented deployed RAG dependency. It should be confirmed by a representative benchmark against alternatives before final selection.

## Online boundary

The RAG API owns:

- request validation;
- identity and project authorization;
- query routing and limits;
- retrieval, fusion, optional reranking, and context assembly;
- model call, output validation, citations, and abstention;
- audit and telemetry.

The hosted LLM does not own authorization, retrieval filters, source precedence, or business rules. It receives only the evidence the application has already authorized and selected.

## One decision pattern

For each component, explain five things:

1. **Constraint:** what workload or risk exists?
2. **Decision:** what pattern addresses it?
3. **Failure:** what can still go wrong?
4. **Recovery:** how is the failure contained?
5. **Evidence:** which metric proves the choice?

Example:

> “S3 events are at least once, so I do not treat an event as unique work. The consumer derives identity from object version or ETag and submits an idempotent Airflow job. Duplicate delivery becomes a cheap no-op. I monitor duplicate rate, queue age, retry rate, and indexing freshness.”

→ Next: **[Offline Ingestion & Indexing](03-offline-ingestion-indexing.md)**
