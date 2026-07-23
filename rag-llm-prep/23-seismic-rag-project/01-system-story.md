# System Overview & the Interview Story

**TL;DR:** The project began as a working document-RAG pipeline. Productionizing it means keeping the useful ML core while replacing local assumptions with durable events, orchestrated jobs, authorization, observability, evaluation gates, and rollback.

## The business problem

Seismic engineers and operations teams need to find facts spread across headers, QC results, product metadata, lineage, delivery records, and troubleshooting documents. The information exists, but answering a question can require searching several systems and asking a domain expert to interpret the result.

The product goal is:

> Reduce time-to-answer while preserving project confidentiality, source traceability, and a clear boundary between retrieved knowledge and numerical seismic computation.

Example questions include:

- “Why did this product fail QC?”
- “Which file contains this line or identifier?”
- “What changed between these processing generations?”
- “What is the recommended recovery procedure for this ingestion error?”
- “Which source supports this answer?”

## What the prototype proved

The prototype proved the core RAG loop:

```text
documents
  → clean text
  → chunks
  → bge-small embeddings
  → FAISS vector index
  → question embedding
  → retrieval
  → hosted LLM
  → answer + source citations
```

It also added BM25, reciprocal-rank fusion, optional cross-encoder reranking, a FastAPI endpoint, an insufficient-context response, and an offline retrieval evaluation set.

That is meaningful engineering. It proves that the corpus can be represented, searched, and used to generate grounded answers. But it does not yet prove that the service can safely operate across confidential projects, survive partial cloud failures, process continuous updates, or roll back a bad index.

## Why the prototype is not yet production

| Prototype assumption | Production question |
|---|---|
| Files are read from a local directory | How are new or changed S3 objects detected reliably? |
| One process builds a local FAISS index | How do many workers update a shared index without exposing a partial generation? |
| The corpus is trusted and small | How are malformed inputs, prompt injection, and access restrictions handled? |
| One API process handles queries | How does the service scale, drain, deploy, and recover? |
| Retrieval evaluation runs manually | What blocks a bad embedding, prompt, or index from reaching users? |
| Latency is returned in one response | Where are p95 latency, cost, quality, and drift monitored? |
| Failure is a Python exception | Which stage failed, can it retry safely, and what does the user receive? |

The production design answers these questions without changing the product into something other than RAG.

## The source-data boundary

The platform scale is large because seismic traces are dense numerical arrays. Those samples are not converted to prose and embedded.

The RAG corpus contains the compact knowledge that people can ask questions about:

- decoded textual headers and selected metadata;
- canonical product/file/geometry facts;
- QC summaries, warnings, and explanations;
- processing lineage and delivery information;
- operational documents and runbooks;
- links to authoritative objects and computed outputs.

If a question requires amplitude statistics, image generation, or geophysical computation, the answer should point to an existing derived result or route to a domain tool. The LLM should not pretend it calculated over the raw seismic volume.

## The production outcome

The target production system has four properties.

### 1. Fresh knowledge

New or changed evidence is discovered through durable events and periodic reconciliation. Processing is safe to retry and a failed update cannot corrupt the currently served index.

### 2. Authorized answers

Identity and project claims are derived at the API boundary. Unauthorized documents are excluded before retrieval and never enter the model context.

### 3. Measured ML quality

Extraction, retrieval, and generation are evaluated separately. A change is promoted only when it passes quality, latency, cost, security, and rollback gates.

### 4. Operable cloud service

The API and workers run on a managed platform, expensive work is orchestrated asynchronously, and OpenTelemetry connects traces, logs, and metrics across service boundaries.

## Requirements that drive the design

| Constraint | Design consequence |
|---|---|
| Multi-GB/TB source objects | Range-read headers or consume trusted derived outputs; do not download everything |
| At-least-once object events | Use immutable object identity and idempotent processing |
| Continuous updates and backfills | Separate fresh-work and replay capacity; use Airflow/MWAA |
| Exact IDs plus natural-language questions | Use structured filters and hybrid retrieval |
| Confidential project boundaries | Enforce authorization before retrieval and in cache keys |
| Hosted model dependency | Add deadlines, circuit breakers, fallback behavior, and token budgets |
| Search/index changes can regress quality | Build versioned indexes and promote through evaluation gates |
| Many asynchronous hops | Propagate or link trace context end to end |

## What success looks like

Do not use one “accuracy” number.

- **Extraction:** schema-valid rate, field precision/recall, quarantine rate.
- **Retrieval:** Recall@K, MRR/NDCG, filter correctness, zero-result rate.
- **Generation:** faithfulness, citation validity, answer completeness, abstention quality.
- **Operations:** freshness, queue age, p50/p95/p99 latency, availability, retry rate.
- **Cost:** cost per changed document and per successful answer.
- **Business:** time-to-answer, successful searches, expert acceptance, reduced escalations.

## The interview opening

A strong opening is:

> “I started with a working RAG prototype over seismic knowledge: ingestion, embeddings, hybrid retrieval, a FastAPI query path, hosted generation, and citations. The production challenge was not adding more AI. It was making updates replayable, enforcing project authorization before retrieval, validating every index change, and operating the pipeline across AWS services. I applied production patterns I had already used—S3, SQS, EKS, MWAA/Airflow, API Gateway, Okta/JWT, and OpenTelemetry—to design that production path.”

That opening establishes ownership without claiming that every target component was already deployed.

→ Next: **[From Prototype to Production Architecture](02-prototype-to-production.md)**
