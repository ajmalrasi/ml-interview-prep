# The Ten-Minute Architecture Walkthrough

**TL;DR:** Use this as a whiteboard script. Establish the truth boundary, draw offline and online lanes, walk one source update and one user query, then explain evaluation, reliability, observability, scaling, and trade-offs.

## 0:00–1:00: Problem and ownership

> “The problem was making seismic product knowledge searchable and explainable. Engineers needed answers from headers, metadata, QC, lineage, and operational documents, but those facts were fragmented. The platform scale is huge because of numerical trace arrays, so the first design decision was not to embed raw seismic samples. The RAG corpus is a compact, citable knowledge layer.”

Then state ownership:

> “I built the core RAG prototype: ingestion, chunking, embeddings, FAISS, hybrid retrieval, optional reranking, FastAPI, hosted generation, citations, and retrieval evaluation. Separately, I worked with AWS production patterns including S3, SQS, EKS, API Gateway, Okta claims, MWAA/Airflow, and OpenTelemetry. The production design combines those proven patterns around the RAG pipeline.”

## 1:00–2:00: Draw the system

Draw two horizontal lanes.

```text
OFFLINE
S3 → SQS/DLQ → EKS trigger → MWAA workers
    → extract/normalize → chunk/embed → candidate index → evaluate → promote

ONLINE
User → API Gateway/Okta → RAG API on EKS
     → authorize → structured/hybrid retrieve → context → LLM → cite/abstain

ACROSS BOTH
OpenTelemetry → traces + Loki + Mimir → Grafana
```

Say:

> “They share artifacts and platform controls, but they scale independently. Indexing is batch, replayable, and sometimes GPU-heavy. Query serving is interactive and has a tail-latency SLO.”

## 2:00–3:30: Walk one knowledge update

> “When a relevant S3 object changes, S3 sends an event to a dedicated SQS queue. Delivery is at least once, so the consumer derives identity from bucket, key, immutable version or ETag, and extraction version. Duplicate delivery becomes the same logical work.”
>
> “The EKS consumer does not process the file. It validates and submits an MWAA workflow, then acknowledges after submission is durable. Airflow runs extraction, validation, chunking, embedding, candidate-index build, and evaluation on short-lived workers. A scheduled reconciliation catches missed events and supports backfills.”

Explain the source boundary:

> “We prefer trusted metadata and QC outputs from the seismic platform. If a needed fact exists only in SEG-Y, we range-read textual and binary headers or selected trace headers. We do not download or embed the full trace array.”

Explain safe publication:

> “Each document retains source, project, object version, parser, chunker, and embedding lineage. We build a full candidate index, compare counts, run retrieval and security regression tests, then move a stable read alias. The old generation remains available for rollback.”

## 3:30–5:30: Walk one question

> “The user calls the RAG API through API Gateway. Okta validates identity, and the service derives allowed project scope from trusted claims. Authorization is pushed into search before retrieval; unauthorized text never reaches the prompt.”
>
> “The router distinguishes exact, semantic, and mixed questions. Exact product or identifier questions use structured filters. Explanatory questions run BM25 and dense retrieval in the allowed corpus. RRF combines ranks because lexical and vector scores are not comparable. A cross-encoder reranks only a small candidate set when its quality gain justifies the latency.”
>
> “Context assembly removes duplicates, preserves evidence diversity, enforces a token budget, and labels each passage with a source ID. Retrieved text is treated as untrusted data. The hosted LLM must use the evidence, cite sources, and abstain when support is missing or conflicting. We validate the response schema and citations before returning it.”

## 5:30–6:45: Explain the ML lifecycle

> “I evaluate three layers separately. Extraction uses field precision/recall and schema validity. Retrieval uses Recall@K, MRR, NDCG, context metrics, and authorization-filter correctness. Generation uses faithfulness, citation entailment, completeness, abstention, latency, and cost.”
>
> “Every experiment pins the source snapshot, parser, schema, chunker, embedding, index, retriever, reranker, prompt, model, and container revision. A candidate passes offline and security tests, then shadow and canary traffic. Critical cohort regression blocks promotion even if the average improves.”

Add:

> “Most RAG failures are evidence failures. I fix extraction, filters, chunks, and retrieval before considering fine-tuning.”

## 6:45–8:00: Explain reliability, security, and observability

> “Reliability comes from deterministic identity, bounded retry, checkpoints, DLQs, and atomic index promotion. Search and LLM calls use deadlines and circuit breakers. If generation is unavailable, we can return authorized evidence without synthesis; if authorization is unavailable, we fail closed.”
>
> “For observability, I reuse the production OpenTelemetry pattern across HTTP, queue, workflow, and short-lived pods. Direct work continues a trace; delayed work can use a span link. Application traces and structured logs go through OTLP, resource metrics go to Mimir, logs are searchable in Loki, and Grafana joins them by safe request, update, workflow, and version identifiers.”

Security close:

> “Prompt rules are not access control. JWT claims, retrieval filters, IAM, network boundaries, encryption, cache scope, and output validation are the hard controls.”

## 8:00–9:00: Explain scale and cost

> “I do not size from raw petabytes. I sample documents and chunks per product/source type, measure token and change distributions, then benchmark extraction, embedding, and filtered hybrid search. Offline capacity is driven by freshness and backfill windows. Online capacity is peak RPS times p95 service time, adjusted for provider quotas and redundancy.”
>
> “I control cost by processing only changed versions, batching embeddings, limiting candidates and context, reranking selectively, routing simple queries to cheaper paths, and using spot only for checkpointed replayable work.”

## 9:00–10:00: Trade-off and honest close

Use one trade-off:

> “FAISS was ideal for the prototype. For a shared production service I would benchmark OpenSearch because we need BM25, vectors, filters, replicas, and versioned operational indexes. I would not claim it as deployed until the benchmark and production gates pass.”

Close:

> “What makes the design production-grade is not the number of AWS boxes. It is that every source update is replayable, every answer is authorized and attributable, every ML change is evaluated and reversible, and every failure has a visible and safe response.”

## Whiteboard questions to invite

- “Would you like me to go deeper into the indexing pipeline or online retrieval?”
- “I can explain the authorization boundary, index rollout, or evaluation design.”
- “The hardest trade-off is usually freshness versus cost, or retrieval quality versus latency.”

→ Next: **[Senior Interview Drills](11-interview-questions.md)**
