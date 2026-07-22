# Data, Embeddings & OpenSearch

**TL;DR:** Index compact, source-aware knowledge—not traces. Chunk by meaning and operational unit, attach exact lineage, choose embeddings through a domain evaluation, and publish OpenSearch indexes with aliases.

## What becomes a searchable document

Index:

- decoded textual/EBCDIC header sections
- selected binary and trace-header metadata
- normalized product and geometry summaries
- ingestion status and parser warnings
- L1, L2, and product QC summaries
- lineage, conversion, delivery, and operational events
- source URI/version and precise source locator

Do not blindly index:

- complete trace-sample arrays
- enormous raw QC payloads when a summary plus pointer is sufficient
- repeated boilerplate that will dominate retrieval
- secrets or fields users are not authorized to retrieve
- content without a stable product/file/source relationship

## Chunking for technical headers

Generic fixed 512-token chunks are not automatically correct. Headers are short, structured, and sometimes line-oriented.

Use semantic units:

- one textual-header section or related card range
- one normalized product summary
- one QC stage/result with its reason codes
- one operational event or failure record
- one delivery/lineage relationship

Do not split a field name from its value or a QC outcome from its explanation. Add small overlap only where prose crosses a boundary. Preserve the raw line/card range so a citation can lead back to exact evidence.

## Relationship model

```text
Project
  └── Product
       ├── File (source URI + immutable object version)
       │    ├── Header chunk (source byte/card/line range)
       │    └── Parser/QC warnings
       ├── QC result (stage + run + status)
       └── Delivery / conversion / operational events
```

Every document carries `tenant_id`, `project_id`, `product_id`, `file_id`, and `source_type`. That supports pre-retrieval authorization, joins-by-filter, diversity, deletion, and traceable citations.

## Embedding model selection

Compare candidates on the seismic golden set, not a public benchmark alone:

- semantic Recall@K and NDCG by vendor/question type
- context length and truncation behavior
- embedding dimension and index memory
- batch throughput, latency, provider quota, and cost
- deployment/privacy constraints and multilingual needs
- stability/versioning and migration support

Higher dimension is not automatically better. Approximate raw vector storage as:

```text
documents × dimensions × bytes_per_value × ANN_overhead × replicas
```

The same model/version and preprocessing must embed documents and queries. Domain fine-tuning is justified only when measured misses remain after fixing extraction, normalization, chunking, filters, and fusion.

## OpenSearch mapping

Important fields include:

| Group | Fields |
|---|---|
| Security | `tenant_id`, `project_id`, ACL groups |
| Identity | `product_id`, `file_id`, `chunk_id`, deterministic `doc_id` |
| Source | cloud, bucket/key, object version, URI, source type, byte/card/line locator |
| Seismic | SEG-Y revision, survey type, inline/crossline ranges, FFID/CDP/shot metadata |
| Operations | ingestion stage/status, QC stage/status, delivery state, timestamps |
| Versioning | parser, schema, chunker, embedding model, index generation |
| Search | analyzed `content_text`, keyword subfields, `content_vector` |

Use explicit mappings for identifiers and filter fields. Do not let dynamic mapping turn IDs or numeric ranges into accidental text.

## ANN choice

- HNSW: strong recall/latency, higher memory and build cost.
- IVF-style partitioning: useful at larger scale, but needs representative training and tuning such as probe count.
- Exact/flat search: simplest and a useful recall baseline for smaller corpora/evaluation.

Choose with measured recall, p95 latency, indexing throughput, memory, and filtered-search behavior. Filtering by tenant/project changes ANN performance and must be in the benchmark.

## Bulk indexing and blue-green publication

1. Create a physical index such as `seismic_knowledge_v17`.
2. Bulk-index with bounded batches and item-level error handling.
3. Compare expected vs written counts; sample documents and run retrieval regression tests.
4. Atomically move the stable read alias.
5. Observe the new generation and retain the old index for rollback.
6. Delete stale documents/index only after the replacement is healthy.

This also handles embedding-model migration: build a parallel index because vectors from different models do not share one meaningful space.

## Leakage prevention and versioning

Split evaluation by product or survey, not random chunks. Near-duplicate headers from one product must not appear in both tuning and held-out sets.

Version the dataset snapshot, source objects, parser, schema, normalization rules, chunker, embedding model, OpenSearch mapping/ANN settings, prompt, and code revision. Without that chain, an experiment score cannot be reproduced.
