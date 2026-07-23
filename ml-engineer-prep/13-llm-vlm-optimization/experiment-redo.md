# Experiment Redo: Your Project as an LLM/VLM

**TL;DR:** Take the exact structure of your FashionMNIST notebook and re-cast it for an LLM,
then a VLM. Same skeleton — baseline, quantized variants, one compare table, everything
tracked — with LLM metrics and tools swapped in. This is the "walk me through how you'd apply
your project to *our* models" answer.

## The one-sentence pitch

> "My project proved I can run the full optimization loop and reason about method vs engine on
> a CNN. The same loop applies to an LLM — I'd swap PTQ/QAT for AWQ-INT4 and FP8, TensorRT for
> TensorRT-LLM, and top-1 for perplexity and tokens/sec — and a VLM is just my CNN skills on
> the vision tower plus that LLM loop on the decoder."

## LLM redo: the compare table

Keep your six-row idea; change the axes. Baseline FP16, then walk method × engine:

| Variant | Method | Engine | Quality (PPL / MMLU) | TTFT | Tokens/s | VRAM |
|---|---|---|---|---|---|---|
| FP16 | — | vLLM | reference | ref | ref | ref |
| **AWQ INT4** | weight-only PTQ | vLLM / TRT-LLM | ≈ baseline | ↓ | ↑ decode | **↓↓** |
| **GPTQ INT4** | weight-only PTQ | TRT-LLM | ≈ baseline | ↓ | ↑ | ↓↓ |
| **FP8 (W+A)** | calibrated PTQ | TRT-LLM | ≈ baseline | **↓↓** | ↑↑ | ↓ |
| **+ KV INT8** | cache quant | TRT-LLM | ≈ baseline | = | = | ↓ (longer ctx) |
| **QLoRA-tuned INT4** | adapter "QAT" | vLLM | ↑ on your task | ↓ | ↑ | ↓↓ |

**Direct analogies to your notebook:**
- FP16 baseline ↔ your FP32 baseline.
- AWQ/GPTQ INT4 ↔ your PTQ (calibrate, don't retrain) — but weight-only, because decode is
  memory-bound.
- FP8/W8A8 via SmoothQuant ↔ your TensorRT INT8, with outlier handling added.
- QLoRA ↔ your QAT — the "actually adjust weights" row, but cheap (adapters on a frozen base).
- The `device` column that stopped CPU-INT8 being misread ↔ here, label the **engine** and
  **batch/seq length**, since tokens/sec is meaningless without them.

## What carries over verbatim from your project

- **Method vs engine separation** — AWQ (method) vs TensorRT-LLM (engine) is your PTQ-vs-
  TensorRT insight, unchanged.
- **"Speed comes from kernels, not weight values"** — TRT-LLM engines for two INT4 methods run
  the same kernels; quality differs, latency doesn't. Exactly your TRT-PTQ vs TRT-QAT finding.
- **Calibration is a clipping decision** — AWQ's salient-channel scaling and FP8's per-tensor
  scaling are the same "pick the range well" problem as your entropy calibrator.
- **Measure everything, trust nothing** — same MLflow discipline; more columns.

## What you'd deliberately change

- **Metric:** perplexity + a task benchmark (lm-eval-harness), not top-1.
- **Two latencies:** TTFT and per-token, swept over batch/seq — not one number.
- **No training:** start from a checkpoint; QLoRA is the only "training," and it's tiny.
- **New axis:** KV-cache precision — a lever your CNN never had.

## VLM redo: add two rows

A VLM table = the LLM table **plus** the vision side (your home turf):

| Extra variant | What it targets | Why |
|---|---|---|
| **INT8 vision encoder** | the ViT/CNN tower | *Your FashionMNIST playbook* — PTQ, per-channel, TensorRT; runs once/image |
| **Visual token reduction** | image-token count | Shrinks prefill + KV — the VLM-specific biggest win |

Then the decoder rows are identical to the LLM table above. The story writes itself: *"I
optimize the vision tower the way I optimized my CNN, the decoder the way I'd optimize an LLM,
and I add token reduction because image tokens are where VLM latency actually lives."*

## The 90-second spoken version

> "Same experiment, three model types. FashionMNIST CNN: FP32 → PTQ/QAT/INT8/FP16 on TensorRT,
> compared on top-1 and latency — that's done. For an LLM I keep the skeleton but the winning
> variants change: AWQ or GPTQ weight-only INT4 because decode is memory-bound, FP8 for prefill
> throughput, KV-cache quant for context length, QLoRA where I need task recovery — served on
> TensorRT-LLM or vLLM, judged on perplexity, MMLU, TTFT, and tokens/sec. A VLM is both: I
> quantize the vision encoder with my CNN toolchain, treat the decoder as an LLM, and reduce
> visual tokens first because that's where prefill and KV cost live. One loop, three model
> families, and I can name why each variant wins."

## Self-check

- Map each row of your FashionMNIST table to its LLM equivalent. *(FP32→FP16; PTQ→AWQ/GPTQ
  INT4; TRT-INT8→FP8/SmoothQuant; QAT→QLoRA; device col→engine+batch/seq.)*
- Which of your project's findings transfers *word for word*? *("speed comes from the kernels,
  not the weight values" — same-kernel engines differ in quality, not latency.)*
- What two rows does a VLM add, and which uses your CNN skills? *(INT8 vision encoder — CNN
  skills — and visual token reduction.)*
