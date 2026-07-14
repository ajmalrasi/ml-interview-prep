# 1 · Embedded Accelerators

**TL;DR:** An automotive SoC is not one chip that runs your model — it's a **collection of
compute blocks** (CPU cores, a **DSP**, an **NPU**, a fixed-function **CNNIP**) glued
together by memory and DMA. Your job as an application engineer is to get the model onto the
**right block**, mapped to operators that block supports, with the data movement between
blocks kept cheap. This section builds that mental model.

## Why this differs from your GPU experience

On a GPU + TensorRT, you had **one** massively parallel device and a mature compiler that
handled almost every op. On an automotive SoC:

- Compute is **heterogeneous** — different blocks are good at different things, and the
  fast ones (NPU/CNNIP) support only a **fixed operator set**.
- Memory is **scarce and explicit** — small on-chip SRAM, limited DRAM bandwidth shared
  across blocks. Data movement, not FLOPs, is often the bottleneck.
- The target is **fixed** — you can't buy a bigger card; you optimize the model to fit.
- It runs under **safety and real-time** constraints (Linux/QNX, deterministic latency).

## Pages

- **[NPU, DSP & CNNIP — What They Are](npu-dsp-cnnip.md)** — the compute blocks, what each
  is good at, systolic arrays vs VLIW/SIMD, and when the toolchain picks which.
- **[Operator Mapping, Offload & Fallback](operator-mapping-offload.md)** — how an ONNX op
  becomes an NPU instruction, what happens to unsupported ops, and the offload debug loop.

## The one-liner to have ready

> "On an embedded SoC I think in terms of **where each subgraph runs** and **what it costs
> to move data between blocks** — the NPU is fast but only for supported ops, so the game is
> maximizing the fraction of the model that stays on the accelerator and minimizing CPU/DSP
> fallbacks and DMA round-trips."
