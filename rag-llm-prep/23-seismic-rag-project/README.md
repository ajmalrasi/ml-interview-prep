# Seismic RAG: From Prototype to Production

**TL;DR:** This module teaches one story: how a working seismic RAG prototype becomes a production AWS service by applying cloud patterns you have genuinely used—S3, SQS, EKS, API Gateway, Okta/JWT, MWAA/Airflow, OpenTelemetry, Grafana, Loki, and Mimir.

> **The interview goal:** answer “Walk me through the RAG and ML system you built on the cloud” as a decision story: the problem, the prototype, the production gaps, the target architecture, the failure handling, and the evidence that it works.

## The truth contract

The most important improvement in this rewrite is accuracy. It separates three kinds of statements:

| Label | Meaning |
|---|---|
| **Built in the RAG prototype** | Python ingestion, chunking, embeddings, FAISS, hybrid retrieval, optional reranking, FastAPI, hosted generation, citations, and offline retrieval evaluation |
| **Used in production systems** | AWS S3, SQS/DLQ, EKS, API Gateway, Okta/JWT claims, MWAA/Airflow, asynchronous workers, throttling, idempotent processing, OpenTelemetry, Grafana, Loki, and Mimir |
| **Production RAG adaptation** | The proposed way those proven patterns would be connected around the RAG pipeline, including a dedicated RAG event queue, production search service, permission-aware retrieval, and automated quality gates |

Do not say that a proposed RAG component was already deployed. A strong and honest line is:

> “I built the RAG pipeline and worked with the production AWS patterns separately. This is how I would combine them into a production deployment, and these are the parts I would validate before claiming production readiness.”

## One system, two paths

This is still one RAG system. It has two paths because indexing and answering have different workloads.

### Offline knowledge path

```text
S3 source or trusted seismic output
    → dedicated SQS queue + DLQ
    → lightweight EKS event consumer
    → MWAA/Airflow workflow
    → extract and normalize useful knowledge
    → chunk and embed
    → validate a versioned search index
    → promote it safely
```

### Online answer path

```text
User question
    → API Gateway + Okta/JWT
    → RAG API on EKS
    → project authorization
    → structured and/or hybrid retrieval
    → context assembly
    → hosted LLM
    → grounded answer with citations or abstention
```

Both paths share security, observability, deployment, and versioning. They are not separate products.

## The system boundary

The seismic platform may hold tens of petabytes, but raw seismic trace samples are not a text corpus. The RAG knowledge layer indexes compact, explainable evidence:

- textual/EBCDIC headers;
- normalized product and geometry metadata;
- QC summaries and warnings;
- lineage and delivery information;
- operational reports and troubleshooting knowledge;
- derived summaries produced by domain processing.

Questions that require computation over trace amplitudes remain in seismic-domain analytics. RAG retrieves and explains existing knowledge; it does not replace numerical seismic processing.

## Learn it in this order

| Step | Lesson | What you should be able to explain |
|---|---|---|
| 1 | [System story](01-system-story.md) | The business problem, prototype, production gap, and success criteria |
| 2 | [Prototype to production](02-prototype-to-production.md) | How your real AWS experience maps to one production RAG architecture |
| 3 | [Offline ingestion and indexing](03-offline-ingestion-indexing.md) | How new knowledge reaches a safe, versioned index |
| 4 | [Online retrieval and generation](04-online-rag.md) | How one authorized question becomes a cited answer |
| 5 | [Evaluation and ML lifecycle](05-evaluation-ml-lifecycle.md) | How extraction, retrieval, and generation changes are tested and promoted |
| 6 | [Reliability, security, and observability](06-reliability-security-observability.md) | How the system survives failures and protects confidential projects |
| 7 | [Scaling, performance, and cost](07-scaling-performance-cost.md) | How to size the system without inventing numbers |
| 8 | [Failure scenarios and debugging](08-failure-debugging.md) | How to diagnose incidents using traces, queues, and stage metrics |
| 9 | [Two-minute interview answer](09-two-minute-answer.md) | A concise, natural first-person answer |
| 10 | [Ten-minute walkthrough](10-ten-minute-walkthrough.md) | A whiteboard-ready architecture explanation |
| 11 | [Senior interview drills](11-interview-questions.md) | Follow-up questions about trade-offs, failures, security, and ML quality |

## What “production-ready” means here

Production readiness is not “put FastAPI in a Docker container.” It means:

- ingestion is asynchronous, replayable, and idempotent;
- fresh work cannot be starved by a large backfill;
- indexes, embeddings, prompts, and models are versioned and reversible;
- authorization is enforced before retrieval;
- failures degrade explicitly instead of producing invented answers;
- one trace connects API, queue, workflow, worker, retrieval, and generation;
- quality, latency, cost, and freshness have measurable gates;
- canary deployment and rollback are tested.

Start with the story: **[System Overview & Interview Story →](01-system-story.md)**
