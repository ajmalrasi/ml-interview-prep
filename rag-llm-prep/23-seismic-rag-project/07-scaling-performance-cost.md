# Scaling, Performance & Cost

**TL;DR:** Do not size the RAG system from petabytes of trace samples. Size it from knowledge documents, change rate, embedding tokens, filtered-search workload, query concurrency, context size, and measured service times.

## Start with the correct units

The seismic platform’s raw storage is not the RAG corpus size.

Estimate:

```text
header documents
+ normalized product summaries
+ QC and lineage documents
+ operational/runbook documents
= searchable documents
```

Stratify by source type, product type, vendor, and update frequency. Measure low/base/high scenarios from samples.

The capacity inputs are:

- documents and chunks;
- tokens per chunk;
- daily changed objects;
- backfill size and completion window;
- embedding throughput;
- index bytes and replicas;
- query mix and peak request rate;
- retrieval candidates and reranker use;
- context/output token distributions;
- latency and availability SLOs.

## Offline capacity

### Event consumer

The SQS consumer is lightweight. Scale it from queue age and receive rate, not GPU or large CPU. Its job is to submit work safely.

### Extraction workers

Measure object-range throughput, parsing CPU, memory high-water mark, and failure rate by source type. Apply separate concurrency limits for oversized objects or noisy vendors.

### Embedding workers

```text
embedding wall time
≈ total changed tokens / measured tokens per second
```

Then account for batch efficiency, provider quotas, retries, checkpoints, and worker count. The freshness SLO determines whether CPU, GPU, or hosted embeddings are justified.

### Fresh updates versus backfills

Use separate Airflow pools or queues. Reserve capacity for recent changes and let backfills consume the remaining budget. Otherwise a historical replay can make the “production” index stale.

## Search-index capacity

Estimate a lower bound:

```text
raw vector bytes
= documents × dimensions × bytes per value
```

Then benchmark the real total:

- text and stored metadata;
- ANN graph/partition overhead;
- replicas;
- segments and merge headroom;
- filtering structures;
- operating headroom and failure domains.

Test filtered hybrid queries while bulk indexing is active. Project authorization filters can change vector-search performance, so an unfiltered benchmark is incomplete.

OpenSearch should be selected because measured workload benefits from lexical search, vectors, filters, aggregations, and operational maturity—not because it appears on an architecture diagram.

## Online service capacity

Approximate concurrent demand:

```text
required concurrency
≈ peak requests per second × p95 service time
```

Measure safe concurrency per replica under the real dependency mix, then add redundancy, canary/rollout headroom, and downstream quotas.

Useful autoscaling signals include:

- in-flight and waiting requests;
- p95/p99 latency and deadline misses;
- search and provider saturation;
- CPU/memory;
- token throughput;
- queue depth for any asynchronous query work.

CPU alone may scale the wrong layer when latency is dominated by search, reranking, or the hosted LLM.

## Latency budget

Break the SLO into stages:

```text
auth
+ routing
+ retrieval
+ rerank
+ context assembly
+ model time to first token
+ generation
+ validation
= end-to-end latency
```

Set deadlines and budgets by query type. Exact metadata lookup should not pay for vector retrieval, reranking, and a large model when a deterministic response is sufficient.

## Cost model

### Offline

```text
changed documents
× average tokens
× embedding rate
+ extraction compute
+ workflow/worker compute
+ index storage and writes
```

### Online

```text
queries × (
  query embedding
  + retrieval/rerank
  + input tokens × input rate
  + output tokens × output rate
)
```

Track cost per successfully indexed change and per successful answer. A cheap wrong answer is not efficient.

## Cost controls

- extract and embed only changed immutable versions;
- batch embeddings;
- cap candidate count and context tokens;
- rerank only ambiguous queries;
- route simple tasks to smaller models;
- cache only within authorization and version boundaries;
- keep retries bounded;
- use spot for replayable, checkpointed offline work;
- keep a reliable on-demand floor for interactive serving;
- retire old indexes only after rollback windows expire.

## Likely bottlenecks

1. source-range request throttling;
2. heterogeneous parsing and quarantine;
3. embedding quota during backfills;
4. vector memory and filtered ANN latency;
5. concurrent bulk indexing versus query traffic;
6. reranker and hosted-LLM tail latency;
7. context growth and token cost;
8. cold capacity during sudden traffic or replay.

## Capacity answer for an interview

> “I would not derive RAG capacity from 40 PB because we do not embed trace samples. I would sample each knowledge source, measure documents and tokens per product plus change rate, benchmark extraction and embedding throughput, and measure filtered hybrid search under concurrent indexing. For the API I would use peak RPS times p95 service time, then add downstream quotas, redundancy, and rollout headroom. I would report low/base/high scenarios instead of one invented number.”

→ Next: **[Failure Scenarios & Production Debugging](08-failure-debugging.md)**
