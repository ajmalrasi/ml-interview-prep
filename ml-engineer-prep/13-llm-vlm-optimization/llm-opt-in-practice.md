# The Loop in Practice

**TL;DR:** The same pipeline shape as your notebook — baseline → quantize → serve → compare —
but with LLM tools and LLM metrics. Baseline FP16, then produce INT4 (AWQ/GPTQ), FP8, and
KV-quant variants, serve each on TensorRT-LLM / vLLM / llama.cpp, and compare on **quality
(perplexity + benchmarks)**, **TTFT**, **tokens/sec**, and **VRAM**. This page is the concrete
recipe.

## The pipeline, side by side with your CNN project

```rawhtml
<div class="diagram">
  <table class="maptable">
    <thead><tr><th>Your CNN notebook</th><th class="marw"></th><th>LLM version</th></tr></thead>
    <tbody>
      <tr><td class="mfrom">train FP32</td><td class="marw"></td><td class="mto">start from a pretrained FP16 checkpoint (no training)</td></tr>
      <tr><td class="mfrom">PTQ / QAT (fbgemm)</td><td class="marw"></td><td class="mto">AWQ / GPTQ (weight-only) · SmoothQuant / FP8 (w+a)</td></tr>
      <tr><td class="mfrom">TensorRT INT8 / FP16</td><td class="marw"></td><td class="mto">TensorRT-LLM engine · vLLM · llama.cpp (GGUF)</td></tr>
      <tr><td class="mfrom">evaluate: top-1, latency</td><td class="marw"></td><td class="mto">evaluate: perplexity + MMLU, TTFT, tokens/sec, VRAM</td></tr>
      <tr><td class="mfrom">MLflow compare table</td><td class="marw"></td><td class="mto">same — track every variant</td></tr>
    </tbody>
  </table>
</div>
```

You don't train — you take a released checkpoint and **optimize** it. That's the norm for LLMs
and a fine thing to say.

## Step 1: baseline

Load the FP16 model, run your eval harness, record **perplexity**, a task benchmark or two,
**TTFT** (time to first token = prefill latency), **TPOT** (time per output token = decode
latency), **throughput** (tokens/sec at your batch size), and **peak VRAM**. This is your
reference row — the equivalent of your FP32 baseline.

## Step 2: quantize (produce the variants)

| Variant | Tool | One line |
|---|---|---|
| **W4 INT4 (weight-only)** | AutoAWQ / AutoGPTQ | calibrate on a few hundred sequences → 4-bit weights |
| **GGUF Q4_K_M** | llama.cpp | group-wise k-quant; great for CPU/edge/local |
| **NF4 + QLoRA** | bitsandbytes + peft | 4-bit base, train LoRA adapters if you need task recovery |
| **FP8 / W8A8** | TensorRT-Model-Optimizer | SmoothQuant/FP8 calibration for Hopper/Ada |
| **KV-cache INT8/FP8** | TensorRT-LLM / vLLM flag | halve the cache → longer ctx / bigger batch |

Each needs a small **calibration set** (representative prompts) — the LLM analog of your PTQ
calibration batches.

## Step 3: serve (the engine axis)

- **TensorRT-LLM** — NVIDIA's LLM runtime: build an engine (fused kernels, FP8, in-flight
  batching), serve via Triton. Best latency/throughput on NVIDIA GPUs. The direct heir to your
  TensorRT step.
- **vLLM** — PagedAttention + continuous batching; easiest high-throughput serving, great
  default for experiments.
- **llama.cpp** — GGUF models on CPU/edge/Apple Silicon; how you'd run locally.
- Mechanics (KV cache, paged attention, in-flight batching, TP/PP) are in
  [§12 LLM Inference](../12-nvidia-model-optimization/llm-inference.md) — cross-reference, don't
  re-derive.

## Step 4: the compare table (what to actually measure)

LLM latency is **two numbers**, so your table grows columns:

| Variant | Perplexity ↓ | MMLU ↑ | TTFT (ms) | Tokens/s ↑ | VRAM (GB) ↓ | Engine |
|---|---|---|---|---|---|---|
| FP16 baseline | ref | ref | ref | ref | ref | HF / vLLM |
| AWQ INT4 | ~= | ~= | ↓ | ↑ (decode) | **↓↓** | vLLM / TRT-LLM |
| FP8 (w+a) | ~= | ~= | **↓↓** | ↑↑ | ↓ | TRT-LLM |
| + KV INT8 | ~= | ~= | = | = | ↓ (longer ctx) | TRT-LLM |

The instinct to voice: **INT4 wins on memory and decode; FP8 wins on prefill/throughput; KV
quant buys context length** — and you *measure the quality cost of each*, exactly like your CNN
compare table.

## Measuring latency correctly (LLM version)

Same async-GPU discipline as your CNN, plus LLM specifics: **warm up**, separate **prefill
(TTFT)** from **decode (TPOT)**, sweep **batch size and sequence length** (throughput is
meaningless without them), and report **p50/p99**. `trtllm-bench` / `genai-perf` (NVIDIA) or
vLLM's benchmark scripts do this properly — the analog of your `benchmark_latency`.

## 🔗 Connecting the dots: the real stack

Quantize: **AutoAWQ / AutoGPTQ / bitsandbytes / llama.cpp / TensorRT-Model-Optimizer**. Serve:
**TensorRT-LLM (+Triton) / vLLM / TGI / llama.cpp**. Evaluate: **lm-evaluation-harness**,
**genai-perf / trtllm-bench**. Track: **MLflow / Weights & Biases**, same as your project.

**How you'd say it:** *"I'd keep the exact structure of my CNN experiment — baseline, a few
quantized variants, one compare table, everything tracked. The variants become AWQ-INT4, FP8,
and KV-quant; the engine becomes TensorRT-LLM or vLLM; and the columns become perplexity, a
task benchmark, TTFT, tokens/sec, and VRAM."*

## Self-check

- Why is there no training step in the LLM loop? *(you optimize a released pretrained
  checkpoint; PTQ/weight-only needs no retraining.)*
- Why does an LLM report two latencies? *(prefill/TTFT is compute-bound; decode/TPOT is
  memory-bound — different optimizations, measured separately.)*
- Which variant would you pick to fit a big model in limited VRAM? *(weight-only INT4 (AWQ/GPTQ)
  + KV-cache quant.)*
- What replaces `top-1` and `benchmark_latency` from your notebook? *(perplexity + task
  benchmarks via lm-eval-harness; genai-perf/trtllm-bench for TTFT & tokens/sec.)*
