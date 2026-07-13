# Quantization, Deeply

**TL;DR:** Quantization maps a range of floats onto a small set of integers with a
**scale** (and maybe a **zero-point**). Everything interesting — accuracy loss, calibration,
symmetric vs asymmetric, per-channel — falls out of *how you pick that scale*. Your project
did PTQ and QAT; this page is the numeric layer underneath them that NVIDIA will drill.

## The core mapping (know the formula cold)

Quantization is an **affine map** between a real value `r` and an integer `q`:

```rawhtml
<div class="formula">
  <div class="frow"><span class="fexpr">r ≈ <span class="fv">scale</span> · (q − <span class="fv">zero_point</span>)</span><span class="fnote">dequantize</span></div>
  <div class="frow"><span class="fexpr">q = round(r / <span class="fv">scale</span>) + <span class="fv">zero_point</span></span><span class="fnote">quantize, then clamp to [qmin, qmax]</span></div>
</div>
```

- **scale** (a float) — the size of one integer step in real units.
- **zero_point** (an integer) — which integer maps to real 0.0.
- For signed INT8, `qmin=−128, qmax=127`; for unsigned, `0…255`.

That's the whole idea. Two choices define a quantizer: **how wide a range** you cover
(calibration) and **whether zero-point is forced to 0** (symmetric vs asymmetric).

**Play with the mapping.** Set a tensor range, pick a value, and watch the scale,
zero-point, the int8 code it snaps to, and the rounding error. Notice how a *wider*
range makes the step (scale) bigger, so every value gets a coarser approximation — and
how symmetric wastes half a code on the unused sign when the data is all-positive.

```rawhtml
<div id="quant-widget" class="widget-host"></div>
```

## Symmetric vs asymmetric

- **Symmetric:** `zero_point = 0`, range is `[−α, α]`, `scale = α / 127`. Real 0 maps to
  integer 0. Cheaper math (no zero-point term in the matmul), and it's what **weights** use.
- **Asymmetric (affine):** range is `[β, α]` with a non-zero zero-point, so it can hug a
  one-sided distribution tightly. Used for **activations** after ReLU (all ≥ 0) where a
  symmetric range would waste half the codes.

The interview one-liner: *"Weights symmetric per-channel, activations asymmetric (or
symmetric) per-tensor — weights are roughly zero-centered so symmetric wastes nothing and
skips the zero-point term; post-ReLU activations are one-sided so asymmetric buys back a bit."*

## Per-tensor vs per-channel (this explains your accuracy cliff)

- **Per-tensor:** one scale for the entire weight tensor. Simplest, but if one output
  channel has a much larger range than the others, the small-range channels get crushed
  into a handful of integer codes.
- **Per-channel (per-axis):** one scale **per output channel** of a conv/linear weight.
  Each channel uses the full INT8 range. This is the standard fix and it's nearly free
  (scales are applied along the output axis after the matmul).

> **Your project's ~0.83 INT8 cliff is almost certainly this.** A small 5-conv model has
> few channels and uneven weight ranges, so **per-tensor** weight quantization loses a lot.
> Say in the interview: *"On such a small net I'd expect per-channel weight quantization and
> more calibration data to recover most of that drop before I even reach for QAT."* That is
> exactly the kind of diagnosis they want.

## Calibration: how you choose the range α

PTQ never touches weights — it just runs batches to observe activation ranges and picks
`α`. **How** you pick it is the calibration algorithm, and it matters a lot:

| Calibrator | Rule | Trade-off |
|---|---|---|
| **Min–max** | α = observed max | Simple; one outlier blows the scale up and wastes codes. |
| **Entropy / KL** (TensorRT default, `IInt8EntropyCalibrator2`) | clip α to minimize KL divergence between the FP32 and INT8 activation histograms | Robust to outliers; usually best accuracy. |
| **Percentile** | α = e.g. 99.99th percentile | Cheap outlier rejection; needs the percentile tuned. |
| **MSE** | α minimizing quantization MSE | Good, a bit slower. |

The insight worth stating: **calibration is a clipping decision.** A wider α covers outliers
but makes every step coarser; a tighter α is finer but clips the tails. Entropy calibration
picks the α that best preserves the *distribution's information* — which is why TensorRT
defaults to it and why swapping to `IInt8MinMaxCalibrator` (a "next step" in your notes) is a
real experiment, not a cosmetic one.

## PTQ vs QAT — the numeric picture

Your notes nail the intuition; here's the mechanism under it:

- **PTQ** solves *"given fixed weights, pick scales that lose the least accuracy."* No
  gradients. Minutes. Fails when the weight distribution is inherently hard to represent in
  INT8 (outliers, wide per-tensor range).
- **QAT** inserts **fake-quant** nodes: forward pass does `dequant(quant(x))` so the model
  *feels* rounding, but gradients flow through via the **Straight-Through Estimator (STE)** —
  the quantizer's derivative is treated as 1 in the pass-through region. Training then nudges
  weights to be robust to rounding and can even learn the ranges. Recovers accuracy PTQ can't.

**STE is a classic follow-up.** "How do you backprop through a round()? Its gradient is 0
almost everywhere." Answer: *STE — pass the gradient straight through inside the clipping
range and zero it outside, so the network can still learn despite the non-differentiable
rounding.*

## Advanced PTQ (name-drop these — they're NVIDIA-adjacent)

For LLMs, plain PTQ breaks because of **activation outliers**. Modern methods fix that
without full retraining, and NVIDIA's `TensorRT-Model-Optimizer` implements them:

- **SmoothQuant** — migrate the "difficulty" from activations into weights by a per-channel
  scaling, so both become easy to quantize. Enables INT8/FP8 on LLMs.
- **AWQ (Activation-aware Weight Quantization)** — protect the ~1% of weight channels that
  matter most (by activation magnitude), quantize the rest to INT4. Weight-only.
- **GPTQ** — second-order (Hessian-based) layer-wise weight quantization to INT4/INT3.
- **Weight-only (INT4) vs weight+activation (INT8/FP8):** weight-only shrinks memory and
  helps the memory-bound decode phase of LLMs; W8A8/FP8 also speeds compute-bound matmuls.

## 🔗 Connecting the dots — the real stack

Native **PyTorch** quantization (`torch.ao.quantization`, fbgemm/qnnpack — **CPU** kernels,
as your project found). On GPU: **TensorRT** calibrators for implicit PTQ, and
**NVIDIA TensorRT-Model-Optimizer** (formerly parts of `pytorch-quantization`) for QAT/QDQ,
SmoothQuant, AWQ, and FP8. For LLM weight-only: **GPTQ**, **AWQ**, **bitsandbytes**.

**How you'd say it:** *"On my FashionMNIST project the INT8 drop came from per-tensor weight
quantization on a tiny net; per-channel scales plus entropy calibration recover most of it,
and QAT with straight-through estimation buys back the rest by making the weights
rounding-robust."*

## Self-check

- Write the dequant formula and say what scale and zero-point mean. *(r = scale·(q −
  zero_point); scale = real size of one step, zero_point = integer that maps to 0.0.)*
- Why symmetric for weights, asymmetric for post-ReLU activations? *(weights ~zero-centered
  so symmetric wastes nothing and drops the zero-point term; ReLU output is one-sided so
  asymmetric hugs it.)*
- Why does entropy calibration usually beat min–max? *(min–max lets a single outlier inflate
  the scale; entropy clips to preserve the distribution → finer steps where it matters.)*
- How does QAT backprop through rounding? *(straight-through estimator: gradient ≈ 1 inside
  the clip range, 0 outside.)*
