# Offline Ingestion & Indexing

**TL;DR:** A new S3 object is a signal, not proof that knowledge is ready. A small event consumer submits idempotent work; MWAA/Airflow coordinates extraction, validation, chunking, embedding, index validation, and safe publication.

## What this path is responsible for

The offline path turns an immutable source change into an approved search-index generation.

```text
source changed
  → identify exact source version
  → extract useful evidence
  → normalize and validate
  → attach provenance and authorization metadata
  → chunk
  → embed
  → build candidate index
  → run quality checks
  → promote or reject
```

It is not the online query path, and it does not run inside the API request that notified the system.

## 1. Discover work without trusting the event

The production S3 pattern already uses object events, SQS, a DLQ, and a Kubernetes consumer. For RAG, reuse the pattern through a dedicated queue:

```text
S3 ObjectCreated / completed upload
    → SQS rag-knowledge-events
    → lightweight EKS consumer
    → submit MWAA/Airflow indexing job
```

S3 notifications are delivered at least once. The consumer derives work identity from:

```text
bucket + key + immutable version/ETag + extraction version
```

A duplicate event submits the same logical work and becomes a no-op. A scheduled S3 inventory reconciliation catches missed events and supports controlled backfills.

For multipart or many-small-file deliveries, trigger on a completed upload or a dataset-ready marker rather than launching one expensive workflow per fragment.

## 2. Keep the listener separate from the work

The consumer validates the event and starts durable work. It does not:

- download a multi-terabyte SEG-Y file;
- run an embedding model;
- build a search index;
- wait for an LLM or GPU job;
- hold an SQS message open for hours.

This separation provides backpressure and clean retry boundaries. MWAA/Airflow controls dependencies, concurrency, and replay. EKS workers receive only the resources needed for their stage.

## 3. Extract the knowledge layer

There are two valid inputs to the RAG pipeline.

### Trusted outputs from the seismic processing platform

Prefer already-validated metadata, QC summaries, lineage, delivery records, and operational documents when they are authoritative. RAG should not repeat expensive processing merely to recreate facts that another system owns.

### Selective extraction from source objects

When the needed fact lives in SEG-Y, range-read only the useful regions:

- textual/EBCDIC header;
- binary header;
- extended textual headers;
- selected trace-header ranges when geometry sampling is required.

Keep buffers bounded. Preserve the exact object version, source location, raw evidence pointer, parser version, and decoding decision.

The target is explainable metadata and text—not seismic sample arrays.

## 4. Normalize before chunking

Headers and operational documents are heterogeneous. Convert them into a canonical evidence shape:

```text
content
source locator
project/product/file identity
source type
event or QC time
parser/schema version
authorization attributes
quality/confidence flags
```

Use deterministic parsing for standard fields. If an LLM is used for irregular free text, treat its output as an untrusted candidate: require a schema, validate types and allowed values, retain provenance, and quarantine low-confidence results.

Authorization metadata must be attached here. Retrieval cannot enforce a project boundary if chunks were indexed without project identity.

## 5. Chunk by meaning, not one global number

The prototype’s fixed-size chunking is a useful baseline, not a universal production rule.

Use natural units:

- one coherent header section;
- one QC result and its explanation;
- one product summary;
- one operational incident or runbook step;
- one lineage or delivery event.

Do not split an identifier from its value or a failure result from its cause. Retain exact card, line, byte-range, document, or record references so citations lead to evidence.

Measure token distributions and retrieval quality by source type. Different extractors may need different chunking policies behind one normalized interface.

## 6. Generate embeddings reproducibly

Every embedding batch records:

- embedding model and revision;
- preprocessing and normalization;
- chunker version;
- input dataset snapshot;
- code/container revision;
- output vector dimension and checksum.

Documents and questions must use the same model and preprocessing. Batch requests for throughput, respect provider quotas, checkpoint progress, and make retries upsert the same deterministic document IDs.

GPU use is a capacity decision. Choose CPU, GPU, or hosted embeddings from measured throughput, freshness SLO, privacy, and cost—not because embeddings are “ML.”

## 7. Build, validate, and promote

Do not update the live index in place and hope every batch succeeded.

```text
current read alias → seismic-knowledge-v17

build seismic-knowledge-v18
    → verify expected counts and item failures
    → run schema/security checks
    → run retrieval regression suite
    → measure latency and cost
    → promote alias only if gates pass

rollback = point alias back to v17
```

Embedding-model migrations require a new index because vectors from different models are not interchangeable.

OpenSearch is the target example because it can support BM25, vectors, filters, aggregations, and operational replicas. The final choice should follow a workload benchmark.

## 8. Fresh work, backfills, and failures

- Reserve capacity for recent updates.
- Put historical reprocessing in a separate Airflow pool or queue.
- Retry transient S3, embedding, and index errors with bounded exponential backoff.
- Send deterministic, non-retryable failures to quarantine/DLQ with enough provenance to reproduce them.
- On worker eviction, replay from the last durable artifact.
- Never promote a candidate with missing documents, authorization metadata, or failed quality tests.

## Metrics that prove this path

| Area | Metrics |
|---|---|
| Freshness | event age, time from source change to promoted index |
| Reliability | duplicate rate, retries, DLQ/quarantine rate, workflow success |
| Extraction | schema-valid rate, field precision/recall, confidence by source type |
| Embedding | tokens/sec, batch failures, cost per changed document |
| Indexing | expected vs written count, bulk errors, build duration |
| Quality | Recall@K/NDCG regression by question cohort |

## Interview summary

> “I reused the S3-to-SQS event pattern, but the listener only starts work. MWAA runs the expensive and replayable stages on short-lived EKS workers. Every update is tied to an immutable source and transformation version. We build a complete candidate index, run security and retrieval gates, and promote it atomically, so a partial failure never damages the version serving users.”

→ Next: **[Online Retrieval & Generation](04-online-rag.md)**
