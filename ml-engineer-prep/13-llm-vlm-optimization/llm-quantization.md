# LLM Quantization

**TL;DR:** Two families. **Weight-only** (INT4, keep activations FP16) shrinks memory and
speeds up the memory-bound decode — GPTQ/AWQ. **Weight + activation** (INT8 or FP8) also speeds
the compute-bound prefill but must tame activation outliers — SmoothQuant/FP8. Plus a third
target unique to LLMs: **quantize the KV cache**. Pick by which bottleneck you're attacking.

## The decision that frames everything

Quantize **weights only**, or **weights *and* activations**? It maps straight to which phase
hurts:

| | Weight-only (e.g. W4A16) | Weight + activation (W8A8 / FP8) |
|---|---|---|
| What's quantized | weights → INT4, activations stay FP16 | both → INT8 or FP8 |
| Speeds up | **decode** (less to load) + big memory cut | **prefill** too (faster matmuls) |
| Main risk | small quality loss | **activation outliers** wreck accuracy |
| Methods | **GPTQ, AWQ**, GGUF k-quants, bnb NF4 | **SmoothQuant**, FP8 calibration |
| Use when | memory-bound / VRAM-limited / long decode | throughput-bound / long prompts / batch |

One-liner: *"Weight-only INT4 if I'm memory- or VRAM-bound, which decode usually is;
weight+activation INT8/FP8 if prefill/throughput dominates and I can handle the outliers."*

## Weight-only methods (INT4)

- **GPTQ** — layer-wise, **second-order (Hessian-based)** rounding: quantize weights column by
  column, compensating remaining weights for the error. INT4/INT3 with small quality loss.
- **AWQ (Activation-aware Weight Quantization)** — protect the ~1% of weight channels that
  matter most (identified by *activation* magnitude), scale them up before quantizing so INT4
  doesn't crush them. Fast, no backprop, great quality/latency.
- **Group-wise quantization** — the LLM twist on per-channel: give every **group of N weights**
  (e.g. group size 128) its own scale. Finer than per-channel, the accuracy knob behind INT4.
  GGUF "k-quants" (Q4_K_M etc.) are group-wise mixes.
- **NF4 (bitsandbytes)** — a 4-bit "normal float" data type matched to the bell-curve
  distribution of weights; the base for **QLoRA**.

## Weight + activation methods

- **SmoothQuant** — the outlier fix. Migrate the "difficulty" from activations into weights by
  a per-channel scaling `X·diag(s)⁻¹` and `diag(s)·W`, so *both* become smooth enough for INT8.
  This is what makes W8A8 viable on LLMs.
- **FP8 (E4M3)** — on Hopper/Ada, often the sweet spot: near-FP16 quality, tensor-core speed,
  and it handles outliers better than INT8 because floating point keeps dynamic range.
  Calibrated per-tensor via Transformer Engine / TensorRT-LLM.

## The third target: KV-cache quantization

Unique to LLMs — the KV cache can dwarf the weights at long context/large batch. Store it in
**INT8 or FP8** to roughly **halve** it, which directly buys **longer context or bigger
batches**. Usually low-risk (keys can be more sensitive than values; some setups keep keys
higher-precision). Always worth mentioning as a lever your CNN never had.

## PTQ vs QAT for LLMs

- **PTQ dominates** — all the methods above are post-training; they need only a small
  **calibration set** (a few hundred sequences). Cheap, no gradients.
- **Full QAT is rare** — too expensive at LLM scale. The practical stand-in is **QLoRA**:
  freeze a 4-bit (NF4) base, train small **LoRA adapters** in higher precision on top.
  You get QAT-like task recovery for a tiny fraction of the cost — and you can serve the base
  once and hot-swap adapters.
- **Distillation** is bigger than in CV — small strong models are often *distilled* from large
  ones, then quantized.

## Measuring quality (don't say "accuracy")

- **Perplexity** on held-out text (e.g. WikiText) — cheap, sensitive first check.
- **Downstream benchmarks** — MMLU (knowledge), GSM8K (reasoning), HumanEval (code), etc., via
  **lm-evaluation-harness**. A 4-bit model can hold perplexity but drop on reasoning, so test
  the tasks you care about.
- **Watch long-context and reasoning** — these degrade first under aggressive quantization.

## 🔗 Connecting the dots: the real stack

**AutoGPTQ**, **AutoAWQ**, **llama.cpp/GGUF** (k-quants, CPU/edge), **bitsandbytes** (NF4/8-bit,
QLoRA) for weight-only; **NVIDIA TensorRT-Model-Optimizer** and **TensorRT-LLM** for
SmoothQuant/FP8/INT8 and KV-cache quant; **lm-evaluation-harness** for quality.

**How you'd say it:** *"For a VRAM-bound deployment I'd AWQ or GPTQ the weights to group-wise
INT4 and quantize the KV cache to FP8; for a throughput-bound one on Hopper I'd go FP8
weight+activation via TensorRT-LLM. Either way I validate on perplexity plus the task
benchmarks I actually care about, because 4-bit can pass perplexity and still lose reasoning."*

## Self-check

- Weight-only vs weight+activation — which bottleneck does each attack? *(weight-only →
  memory/decode; weight+activation → compute/prefill, but needs outlier handling.)*
- What problem do SmoothQuant and AWQ solve, and how differently? *(activation outliers;
  SmoothQuant shifts difficulty into weights for W8A8, AWQ protects salient weight channels for
  INT4.)*
- What's group-wise quantization? *(a scale per group of N weights, e.g. 128 — finer than
  per-channel, the accuracy knob for INT4.)*
- Why quantize the KV cache, and what does it buy? *(it can exceed the weights at long context;
  INT8/FP8 halves it → longer context / bigger batch.)*
- QAT's practical replacement at LLM scale? *(QLoRA — LoRA adapters on a frozen 4-bit base.)*
