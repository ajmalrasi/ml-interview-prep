# 5 · SoC Architecture

**TL;DR:** On an automotive SoC, **data movement and scheduling dominate performance**, not
raw compute. This section is the hardware substrate: the **memory hierarchy** (registers →
SRAM → DRAM), **DMA** (how tensors move without burning CPU), the **IPMMU** (how accelerators
see memory safely), and **multi-core scheduling** (how the blocks run in parallel). It closes
with the **performance-analysis** framing the JD asks for: latency, throughput, multi-core
scaling, and finding the bottleneck.

## Why the hardware substrate matters to you

You can have a perfectly quantized, fully-NPU-mapped model that's still slow — because it's
**memory-bound**, stalling on DRAM, or serialized behind a DMA copy, or not overlapping the
camera→NPU→post stages. Diagnosing that needs this vocabulary.

## Pages

- **[Memory Hierarchy, DMA & IPMMU](memory-dma-ipmmu.md)** — where tensors live, why
  bandwidth is the usual limiter, how DMA moves data, and what the IPMMU does.
- **[Multi-Core Scheduling & Perf Analysis](multicore-scheduling.md)** — how blocks run
  concurrently, synchronization costs, pipelining, and the latency/throughput/scaling
  analysis loop.

## Relationship to your other prep

The GPU version of some of this (memory coalescing, occupancy, profiling) is in
**ml-engineer-prep §12** ([gpu-performance](../../ml-engineer-prep/12-nvidia-model-optimization/gpu-performance.md))
and the latency-budget framing is in **computer-vision-prep §03**
([latency-budget](../../computer-vision-prep/03-low-latency-inference/latency-budget.md)).
This section is the embedded-SoC re-frame: fixed hardware, explicit memory, hard real-time.

## The one-liner to have ready

> "On these SoCs I assume **memory bandwidth and scheduling are the bottleneck until proven
> otherwise**. I profile per-block utilization and DMA traffic before I touch the model —
> a layer that's memory-bound doesn't get faster from a better kernel, it gets faster from
> less data movement: quantization, fusion, tiling to SRAM, and overlapping DMA with
> compute."
