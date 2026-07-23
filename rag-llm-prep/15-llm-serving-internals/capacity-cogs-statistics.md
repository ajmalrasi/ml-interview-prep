# Capacity, COGS & Statistical Decisions

**TL;DR:** Capacity is the maximum *goodput* that still meets the customer SLO with failure
headroom—not the highest observed tokens/sec. Convert a repeated saturation curve into a safe
per-replica operating point, then include idle capacity, redundancy, and the full serving
stack when calculating cost.

## Step 1: Prove the model fits

GPU memory is consumed by:

1. model weights and quantization metadata;
2. runtime workspace, activations, temporary buffers, and compiled graphs;
3. KV cache for active sequences;
4. safety margin for allocator behavior and workload variation.

For a transformer with grouped-query attention, an approximate KV-cache size per sequence is:

```rawhtml
<div class="formula">
  <div class="frow"><span class="fexpr">KV bytes ≈ 2 × layers × KV heads × head dimension × cached tokens × bytes/element</span></div>
  <div class="frow"><span class="fexpr">2 = key + value</span></div>
</div>
```

Multiply by concurrent cached tokens across sequences, then account for block allocation and
runtime overhead. Do not use hidden size blindly when the model has fewer KV heads than query
heads. Measure actual free/used KV blocks after model load to validate the estimate.

For MoE, all or most expert weights may still need to reside in GPU memory even though each
token activates only a subset. Sparse compute does not automatically mean sparse storage.

## Step 2: Find the operating frontier

For each representative cohort:

1. start at low request rate/concurrency;
2. increase load in controlled steps;
3. record p50/p95/p99 TTFT, ITL, E2E, throughput, goodput, errors, queue, and KV pressure;
4. continue beyond the expected peak until throughput flattens or safety limits stop the run;
5. repeat points around the knee.

```text
load increases      batching benefit        saturation knee        overload
throughput           rises efficiently       begins to flatten      flat/failing
tail latency         modest                  bends upward            explodes
goodput              rises                   peaks                   falls
```

Choose the safe operating point before the knee, where the required SLO still passes with
headroom. A server may complete more tokens beyond that point while delivering less goodput.

## Step 3: Convert benchmark capacity to fleet capacity

Let:

- `G_replica` = GPUs per replica;
- `C_safe` = safe goodput per replica for the production workload;
- `R_peak` = forecast peak offered load;
- `H` = planned utilization fraction after reserving headroom, such as `0.7` or a value
  justified from burst/failure policy.

```rawhtml
<div class="formula">
  <div class="frow"><span class="fexpr">replicas_base = ceil(R_peak ÷ (C_safe × H))</span></div>
  <div class="frow"><span class="fexpr">GPUs_base = replicas_base × G_replica</span></div>
</div>
```

Then apply availability constraints explicitly:

- largest failure domain (node, rack, zone);
- rolling upgrade/canary capacity;
- model-load and autoscaling delay;
- forecast error and burst duration;
- fragmentation when multiple models share a fleet.

Do not hide these by multiplying an unexplained “2× safety factor.” Show what each reserve
protects and test the N−1 or zone-loss scenario.

## Step 4: Calculate cost on achieved useful work

For a continuously occupied replica:

```rawhtml
<div class="formula">
  <div class="frow"><span class="fexpr">GPU cost / 1M output tokens = hourly GPU cost × GPUs per replica × 1,000,000 ÷ (good output tokens/s × 3,600)</span></div>
</div>
```

Use the good output-token rate at the safe operating point, not the maximum benchmark rate.
If billing or product economics include input tokens, report input and output cost separately
or define the blended denominator precisely.

Full COGS also includes:

- idle/headroom and failed-capacity reserve;
- CPU/RAM nodes, gateway/router, load generator where relevant;
- model storage, image/weight transfer, and inter-zone/network cost;
- observability retention and control-plane services;
- software/support/licensing where applicable;
- energy/power where owned infrastructure makes it material.

State whether the number is marginal GPU cost, allocated infrastructure cost, or fully loaded
COGS. Those are different business questions.

## Compare configurations on the Pareto frontier

One configuration may have better TTFT and another lower cost. Do not collapse every metric
into an unexplained score.

Discard configurations that are:

- lower goodput *and* higher latency *and* higher cost than another;
- outside quality tolerance;
- unable to meet the critical SLO cohort;
- operationally unsupported.

Present the remaining Pareto frontier with a recommendation tied to product priority:
interactive latency, batch throughput, cost, hardware availability, or operational simplicity.

## Statistical decision checklist

| Risk | Control |
|---|---|
| Cold-start/compiler effects | declared warmup; report cold start separately |
| Thermal/time trend | randomized/alternating run order; telemetry |
| Noisy neighbor | isolated host or measured contention; independent trials |
| Different generated lengths | fixed output tokens or normalize and report distribution |
| Tail instability | adequate request count and repeated trials |
| Multiple tuning trials | confirm winner on held-out/repeated run; retain all attempts |
| Small but “significant” change | predeclare practical regression budget |
| Large but uncertain change | more evidence or investigate; do not average it away |

Error bars do not rescue a biased experiment. Control comparability first, then quantify
remaining random uncertainty.

## Worked decision, without invented performance numbers

Suppose configuration A has lower single-request TTFT, while B batches more aggressively.
Run both over the same open-loop production-shaped rate sweep:

- A may win the low-load interactive cohort.
- B may deliver more total output tokens at moderate load.
- Near overload, either may lose goodput first due to TTFT or ITL violations.

Pick the configuration whose safe goodput meets forecast peak with the least fully loaded
cost and required headroom. If user cohorts differ, separate interactive and batch pools
instead of forcing one scheduler policy to serve incompatible SLOs.

## Interview answer

> I first estimate weights, runtime reserve, and KV memory, then validate actual cache
> capacity. I sweep production-shaped open-loop load through saturation and select a safe
> goodput point before the tail-latency knee. Fleet sizing divides peak demand by that safe
> per-replica capacity, then adds explicit failure, rollout, cold-start, and forecast reserves.
> Cost per million uses achieved SLO-compliant tokens and includes idle/headroom plus the
> surrounding stack. I repeat knee points, quantify uncertainty, and present the Pareto
> frontier instead of inventing a universal winner.

## Primary references

- [vLLM metrics](https://docs.vllm.ai/en/latest/design/metrics/)
- [NVIDIA AIPerf goodput](https://docs.nvidia.com/aiperf/tutorials/metrics-analysis/benchmark-goodput-with-ai-perf)
- [TensorRT-LLM performance benchmarking](https://nvidia.github.io/TensorRT-LLM/performance/perf-benchmarking.html)

→ Next: **[vLLM in Production](vllm-production.md)**
