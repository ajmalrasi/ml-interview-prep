# The 2-Minute and 10-Minute Answers

**TL;DR:** Lead with scope and the 40 PB boundary, draw offline/online paths, then go deeper only where the interviewer asks. Your answer is a decision story, not a tool inventory.

## Natural 2-minute answer

> I built an end-to-end RAG system for a seismic platform containing roughly 40 PB across about 10,000 SEG-Y files in AWS and GCP. The central constraint was that individual files can be multi-terabyte, so the 40 PB is not an ML corpus and raw trace samples never go to an LLM.
>
> On the offline path, Airflow discovers immutable object versions and launches idempotent workers. Using range reads through fsspec, s3fs, or gcsfs, we extract EBCDIC textual headers, binary and selected trace metadata, then combine that with ingestion, QC, lineage, and delivery information. We normalize vendor-specific fields into a versioned schema, quarantine invalid records, create small source-aware chunks, generate embeddings, and bulk-index them into versioned OpenSearch indexes. Deterministic IDs and alias swaps make retries, re-ingestion, and embedding migrations safe.
>
> On the online path, a stateless FastAPI service authenticates the user, applies project-level authorization filters, and routes structured questions to exact filters while semantic questions use BM25 plus vector retrieval. We fuse results, optionally rerank ambiguous queries, deduplicate and assemble a token-bounded context. The LLM treats retrieved content as untrusted evidence, cites sources, and abstains when evidence is insufficient.
>
> We evaluate extraction, retrieval, and generation separately using a seismic-engineer golden set, with Recall@K, MRR/NDCG, faithfulness, citation accuracy, latency, and cost. We deploy on Kubernetes or managed containers, trace the full request with OpenTelemetry/OTLP, visualize it in Grafana, and use versioned indexes, circuit breakers, backoff, and canary rollback for reliability.

## 8–10 minute route

| Time | What to say |
|---|---|
| 0:00–1:00 | Problem, users, system boundary, scale, success criteria |
| 1:00–2:00 | Draw offline and online lanes plus shared security/observability |
| 2:00–4:00 | Range reads, decoding, normalization, idempotency, quarantine, re-ingestion |
| 4:00–6:00 | Query routing, filters, BM25 + vectors, fusion, rerank, context, citations |
| 6:00–7:15 | Extraction/retrieval/generation evaluation and golden dataset |
| 7:15–8:30 | Deployment, telemetry, authorization, degraded modes |
| 8:30–10:00 | Trade-offs, capacity method, hardest challenge, future improvements |

## Component-by-component deep-dive prompts

### Object discovery

Event notification for freshness plus scheduled reconciliation for correctness. Identity includes immutable object version; key alone is insufficient.

### Header extraction

Range-read textual/binary headers and stream selected trace headers. Preserve raw bytes and decoding provenance. Bound memory and retry each immutable version.

### Normalization

Deterministic parsing first; structured LLM extraction for inconsistent free text; validate all outputs against a versioned canonical schema.

### Indexing

Source-aware semantic units, explicit metadata fields, deterministic IDs, bulk item-level error handling, versioned physical index, atomic read alias.

### Retrieval

Route structured questions to exact search. Use authorized filtered BM25 + vectors for semantic questions, fuse ranks, rerank top-N when measured gain pays for cost.

### Generation

Untrusted evidence, source IDs beside passages, structured output validation, tokens/rate limits, citations per claim, abstention on missing/conflicting evidence.

### Evaluation

Golden set split by product/survey. Extraction field metrics, retrieval Recall@K/MRR/NDCG, generation faithfulness/citations/abstention, expert review, latency and cost.

### Production

Stateless FastAPI, external state, autoscaling, probes, gradual rollout, OpenTelemetry/OTLP, Grafana, least-privilege IAM, project filters before retrieval.

## Challenges you can honestly claim

- extracting useful metadata without downloading multi-TB files
- decoding and normalizing heterogeneous EBCDIC/vendor headers
- making partial ingestion and re-ingestion safely replayable
- preventing duplicate/stale OpenSearch documents
- balancing exact identifiers with semantic retrieval
- grounding answers with citations and abstention
- handling cloud throttling, worker interruption, and provider failures
- protecting confidential project data through the full retrieval/cache path
- evaluating extraction, retrieval, and generation separately

## Future improvements — label them clearly

- MLflow as a unified experiment registry
- domain-adapted embedding evaluation/fine-tuning
- richer active-learning and expert feedback loops
- expanded automated citation entailment checks
- self-hosted vLLM only after data-policy, utilization, and TCO validation

## How to sound senior

Use this pattern for every follow-up:

1. state the workload constraint
2. name the decision
3. explain the failure/cost it controls
4. give the metric that validates it
5. say when you would choose the alternative

Example:

> “Because questions contain both exact FFID/product identifiers and paraphrased operational language, we used hybrid retrieval. BM25 protects lexical precision; vectors add semantic recall; RRF avoids assuming comparable raw scores. We validate the choice with Recall@K/NDCG and p95 latency by question cohort. If vector-only matched quality at lower operating cost, I would simplify—but our domain makes that unlikely.”
