# CNN → LLM/VLM: What Transfers, What Breaks

**TL;DR:** Everything conceptual from your CNN project transfers — quantization math, the
three axes, TensorRT-style compilation, profiling. What *breaks* is the assumptions: LLMs are
**memory-bound**, have **outlier activations**, are **too big to retrain**, and are judged by
**perplexity**. Knowing exactly which assumption flips is the whole interview.

## What transfers unchanged

- **The three axes** — method (how you pick int8-friendly numbers), format (FP16/INT8/FP8/
  INT4), engine (where it runs fast). Same framing.
- **Quantization math** — scale, zero-point, symmetric/asymmetric, per-channel. Identical; LLMs
  just add **group-wise** granularity (below).
- **The loop** — baseline → quantize → measure quality + speed → compare in a tracker. Same
  discipline, different metrics.
- **Compilation & profiling** — a runtime that fuses ops and picks kernels (TensorRT →
  TensorRT-LLM); roofline, Nsight, proper timing. All carry over.
- **Distillation** — still a core lever, arguably *more* central for LLMs.

## What breaks: the four flips

### 1. Compute-bound → memory-bound (the big one)
- Your CNN did lots of math per byte, so INT8 sped up the **compute**.
- LLM **decode generates one token at a time**, re-reading *every weight* from memory per token
  with little math → **bandwidth-bound**.
- Consequence: **weight-only INT4** (shrink the bytes you load) gives a big decode speedup even
  though it never touches the math units — the *opposite* of the CNN intuition.
- (Roofline logic from [§12](../12-nvidia-model-optimization/gpu-performance.md).)

### 2. Clean activations → outlier activations
- Transformer activations develop a few **massive outlier channels**.
- A naive per-tensor INT8 scale must cover those outliers → normal values crushed into a few
  codes → **accuracy collapse**.
- This is why plain PTQ that worked on your CNN *fails* on an LLM — and why **SmoothQuant / AWQ**
  exist (next page).
- Note: weights are still well-behaved; **activations** are the problem.

### 3. Retrainable → too big to retrain
- You could QAT FashionMNIST in minutes. A 7B–70B model costs far too much to QAT end-to-end,
  and you rarely have the data.
- So the field leans on **PTQ and weight-only** methods that need only a little calibration data.
- The QAT-shaped option is **QLoRA** — fine-tune small **LoRA adapters** on a frozen 4-bit base
  → recovers task accuracy cheaply, without touching the base weights.

### 4. Top-1 accuracy → perplexity + benchmarks
- Your CNN had one clean number. LLM quality is **perplexity** (how well it predicts held-out
  text) **+ downstream benchmarks** (MMLU, GSM8K…).
- Degradation is subtler and uneven — a 4-bit model can look fine on perplexity but slip on
  multi-step reasoning or long context.
- So you **measure more, and more carefully**.

## Two new things with no CNN analog

- **The KV cache** — autoregressive attention caches past keys/values; it grows with sequence
  length and often dominates memory. Managing/quantizing it is a whole optimization axis your
  CNN never had. (Mechanics in [§12](../12-nvidia-model-optimization/llm-inference.md).)
- **Two-phase inference** — a compute-bound **prefill** (process the prompt) then memory-bound
  **decode** (generate tokens). You optimize them differently and report **two latencies**
  (TTFT and per-token), not one.

## The mapping in one table

| Aspect | Your CNN | LLM | VLM |
|---|---|---|---|
| Bottleneck | compute | decode = memory | prefill (image tokens) + decode |
| Best-bang quant | INT8 (W+A) | weight-only INT4; FP8 | INT8 vision tower + INT4/FP8 decoder |
| Outliers? | no | yes → SmoothQuant/AWQ | yes (in the LLM half) |
| Retrain? | QAT easy | PTQ / QLoRA | PTQ / QLoRA |
| Quality metric | top-1 acc | perplexity + MMLU… | VQA/caption benchmarks |
| New cost | — | KV cache | KV cache + many image tokens |

## 🔗 Connecting the dots: the real stack

Same spirit as your project, different tools: **HuggingFace** baseline → **AutoAWQ / AutoGPTQ /
bitsandbytes** (weight-only) or **TensorRT-Model-Optimizer** (FP8/SmoothQuant) → served by
**TensorRT-LLM / vLLM / llama.cpp** → evaluated with **lm-evaluation-harness**.

**How you'd say it:** *"The loop is the same as my CNN project — baseline, quantize, serve,
compare — but LLM decode is memory-bound, so weight-only INT4 is the big win instead of INT8
compute; activations have outliers so I'd use SmoothQuant or AWQ; I can't afford QAT so I'd
reach for QLoRA; and I'd track perplexity and tokens/sec, not top-1."*

## Self-check

- Why does weight-only INT4 help an LLM but wouldn't have been the obvious choice for your
  CNN? *(LLM decode is memory-bound — fewer weight bytes to load speeds it up; the CNN was
  compute-bound.)*
- Why does plain per-tensor INT8 PTQ fail on an LLM? *(outlier activation channels inflate the
  scale and crush normal values → need SmoothQuant/AWQ.)*
- What replaces QAT when the model's too big to retrain? *(PTQ/weight-only quantization, and
  QLoRA for cheap task-specific recovery.)*
- Name two things you optimize on an LLM that have no CNN analog. *(the KV cache; the separate
  prefill vs decode phases.)*
