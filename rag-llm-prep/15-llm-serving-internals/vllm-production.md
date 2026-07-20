# vLLM in Production

**TL;DR:** vLLM is an inference engine and OpenAI-compatible server, not the whole product.
Put it behind an application/gateway layer, size it from workload and KV memory, tune with
measured SLOs, expose engine metrics, and roll model/runtime changes as carefully as code.

## Draw the boundary correctly

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">client</span><span class="arw"></span>
    <span class="node">gateway / app<span class="nsub">auth · quota · validation · routing</span></span><span class="arw"></span>
    <span class="node soft">vLLM replica<span class="nsub">schedule · KV · batch · execute</span></span><span class="arw"></span>
    <span class="node out">GPU</span>
  </div>
</div>
```

The gateway owns identity, authorization, tenant quotas, request validation, safety policy,
model aliases, retries, audit logging, and stable external contracts. vLLM owns tokenization,
scheduling, KV-cache blocks, batching, model execution, and token streaming.

Keeping that boundary allows an engine upgrade or a move to TensorRT-LLM/SGLang without
rewriting banking policy and product logic.

## Start with a controlled baseline

A minimal development launch is intentionally simple:

```bash
vllm serve MODEL_ID --host 0.0.0.0 --port 8000
```

In production, do not copy a giant flag list from a benchmark. Pin the container and model
revision, then tune categories against your workload:

- **Memory:** model length, GPU memory utilization, dtype/quantization, KV-cache dtype.
- **Scheduling:** maximum sequences, batched-token budget, chunked prefill, prefix caching.
- **Parallelism:** tensor/pipeline size and worker topology.
- **API/security:** served model names, authentication at the gateway, TLS/network policy.
- **Observability:** metrics and tracing, request IDs, structured engine logs.

Flags and defaults change across engine versions. Store the full tested configuration with
the benchmark artifact and revalidate during upgrades.

## Capacity starts with memory

Reserve GPU memory for four buckets:

1. model weights;
2. runtime workspace and temporary activations;
3. CUDA graphs/compiled kernels and allocator overhead;
4. KV cache for active sequences.

Tensor parallelism may make a model fit by sharding weights and per-layer work, but it adds a
collective communication path. More GPUs do not guarantee lower latency. Keep TP within a
fast interconnect domain when possible and benchmark the exact topology.

Maximum context is a capacity promise: allowing huge contexts increases potential KV
allocation and makes admission harder. Enforce product-level token limits based on real use,
not merely the model's advertised maximum.

## Kubernetes lifecycle

A loaded inference replica is different from a normal stateless web pod:

- **Startup probe:** allows time for image pull, weight download, CUDA initialization, and
  model load without premature restarts.
- **Readiness probe:** becomes healthy only after the engine can accept useful work. Remove
  readiness before draining so new streams stop arriving.
- **Liveness probe:** detects a wedged process, but must not restart a healthy replica merely
  because it is saturated.
- **Termination grace:** lets streaming requests finish or reach an explicit drain deadline.
- **Persistent/model cache:** avoids repeated network downloads, while verifying revision and
  integrity.
- **Pod disruption budget and topology spread:** preserve capacity during node maintenance or
  failure.

Request GPUs as extended resources and select compatible GPU nodes. The shared ML lesson on
[GPU Kubernetes Operations](http://192.168.3.20:9002/#07-cloud-infra/gpu-kubernetes-operations.md)
covers device plugins, GPU Operator, Helm, MIG, autoscaling, and DCGM.

## Scale on demand pressure, not one utilization number

Useful signals include:

- running and waiting request counts;
- p95/p99 TTFT and ITL against SLO;
- KV-cache utilization and preemption/recompute rate;
- prompt and generation token rates;
- request errors and deadline misses;
- DCGM memory, SM activity, power, thermals, and XID/ECC health.

Scale-out is slow if a new node must provision and load tens of gigabytes. Maintain headroom,
pre-pull images, cache weights, and use predictive or scheduled capacity for known peaks.
Scale-to-zero fits batch workloads that tolerate cold starts, not interactive chat with a
tight TTFT target.

## Rollouts: model and engine are both risky changes

Treat these as separate versioned artifacts:

- model weights and tokenizer;
- chat template and generation defaults;
- quantization/calibration artifact;
- inference engine/container and CUDA stack;
- deployment configuration.

Run offline correctness and performance gates first. Then shadow real traffic, canary a small
share, compare quality/latency/error/cost, and expand gradually. Keep the previous model and
engine warm enough for rapid rollback. Never let an automatic retry duplicate a streamed
response after tokens have reached the client; retries need idempotency and awareness of
whether output started.

## What to watch from vLLM

Current vLLM exposes Prometheus-compatible engine/request metrics such as running/waiting
requests, KV-cache usage, prompt/generation tokens, TTFT, inter-token latency, end-to-end
latency, and prefill/decode time. Build alerts from SLOs and symptoms rather than every raw
counter.

Correlate three layers with one request ID:

1. gateway: tenant, status, deadline, bytes and stream lifecycle;
2. engine: queue, prefill, decode, cache, preemption;
3. GPU/node: memory, compute, link, thermals, hardware faults.

Without correlation, a p99 latency spike becomes three unrelated dashboards.

## Common failure modes

| Failure | Why it happens | Mitigation |
|---|---|---|
| OOM on burst | contexts/outputs consume more KV than average | admission limits, cache budget, bounded queue |
| Tail-latency cliff | service crossed capacity knee | headroom, SLO scaling, load shedding |
| Replica ready too early | HTTP process started before model usable | startup/readiness separation |
| Upgrade changes output | tokenizer/template/default drift | pin and regression-test all artifacts |
| TP slower on more GPUs | interconnect collective dominates | topology-aware placement, lower TP |
| Retry duplicates output | stream partially delivered | retry only before first token or resume explicitly |

## Interview design checklist

When asked to deploy vLLM, cover this sequence:

1. Workload and SLO: model, prompt/output distributions, concurrency, streaming.
2. Single-replica fit: weights, KV cache, dtype, context, GPU type.
3. Engine policy: batching, chunking, caching, speculation, parallelism.
4. Platform: gateway, Kubernetes lifecycle, placement, storage, network.
5. Reliability: bounded queues, drain, canary, rollback, failure domains.
6. Evidence: quality gates, load matrix, percentiles, goodput, cost.

## Primary references

- [vLLM online serving](https://docs.vllm.ai/en/latest/serving/online_serving/)
- [vLLM metrics design](https://docs.vllm.ai/en/latest/design/metrics/)
- [Kubernetes GPU scheduling](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/)

→ Drill: **[LLM Serving Interview Questions](interview-questions.md)**
