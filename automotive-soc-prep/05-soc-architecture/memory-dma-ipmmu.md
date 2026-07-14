# Memory Hierarchy, DMA & IPMMU

**TL;DR:** The SoC memory hierarchy goes **fast-and-tiny → slow-and-big**: registers,
on-chip SRAM/scratchpad, then shared **DRAM**. DRAM bandwidth is shared across every block
and is the usual bottleneck. **DMA** engines move tensors between these without stealing CPU
cycles, and can **overlap** transfer with compute. The **IPMMU** is the accelerators' MMU —
it translates the addresses an NPU/DSP uses, isolating them and letting them work in virtual
memory. Master these three and most "why is it slow / why did it crash" questions fall out.

## The memory hierarchy

| Level | Size | Speed | Who uses it |
|---|---|---|---|
| Registers / MAC array operands | bytes | fastest | inside the NPU/DSP |
| **On-chip SRAM / scratchpad** | KB–MB | very fast, no contention | tiled activations/weights during a layer |
| **Shared DRAM (LPDDR)** | GB | slow, **shared + contended** | full model weights, camera frames, big activations |
| Flash/storage | GB+ | slowest | model + OS at rest |

**The core tension:** the NPU is fast enough to drain any realistic DRAM bandwidth, so if a
layer's working set doesn't fit in SRAM, the NPU **stalls waiting on DRAM**. This is why
**tiling** (breaking a layer into SRAM-sized chunks) and **fusion** (keep intermediates in
SRAM instead of writing to DRAM and reading back) are the biggest levers. It's also why INT8
(4× less data than FP32) helps so much — see the
[roofline](../01-embedded-accelerators/npu-dsp-cnnip.md).

## Bandwidth is the shared resource

Every block — CPU, NPU, DSP, ISP, video decoder — pulls from the **same DRAM**. Two
consequences:

- **Contention:** the camera ISP writing frames and the NPU reading activations compete for
  the same bus. Peak NPU throughput on a bench ≠ throughput in the live system.
- **Bandwidth budgeting:** you estimate `bytes-per-frame × fps` per block and check it
  against total DRAM bandwidth. A model can be "compute-cheap" and still not fit the
  bandwidth budget.

## DMA — moving data without the CPU

A **DMA (Direct Memory Access)** engine copies memory block-to-block (DRAM↔SRAM,
block↔block) **without the CPU doing the copy**. Two things to know:

1. **It offloads the copy** — the CPU issues a descriptor and moves on; an interrupt/flag
   signals completion.
2. **It enables overlap (double-buffering)** — while the NPU computes tile *N*, DMA prefetches
   tile *N+1* into the *other* SRAM buffer. Done right, transfer time hides behind compute
   and the NPU never stalls. Done wrong (single buffer, synchronous copies), every tile pays
   the full DMA latency serially — a classic bottleneck.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node">DMA prefetch tile N+1</span>
    <span class="arw labeled"><span class="al">overlaps</span></span>
    <span class="node">NPU compute tile N</span>
    <span class="arw labeled"><span class="al">ping-pong SRAM</span></span>
    <span class="node out">no stall</span>
  </div>
  <div class="flow-foot">Double-buffering: two SRAM buffers, DMA fills one while the NPU drains the other. This is how you turn a memory-bound layer into a compute-bound one.</div>
</div>
```

**Data-transfer overhead** (a JD debug target) is usually one of: unnecessary DRAM
round-trips at partition boundaries (see
[operator mapping](../01-embedded-accelerators/operator-mapping-offload.md)), synchronous
(non-overlapped) DMA, or **layout conversions** copying data just to reshape it.

## IPMMU — the accelerator's MMU

The **IPMMU (IP Memory Management Unit)**, a.k.a. **SMMU/System MMU**, is an MMU **for the
non-CPU masters** (NPU, DSP, DMA engines). It:

- **Translates** the virtual addresses those blocks issue into physical DRAM addresses — so
  an accelerator can be handed a virtual buffer just like software, and buffers needn't be
  physically contiguous.
- **Isolates / protects** — a block can only touch memory the IPMMU has mapped for it. In a
  safety context this is essential: a faulty NPU job can't corrupt another partition's
  memory. (Ties into [functional safety](../06-runtime-safety-validation/functional-safety.md).)
- **Enables scatter-gather DMA** — the DMA can walk page tables via the IPMMU instead of
  needing one big contiguous physical block.

**Why you'll meet it in debugging:** if a buffer isn't **mapped** into the IPMMU for the NPU,
the offload **faults** (translation fault) — the model "won't run on the accelerator" for a
reason that's nothing to do with the model. Cache coherence is the sibling gotcha: if CPU and
NPU share a buffer and caches aren't flushed/invalidated, one reads stale data → wrong
results with no crash. "Mapped into the IPMMU + cache-coherent" is the checklist for any
shared buffer.

## The debug checklist for a shared tensor

1. **Is the buffer mapped** into the IPMMU for the consuming block? (else translation fault)
2. **Is it cache-coherent** — flushed by the producer, invalidated by the consumer? (else
   stale-data wrong results)
3. **Is the DMA overlapped** with compute (double-buffered), or serializing?
4. **Does the working set fit SRAM**, or is it thrashing DRAM?
5. **Are there needless layout conversions** copying data to reshape?

## Interview soundbite

> "The hierarchy is registers → SRAM → shared DRAM, and DRAM bandwidth — shared across every
> block — is the usual limiter. DMA moves tensors without the CPU and, double-buffered, hides
> transfer behind compute. The IPMMU is the MMU for the accelerators: it translates and
> isolates their memory accesses, so a buffer that isn't mapped faults, and one that isn't
> cache-coherent silently returns stale data. When something's slow I check bandwidth and DMA
> overlap before I blame the kernel."
