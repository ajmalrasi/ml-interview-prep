# Evaluation & the ML/RAG Lifecycle

**TL;DR:** Production RAG changes are model changes, data changes, and software changes at the same time. Evaluate extraction, retrieval, and generation separately, store every version, and promote through offline, shadow, canary, and rollback gates.

## Why end-to-end “looks good” testing is not enough

A wrong answer can come from:

- bad header decoding;
- incorrect normalization;
- a missing or stale source;
- poor chunk boundaries;
- a weak embedding;
- incorrect authorization filters;
- bad ranking;
- noisy context;
- unsupported generation;
- a broken citation mapper.

One end-to-end score cannot identify the failing layer. The evaluation system mirrors the pipeline.

## Build a seismic golden set

Work with domain experts to label representative questions across:

- different survey and product types;
- vendors, header layouts, and encodings;
- exact identifier, semantic, mixed, and multi-source questions;
- QC, lineage, delivery, and operational topics;
- malformed or conflicting sources;
- unanswerable questions;
- cross-project authorization attempts;
- prompt-injection content.

Each item contains:

```text
question
authorized project scope
expected facts or acceptable answer points
relevant source IDs/passages
required citations
whether abstention is correct
question cohort
```

Split by product or survey, not random chunks. Near-duplicate headers from one product must not appear in both tuning and test data.

## Layer 1: extraction and normalization

Measure:

- exact match for identifiers and controlled fields;
- precision/recall/F1 per field;
- numeric tolerance where appropriate;
- schema-valid rate;
- extraction coverage;
- quarantine and manual-review rate;
- confidence calibration;
- results sliced by vendor, encoding, and source type.

If OCR, EBCDIC decoding, or a parser produced the wrong fact, retrieval cannot repair it.

## Layer 2: retrieval

| Metric | Question it answers |
|---|---|
| Recall@K | Did the candidate set contain the needed evidence? |
| MRR | How early did the first useful result appear? |
| NDCG | Were multiple graded results ordered well? |
| Context precision | How much of the final context was useful? |
| Context recall | Did the context include enough support? |
| Filter correctness | Did the request search exactly the allowed corpus? |

Report by question cohort. Exact-ID lookup and multi-source explanation need different retrieval behavior. Compare dense, BM25, hybrid, and reranked configurations against both quality and latency.

## Layer 3: generation and citations

Measure:

- claim faithfulness;
- answer relevance and completeness;
- citation validity and entailment;
- source coverage;
- abstention precision/recall;
- structured-output validity;
- domain-expert rating;
- token cost and stage latency.

RAGAS or an LLM judge can accelerate iteration, but calibrate it against expert labels. Deterministic checks remain necessary for schema, citation existence, authorization, latency, and cost.

## Version the complete experiment

An experiment is reproducible only when it records:

- source snapshot/object versions;
- extraction, parser, and schema versions;
- chunker configuration;
- embedding model and preprocessing;
- candidate search index and mapping;
- BM25/vector candidate counts and fusion;
- reranker and top-N;
- prompt, LLM, temperature, and token limits;
- code, container, and deployment configuration;
- metrics by cohort, latency, and cost.

The production handoffs demonstrate durable cloud metadata and versioned container/deployment artifacts. A unified experiment registry such as MLflow is a possible improvement, not a requirement for disciplined versioning.

## Promotion flow

```text
candidate data/model/index/prompt
    → unit and contract tests
    → offline golden-set evaluation
    → security and authorization tests
    → load and failure tests
    → shadow production traffic
    → small canary
    → monitored promotion
    → retain previous version for rollback
```

A candidate is rejected if a critical cohort regresses even when the average improves.

Promotion gates should include:

- no authorization leakage;
- extraction and retrieval thresholds;
- citation and abstention thresholds;
- p95/p99 latency budget;
- cost per successful answer;
- load and dependency-failure behavior;
- tested index, prompt/model, and service rollback.

## Production feedback loop

Collect privacy-safe signals:

- low-confidence and abstained questions;
- negative feedback;
- zero-result and high-cost queries;
- novel question patterns;
- citation disagreements;
- source/freshness distribution changes.

Domain experts adjudicate selected examples. Add them to a future evaluation set, not the held-out set currently used to report performance.

Run scheduled regression tests against a stable baseline. Monitor shifts in query mix, retrieval scores, source mix, citation coverage, abstention, token use, and model behavior.

## When to fine-tune

Use this order:

1. repair source data and extraction;
2. fix project filters and normalization;
3. improve chunks, hybrid retrieval, or reranking;
4. improve context and prompt contract;
5. fine-tune embeddings for a persistent measured semantic gap;
6. fine-tune the generator for a persistent behavior or formatting gap.

RAG solves changing knowledge. Fine-tuning changes behavior. Do not train facts into model weights when the index can update them with better freshness and citations.

## Interview summary

> “I separate extraction, retrieval, and generation evaluation so I know which layer caused a bad answer. Every candidate records source, parser, chunker, embedding, index, retriever, prompt, model, and container versions. It passes offline domain evaluation, security and load tests, then shadow and canary checks. We keep the prior index and service configuration available for rollback. Fine-tuning is the last step, only after evidence and retrieval problems are ruled out.”

→ Next: **[Reliability, Security & Observability](06-reliability-security-observability.md)**
