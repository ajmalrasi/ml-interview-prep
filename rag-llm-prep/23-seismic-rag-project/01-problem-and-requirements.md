# Problem, Scale & Requirements

**TL;DR:** The business problem is slow, fragmented discovery of seismic product facts. The technical problem is building a trustworthy knowledge layer over huge, heterogeneous files without moving raw samples into the RAG system.

> **In simple words — what this page teaches:** Learn what problem the project solves, who uses it, what “good” looks like, and why 40 PB does not mean embedding 40 PB.

## Business objective

Seismic engineers and operations teams need answers about product identity, geometry, header contents, ingestion state, L1/L2/product QC, lineage, delivery, and failures. Today those facts may live in file headers, pipeline metadata, QC outputs, object stores, and operational systems.

The product objective is:

> Reduce time-to-answer while preserving source traceability and project-level confidentiality.

The RAG service is not a replacement for seismic compute. A question requiring statistics over trace amplitudes must be routed to domain processing or a precomputed result. RAG explains and finds existing knowledge.

## Users, inputs, and outputs

| Dimension | Design |
|---|---|
| Users | Geoscientists, ingestion/QC engineers, operations, delivery, support |
| Inputs | Natural-language question, user identity, project context, optional product/file filters |
| Evidence | EBCDIC/textual headers, normalized metadata, QC summaries, lineage, delivery and operational records |
| Output | Concise answer, source references, relevant product/file IDs, confidence/abstention state |

## Functional requirements

1. Detect new or changed S3/GCS object versions.
2. Stream only required SEG-Y regions instead of downloading multi-TB objects.
3. Extract and preserve textual/binary headers and selected trace metadata.
4. Normalize inconsistent vendor fields into a versioned canonical schema.
5. Index product, file, QC, lineage, source location, and access-control relationships.
6. Support exact structured lookups and semantic questions.
7. Require citations and refuse unsupported answers.
8. Handle backfills, retries, re-ingestion, deletion, and embedding migrations.

## Non-functional requirements

- **Scale:** size by object count, indexed document count, request volume, and change rate—not by blindly embedding 40 PB.
- **Latency:** maintain separate SLOs for exact metadata queries and hybrid retrieval + generation. Report measured p50/p95/p99.
- **Availability:** stateless multi-replica API; external durable state; graceful provider degradation.
- **Consistency:** object version/manifest is authoritative; the search projection is eventually consistent and versioned.
- **Security:** least privilege, encryption, private networking, pre-retrieval authorization filters, auditability.
- **Reliability:** deterministic identity, bounded retry, quarantine/dead-letter handling, resumable backfills.
- **Cost:** token budgets, batch embeddings, controlled reranking, provider quotas, spot only for replayable work.

## Success criteria

### Retrieval

- Recall@K: did top-K contain the necessary source?
- MRR/NDCG: did the useful evidence rank early and in the right order?
- Context precision/recall: did the final context contain enough relevant evidence without noise?
- Filter correctness: did tenant/project/product constraints select the right corpus?

### Generation

- Faithfulness and answer relevance
- Citation correctness and source coverage
- Correct abstention on missing or conflicting evidence
- Domain-expert acceptance by question cohort

### System and business

- p50/p95/p99 latency, availability, ingestion freshness, error/retry rate
- cost per indexed document, changed file, and answered query
- search success, time-to-answer, repeat adoption, fewer manual escalations

## Assumptions to state, not hide

- Individual objects may be hundreds of GB or multiple TB.
- Header layout and encoding may be wrong even when the extension says SEG-Y.
- Some answers come from exact structured state, not semantic text retrieval.
- Freshness can be eventually consistent; destructive or compliance workflows may require the authoritative manifest.
- Availability and latency targets must come from business SLOs and measured baselines, not invented interview numbers.

## Principal-level framing

Do not begin with “We used OpenSearch.” Begin with the constraint and consequence:

> “Because the source objects are multi-terabyte, we designed around metadata-selective range reads, idempotent version processing, and a compact knowledge index. That bounded network, memory, embedding, and LLM cost independently of raw seismic bytes.”

That is system design. The tool list is supporting detail.
