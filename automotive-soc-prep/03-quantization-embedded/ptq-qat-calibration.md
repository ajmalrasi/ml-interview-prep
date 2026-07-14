# PTQ, QAT & Calibration

**TL;DR:** **PTQ** quantizes a trained model with no gradient updates — you just need a
small **calibration set** to pick activation ranges. **QAT** simulates quantization *during*
training so the weights adapt, recovering accuracy PTQ loses at the cost of a training
pipeline. **Calibration** is the sub-problem inside PTQ: choosing the clipping range for each
tensor. Know when to reach for each and how the calibration methods differ.

## PTQ vs QAT at a glance

| | **PTQ** (post-training) | **QAT** (quantization-aware) |
|---|---|---|
| Needs training pipeline? | No | Yes (fine-tune) |
| Data needed | ~100–1000 unlabeled samples (calibration) | Full labeled training set |
| Time | Minutes–hours | Hours–days |
| Accuracy | Good for most CNNs; can drop on sensitive models | Best; recovers most of the loss |
| When to use | **First choice** — always try PTQ first | When PTQ misses the accuracy target |
| Your role | You run it | You **collaborate** with the training team |

The JD phrasing is exact: "**PTQ**" (you do it) and "**QAT collaboration**" (the training
team owns the loop, you provide the quantization spec and the target). Say it that way.

## How PTQ works

1. **Insert observers** on weights and activations.
2. **Weights** — ranges are known directly from the trained values; quantize immediately
   (per-channel for conv/matmul weights — big accuracy win, cheap on hardware).
3. **Activations** — ranges are *data-dependent*, so run the **calibration set** through the
   model and collect per-tensor statistics.
4. **Compute scales/zero-points**, insert Q/DQ, produce the
   [QDQ model](../02-onnx-toolchain/qdq-models.md).

The calibration set must be **representative** — same distribution as deployment (lighting,
scene types for AD). A biased calibration set is a top cause of field accuracy loss.

## Calibration methods (the activation-range choice)

For each activation tensor you must pick a clipping range `[−α, α]` (or `[β, α]`). Too wide
→ coarse steps waste precision; too narrow → clipping destroys outliers. Methods:

| Method | How it picks the range | Trade-off |
|---|---|---|
| **Min-Max** | Use the observed min/max | Simple; **outlier-sensitive** — one spike widens the range and coarsens everything |
| **Percentile** | Clip at e.g. 99.9th percentile | Ignores rare outliers → tighter range, better for most layers |
| **Entropy / KL-divergence** | Choose the range that minimizes information loss between FP and INT distributions (TensorRT's default) | Best general-purpose; a bit more compute |
| **MSE** | Minimize quantization mean-squared error | Good for weights / smooth distributions |

**Rule of thumb:** min-max for weights, **entropy or percentile for activations**. If a
layer has heavy outliers (common after certain activations), percentile/entropy beats
min-max clearly.

## Symmetric vs asymmetric, per-tensor vs per-channel (embedded specifics)

- **Weights: symmetric, per-channel.** Symmetric (zero-point 0) removes the zero-point term
  from the MAC — many NPUs *require* it for weights. Per-channel handles the wide range
  across output channels.
- **Activations: asymmetric or symmetric, per-tensor.** Per-tensor because per-channel
  activations are expensive/unsupported on most NPUs. Asymmetric helps one-sided
  distributions (post-ReLU, all ≥ 0) — but check what your NPU supports.

(The scale/zero-point math is in
[ml-engineer-prep quantization-deep](../../ml-engineer-prep/12-nvidia-model-optimization/quantization-deep.md).)

## How QAT recovers accuracy

QAT inserts **fake-quant** nodes (quantize→dequantize in FP, so gradients flow) into the
training graph. The forward pass sees the *rounding error*, so the optimizer nudges weights
to be **robust to quantization**. The **straight-through estimator (STE)** passes gradients
through the non-differentiable round as if it were identity.

- Usually a **short fine-tune** from the FP32 checkpoint, low LR.
- Export bakes the learned scales into the [QDQ model](../02-onnx-toolchain/qdq-models.md).
- Your collaboration deliverable: the **quantization scheme** (which layers, granularity,
  symmetric/asymmetric, target dtype) that matches the NPU's constraints, plus the accuracy
  target and the sensitive layers PTQ flagged.

## The workflow you'd describe

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node">FP32 model</span>
    <span class="arw labeled"><span class="al">PTQ + calib</span></span>
    <span class="node">INT8 QDQ<span class="nsub">measure accuracy</span></span>
    <span class="arw labeled"><span class="al">miss target?</span></span>
    <span class="node data">diagnose sensitive layers</span>
    <span class="arw labeled"><span class="al">mixed-prec / QAT</span></span>
    <span class="node out">ship</span>
  </div>
</div>
```

## Interview soundbite

> "PTQ first — it's minutes and needs only a representative calibration set; I use
> per-channel symmetric weights and entropy/percentile calibration for activations. I
> measure per-layer, and if I miss target I keep the few sensitive layers in higher
> precision or hand the training team a QAT spec to recover the rest. QAT is a collaboration
> — I own the quantization scheme and the target, they own the fine-tune."
