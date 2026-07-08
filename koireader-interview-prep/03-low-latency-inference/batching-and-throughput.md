# Batching & Throughput

**TL;DR:** GPUs are massively parallel; one frame barely uses them. Batching feeds
many frames per kernel launch, amortizing overhead and filling the GPU — often a
several-fold throughput gain. The cost is a little latency (you wait to fill the
batch). Tune batch size to your latency SLA.

## Why batching works (the intuition)

A GPU is a huge parallel factory. Sending one frame is like running the whole
factory to assemble a single widget — most of the line sits idle, and you still
pay the fixed cost of starting and stopping the line (kernel launch, memory
transfer). Batch 16 frames and the same start/stop cost is shared across 16 → far
better utilization.

## The latency/throughput knob

```
batch=1   : lowest latency,  worst GPU utilization, fewest cameras
batch=N   : higher latency (wait to fill), best utilization, most cameras
```

- **Static batching** (DeepStream `nvstreammux`): batch = number of synchronized
  camera streams. Frames arrive together each tick, so little extra wait.
- **Dynamic batching** (Triton): server waits up to `max_queue_delay` to gather
  requests, then runs them together. You cap the wait to bound latency.

## How to size the batch

1. Fix your latency SLA (e.g., must act within 100ms).
2. Sweep batch size, measure p99 latency and throughput at each.
3. Pick the largest batch whose p99 stays under SLA. That maximizes cameras/box
   without breaking real-time. (This sweep *is* your evidence-driven method.)

## Other throughput levers

- **Multiple model instances / CUDA streams** — overlap inference of different
  batches; overlap decode (NVDEC) with inference (CUDA cores) since they're
  separate engines.
- **Smaller/faster backbone** — YOLO-n vs YOLO-x; the cheapest latency win is often
  a smaller model that still hits accuracy.
- **Right resolution** — inferring at 640×640 instead of 1280×1280 can 4× speed;
  validate accuracy impact.
- **Async pipeline** — decode, infer, and postprocess on separate threads/streams
  so the GPU never waits on the CPU.

## Why X over Y

**Bigger batch — always better?**
No. Beyond the point that fills the GPU, you only add latency for marginal
throughput, and you risk blowing the latency SLA and growing buffers. Size to SLA.

**Batching vs a smaller model for more throughput?**
Batching keeps accuracy and fills the GPU but adds some latency. A smaller model
cuts latency *and* compute but may cost accuracy. Try both; often you batch a
right-sized model.

**Why overlap NVDEC decode with CUDA inference?**
Decode and inference use *different* silicon (NVDEC vs CUDA cores). Running them
concurrently (separate threads/streams) hides decode time behind inference → higher
effective throughput than doing them serially.

→ Back to [section README](README.md) · Next section: **[04-fault-tolerance/](../04-fault-tolerance/README.md)**
