# Multi-Core Scheduling & Perf Analysis

**TL;DR:** An SoC runs blocks **in parallel**, so throughput comes from **pipelining** the
stages (camera → pre → NPU → post) across cores/accelerators and **overlapping** them —
while latency is set by the **critical path** through them. This page is the JD's
"performance analysis (latency, throughput, multi-core scaling) and identify bottlenecks"
task: the metrics, the scaling laws, and the diagnosis loop.

## Latency vs throughput (don't conflate them)

- **Latency** — time for **one** frame end-to-end (sensor to result). Bounded by the
  **critical path**. This is the safety-relevant number (how stale is the perception when
  the planner uses it).
- **Throughput** — frames **per second** the system sustains. Set by the **slowest stage**
  once the pipeline is full.

Pipelining trades them: you can raise throughput to `1 / max(stage_time)` **without**
lowering per-frame latency (it may even rise slightly from buffering).

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">capture</span>
    <span class="arw"></span>
    <span class="node">ISP / preproc<span class="nsub">DSP</span></span>
    <span class="arw"></span>
    <span class="node">inference<span class="nsub">NPU</span></span>
    <span class="arw"></span>
    <span class="node out">post / NMS<span class="nsub">CPU/DSP</span></span>
  </div>
  <div class="flow-foot">Run as a <b>pipeline</b>: while the NPU processes frame N, the ISP captures frame N+1 and the CPU post-processes frame N−1. Throughput = 1 / slowest stage; latency = sum of the critical path.</div>
</div>
```

## Multi-core scaling — why it's sublinear

Adding cores/blocks rarely gives linear speedup:

- **Amdahl's law** — the serial fraction caps you. If 20% of the pipeline is serial (a CPU
  post-process that can't parallelize), max speedup is 5× no matter how many NPU cores.
- **Synchronization cost** — every cross-block handoff needs a signal/wait; more blocks =
  more sync overhead and more chances to stall.
- **Shared-resource contention** — more blocks pulling on the **same DRAM bandwidth** (see
  [memory-dma-ipmmu](memory-dma-ipmmu.md)) means per-block effective bandwidth drops. This
  is why "2 NPU cores" often gives ~1.6×, not 2×.
- **Load imbalance** — if the graph splits unevenly across cores, the busiest core sets the
  time and the others idle.

**Multi-core scaling analysis** = measure speedup vs #cores, and attribute the gap to serial
fraction, sync, contention, or imbalance.

## Synchronization primitives

- **Semaphores / fences / doorbells** — block signals "done," consumer waits. Cheap but each
  wait is a potential stall.
- **Double-buffering** — decouple producer/consumer so neither waits (the DMA trick from the
  memory page applies to whole stages too).
- **Work queues** — a block pulls the next job when free, smoothing imbalance.
- **Cache coherence / barriers** — shared buffers must be coherent at the handoff or you get
  stale data (silent wrong results).

## The performance-analysis loop (the day-job)

1. **Measure end-to-end** — latency (p50/p99) and sustained throughput on the target, on
   **real** input, not a microbenchmark.
2. **Break down by stage/block** — per-block busy time and utilization. Find the **slowest
   stage** (throughput limiter) and the **critical path** (latency limiter) — they can differ.
3. **Classify the bottleneck** for the hot stage:
   - **Compute-bound** (NPU MAC utilization high) → smaller/faster model, better fusion,
     structured sparsity.
   - **Memory-bound** (low MAC util, high DRAM traffic) → quantize, fuse to avoid round-trips,
     tile to SRAM, double-buffer DMA. (Roofline test — see
     [npu-dsp-cnnip](../01-embedded-accelerators/npu-dsp-cnnip.md).)
   - **Scheduling-bound** (blocks idle waiting on each other) → pipeline/overlap stages,
     fix load imbalance, cut sync points.
   - **Fallback-bound** (too much on CPU/DSP) → fix the partition (static shapes, complete
     QDQ, graph surgery — see [operator mapping](../01-embedded-accelerators/operator-mapping-offload.md)).
4. **Fix the top item, re-measure.** One bottleneck at a time — fixing #2 while #1 dominates
   shows no movement and misleads you.

## Bottleneck symptom → cause cheat table

| Symptom | Likely bottleneck |
|---|---|
| NPU utilization high, latency high | Compute-bound — shrink/speed the model |
| NPU utilization **low**, DRAM traffic high | Memory-bound — cut data movement |
| Blocks idle in the timeline, gaps between stages | Scheduling — pipeline / overlap |
| Big chunk of time on CPU in the profile | Fallback-bound — fix partitioning |
| Throughput scales <linearly with cores | Serial fraction / contention / imbalance |
| p99 ≫ p50 | Jitter — sync stalls, contention spikes, thermal |

## Interview soundbite

> "I separate latency (critical path, the safety number) from throughput (slowest stage once
> pipelined). I profile per-block, find the hot stage, and classify it — compute-bound,
> memory-bound, scheduling-bound, or fallback-bound — because each has a different fix. Then I
> fix one thing and re-measure. Multi-core scaling is sublinear from serial fraction, sync
> cost, and shared DRAM contention, so I attribute the gap rather than assume 2 cores = 2×."
