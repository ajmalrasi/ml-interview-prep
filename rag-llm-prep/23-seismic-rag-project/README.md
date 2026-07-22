# Seismic RAG — The Production Project

**TL;DR:** You built a multi-cloud RAG system over a seismic platform holding roughly **40 PB across about 10,000 SEG-Y files**. The design does not treat 40 PB of trace samples as an LLM corpus. It range-reads compact headers, combines them with ingestion/QC/operational metadata, and returns authorized, grounded answers with source references.

This module teaches you to explain that system as a Principal ML/MLOps Architect. Every choice is tied to the real constraints: multi-terabyte objects, inconsistent EBCDIC headers, hybrid retrieval, cloud throttling, partial failure, confidential data, and LLM cost.

## The one-sentence system boundary

> Raw seismic processing produces trusted metadata and QC outputs. The RAG knowledge pipeline indexes that compact knowledge layer. It does **not** send seismic trace samples to an LLM.

That sentence prevents the most damaging interview misunderstanding: “40 PB” is the platform scale, not the embedding or training volume.

## What you built

- Python-based processing across AWS S3 and GCP Cloud Storage
- Airflow orchestration on MWAA/Cloud Composer
- Range-based SEG-Y/EBCDIC and technical metadata extraction
- Vendor-field normalization and versioned validation
- Searchable ingestion, QC, lineage, delivery, and operational knowledge
- OpenSearch BM25 + vector hybrid retrieval with optional reranking
- A stateless FastAPI query service on container infrastructure
- Grounded hosted-LLM answers with source references and abstention
- Retrieval/generation evaluation, production telemetry, and cost monitoring

The choices are cloud-portable: EKS/GKE and managed container serving are deployment options, not a claim that every workload must run on Kubernetes.

## Learn it in this order

| Step | Lesson | The question it answers |
|---|---|---|
| 1 | [Problem, scale, requirements](01-problem-and-requirements.md) | What problem did you solve, for whom, and how well? |
| 2 | [Offline ingestion](02-offline-ingestion.md) | How did you safely process multi-TB files? |
| 3 | [Data, embeddings, OpenSearch](03-data-embeddings-indexing.md) | What exactly became searchable, and how? |
| 4 | [Online retrieval and generation](04-online-retrieval-generation.md) | How does one question become one cited answer? |
| 5 | [Evaluation and experiments](05-evaluation-experiments.md) | How do you prove it works? |
| 6 | [Production operations](06-production-operations.md) | How do you deploy, monitor, secure, and recover it? |
| 7 | [Trade-offs, capacity, cost](07-tradeoffs-capacity.md) | How do you defend design and sizing decisions? |
| 8 | [Interview answers](08-interview-answer.md) | How do you deliver the story in 2 or 10 minutes? |
| 9 | [Principal-level drills](09-interview-questions.md) | Can you handle the follow-up pressure? |

## The mental model

There are two independent paths:

1. **Offline indexing:** discover an immutable object version → extract compact evidence → normalize/validate → chunk/embed → publish a versioned search index.
2. **Online answering:** authorize and understand the question → apply structured filters → hybrid retrieve → rerank/assemble evidence → generate a cited answer or abstain.

Object storage is authoritative. OpenSearch is a rebuildable, eventually consistent projection. FastAPI remains stateless. This separation lets each layer scale, fail, deploy, and roll back independently.

## The honest future-work line

The system is built. The following are still best described as optional improvements rather than existing production dependencies:

- MLflow as a unified experiment registry
- self-hosted vLLM when security or stable GPU economics justify it
- domain embedding fine-tuning when a measured retrieval cohort needs it
- more automated citation verification and active-learning feedback

Start with the problem, not the tools: **[Problem, Scale & Requirements →](01-problem-and-requirements.md)**
