# NPU, DSP & CNNIP — What They Are

**TL;DR:** Three kinds of accelerator show up in automotive SoCs. **CNNIP** is a
fixed-function convolution engine (fastest, least flexible). **NPU** is a programmable
tensor accelerator (fast, supports a defined op set). **DSP** is a programmable vector
processor (flexible, handles the ops the NPU can't). The CPU is the fallback for everything
else. Know what each is good at and you can predict how the toolchain will partition a model.

## The four compute blocks

| Block | What it is | Great at | Bad at | Programmability |
|---|---|---|---|---|
| **CNNIP** (CNN IP / conv accelerator) | Fixed-function hardware for convolution-family ops | Conv, pooling, common activations at very high throughput/watt | Anything not in its wired-in op set | None — configured, not programmed |
| **NPU** (neural processing unit) | Programmable **MAC array** (often systolic) for tensor ops | GEMM/conv, INT8 matmul, the standard DL op set | Dynamic shapes, exotic ops, heavy control flow | Via the vendor compiler/op set |
| **DSP** (digital signal processor) | Programmable **VLIW/SIMD** vector core | Custom ops, pre/post-processing, ops the NPU lacks | Big dense matmul (slower than NPU) | Fully (C/intrinsics), but you rarely hand-write |
| **CPU** (Arm cores) | General-purpose scalar/NEON | Control flow, glue, unsupported ops | Throughput on dense tensor math | Fully |

**Mental model:** throughput/efficiency goes **CNNIP > NPU > DSP > CPU**; flexibility goes
the other way. The compiler tries to keep as much of the graph as possible on the CNNIP/NPU
and spills the rest to DSP/CPU.

## How an NPU actually computes — the systolic array

The NPU's core is usually a **2-D array of multiply-accumulate (MAC) units** (a *systolic
array*, the same idea as a GPU tensor core or the TPU's MXU):

- Weights are **stationary** in the array; activations **stream through**, and each cell
  does `acc += a * w` and passes the operand to its neighbor.
- One load, many reuses → arithmetic intensity is high, which is exactly what you want when
  DRAM bandwidth is the limit.
- It is sized for a fixed data type — **INT8** is the bread-and-butter (hence quantization
  matters so much), sometimes INT16/FP16 at lower throughput.

**Why this matters for you:** the array is happiest with **large, regular, static-shape**
matmuls/convs. Small tensors, odd channel counts, or dynamic shapes leave MAC cells idle
(low *utilization*) — a classic bottleneck you'll be asked to diagnose.

## Roofline: is a layer compute-bound or memory-bound?

The single most useful framework for embedded perf. Every layer has an **arithmetic
intensity** = FLOPs ÷ bytes moved.

```rawhtml
<div class="formula">
  <div class="frow"><span class="fexpr">intensity = <span class="fv">FLOPs</span> / <span class="fv">bytes from memory</span></span><span class="fnote">ops per byte</span></div>
</div>
```

- **Below the roofline knee** (low intensity) → **memory-bound**: performance is capped by
  DRAM/SRAM bandwidth. Depthwise convs, elementwise ops, and small matmuls live here.
- **Above the knee** (high intensity) → **compute-bound**: capped by MAC throughput. Big
  dense convs live here.

Quantizing FP32→INT8 cuts bytes moved 4× — it **shifts memory-bound layers toward the
compute roof**, which is why quantization often speeds up embedded inference more than the
raw MAC count suggests.

## DSP: the flexible relief valve

The DSP exists because no fixed op set covers a real model. It handles:

- **Pre/post-processing** — resize, color convert, NMS, decode of detection heads.
- **Unsupported operators** — a custom activation, a novel attention variant, layout
  conversions the NPU can't do.
- **Glue** between NPU subgraphs when a fallback would otherwise go all the way to CPU.

A DSP fallback is **much cheaper than a CPU fallback** (the DSP is still a vector engine
near the accelerator), so "can this op run on the DSP instead of the CPU?" is a real
optimization question.

## What the interviewer is checking

- Do you know these are **separate blocks** with separate op support, not one device?
- Can you reason about **why** a model lands partly on CPU (unsupported ops) and what that
  costs (round-trips, sync, DRAM traffic)?
- Do you connect **INT8 quantization** to the NPU MAC array being an INT8 engine?

Next: [Operator Mapping, Offload & Fallback](operator-mapping-offload.md) — how a graph
actually gets split across these blocks.
