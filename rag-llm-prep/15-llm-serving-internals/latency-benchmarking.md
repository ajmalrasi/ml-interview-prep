# TTFT, ITL & Reproducible LLM Benchmarks

**TL;DR:** "Tokens per second" is not one metric. Production inference needs separate
distributions for queue time, **TTFT**, **ITL/TPOT**, end-to-end latency, and throughput,
measured under a declared prompt/output/concurrency workload. A benchmark without workload,
warmup, percentiles, quality parity, and hardware/config metadata is not reproducible evidence.

## The latency vocabulary

For a streaming request received at time `t0`, with first token at `t1` and final token at
`tn`:

- **TTFT (Time To First Token)** = `t1 - t0`. Includes queueing, tokenization, scheduling,
  and prefill before the first streamed token.
- **ITL (Inter-Token Latency)** = time between successive output tokens. Report its
  distribution, not just one average.
- **TPOT (Time Per Output Token)** is commonly the decode duration divided by the number of
  decode intervals. Tools differ on exact convention; state yours.
- **End-to-end latency** = `tn - t0`.
- **Per-request generation rate** is derived from decode tokens and decode time.
- **System throughput** = total completed output tokens per wall-clock second across all
  requests. This is not the same as one user's streaming rate.
- **Goodput** = throughput from requests that satisfy the SLO. It prevents a system from
  looking "fast" by completing lots of work while violating latency targets.

For `N` output tokens, a useful approximation is:

```rawhtml
<div class="formula"><div class="frow"><span class="fexpr">E2E ≈ TTFT + (N − 1) × mean_ITL</span></div></div>
```

It explains why TTFT dominates short answers while ITL dominates long generations.

## Start with an SLO, not an engine flag

A configuration can maximize throughput by batching aggressively yet feel terrible in an
interactive chat. Another can minimize single-request latency while wasting most GPU capacity.
Define success first, for example:

- p95 TTFT below the interactive target;
- p99 ITL below the "no visible pause" target;
- error rate below the reliability target;
- minimum goodput at expected peak arrival rate;
- quality equal to the baseline within a declared tolerance;
- cost per million generated tokens.

Only then compare configurations.

## The workload matrix

Benchmark representative combinations instead of one convenient prompt:

| Dimension | Example buckets | Why it changes the result |
|---|---|---|
| Prompt length | 128, 2k, 8k, 32k | prefill work and KV allocation |
| Output length | 32, 256, 1k | decode duration and residency |
| Concurrency / arrival rate | 1 to overload | batching opportunity and queueing |
| Repeated prefixes | 0%, 50%, 90% | prefix-cache value |
| Sampling | greedy vs production settings | kernel path and output variance |
| Model/runtime | dtype, quantization, TP size | memory, compute, communication |

Use the production distribution as the headline result and synthetic buckets to explain why
it behaves that way. Fix random seeds or use fixed token counts when comparing system speed;
otherwise different generated lengths contaminate the result.

## Closed-loop vs open-loop load

- **Closed loop:** each client sends its next request after the previous one completes.
  Useful for saturation curves, but the arrival rate falls automatically when the server
  slows, hiding queue collapse.
- **Open loop:** requests arrive according to an independent schedule. Better for modelling
  real traffic and burst behavior because overload continues to arrive.

A strong evaluation uses both: closed loop to understand capacity and open loop to validate
SLOs near and beyond the expected peak.

## Reproducibility checklist

Record enough information for another engineer to rerun the experiment:

1. Model revision, tokenizer revision, dtype/quantization, maximum context.
2. Engine/container version, command/config, CUDA and driver versions.
3. GPU model/count, memory, power/clock policy, interconnect, CPU/RAM/storage.
4. Dataset or generated workload, prompt/output histograms, seed, arrival process.
5. Warmup policy and measurement window.
6. Concurrency, request rate, timeout, retries, streaming/non-streaming behavior.
7. p50/p95/p99 for TTFT, ITL, E2E, queue and prefill/decode time.
8. Output-token throughput, goodput, error/preemption rate, KV-cache utilization.
9. Quality parity checks for quantization, speculation, or model changes.

Warm the model, kernels, allocator, and representative KV-cache state before measuring.
Run long enough to expose thermal throttling, cache churn, memory fragmentation, and queue
growth. Repeat trials and show variance; a single run is a demo, not a result.

## Find the capacity knee

Increase arrival rate or concurrency gradually. At first, batching improves throughput with
small latency cost. Near saturation, queue time rises sharply; beyond it, throughput flattens
while tail latency explodes. The useful operating point is before that knee, with headroom
for bursts and failures.

Do not autoscale from GPU utilization alone. A decode server can be memory-bandwidth-bound,
KV-capacity-bound, or queue-bound while a coarse utilization percentage looks ambiguous.
Queue depth, TTFT/ITL SLO burn, running/waiting requests, KV usage, and tokens per second form
a much better signal set.

## Reading common benchmark outcomes

| Result | Interpretation | Next experiment |
|---|---|---|
| Better throughput, worse ITL | batches too aggressive for chat SLO | lower token budget / separate pool |
| TTFT worsens only for long prompts | prefill scheduling pressure | chunked prefill / prefix cache |
| More TP lowers memory but hurts latency | collective overhead dominates | inspect topology and NCCL |
| Quantization helps decode, little prefill gain | decode was bandwidth-bound | profile phase separately |
| Speculation helps at low load only | draft overhead/batch interaction | acceptance rate by concurrency |
| p50 stable, p99 explodes | queueing, preemption, or noisy neighbor | timeline tails, not averages |

## A strong interview answer

> I would freeze the model, quality target, hardware, and prompt/output distribution; warm
> the service; then sweep concurrency and arrival rate. I would report p50/p95/p99 TTFT,
> ITL, and E2E alongside output-token throughput, goodput, KV usage, preemptions, errors,
> and cost. The winner is the cheapest configuration that meets the latency and quality
> SLOs at peak load with headroom—not the one with the largest isolated tok/s number.

## Primary references

- [vLLM production metrics](https://docs.vllm.ai/en/latest/design/metrics/)
- [PyTorch profiler](https://docs.pytorch.org/docs/stable/profiler.html)
- [NVIDIA DCGM exporter](https://docs.nvidia.com/datacenter/dcgm/latest/gpu-telemetry/dcgm-exporter.html)

→ Next: **[vLLM in Production](vllm-production.md)**
