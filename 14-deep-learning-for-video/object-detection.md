# Object Detection

**TL;DR:** Detection = localize (boxes) + classify, for every object. For live
CCTV you want a **single-stage** detector (YOLO family) — one forward pass, real-time
FPS — over a two-stage detector (Faster R-CNN) that's more accurate but too slow per
frame. Know anchor vs anchor-free, NMS, the loss pieces, and **mAP** (you *will* be
asked what it means).

## One-stage vs two-stage

| | Two-stage (Faster R-CNN) | One-stage (YOLO, SSD, RetinaNet) |
|---|---|---|
| How | propose regions → classify each | predict boxes + classes in one pass over a grid |
| Speed | slower | **fast — real-time**, edge-friendly |
| Accuracy | historically higher, esp. small objects | closed the gap; now competitive |
| CCTV pick | rarely | **default** — you need FPS per camera |

Say it plainly: *"On the edge with N cameras I need one forward pass at real-time
FPS, so I use a YOLO-family single-stage detector."*

## Anchors vs anchor-free

- **Anchor-based** (YOLOv3–v5, SSD, RetinaNet) — predefined box priors of set
  scales/ratios at each grid location; the net predicts offsets + objectness.
  Requires tuning anchor sizes to your object distribution.
- **Anchor-free** (YOLOX, FCOS, CenterNet, YOLOv8) — predict object centers/points
  and sizes directly; no anchor hyperparameters. Simpler, increasingly standard.

## The YOLO idea (be able to sketch it)

Divide the image into a grid; each cell predicts boxes (x, y, w, h), an
**objectness** score, and class probabilities — in **one pass**. Modern YOLOs add a
CSPDarknet backbone, an FPN/PAN neck for multi-scale, and mosaic augmentation. The
"one pass over a grid" mental model is what interviewers want, not a version-number
recital.

## NMS — Non-Max Suppression (guaranteed question)

Detectors emit many overlapping boxes for one object. NMS keeps the best:

```
1. sort boxes by score
2. take the top box, keep it
3. remove any remaining box with IoU > threshold vs it   (same object)
4. repeat with the next-highest surviving box
```

- **IoU** = intersection area / union area of two boxes (0..1).
- **Trap in crowds:** a low IoU threshold suppresses *real* nearby people
  (two heads → one survives → under-count). **Soft-NMS** (decay scores instead of
  hard-removing) helps in dense scenes — a great crowd-specific answer.
- NMS is per-class (usually) and runs post-inference on CPU/GPU.

## Loss (the three pieces)

- **Localization** — box regression (IoU/GIoU/CIoU or smooth-L1).
- **Objectness/confidence** — is there an object here.
- **Classification** — which class (focal loss in RetinaNet to fight the huge
  background/foreground imbalance — worth naming).

## mAP — the metric you must explain

```
IoU decides if a prediction is a True Positive (IoU ≥ threshold, e.g. 0.5)
Precision = TP / (TP+FP)   Recall = TP / (TP+FN)
AP  = area under the precision–recall curve, per class
mAP = mean of AP over all classes
mAP@0.5      → COCO "loose"      mAP@[0.5:0.95] → COCO strict (avg over IoU thresholds)
```

- **Precision–recall trade-off = the confidence threshold**; the PR curve sweeps it.
- Report the IoU threshold — "mAP" alone is ambiguous (0.5 vs 0.5:0.95).
- For **counting**, high **recall** matters most (missed people = under-count); for
  a **security alert**, precision may matter more. Tie the metric to the use-case.

## CCTV-specific detection challenges

- **Small/far objects** — FPN + higher input resolution; tile the frame if needed.
- **Occlusion in crowds** — detect **heads** not full bodies; Soft-NMS; density
  estimation when it's hopeless (§11).
- **Class imbalance** — mostly "person"; focal loss / balanced sampling.
- **Domain shift** — train scene ≠ deploy scene (angle, lighting, weather) → §14
  training page + §13 drift monitoring.

## Quick self-check

- Why single-stage for live CCTV? *(one forward pass, real-time FPS per camera)*
- Walk through NMS; why does a low IoU threshold hurt crowd counting? *(suppresses
  true nearby detections → under-count; use Soft-NMS)*
- What is mAP@[0.5:0.95]? *(AP averaged over IoU thresholds 0.5→0.95, mean over
  classes — COCO's strict metric)*
- For people-counting, precision or recall? *(recall — a miss is an under-count)*
