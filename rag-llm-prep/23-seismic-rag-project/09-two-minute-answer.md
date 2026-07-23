# The Two-Minute Interview Answer

**TL;DR:** Lead with what you built, state the production gap, explain the offline and online paths, then close with security, observability, evaluation, and the honest boundary between deployed experience and proposed RAG adaptation.

## Natural first-person answer

> I built a RAG pipeline for seismic knowledge such as textual headers, product metadata, QC summaries, lineage, and operational documents. The important boundary was that the seismic platform contains extremely large numerical trace data, but that raw data is not a text corpus. I indexed the compact knowledge layer and linked answers back to authoritative sources.
>
> The prototype used Python, chunking, bge embeddings, FAISS, hybrid BM25 and vector retrieval, optional reranking, a FastAPI query API, hosted LLM generation, citations, and an offline retrieval evaluation set. That proved the ML flow, but it still had prototype assumptions: local ingestion, a local index, limited authorization, manual evaluation, and no production recovery path.
>
> To productionize it on AWS, I would apply patterns I have used in production ingestion systems. On the offline path, an S3 change goes to a dedicated SQS queue and DLQ. A lightweight consumer on EKS validates and deduplicates the event, then triggers an MWAA/Airflow workflow. Short-lived workers extract or consume trusted metadata, normalize and validate it, chunk and embed it, and build a versioned candidate search index. The promotion workflow runs retrieval and security regression tests before atomically promoting that index, so a partial update never corrupts the live version.
>
> On the online path, API Gateway validates the Okta JWT and the RAG API on EKS derives the user’s allowed projects. Structured questions use exact filters, while explanatory questions use authorized BM25 plus vector retrieval and optional reranking. The application assembles a token-bounded context, treats retrieved text as untrusted evidence, and asks the hosted LLM to cite sources or abstain.
>
> I would propagate OpenTelemetry context through the API, queue, Airflow workflow, workers, retrieval, and model call, then correlate traces, Loki logs, and Mimir metrics in Grafana. I would evaluate extraction, retrieval, and generation separately and promote changes through offline, shadow, and canary gates. The RAG prototype and those AWS production patterns are experience I can defend; the combined production RAG deployment is the architecture I would implement and validate rather than falsely claiming every component was already live.

## If the interviewer asks “What made it production rather than a demo?”

> The model was not the main difference. Production meant durable asynchronous updates, idempotent retries, project authorization before retrieval, versioned index promotion and rollback, stage-level telemetry, dependency-specific degraded modes, and quality gates for every parser, embedding, retriever, prompt, and model change.

## If the interviewer asks “Where is the ML?”

> The ML lifecycle covers extraction where needed, embeddings, optional reranking, and generation. Each has versioned inputs and evaluation. I separate extraction accuracy, retrieval Recall@K/MRR/NDCG, and answer faithfulness/citations so I can diagnose the layer that actually failed. I fine-tune only after data, filters, chunks, retrieval, and prompting are ruled out.

## Delivery tips

- Say **“I built”** for the prototype and production components you genuinely worked on.
- Say **“I would adapt”** or **“the target design uses”** for the combined production RAG deployment.
- Draw only two lanes: offline indexing and online answering.
- Explain why each component exists; do not list tools.
- End with one hard trade-off or failure mode.

## One-sentence close

> “The core lesson was that a production RAG system is a data, security, and operations system around an ML pipeline—not just embeddings plus an LLM endpoint.”

→ Next: **[The Ten-Minute Walkthrough](10-ten-minute-walkthrough.md)**
