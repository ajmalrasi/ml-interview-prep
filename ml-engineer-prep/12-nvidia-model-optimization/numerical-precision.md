# Numerical Precision — FP32 → FP8 → INT8

**TL;DR:** Every number format is a bet on **range vs precision** in a fixed bit budget.
Floating point spends bits on an **exponent** (range) and a **mantissa** (precision);
integer/INT8 has neither — just a fixed step. Knowing which format to reach for, and *why
FP16 needs loss scaling but BF16 doesn't*, is table-stakes at NVIDIA.

## The formats, in one table

| Format | Bits (E/M) | Dynamic range | Precision | Where it's used |
|---|---|---|---|---|
| **FP32** | 8 / 23 | huge | high | Baseline; master weights in mixed precision. |
| **TF32** | 8 / 10 | = FP32 | ~FP16 | Ampere+ tensor-core math for "FP32" matmuls (on by default). |
| **FP16** | 5 / 10 | narrow (~6e−5…65504) | good | Mixed-precision train/infer; **needs loss scaling**. |
| **BF16** | 8 / 7 | = FP32 | lower | Training; no loss scaling needed. |
| **FP8 E4M3** | 4 / 3 | small | more mantissa | Hopper/Ada forward pass (weights/activations). |
| **FP8 E5M2** | 5 / 2 | larger | less mantissa | Gradients (needs range). |
| **INT8** | fixed step | set by scale | uniform | TensorRT inference; needs calibration. |
| **INT4** | fixed step | set by scale | coarse | LLM weight-only (AWQ/GPTQ). |

The single sentence that ties it together: **exponent bits buy range, mantissa bits buy
precision, and INT formats trade both for a single uniform step you place with a scale.**

**See the bit budget.** Pick a format and watch how its bits split into sign / exponent /
mantissa — and how that fixes its **range** (exponent) and **precision** (mantissa). Notice
FP16 vs BF16: same total bits, but BF16 spends them on range, which is exactly why it skips
loss scaling.

```rawhtml
<div id="format-widget" class="widget-host"></div>
```

## Why FP16 needs loss scaling but BF16 doesn't

A favorite question. The whole answer is about **exponent range**, not precision.

**FP16 — narrow range, needs the fix:**
- Keeps FP32-ish mantissa precision, but a **much narrower exponent range**.
- Small gradients **underflow to zero** and vanish.
- Fix = **loss scaling**: multiply the loss by a big constant before `backward` so gradients
  land in FP16's range → unscale before the optimizer step → skip the step if any Inf/NaN shows up.
- Frameworks automate it: `torch.cuda.amp.GradScaler`.

**BF16 — FP32's range, no fix needed:**
- **Same 8-bit exponent as FP32** → identical range → gradients don't underflow → **no loss scaling.**
- Cost is only 7 mantissa bits (less precision), which training tolerates well.
- That's why BF16 is the default for large-model training today — even though FP16 has more mantissa.

```rawhtml
<div class="compare">
  <div class="cmp-col">
    <div class="cmp-h">FP16</div>
    <p><b>Narrow range</b>, more precision → underflow risk.</p>
    <span class="cmp-tag">needs loss scaling</span>
  </div>
  <div class="cmp-col green">
    <div class="cmp-h">BF16</div>
    <p><b>FP32 range</b>, less precision → no underflow.</p>
    <span class="cmp-tag">no loss scaling needed</span>
  </div>
</div>
```

## TF32 — the "free" one people forget

On Ampere and newer, a **plain FP32 matmul** on tensor cores actually runs in **TF32**:

- Inputs are rounded to a 19-bit form (**8 exp, 10 mantissa**) before the multiply; accumulation stays in FP32.
- You get most of FP16's speed at **near-FP32 accuracy**.
- It's **on by default** in cuDNN/cuBLAS — in PyTorch, `torch.backends.cuda.matmul.allow_tf32`.

Good to mention: *"a chunk of the FP32→FP16 speedup people report is really FP32→TF32, already
happening under the hood."*

## Mixed-precision training (the mechanism)

"Mixed precision" = compute in FP16/BF16 for speed, but keep a **master copy of weights in FP32**
so tiny updates don't get lost to rounding.

The loop:
1. Forward/backward in FP16 (with loss scaling) or BF16.
2. Accumulate into the **FP32 master weights**.
3. Apply the optimizer in FP32.

**Payoff:** ~**2× faster** and ~**half the memory**, negligible accuracy loss. Tensor cores are
why it's fast — they're built for reduced-precision matmul-accumulate.

## FP8 — the current frontier (Hopper / Ada)

FP8 comes in **two flavors** because forward and backward want different things:
- **E4M3** (4 exponent, 3 mantissa) — more precision, less range → forward pass, weights &
  activations.
- **E5M2** (5 exponent, 2 mantissa) — more range, less precision → gradients.

FP8 needs **per-tensor scaling factors** (delayed/dynamic scaling) to keep values in range,
much like INT8 calibration — NVIDIA's **Transformer Engine** does this automatically for
training and inference.

Why it matters: FP8 **doubles tensor-core throughput vs FP16** and is the headline feature of
Hopper (H100). Expect at least one FP8 question if the role touches LLMs.

## INT8 vs FP16 — when to pick which

- **FP16/BF16:** ~2× faster, ~half memory, **almost no accuracy risk, no calibration**. The
  safe default and often the whole answer.
- **INT8:** up to ~4× and lowest memory, but needs **calibration** and can lose accuracy —
  so you *measure* it (exactly your project's compare table). Best when latency/cost is tight
  and you can afford the calibration + QAT effort.
- Instinct to voice: *"FP16 first because it's free accuracy-wise; INT8 when the latency or
  cost budget demands it and I can validate the accuracy hit — and I keep sensitive layers
  (first/last, softmax) in higher precision if INT8 hurts."*

## 🔗 Connecting the dots — the real stack

**AMP** (`torch.cuda.amp`, `torch.autocast`) for mixed precision; **Transformer Engine** for
FP8; tensor-core formats are picked by **cuBLAS/cuDNN/TensorRT** automatically. TensorRT's
`enabled_precisions={torch.half}` (your FP16 path) vs the INT8 builder flag chooses the format
the engine targets.

**How you'd say it:** *"My TRT-FP16 row was basically free accuracy-wise; the INT8 rows needed
calibration and I tracked the drop. On newer hardware I'd reach for FP8 via Transformer Engine
before INT8 for LLMs — similar speed with an easier accuracy story."*

## Self-check

- Why does FP16 need loss scaling and BF16 not? *(FP16 has a narrow exponent range →
  gradients underflow; BF16 shares FP32's 8-bit exponent → no underflow.)*
- What is TF32 and when does it kick in? *(19-bit tensor-core format for FP32 matmuls on
  Ampere+, on by default — near-FP32 accuracy at FP16-ish speed.)*
- Why two FP8 formats? *(E4M3 precision-heavy for forward; E5M2 range-heavy for gradients.)*
- In mixed precision, why keep FP32 master weights? *(so small updates aren't lost to FP16
  rounding.)*
