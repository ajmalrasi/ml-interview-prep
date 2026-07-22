# Trade-offs, Capacity & Cost

**TL;DR:** Defend each choice with workload evidence. Estimate from file count, chunks, tokens, query mix, and benchmarks; never invent capacity numbers from “40 PB” alone.

## Trade-offs

| Decision | Chosen direction | Why | When the alternative wins |
|---|---|---|---|
| Batch vs streaming | Airflow batch/micro-batch | Large objects, QC dependencies, retries, reconciliation, backfills | Streaming when seconds-level freshness has proven value |
| Hosted LLM vs vLLM | Hosted generation | Faster delivery, strong models, less GPU operations | Self-host when policy, stable high utilization, or economics justify ownership |
| OpenSearch vs vector DB | OpenSearch | BM25 + vectors + filters + aggregations + operational maturity | Dedicated vector DB when measured scale/features exceed OpenSearch |
| Hybrid vs vector-only | Hybrid | Exact seismic tokens plus paraphrases | Vector-only only if domain evaluation shows no lexical loss |
| Fine-tune vs retrieval | Improve evidence first | Grounding failures usually start before generation | Fine-tune for measured semantic gaps or stable behavior |
| Managed vs Kubernetes | Workload/team dependent | Balance portability/control against operating burden | Use the option the team can reliably own |
| On-demand vs spot | Reliable online floor; spot offline | Availability online, savings for replayable work | Spot burst only with safe fallback |
| Strong vs eventual consistency | Authoritative manifest + eventual index | Search is a rebuildable projection | Route strict workflows to authoritative state |

## Document-count estimate

Do not divide 40 PB by an arbitrary chunk size. Sample representative file/product types:

```text
header_chunks = files × average_header_chunks_per_file
qc_documents  = products × average_qc_runs × documents_per_qc_run
ops_documents = products × average_operational_events
total_docs    = header_chunks + qc_documents + ops_documents + lineage/delivery
```

Calculate separately for 2D, 3D, OBN, non-binned shot, vendors, and oversized QC outputs. Report low/base/high scenarios.

## Index and vector storage

```text
raw_vector_bytes = documents × dimensions × bytes_per_value
total_index ≈ text + stored fields + vectors + ANN graph/partitions + segments
              + replicas + operational headroom
```

Measure actual OpenSearch index size from a representative pilot. ANN overhead, source fields, replicas, and segment behavior make the simple vector formula only a lower bound.

## Embedding throughput

```text
total_tokens = Σ tokens(chunk)
wall_time ≈ total_tokens / measured_tokens_per_second
```

Then apply batching efficiency, worker count, provider rate limits, retry rate, and checkpoint/restart overhead. GPU need comes from the required backfill/freshness window and measured throughput—not fashion.

## OpenSearch capacity

Benchmark representative filtered hybrid queries and indexing load together:

- shard size/count and routing strategy
- heap, off-heap vector memory, page cache, disk IOPS
- replicas and failure-domain placement
- HNSW/IVF parameters, recall, and p95 latency
- concurrent bulk indexing plus query traffic
- 30–50% operational headroom according to observed workload

Tenant/project filters can change ANN behavior. Include them in load tests.

## API replicas

Use queueing/load tests rather than CPU guesses:

```text
concurrency_needed ≈ peak_requests_per_second × p95_service_time_seconds
replicas ≈ concurrency_needed / safe_concurrency_per_replica
```

Add redundancy, rollout headroom, uneven latency, rate limits, and downstream quotas. The bottleneck may be provider concurrency or OpenSearch, not FastAPI CPU.

## LLM cost

```text
monthly_cost = queries ×
  (average_input_tokens × input_rate + average_output_tokens × output_rate)
```

Break input tokens into instructions, retrieved context, and conversation history. Add embedding/reranker calls and retry/fallback rates. Track cost per successful answer and by tenant/query type—not only the provider bill.

## Likely scaling bottlenecks

1. object-store range-request concurrency and throttling
2. parser variability/quarantine/reprocessing, not raw CPU alone
3. embedding quotas or batch throughput during backfills
4. OpenSearch vector memory and filtered ANN latency
5. reranker/LLM latency and concurrency
6. token growth from noisy context or chat history
7. one tenant or backfill starving fresh work

## The interview-safe capacity answer

> “I would not invent a document count from 40 PB because we index metadata, not samples. I would stratify files by survey/vendor type, measure chunks and tokens per file plus QC/ops records, project low/base/high counts, benchmark embeddings and filtered hybrid search, then size OpenSearch, workers, and API concurrency with failure and rollout headroom.”
