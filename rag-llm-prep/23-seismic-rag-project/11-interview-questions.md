# Senior-Level Seismic RAG Interview Drills

> **How to practise:** answer aloud before opening each card. Use the pattern constraint → decision → failure → recovery → metric.

## Q: What did you actually build, and what is proposed?

I built the core RAG prototype: Python ingestion, chunking, bge embeddings, FAISS, hybrid BM25/vector retrieval, optional reranking, FastAPI, hosted generation, citations, and offline retrieval evaluation.

I also worked with production AWS patterns such as S3/SQS, EKS, API Gateway, Okta/JWT claims, MWAA/Airflow, asynchronous workers, throttling, and OpenTelemetry/Grafana. The combined production RAG deployment is the target architecture that applies those patterns. I distinguish it clearly from components already deployed.

---

## Q: Why not embed the raw seismic platform?

Most of the storage is dense numerical trace data, not language. Turning it into text would be semantically weak, extremely expensive, and difficult to secure.

I index the knowledge layer: textual headers, normalized metadata, QC summaries, lineage, operational documents, and derived domain summaries. Numerical questions remain in seismic compute or use existing derived outputs. RAG retrieves and explains; it does not replace domain computation.

---

## Q: Why use S3 events, SQS, an EKS consumer, and Airflow instead of one Lambda?

The event path and the heavy work have different lifetimes. SQS buffers bursts and provides retry/DLQ behavior. The consumer validates, deduplicates, and submits work quickly. Airflow manages long dependencies, retries, checkpoints, backfills, and stage-specific workers.

A single long-running event handler would mix acknowledgement with expensive processing, create timeout and duplicate-work risks, and make resource isolation difficult.

---

## Q: How do you handle duplicate or missed S3 events?

S3 events are at least once, so identity includes bucket, key, immutable version or ETag, and extraction version. A duplicate maps to the same logical work and becomes a no-op or safe resume.

Events provide low-latency notification, while scheduled inventory reconciliation provides correctness and backfill. I monitor duplicate rate, event age, reconciliation gaps, and time to promoted index.

---

## Q: Why move from FAISS to OpenSearch?

FAISS was the right prototype baseline: simple, local, fast, and easy to benchmark. A shared production service needs lexical search, vector search, authorization filters, replicas, operational health, concurrent indexing, and versioned cutover.

OpenSearch is a target candidate because it combines those capabilities. I would benchmark it against alternatives using filtered hybrid queries, recall, p95 latency, indexing throughput, memory, and operations before committing.

---

## Q: Why hybrid retrieval instead of vector-only?

Seismic queries contain exact IDs, error codes, vendor terms, and acronyms, where BM25 is strong, plus paraphrased explanations, where dense retrieval is strong. They fail differently.

I run both inside the authorized scope and fuse ranks with RRF so incompatible raw scores are not added directly. I validate the gain with MRR/NDCG/Recall@K by query cohort and compare it with p95 latency and cost.

---

## Q: Where is authorization enforced?

API Gateway validates the Okta JWT, then the RAG service derives allowed projects from trusted claims or an authorization service. Those filters are pushed into lexical and vector retrieval before candidates are returned.

The same scope is included in cache keys and audits. Unauthorized text never enters reranking or the model context. If authorization is unavailable, the service fails closed. A prompt instruction is not an authorization control.

---

## Q: How do you update an index without serving partial or bad data?

Every update creates deterministic documents in a new candidate generation. I verify expected counts and item failures, run schema, authorization, retrieval, latency, and cost regression tests, then atomically move a stable read alias.

The previous index remains available for rollback. An embedding-model change always builds a separate vector space; it is not mixed into the old index.

---

## Q: How do you prove the RAG system works?

I evaluate extraction, retrieval, and generation separately. Extraction uses field accuracy and schema validity. Retrieval uses Recall@K, MRR, NDCG, context metrics, and filter correctness. Generation uses faithfulness, citation validity, completeness, abstention, latency, and cost.

The golden set is split by product or survey to prevent near-duplicate leakage and sliced by question/source cohort. A critical cohort regression blocks promotion even if the average improves.

---

## Q: What happens when the LLM provider is unavailable?

The call has a deadline, bounded retries, and a circuit breaker. Depending on product policy, the service either uses an approved fallback or returns the authorized retrieved evidence without synthesis.

It never invents an answer, retries beyond the request budget, or bypasses authorization. Provider errors, latency, fallback rate, and user-visible failures are monitored.

---

## Q: How do you debug a slow query?

I start with the trace and stage timings: auth, routing, retrieval, rerank, context, time to first token, generation, and validation. Metrics show whether the issue affects one query, one project, or the whole system.

If retrieval is fast but time to first token is high across projects, adding FastAPI replicas is the wrong fix. I investigate provider saturation, apply fallback or load shedding, and protect the request deadline.

---

## Q: How do you size this system without inventing numbers?

I sample each knowledge-source type and measure documents, chunks, tokens, and change rate. I benchmark extraction and embedding throughput and filtered hybrid search under concurrent indexing.

For the API, I start with peak RPS multiplied by p95 service time, then account for safe per-replica concurrency, provider quotas, redundancy, and rollout headroom. I report low/base/high scenarios rather than deriving document count from raw petabytes.

---

## Q: When would you fine-tune embeddings or the LLM?

First I localize the failure. I fix source extraction, authorization filters, normalization, chunking, fusion, reranking, and prompts.

I fine-tune embeddings only for a persistent, measured domain-semantic retrieval gap. I fine-tune the generator only for a persistent behavior or output-format problem. Changing knowledge belongs in RAG because it stays fresh and citable.

---

## Q: What was the hardest production challenge?

The hardest part is preserving correctness across asynchronous and versioned boundaries: duplicate events, heterogeneous extraction, worker interruption, partial indexing, and a model that can sound confident even when evidence is wrong.

The design contains that risk with immutable source identity, validated normalized evidence, deterministic documents, versioned candidate indexes, authorization before retrieval, citations, abstention, and end-to-end telemetry. The key is making every failure visible and reversible.

---

## Q: What makes this production-grade rather than a college project?

A demo proves that embeddings and an LLM can answer questions. Production proves that new data arrives safely, duplicate work is harmless, confidential projects do not leak, a bad model/index cannot silently ship, incidents can be diagnosed, dependencies fail safely, and cost/latency/quality remain within budgets.

The difference is durable orchestration, hard security boundaries, evaluation gates, observability, controlled degradation, and tested rollback—not simply putting FastAPI in Docker.

---

## Q: Walk me through the ML lifecycle in one minute.

Every source, parser, schema, chunker, embedding, index, retriever, reranker, prompt, model, and container is versioned. A domain golden set evaluates extraction, retrieval, generation, security, latency, and cost.

A candidate passes offline gates, then shadow and canary checks. Production feedback identifies hard or novel cases for expert review and future evaluation sets. Drift is measured against a stable baseline. Fine-tuning happens only when a diagnosed gap justifies it, and every release keeps a rollback path.
