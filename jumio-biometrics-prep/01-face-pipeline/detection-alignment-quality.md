# Detection, Alignment & Face Quality

**TL;DR:** Detection finds the face, alignment removes nuisance geometry, and quality
predicts whether the resulting sample is usable. Treat them as independently measurable
stages with separate error budgets.

## Detection and landmarks

A face detector returns a bounding box, confidence and often five landmarks. Production
choices include lightweight mobile detectors and heavier server-side models such as
RetinaFace-style detectors. Evaluate **recall at the capture distribution**, not only
generic mAP: profiles, masks, glasses, low light, dark/light skin tones, older devices,
ID-card portraits and screen recaptures all matter.

Landmarks define the canonical crop. Given source eye/nose points and target template
points, estimate a similarity transform (rotation, uniform scale and translation), then
warp to the encoder input size. Keep the interpolation, color order, crop margin and
normalization versioned; a one-pixel or RGB/BGR mismatch can create train/serve skew.

## Quality as a gate

Useful signals include:

- face size and detector confidence;
- yaw, pitch and roll;
- blur or motion estimates;
- under/overexposure and non-uniform illumination;
- occlusion of eyes, nose or mouth;
- compression, moiré, screen glare and resampling artifacts;
- embedding-based utility or uncertainty.

Do not combine everything into an unexplained scalar too early. Keep reason codes so you
can improve capture UX and diagnose subgroup differences.

## Thresholding the quality gate

A strict gate improves accepted-sample accuracy but raises **failure to acquire** and
customer abandonment. A loose gate increases match errors and fraud exposure. Select the
gate on an end-to-end curve:

| Gate becomes stricter | Usually improves | Usually worsens |
|---|---|---|
| higher minimum quality | FNMR/FMR among accepted samples | capture completion and conversion |
| tighter pose limits | alignment consistency | accessibility and device coverage |
| larger minimum face | embedding stability | low-end camera acceptance |

Report both **conditional matcher performance** and **overall journey performance**.
Excluding hard captures can make the matcher look fair while the product rejects one
group more often at the quality gate.

## Debug checklist

1. Freeze the sample and preprocessing versions.
2. Visualize boxes/landmarks on failure slices.
3. Measure detector miss, acquisition failure and matcher error separately.
4. Compare offline and production tensors for the same image.
5. Tune guidance and recapture policy before retraining the encoder.

> “I measure the cascade, not only the final matcher. A fairness report must include
> failure-to-acquire and quality rejection, because those gates decide who reaches the
> face model.”
