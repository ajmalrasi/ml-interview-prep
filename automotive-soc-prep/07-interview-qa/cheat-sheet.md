# One-Page Cheat Sheet (Morning Of)

**TL;DR:** Everything in one skim. If you can recite this, you can hold the whole loop.

## The four blocks (efficiency ↓, flexibility ↑)

`CNNIP` (fixed conv) → `NPU` (INT8 tensor array) → `DSP` (vector, custom ops) → `CPU`
(fallback). Keep the model on NPU/CNNIP; spill the rest to DSP before CPU.

## The golden rule

> **Data movement and scheduling, not FLOPs, are the bottleneck.** Keep the model on the
> accelerator, minimize partition boundaries, hide DMA behind compute.

## Roofline (compute vs memory bound)

intensity = FLOPs / bytes moved. Low → **memory-bound** (fix: quantize, fuse, tile to SRAM,
double-buffer DMA). High → **compute-bound** (fix: smaller/faster model, sparsity). INT8 cuts
bytes 4× → shifts memory-bound layers toward the compute roof.

## Operator mapping

Supported → mapped (+fused: Conv+Bias+Act → 1 pass). Unsupported → fallback → **subgraph
boundary = copy + sync**. One fallback in the *middle* = 2 boundaries; fallbacks at the
*tail* (NMS/decode) = 1. Read the **partition report** first.

## ONNX toolchain

- Graph = protobuf, nodes connected **by tensor name**; opset matters; run **shape inference**.
- **Graph surgery**: fold constants, pin dynamic shapes, replace/remove ops, **segment** the
  model. Tools: `onnx`, `onnx-graphsurgeon`, `onnxsim`, Netron.
- **QDQ model** = FP32 graph + QuantizeLinear/DequantizeLinear (scale, zero-point). Compiler
  fuses Q→op→Q into INT8. Missing/unfusible Q/DQ → layer silently runs FP32.
- **Compiler** (offline): optimize, lower QDQ, fuse, **partition**, plan memory, emit
  hardware-specific engine. **Runtime**: load, bind buffers (zero-copy), schedule subgraphs.
  ONNX Runtime = **Execution Providers**, priority order, CPU EP = universal fallback.

## Quantization

- Weights: **symmetric, per-channel**. Activations: per-tensor, entropy/percentile calib.
- **PTQ** (you own, minutes, calibration set) → **QAT** (collaboration, best accuracy, STE
  through round).
- **Accuracy recovery ladder** (cheapest first): recalibrate → per-channel weights → **mixed
  precision on sensitive layers** → bias correction / cross-layer equalization → QAT → graph
  change. Localize with **per-layer SQNR/cosine**. Re-check accuracy **and** latency.

## Models

- Skeleton: **backbone → neck (FPN) → head**. Backbone/neck = NPU-friendly; head = trouble.
- Detection: one-stage (YOLO) default; **NMS/decode off NPU at the tail**; pad to static max.
  Metric **mAP** (IoU thresholds).
- Segmentation: watch **`Resize` modes** + big activations (bandwidth). Metric **mIoU**.
- **BEV** = multi-cam → top-down grid. **LSS** (forward depth-splat, scatter), **BEVFormer**
  (backward deformable attention — grid-sample/LayerNorm fallbacks), **BEVFusion**
  (+lidar sparse/3D conv), **Occupancy** (3D voxels — bandwidth heavy). Geometry is fixed by
  calibration → **precompute sampling as static tensors**.

## SoC hardware

- Hierarchy: registers → **SRAM** (tile here) → shared **DRAM** (the limiter).
- **DMA** moves data w/o CPU; **double-buffer** to overlap with compute.
- **IPMMU** = MMU for accelerators: translates + isolates. Unmapped buffer → **fault**;
  incoherent buffer → **stale data**. Checklist: mapped + cache-coherent.
- **Latency** = critical path (safety number). **Throughput** = slowest stage (pipelined).
  Multi-core scaling **sublinear**: Amdahl + sync + DRAM contention + imbalance.

## Runtime & safety

- **Linux** (PREEMPT_RT, rich/non-safety) vs **QNX** (microkernel RTOS, hard real-time,
  user-space driver isolation, ASIL-D certifiable). **Determinism first**: bounded WCET,
  static shapes, no surprise fallbacks.
- Validation ladder: **MIL → SIL → PIL → HIL**. SIL = compiled INT8 vs FP32 on golden set
  (catch accuracy regressions). On-target = honest latency. HIL = real SoC, real time,
  sensor playback / closed-loop sim. Golden-set **regression every release**.
- **ISO 26262** → **ASIL A–D** (severity × exposure × controllability); perception ~C/D.
  **SOTIF (21448)** = wrong-but-not-faulty (the AI case) → redundancy, ODD monitoring, safety
  monitor. Accuracy targets and determinism are **hard limits**; configs are safety evidence.

## Your framing

> "I take a trained CV/BEV model and make it run fast, accurately, and deterministically on a
> fixed embedded accelerator: quantize it (PTQ→QAT), get it through the ONNX compiler cleanly
> with graph surgery, keep the bulk on the NPU and isolate fallbacks, diagnose accuracy loss
> per layer, and validate on SIL/HIL under ISO 26262. My GPU/TensorRT background is the same
> concepts; here the compiler is ONNX-based and the target is fixed and safety-rated."
