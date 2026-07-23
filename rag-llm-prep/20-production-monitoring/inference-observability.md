# Inference Observability with Prometheus & Grafana

**TL;DR:** An inference dashboard must connect the customer symptom to the scheduler and then
to the GPU. Scrape request, engine, and hardware signals with bounded-cardinality labels;
annotate releases and benchmark baselines; and alert on sustained SLO burn or loss of goodput,
not on one ambiguous GPU-utilization gauge.

## One request, four layers

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">gateway<span class="nsub">rate · errors · E2E</span></span><span class="arw"></span>
    <span class="node">router<span class="nsub">queue · admission · retries</span></span><span class="arw"></span>
    <span class="node soft">engine<span class="nsub">TTFT · ITL · tokens · KV</span></span><span class="arw"></span>
    <span class="node out">GPU<span class="nsub">compute · memory · power · health</span></span>
  </div>
</div>
```

Use the same request ID in logs/traces, but do not put request IDs, user IDs, or prompt text
in Prometheus labels. Metrics need low-cardinality dimensions such as model alias, engine
version, GPU SKU, region, workload class, and status class.

## Metric map

| Layer | Core signals | What they distinguish |
|---|---|---|
| Client/gateway | request rate, errors, E2E, disconnects, streamed TTFT/ITL | real user experience and network/gateway effects |
| Router/admission | queue depth/age, rejected/load-shed requests, retries, route/replica | offered load versus admitted load |
| Engine | prompt/generation tokens, running/waiting requests, TTFT/ITL, KV usage, preemption, cache hits | scheduler and cache behavior |
| GPU/node | compute activity, memory used/bandwidth, power/clock/thermal, ECC/XID health, interconnect | hardware bottleneck or failure |
| Business/capacity | goodput, cost/token, capacity headroom, SLO burn | whether performance is useful and affordable |

Histograms are needed for aggregatable latency distributions. Choose buckets around the
actual SLOs, keep units explicit, and preserve enough resolution at the tail. A client-side
histogram and an engine-side histogram may measure different boundaries; name them clearly.

## Dashboard layout

### Row 1: Can customers use it?

- offered and completed request rate;
- success/error/timeout/load-shed rate;
- p50/p95/p99 E2E, TTFT, and ITL against SLO lines;
- goodput and SLO burn.

### Row 2: Is demand beyond safe capacity?

- running and waiting requests, oldest queue age;
- input/output tokens per second and active cached tokens;
- KV-cache usage, preemptions/recompute, prefix-cache hit rate;
- per-replica safe-capacity baseline and current headroom.

### Row 3: What resource is limiting it?

- GPU compute activity and memory usage/bandwidth indicators;
- power, clocks, thermal throttling, ECC/XID or analogous health;
- tensor/expert-parallel communication and interconnect throughput;
- CPU, host memory, network, and model-storage latency.

### Row 4: What changed?

- deployment/model/engine/config annotations;
- benchmark baseline and qualification report link;
- canary versus stable comparison;
- breakdown variables for model, engine, GPU SKU, region, and workload cohort.

Grafana annotations turn “latency rose at 14:03” into “engine candidate began canary at
14:01.” Store the immutable run/config ID behind the annotation.

## Alerts are decisions, not panels

| Alert | Useful trigger | Automated response candidate |
|---|---|---|
| Fast SLO burn | high TTFT/ITL error-budget burn over short + confirming window | page and stop rollout |
| Slow SLO burn | sustained lower burn over a longer window | ticket/capacity review |
| Goodput collapse | offered load stable/rising while SLO-compliant completions fall | load shed, route, or add ready capacity |
| Queue saturation | queue age/depth rising with flat throughput | protect deadlines; scale if warm capacity can arrive |
| KV pressure | high cache usage plus preemption/recompute and tail regression | admission/token limits or tuning |
| GPU health | hardware error, throttling, or failed telemetry | drain/quarantine node |
| Canary regression | candidate worse than stable on matched cohorts | automatic rollback |

Do not page on high GPU utilization alone. High utilization may be healthy batching; low
utilization may coexist with memory-bandwidth, communication, or queue-policy bottlenecks.

## Benchmark data and production telemetry must meet

The qualification pipeline should publish:

- safe per-replica capacity by workload cohort;
- expected TTFT/ITL/goodput bands;
- model/engine/config/hardware IDs;
- date, sample count, and uncertainty;
- artifact/report link.

Production dashboards use those as overlays or reference series. When real traffic drifts
outside the benchmarked ISL/OSL or concurrency distribution, flag **coverage drift**: the
capacity claim may no longer apply even if the binary did not change.

## Prometheus design pitfalls

- Avoid unbounded labels such as request ID, prompt, tenant, error message, or commit SHA per
  sample; use logs/traces or controlled metadata for those.
- Apply `rate()` to counters before aggregation; do not average already-averaged percentiles.
- Preserve histogram buckets when aggregating across replicas.
- Separate missing telemetry from a real zero.
- Version recording/alert rules and test them with synthetic series.
- Define retention/downsampling so short ITL incidents and long cost trends both remain useful.

## Interview answer

> I would instrument the gateway, admission/router, engine, and GPU layers and join them by
> time, model/config, replica, and low-cardinality workload cohort. The top row is customer
> SLO and goodput; lower rows explain queue/KV and hardware causes. Releases and benchmark
> baselines become Grafana annotations. Alerts use multi-window SLO burn, queue/goodput
> collapse, KV pressure, hardware health, and matched canary regression. A single utilization
> gauge never decides a rollout or capacity action.

## Primary references

- [vLLM production metrics](https://docs.vllm.ai/en/latest/design/metrics/)
- [NVIDIA DCGM Exporter](https://docs.nvidia.com/datacenter/dcgm/latest/gpu-telemetry/dcgm-exporter.html)
- [Prometheus histograms and summaries](https://prometheus.io/docs/practices/histograms/)
- [Grafana annotations](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/annotate-visualizations/)

→ Drill: **[Production Monitoring Interview Questions](interview-questions.md)**
