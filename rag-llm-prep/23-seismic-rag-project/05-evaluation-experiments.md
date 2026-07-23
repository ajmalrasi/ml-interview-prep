# Evaluation & Experiments

**TL;DR:** Evaluate extraction, retrieval, and generation separately on a domain golden set. Use RAGAS as an assistant, not ground truth. Promote only when quality, latency, cost, security, and regression gates all pass.

> **In simple words — what this page teaches:** Learn how to test each layer separately so you can tell whether a bad answer came from extraction, search, or the LLM.

## Build a seismic golden dataset

Work with seismic engineers to create representative questions and verified answers across:

- 2D, 3D, OBN, and non-binned shot data
- vendors and header styles
- S3/GCS sources and different object sizes
- SEG-Y/MDIO versions and malformed inputs
- ingestion, L1, L2, product QC, lineage, and delivery
- exact, semantic, mixed, multi-source, and unanswerable questions
- confidentiality boundaries and prompt-injection cases

Each item includes question, authorized scope, expected structured facts, relevant source IDs/passages, acceptable answer points, and whether the correct behavior is abstention.

Split by product/survey. Random chunk splits leak repeated headers and overstate performance.

## Layer 1: metadata extraction

Evaluate independently of retrieval:

- exact match for IDs, categorical fields, and controlled values
- numeric tolerance for coordinates/ranges where appropriate
- per-field precision, recall, and F1
- schema-valid rate and extraction coverage
- confidence calibration and manual-review rate
- results sliced by vendor, encoding, SEG-Y version, and failure type

A retrieval score cannot reveal that the wrong inline range was extracted correctly from the wrong bytes.

## Layer 2: retrieval

| Metric | What it tells you |
|---|---|
| Recall@K | Relevant evidence exists in top K |
| MRR | First relevant result appears early |
| NDCG | Multiple relevant results are well ordered |
| Context precision | Final context is not mostly noise |
| Context recall | Final context contains enough evidence |
| Filter accuracy | Scope/entities selected the correct corpus |

Slice metrics by structured/semantic/mixed question, vendor, product type, and exact identifier presence. An average can hide a broken OBN or vendor cohort.

## Layer 3: generation

Measure:

- faithfulness/claim support
- answer relevance and completeness
- citation validity, entailment, and source coverage
- abstention precision/recall
- structured-output validity
- domain expert rating
- end-to-end p50/p95 latency and token/currency cost

RAGAS helps automate context precision/recall, faithfulness, and relevance in offline iteration. Calibrate LLM-as-judge scores against expert labels. Keep deterministic retrieval, schema, citation, latency, and cost tests because no judge is perfect.

## Experiment tracking

Record one immutable experiment bundle:

- dataset snapshot and split
- parser/schema/normalization versions
- chunk strategy and token statistics
- embedding model/dimension/preprocessing
- OpenSearch mapping and ANN parameters
- BM25/vector candidate counts and fusion method
- reranker and top-N
- prompt/model/temperature/token limits
- code/container revision
- all metrics by cohort, latency, and cost

Native cloud metadata and versioned artifacts implement this today. MLflow is a useful future improvement for one comparison UI, lineage, and promotion registry; do not make reproducibility depend on a product name.

## Promotion criteria

A candidate moves to production only when:

1. no critical cohort or authorization regression exists
2. retrieval/citation/abstention thresholds pass
3. human review passes for confidential or high-impact questions
4. latency and cost remain within budget
5. load, fault, and security tests pass
6. shadow/canary metrics are healthy
7. index, service, and prompt rollback paths are tested

## Production quality loop

Sample queries with privacy-safe logging. Review low-confidence, abstained, negative-feedback, high-cost, and novel-intent cases. Add adjudicated examples to a future evaluation set—not the current held-out set. Run the regression suite on every parser, chunker, embedding, retriever, prompt, and model change.

Monitor shifts in zero-result rate, top-score distribution, retrieved source mix, citation coverage, faithfulness samples, abstention rate, tokens/query, and user success. These are degradation signals; periodically validate them against labeled outcomes.

## Fine-tuning decision order

1. fix source data and extraction
2. fix normalization/metadata filters
3. improve chunks and retrieval/fusion
4. improve prompt/context assembly
5. fine-tune embeddings for a measured semantic gap
6. fine-tune the LLM for stable behavior only

Most RAG failures are evidence failures before they are model-training failures.
