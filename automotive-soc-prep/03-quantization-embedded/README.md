# 3 · Quantization for Embedded

**TL;DR:** The NPU is an **INT8 engine**, so quantization isn't optional — it's how the
model runs on the accelerator at all. This section is the embedded-focused version of
quantization: PTQ vs QAT, calibration methods, and — the part the JD stresses — **diagnosing
and mitigating the accuracy you lose** when a model is quantized or an operator is limited.

## Why quantization is central to this role

- The fast blocks (NPU/CNNIP) compute in **INT8**; FP32/FP16 either doesn't run there or
  runs far slower. No quantization → no acceleration.
- INT8 also **cuts memory traffic 4×**, which on a bandwidth-limited SoC is often the bigger
  win than the MAC speedup (see the roofline argument in
  [npu-dsp-cnnip.md](../01-embedded-accelerators/npu-dsp-cnnip.md)).
- But INT8 has only 256 levels — some layers lose accuracy, and **you** have to find which
  and fix them. That's the applied skill this JD is testing.

## Relationship to your existing prep

You already have the deep numerics (scale/zero-point, symmetric vs asymmetric, per-channel,
FP32→FP8→INT8) in **ml-engineer-prep §12** ([quantization-deep](../../ml-engineer-prep/12-nvidia-model-optimization/quantization-deep.md),
[numerical-precision](../../ml-engineer-prep/12-nvidia-model-optimization/numerical-precision.md)).
This section assumes that and focuses on the **embedded workflow and accuracy debugging**.

## Pages

- **[PTQ, QAT & Calibration](ptq-qat-calibration.md)** — the two paths, when to use each,
  and how calibration methods (min-max, entropy/KL, percentile) pick scales.
- **[Accuracy Degradation & Mitigation](accuracy-mitigation.md)** — the diagnosis checklist:
  find the layer that's hurting, understand why, and the ladder of fixes.

## The one-liner to have ready

> "I start with PTQ because it's fast and needs no training data pipeline, per-channel
> weights and a good calibration set. If accuracy still misses target, I localize the
> damage — usually a few sensitive layers — and either keep those in higher precision or move
> to QAT to recover the last points. Quantization is a per-layer accuracy budget, not a
> single global switch."
