# GPU Performance & Profiling

**TL;DR:** Speed on a GPU comes down to one question: **is this kernel limited by compute,
by memory bandwidth, or by overhead?** The **roofline model** answers it, **Nsight** proves
it, and the answer tells you which optimization will actually help. Your project already hit
this — the "GPU is idle" mystery was an overhead/data-feeding bound, not a compute bound.

## GPU architecture in one screen

- **SMs (Streaming Multiprocessors)** — the GPU's cores; each runs many threads. A 3070 Ti
  has ~48 SMs.
- **Warps** — threads execute in lockstep groups of **32** (SIMT). Divergent branches within
  a warp serialize — that's **warp divergence**.
- **Tensor Cores** — dedicated matrix-multiply-accumulate units (FP16/BF16/TF32/FP8/INT8).
  They are *why* reduced precision is fast; they do a small matmul per instruction.
- **Memory hierarchy** (fast→slow, small→large): registers → **shared memory / L1** (per-SM,
  programmer-managed) → **L2** (shared) → **global memory / HBM/GDDR** (GBs, but hundreds of
  cycles latency).
- **Occupancy** — how many warps are resident per SM vs the max. Higher occupancy hides
  memory latency by having other warps to run while some wait.

The performance mantra: **keep the tensor cores fed and minimize trips to global memory.**

## The roofline model (the framing to lead with)

Every kernel has an **arithmetic intensity** = FLOPs performed per byte moved from memory.
Achievable performance is:

```
  perf = min( peak_compute,  memory_bandwidth × arithmetic_intensity )
```

```
 FLOP/s │            ______________  ← compute-bound ceiling (peak tensor-core FLOP/s)
        │           /
        │          /  ← memory-bound region (slope = bandwidth)
        │         /
        └────────/──────────────────▶  arithmetic intensity (FLOP/byte)
                 ridge point
```

- **Low intensity → memory-bound.** You're waiting on bytes. Fixes: fuse ops (avoid
  re-reading), better data layout/coalescing, lower precision (fewer bytes), bigger reuse.
- **High intensity → compute-bound.** You're saturating the math units. Fixes: tensor cores,
  lower precision, better tiling.
- **Elementwise ops (ReLU, add, norm) are almost always memory-bound** — barely any math per
  byte. This is why **fusion** (do them without a round-trip to HBM) is such a big lever, and
  why TensorRT fuses aggressively.

## Why your "GPU is idle" was neither compute nor memory bound

Your issue #3: tiny 28×28 images + a small model → the GPU finishes a batch in ~1 ms and
sits waiting. That's a **third regime the roofline doesn't show: overhead-bound.** Two flavors:

- **Input/data-feeding bound** — the dataloader can't produce batches fast enough (your
  actual bug; fixed with `num_workers`, `pin_memory`, `prefetch`, `non_blocking`, bigger
  batch). The GPU starves.
- **Kernel-launch-bound** — each CUDA kernel launch costs a few microseconds of CPU→GPU
  overhead; for a tiny model the launches cost more than the math. **CUDA Graphs** fix this
  by capturing the whole launch sequence once and replaying it as a single unit.

Interview-ready: *"On that model, low `nvidia-smi` utilization wasn't a compute problem —
the kernels were too small to saturate anything, so it was launch/feed overhead. I'd confirm
with Nsight Systems and, if it were latency-critical, use CUDA Graphs to kill launch
overhead and larger batches to amortize it."* That reframes a debugging story as a
performance-analysis story — exactly the NVIDIA register.

## Profiling: name the right tool

- **Nsight Systems (`nsys`)** — **timeline / system-level.** Shows CPU vs GPU activity,
  kernel gaps, memcpy, stream overlap. Use it to answer *"is the GPU even busy, and what's it
  waiting on?"* This is what actually diagnoses your data-feeding stall.
- **Nsight Compute (`ncu`)** — **per-kernel deep dive.** Gives you the roofline placement,
  occupancy, memory-vs-compute breakdown for a single kernel. Use it once you know *which*
  kernel is the bottleneck.
- **`trtexec`** — quick engine-level latency/throughput for TensorRT.
- **PyTorch profiler** / `torch.cuda.Event` — framework-level timing.
- **`nvidia-smi` / `dcgm`** — coarse utilization & memory; good for "is it on the GPU," bad
  for "why is it slow" (utilization % is misleading, as your project showed).

The discipline (same as everywhere): **profile first, attack the biggest bar, re-measure.**

## Measuring GPU latency correctly (a common trap)

Naive Python timing around a CUDA call measures nothing — kernels are **asynchronous**. Do it
right:

```python
torch.cuda.synchronize()               # or use CUDA events
start = torch.cuda.Event(enable_timing=True); end = torch.cuda.Event(enable_timing=True)
for _ in range(warmup): model(x)       # warm up: first calls JIT/autotune/allocate
torch.cuda.synchronize()
start.record()
for _ in range(iters): model(x)
end.record(); torch.cuda.synchronize()
ms = start.elapsed_time(end) / iters
```

Key points to say out loud: **synchronize before/after**, **warm up** (first iterations pay
one-time costs — your `benchmark_latency` warmup(10) is exactly this), report **p50/p99 not
just mean**, and ideally **lock clocks** (`nvidia-smi -lgc`) so boost/thermal drift doesn't
add noise. Your `itertools.cycle` fix (issue #6) is the same discipline — never let the
harness run short.

## CUDA streams & overlap

A **stream** is an ordered queue of GPU work; independent streams run concurrently. The wins:
**overlap H2D/D2H copies with compute** (copy next batch while computing this one — this is
what `pin_memory` + `non_blocking=True` enable, which you already used), and run independent
kernels in parallel. Triton uses multiple streams/instances to raise utilization the same way.

## 🔗 Connecting the dots — the real stack

**Nsight Systems / Nsight Compute** for profiling, **`trtexec`** for engine latency, **CUDA
Graphs** for launch-bound models, **DCGM** for fleet monitoring. The concepts (roofline,
occupancy, coalescing, fusion) are framework-agnostic and show up whether you're writing
CUDA, tuning TensorRT, or debugging a dataloader.

**How you'd say it:** *"My small model was overhead-bound, not compute-bound — I'd verify on
an Nsight Systems timeline, then fix the feed with more dataloader workers and, if latency
mattered, CUDA Graphs. For a big model I'd use Nsight Compute's roofline to see if it's
memory- or compute-bound before choosing between fusion and lower precision."*

## Self-check

- Roofline: what decides compute- vs memory-bound? *(arithmetic intensity = FLOPs/byte vs the
  ridge point; low intensity → memory-bound.)*
- Why are elementwise ops memory-bound, and what's the fix? *(tiny math per byte → bandwidth
  limited; fuse them to avoid re-reading from global memory.)*
- Nsight Systems vs Nsight Compute? *(Systems = timeline/"is the GPU busy & waiting on what";
  Compute = single-kernel roofline/occupancy deep dive.)*
- Why is naive timing of a CUDA call wrong? *(kernels are async — you must synchronize and
  warm up, and report p99 not just mean.)*
