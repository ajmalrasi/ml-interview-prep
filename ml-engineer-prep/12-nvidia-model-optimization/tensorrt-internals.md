# TensorRT Internals

**TL;DR:** TensorRT is an **optimizing compiler + runtime** for inference. You hand it a
network (usually via ONNX); it **fuses layers, picks the fastest kernel for your exact GPU,
chooses precisions, and serializes an engine**. The two concepts NVIDIA will press: what the
builder actually does, and **implicit vs explicit quantization** — which is exactly your
project's "Option A vs Option B," in the official vocabulary.

## The pipeline

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node">PyTorch</span>
    <span class="arw labeled"><span class="al">torch.onnx.export</span></span>
    <span class="node">ONNX</span>
    <span class="arw labeled"><span class="al">TRT Builder</span></span>
    <span class="node">Engine<span class="nsub">plan file</span></span>
    <span class="arw labeled"><span class="al">Runtime</span></span>
    <span class="node out">inference</span>
  </div>
  <div class="flow-foot"><b>Builder does the heavy lifting:</b> layer/tensor fusion · kernel (tactic) auto-tuning · precision selection · memory planning · calibration (if implicit INT8).</div>
</div>
```

- **Builder** — the expensive, offline step. It runs the optimizations below and **times
  candidate kernels on your actual GPU** to pick the fastest.
- **Engine (plan file)** — the serialized result. **Hardware-specific**: an engine built for
  an RTX 3070 Ti is not guaranteed to run optimally (or at all) on a different arch/TRT
  version. Build on the deployment GPU.
- **Runtime** — loads the engine, allocates a **context**, binds input/output device
  buffers, runs `enqueueV3` on a CUDA stream.

## What the builder actually does (name these)

1. **Layer & tensor fusion** — the biggest structural win. Fuses `Conv+BN+ReLU` into one
   kernel, fuses elementwise chains, collapses concat, etc. Fewer kernel launches, fewer
   round-trips to global memory. *(This is why BN folding matters — see below.)*
2. **Kernel auto-tuning / tactic selection** — for each layer it has many candidate CUDA
   kernels (different tile sizes, tensor-core paths) and **benchmarks them** to pick the
   fastest for your shapes and GPU. This is why builds are slow and engines are portable
   only within a GPU family.
3. **Precision selection** — runs layers in FP16/INT8 where allowed, keeping others in higher
   precision if needed for accuracy (you can pin per-layer precision).
4. **Memory optimization** — reuses activation buffers across layers that don't overlap in
   time (memory planning), sized by the **workspace** you grant it.
5. **Multi-stream / dynamic shapes** — supports variable input sizes via optimization
   profiles (below).

## Implicit vs explicit quantization (the key TensorRT concept)

Your notes described "Option A: TRT calibrates itself" and "Option B: QDQ nodes baked in."
Those are the two official INT8 modes:

| | **Implicit quantization** (Option A) | **Explicit quantization / QDQ** (Option B) |
|---|---|---|
| Input | FP32 ONNX + a **calibrator** | ONNX with **Q/DQ nodes** carrying scales |
| Who picks scales | TensorRT's calibrator | Baked in from **QAT** (Model-Optimizer) |
| Determinism | Builder chooses which layers go INT8 to maximize speed | You control exactly where INT8 runs |
| Accuracy story | "PTQ, done by TensorRT" | Matches the QAT-trained numerics |
| Status | Legacy path; being deprecated | **Recommended** going forward |

**The subtlety to nail** (your notes get this right): Q/DQ nodes are a **build-time
instruction, not a runtime op.**

- The builder fuses `Q → Conv → DQ` into a single INT8 kernel; the Q/DQ markers vanish from the engine.
- So **explicit vs implicit changes achievable accuracy, never runtime speed** — the executed engine is the same shape.
- Explicit only costs latency if Q/DQ nodes are placed so densely the builder can't fuse them.

**Why your project used implicit** (a good war story — you knew the "right" path and why the
environment forced a fallback):

- `nvidia-modelopt` (which produces explicit QDQ) was broken on your torch 2.5 stack.
- fbgemm's fake-quant ops **can't export to ONNX at all**.
- So you folded QAT weights into a plain model and re-calibrated — a hybrid: weights got QAT's
  benefit, scales came from TRT's calibrator.

## BN folding: why your issue #7b existed

TensorRT (and QAT) **fold BatchNorm into the preceding conv**. Since BN is an affine
`γ·(x−μ)/σ + β` and conv is linear, the two compose into one conv with adjusted weights and bias.

Two consequences:
- **An optimization** — one fewer kernel.
- **The reason for your QAT→plain-model remap** — `bn.*` params had to move out of the fused module.

Interview-ready phrasing: *"BN folding is exact math, not an approximation — it's why fused
Conv+BN+ReLU is one kernel and why my QAT state-dict keys had to be remapped."*

## Dynamic shapes & optimization profiles

Your engines were fixed-batch (256), which forced the "pad the last partial batch" hack. The
general fix is an **optimization profile**:

- Declare `min / opt / max` shapes for each dynamic dimension.
- TensorRT tunes kernels for `opt` while supporting the whole range.
- One engine then serves batch sizes 1…N.

Standard production setup, and a clean "what would you do next" answer.

## Plugins (custom ops)

If your model has an op TensorRT doesn't support natively, you write a **plugin** (`IPluginV3`)
— a custom CUDA kernel TRT calls as a black-box layer.

- Common for novel attention variants, NMS, custom preprocessing.
- Plugins **break fusion across their boundary** — the builder can't see inside them.

## Serving it: Triton Inference Server

An engine alone isn't a service. **Triton** wraps it with:

- **Dynamic batching** — group requests within a latency window.
- **Concurrent model instances** — multiple engines per GPU to raise utilization.
- **Model ensembles / pipelines** and multi-framework backends (TensorRT, ONNX, PyTorch, Python).
- **Metrics.**

The production shape: *"TensorRT engine served by Triton with dynamic batching and a couple of
concurrent instances."* A natural "how would you deploy it" follow-up to your project.

## 🔗 Connecting the dots: the real stack

**torch-tensorrt** / `torch.compile` backend and **`trtexec`** (CLI to build+profile
engines) for classic models; **ONNX Runtime** as the portable alternative; **TensorRT-LLM**
for LLMs; **Triton** for serving; **NVIDIA TensorRT-Model-Optimizer** for explicit-QDQ
quantization. `trtexec --int8 --fp16 --best` is the fastest way to see achievable latency.

**How you'd say it:** *"I exported to ONNX and built an INT8 engine with an entropy
calibrator — implicit quantization. The cleaner path is explicit QDQ from QAT via
Model-Optimizer, which my torch/modelopt versions didn't support, so I folded QAT weights in
and re-calibrated. In production I'd serve the engine through Triton with dynamic batching."*

## Self-check

- What are the two biggest things the TRT builder does? *(layer fusion + kernel auto-tuning /
  tactic selection for your specific GPU.)*
- Implicit vs explicit quantization? *(calibrator picks scales & builder chooses INT8 layers
  vs Q/DQ nodes with baked-in QAT scales you control; explicit is recommended.)*
- Do QDQ nodes slow inference? *(no — build-time markers, fused away; they affect accuracy,
  not speed, unless placed un-fusably.)*
- Why is a TRT engine not portable across GPUs? *(kernels are auto-tuned/timed for a specific
  arch + TRT version.)*
