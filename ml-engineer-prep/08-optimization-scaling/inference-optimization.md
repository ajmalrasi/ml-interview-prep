# Inference & Serving Optimization

**TL;DR:** Serving optimization is about lower **latency** and higher **throughput per
dollar** at prediction time. The big levers: **batching** requests, **caching** repeated
results, compiling the model for the hardware, and scaling smartly. Distinct from
training optimization — here you're tuning the live service.

## Latency vs throughput (frame it first)

Two different goals that sometimes conflict. **Latency** = how fast a single prediction
returns (what one user feels). **Throughput** = how many predictions per second the
system handles (what your bill reflects). Some tricks (batching) boost throughput but can
*add* latency, so you optimize for the one the product needs — usually a p99 latency
target at the lowest cost.

**See the tension.** Increase batch size below: throughput (solid line) climbs as the
GPU is better utilized, but latency-per-batch (dashed) rises too. Small batches are
latency-optimal; large batches are throughput-optimal. Dynamic batching just picks a
point on this curve that fits your p99 budget.

```rawhtml
<div id="batch-widget" class="widget-host"></div>
```

## The main levers

- **Batching** — instead of running the model once per request, group several requests and
  run them together in one GPU pass. GPUs love parallelism, so this dramatically raises
  throughput. **Dynamic batching** (Triton, KServe) waits a few milliseconds to collect a
  batch — a small, bounded latency cost for a big throughput gain.
- **Caching** — if the same input (or a common one) recurs, cache the prediction and skip
  the model entirely. Huge for repeated queries; also used for embeddings and, in LLMs,
  for prompt/KV caching.
- **Model compilation / optimized runtimes** — compile the model for the target hardware
  with **TensorRT**, **ONNX Runtime**, or **TorchScript**: they fuse operations, pick fast
  kernels, and apply the precision from section 8's compression. Often a big speedup for
  free.
- **Right hardware** — GPU for heavy/parallel models, CPU for light ones; specialized
  accelerators (Inferentia, TPU) where they fit.
- **Autoscaling** (section 7) — match replica count to load; scale to zero when idle.

## Putting it together

A typical optimized online service: a **quantized, TensorRT-compiled model**, behind a
server that does **dynamic batching**, with a **cache** for hot inputs, running on
**autoscaling** GPU replicas. Each layer attacks cost or latency without touching
accuracy.

## Measure, don't guess

The engineering discipline is the same as everywhere: **profile to find the actual
bottleneck** (is it the model, the preprocessing, the network, the batching wait?) and
attack the biggest number — rather than optimizing what you assume is slow. "I profile
first" is always the right thing to say.

## 🔗 Connecting the dots — the real stack

Serving optimizers: **Triton** (dynamic batching, multi-framework) and **TensorRT / ONNX Runtime** for classic models; **vLLM** and **TGI** for LLMs (paged KV-cache, continuous batching); **Redis** for caching hot inputs/embeddings; autoscaling via **KServe**.

**How you'd say it:** *"CV inference went through Triton with dynamic batching on TensorRT engines; LLM inference through vLLM for KV-cache batching, with a Redis semantic cache in front."*

## Self-check

- Latency vs throughput — how can they conflict? *(batching raises throughput but adds
  latency while requests are grouped.)*
- How does batching help on a GPU? *(runs many requests in one parallel pass → much higher
  throughput per dollar.)*
- Name two serving-optimization levers besides batching. *(caching, model compilation
  (TensorRT/ONNX), right hardware, autoscaling — any two.)*
