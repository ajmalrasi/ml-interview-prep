# Training & Model Optimization for the Edge

**TL;DR:** As a data scientist you own the model lifecycle: curate data, augment for
the deployment domain, transfer-learn instead of training from scratch, then
**optimize for the edge** (INT8/FP16, pruning, distillation, TensorRT) *without*
losing the accuracy you need. And because it's a closed on-prem loop, you improve
the model with **active learning** on its own failures.

## Data — where the accuracy actually comes from

- **Domain match is everything.** A model trained on web images fails on your CCTV:
  high angle, wide lens, night IR, weather, motion blur. Collect/label data **from
  the actual cameras and conditions**. This single point beats most architecture
  tweaks.
- **Labeling quality & consistency** — define box conventions (head vs full body,
  occluded-object policy) and hold to them; noisy labels cap your ceiling.
- **Class balance & hard cases** — deliberately include night, crowds, occlusion,
  rare events; a model only learns what it sees.

## Augmentation (cheap generalization)

- **Geometric:** flip, scale, crop, rotate — teach scale/position invariance
  (matches the CCTV scale range).
- **Photometric:** brightness/contrast/hue, noise, blur, JPEG artifacts — teach
  robustness to lighting/weather/IR and compression.
- **Detection-specific:** **mosaic** (4 images tiled — YOLO staple, great for small
  objects and context), mixup, copy-paste, cutout/random-erase (occlusion robustness).
- Augment toward *your* deployment conditions — simulate night, rain, glare.

## Transfer learning (almost always the right start)

Start from an ImageNet/COCO-pretrained backbone and **fine-tune** on your data —
far less data and compute than scratch, better generalization. Freeze early layers
(generic edges/textures) and adapt the head + later layers to your classes/domain.
Say this — training a detector from scratch on-site is rarely justified.

## Handling the usual problems

- **Class imbalance** — focal loss, resampling, class-balanced sampling.
- **Overfitting** — more/harder augmentation, dropout, weight decay, early stopping,
  validate on a **held-out scene** (not just held-out frames from the same clip).
- **Small objects** — higher input res, FPN, tiling, mosaic.
- **Evaluate on realistic splits** — split by camera/day, not random frames, or
  near-duplicate frames leak and inflate your metrics.

## Optimization for the edge (ties to §03)

The JD's "model optimization." Turn the trained model into something that hits the
FPS budget on a Jetson:

- **Precision reduction** — **FP16** (≈2× speed, usually negligible accuracy loss),
  **INT8** (bigger speedup, needs calibration and can cost mAP — *measure it*).
  - **PTQ** (post-training quantization) — calibrate on a representative set; fast,
    no retraining, small accuracy hit.
  - **QAT** (quantization-aware training) — simulate INT8 during training; recovers
    most of the accuracy when PTQ drops too much.
- **Pruning** — remove low-importance weights/channels → smaller/faster; fine-tune
  to recover accuracy.
- **Knowledge distillation** — train a small "student" to mimic a big "teacher";
  keep much of the accuracy at edge cost. Strong answer for edge deployment.
- **TensorRT** — layer/tensor fusion, kernel autotuning, precision calibration into
  a hardware-specific engine (§03). **Always re-measure mAP after** — optimization
  that quietly tanks accuracy is a failure, which is why §13 monitoring watches it.

```
train (transfer + augment) ─► validate on held-out SCENE
   ─► optimize (FP16/INT8 PTQ→QAT, prune, distill) ─► TensorRT engine
   ─► RE-MEASURE mAP + latency ─► deploy (§13 canary) ─► monitor drift (§13)
```

## Active learning — improve inside a closed loop

On-prem you can't crowdsource labels, but the system generates its own hard cases:

1. Mine **low-confidence** detections and **operator-flagged false alarms** (§12).
2. Label just those (high value per label).
3. Retrain / fine-tune, validate, canary (§13).

This is how accuracy climbs over time in a locked-down deployment without endless
labeling — a mature, senior thing to volunteer.

## Quick self-check

- Biggest lever on CCTV accuracy — architecture or data? *(domain-matched data +
  augmentation from the real cameras)*
- PTQ vs QAT — when each? *(PTQ first — fast, no retrain; QAT when INT8 drops mAP
  too much)*
- Why validate on a held-out *scene/camera*, not random frames? *(same-clip frames
  leak → inflated metrics; you must test generalization to new views)*
- How does a model improve on a closed on-prem site? *(active learning — mine
  low-confidence + flagged false positives, label those, retrain, canary)*
