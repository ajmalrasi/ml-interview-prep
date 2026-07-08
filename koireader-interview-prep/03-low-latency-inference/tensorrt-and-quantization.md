# TensorRT & Quantization

**TL;DR:** TensorRT is NVIDIA's inference compiler — it takes a trained model
(usually via ONNX) and produces an optimized **engine** for *your specific GPU* by
fusing layers, picking fast kernels, and lowering precision (FP16/INT8). INT8 ≈
fastest + smallest, but needs calibration to keep accuracy. You've done this; this
file makes the *why* crisp.

## The flow

```
PyTorch/TF model → export ONNX → trtexec / TRT builder → engine (.plan/.engine)
                                      │
                          chooses kernels for THIS GPU,
                          fuses layers, sets precision
```

> The engine is hardware-specific. An engine built on an A100 won't be optimal (or
> may not load) on a Jetson Orin. **Build on the deployment target** (or matching
> arch). This is a classic gotcha — mention it.

## What TensorRT actually does

1. **Layer & tensor fusion** — merges conv+bias+ReLU into one kernel → fewer kernel
   launches and memory reads. (Your resume literally says "layer fusion.")
2. **Kernel auto-tuning** — benchmarks several CUDA kernel implementations and
   picks the fastest for your shapes/GPU.
3. **Precision calibration** — runs in FP32, FP16, or INT8.
4. **Memory optimization** — reuses buffers across layers (smaller footprint).
5. **Dynamic shapes / optimization profiles** — handle variable batch/resolution.

## Precision ladder

| Precision | Speed | Memory | Accuracy | Notes |
|---|---|---|---|---|
| **FP32** | 1× | 1× | baseline | training default, rarely needed for inference |
| **FP16** | ~2× | ½ | ~lossless | safe default on modern GPUs/Jetson; almost free win |
| **INT8** | ~3–4× | ¼ | small drop | needs **calibration**; best for edge throughput |

## INT8 calibration (the part people fumble)

INT8 maps floats to 256 integer levels. To pick the right float range per layer,
TensorRT needs a **calibration dataset** — a few hundred representative images —
to measure activation distributions (entropy/min-max calibration). Get this wrong
(unrepresentative data) and accuracy tanks.

- **PTQ (post-training quantization):** calibrate after training. Fast, no
  retraining. What you usually do.
- **QAT (quantization-aware training):** simulate INT8 during training for best
  accuracy. More work; use when PTQ drops too much accuracy.
- Always **measure mAP/accuracy after quantizing** — never assume it's fine. (Your
  resume's model-evaluation discipline: mAP/precision/recall.)

## Beyond precision: pruning & distillation

- **Pruning** — remove low-importance weights/channels → smaller, faster (you've
  done this). Structured pruning helps real latency; unstructured needs sparse HW.
- **Distillation** — train a small "student" to mimic a big "teacher." Different
  lever (smaller architecture) vs quantization (cheaper arithmetic). Combine them.

## Why X over Y

**FP16 vs INT8?**
FP16 is nearly free accuracy-wise and ~2× faster — always try it first. INT8 is
~3–4× and ¼ memory but needs calibration and risks accuracy; reach for it when you
need maximum edge throughput and can validate accuracy holds.

**ONNX → TensorRT vs torch2trt / direct?**
ONNX is the portable interchange path: framework-agnostic, widely supported, easy
to inspect. Direct converters are convenient but more fragile across ops. ONNX
first, fall back to custom plugins for unsupported ops.

**Why build the engine on the target device?**
TensorRT tunes kernels and memory for the *specific* GPU arch and even driver. An
engine built elsewhere may be suboptimal or fail to load — build (or rebuild) on
the deployment hardware, and cache the engine so you don't pay build time at
startup.

**Quantization vs pruning vs distillation — which?**
They're orthogonal. Quantization = cheaper math (precision). Pruning = fewer
weights. Distillation = smaller architecture. Stack them: distill to a small
model, prune it, then INT8-quantize for the edge.

→ Next: **[triton.md](triton.md)**
