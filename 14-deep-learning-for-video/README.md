# 14 — Deep Learning for Video

**TL;DR:** "AI **Data Scientist**" (not just systems engineer) means you must
reason about the *models*, not only the pipeline. The JD names them directly:
**CNNs, object detection, tracking.** This section rebuilds that modeling narrative
— backbones, the detection stack (YOLO family, mAP, NMS), the tracking stack
(SORT→ByteTrack, ReID), and how you'd actually train and optimize these for the
edge. This is the half of your story that reads "systems" and needs to read
"modeling" too.

Files:
1. [cnns-and-backbones.md](cnns-and-backbones.md) — convolutions, receptive field, backbones, FPN
2. [object-detection.md](object-detection.md) — anchor vs anchor-free, YOLO, NMS, mAP
3. [tracking.md](tracking.md) — SORT, DeepSORT, ByteTrack, Kalman, Hungarian, ReID, MOT metrics
4. [training-and-optimization.md](training-and-optimization.md) — data, augmentation, transfer learning, QAT/PTQ, distillation, active learning

## The pipeline this section is about

```
frame ─► [backbone CNN] ─► features ─► [detection head] ─► boxes+classes
                                                  │
                                                  ▼
                                      [tracker] ─► stable track IDs ─► (§11/§12 analytics)
```

## The framing line (memorize)

*"For live CCTV I run a single-stage detector — a YOLO-family model — on a CNN
backbone, because on the edge I need one forward pass per frame at real-time FPS.
Detections feed a tracking-by-detection tracker like ByteTrack for stable IDs, with
ReID when I need identity across occlusion or cameras. I train with heavy
augmentation for the deployment domain and quantize to INT8 with TensorRT, watching
that mAP survives."*

Everything here connects forward: detections + IDs are exactly the inputs §11
(analytics) and §12 (events) consume, and §03 is how you make it run fast.

→ Start: **[cnns-and-backbones.md](cnns-and-backbones.md)**
