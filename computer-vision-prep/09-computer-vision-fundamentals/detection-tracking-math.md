# Detection & Tracking Math

**TL;DR:** The role *integrates* models, so you must know the math *around* them:
**IoU** (box overlap), **NMS** (dedupe overlapping detections), **anchors** (how
detectors propose boxes), **mAP** (how accuracy is scored), and **trackers** (Kalman
for motion, IoU/Hungarian for association, DeepSORT for appearance). This is the
math you put *on top of* the ML team's models.

## IoU: Intersection over Union

The fundamental box-overlap metric:

```rawhtml
<div class="formula">
  <div class="frow"><span class="fexpr">IoU = area(<span class="fv">A ∩ B</span>) / area(<span class="fv">A ∪ B</span>)</span><span class="fnote">0 = no overlap, 1 = identical</span></div>
</div>
```

**Try it.** Drag the prediction box around the ground truth and watch IoU. Notice the
cliff around 0.5 — that single threshold decides whether a detection counts as a match
(TP) in mAP, and whether NMS suppresses it.

```rawhtml
<div id="iou-widget" class="widget-host"></div>
```

Used everywhere: NMS, matching detections to ground truth (mAP), and associating
detections to tracks frame-to-frame.

## NMS: Non-Maximum Suppression

Detectors output many overlapping boxes for one object. NMS keeps the best:
1. Sort boxes by confidence.
2. Take the highest; remove all others with IoU > threshold (e.g., 0.5) against it.
3. Repeat with the next remaining box.

Result: one box per object. **Soft-NMS** decays scores instead of hard-removing
(better for crowded scenes). NMS runs every frame — do it on GPU at scale (sec 03).

## Anchors & detection heads (quick model literacy)

- **Anchor boxes:** predefined box shapes/scales at each location; the model
  predicts offsets from anchors + class + objectness. (Faster R-CNN, SSD, older
  YOLO.)
- **Anchor-free:** predict box centers/extents directly (FCOS, newer YOLO/CenterNet)
  — fewer hyperparameters.
- **YOLO:** single-shot, grid-based, real-time — the standard for live video. Know
  it's one forward pass → fast, which is why it dominates streaming inference.

## mAP: mean Average Precision (how detection is scored)

- **Precision** = TP / (TP+FP) — of what I flagged, how much was right.
- **Recall** = TP / (TP+FN) — of what existed, how much I caught.
- A detection is a TP if IoU with ground truth ≥ threshold (e.g., 0.5).
- **AP** = area under the precision–recall curve for one class; **mAP** = mean over
  classes. `mAP@0.5` (one threshold) vs `mAP@[.5:.95]` (averaged over thresholds,
  the COCO metric). This is your model-eval vocabulary — own it.

## Tracking: detection → identity over time

Detection finds objects per frame; **tracking** keeps the *same ID* across frames
(needed for counting, dwell time, line-crossing). Tracking-by-detection loop:
1. **Predict** where each existing track will be (motion model).
2. **Associate** new detections to predicted tracks (similarity → assignment).
3. **Update** matched tracks; spawn new ones; kill stale ones.

### The building blocks

- **Kalman filter** — predicts an object's next position/velocity and smooths noisy
  detections. The motion model in SORT/DeepSORT. Intuition: "where will it be next
  frame, and how confident am I."
- **Hungarian algorithm** — optimal assignment of detections↔tracks given a cost
  matrix (e.g., 1−IoU, or appearance distance). Solves "which detection is which
  track" in one shot.
- **SORT** — Kalman + Hungarian on **IoU**. Fast, but loses IDs through occlusions
  (ID switches).
- **DeepSORT** — SORT + an **appearance embedding** (a re-ID feature per object), so
  it re-identifies objects after occlusion → far fewer ID switches. (You built a
  custom tracker beating SORT — strong story.)
- **ByteTrack** — also associates *low*-confidence detections, recovering occluded
  objects without a heavy appearance model; strong modern baseline.

## Why X over Y

**SORT vs DeepSORT?**
SORT = Kalman + IoU + Hungarian: fast, light, but drops IDs through occlusion.
DeepSORT adds an appearance embedding so it re-IDs after occlusion → fewer ID
switches at extra compute. Crowded/occluded scenes → DeepSORT (or ByteTrack); simple
fast scenes → SORT.

**IoU-based vs appearance-based association?**
IoU association is cheap and works when objects move little between frames. Appearance
(re-ID embeddings) survives occlusion and large motion but costs an extra model.
Combine them: IoU first, appearance to recover the hard cases.

**Hard-NMS vs Soft-NMS?**
Hard-NMS removes overlapping boxes outright — can delete a real object in a crowd.
Soft-NMS decays their scores instead, preserving nearby true objects → better in
dense scenes, slightly more tuning.

**Why is YOLO the default for live video?**
One forward pass per frame (single-shot) → real-time throughput, unlike two-stage
detectors (region proposal + classify) that are more accurate but slower. For
streaming, latency wins → YOLO-class models.

→ Next: **[logic-on-detections.md](logic-on-detections.md)**
