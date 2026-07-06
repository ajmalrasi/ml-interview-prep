# Training & Optimization for the Edge

**TL;DR:** Two opposing halves + a loop. **Train** = accurate on YOUR scene (data ≫ architecture). **Optimize** = fast on Jetson without losing that accuracy. **Active learning** = improve from own mistakes.

## Data = biggest accuracy lever (not architecture)
- **Domain match is everything** — web images fail on CCTV (high angle, wide lens, IR, weather, blur). Collect/label from **actual cameras + conditions**.
- **Labelling consistency** (head vs body, occlusion policy) — noisy labels cap ceiling.
- **Cover hard cases** — night, crowds, occlusion, rare events.

## Augmentation (cheap generalization)
- **Geometric** — flip/scale/crop/rotate (scale invariance).
- **Photometric** — brightness/contrast/hue/noise/blur/JPEG (lighting/weather/IR).
- **Detection** — **mosaic** (4 tiled, small objects+context), mixup, copy-paste, random-erase (occlusion).
- Aim at your deploy conditions (simulate night/rain).

## Transfer learning (default start)
Start from ImageNet/COCO pretrained → **fine-tune** on your data. Less data/compute, better generalization. Freeze early layers (generic), adapt head. Scratch training on-site rarely justified.

## Usual problems
- Imbalance → focal loss / resample.
- Overfit → more aug, dropout, weight decay, early stop.
- Small objects → ↑res, FPN, tile.
- **Eval on held-out SCENE/camera**, not random frames (same-clip frames leak → inflated mAP).

## Optimization for edge (§03)
- **FP16** — ~2× speed, tiny accuracy loss.
- **INT8** — bigger speedup, needs calibration, **can drop mAP → measure**.
  - **PTQ** — calibrate after training; fast, no retrain, small hit.
  - **QAT** — simulate INT8 in training; recovers accuracy when PTQ too lossy.
- **Pruning** — drop low-importance weights/channels + fine-tune.
- **Distillation** — small student mimics big teacher; keep accuracy at edge cost.
- **TensorRT** — fuse layers, autotune, precision → hardware engine. **Re-measure mAP after** (optimization that tanks accuracy = fail → §13 watches).
```
train (transfer+aug) → validate on held-out SCENE
→ optimize (FP16/INT8 PTQ→QAT, prune, distill) → TensorRT engine
→ RE-MEASURE mAP+latency → deploy (§13 canary) → monitor drift (§13)
```

## Active learning (improve in closed site)
Mine **low-confidence** + **operator-flagged FPs** (§12) → label just those → retrain → canary. How accuracy climbs on a locked-down site without endless labelling.

## Q&A
- Biggest accuracy lever? → domain-matched data + augmentation.
- PTQ vs QAT? → PTQ first (fast, no retrain); QAT when INT8 drops mAP too far.
- Held-out scene why? → same-clip frames leak → inflated metrics.
- Improve on closed site? → active learning (low-conf + flagged FPs → label → retrain).
