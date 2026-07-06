# 14 — Deep Learning for Video

**TL;DR:** The title is "AI **Data Scientist**," not "systems engineer," and that word
matters — you're expected to reason about the *models*, not just the pipeline that runs
them. The job names the three you need cold: CNNs, object detection, and tracking. This
section rebuilds that modelling story, because if your recent years read as "systems,"
this is the half of your narrative that has to read as "modelling" too. And it's not four
disconnected topics — it's one chain, each link feeding the next.

Here's the chain, and it's worth holding in your head as you read: a frame goes into a
**CNN backbone** that turns pixels into features; a **detection head** turns those
features into boxes and classes; a **tracker** turns per-frame boxes into identities that
persist over time; and those identities are exactly what sections 11 and 12 consume to
produce analytics and events. Read in that order and each page answers a question the last
one raised.

Files, in reading order:
1. [cnns-and-backbones.md](cnns-and-backbones.md) — how convolutions build features, and why scale is the CCTV headache
2. [object-detection.md](object-detection.md) — turning features into boxes: YOLO, NMS, and what mAP actually means
3. [tracking.md](tracking.md) — giving boxes lasting identities: SORT to ByteTrack, and when you need ReID
4. [training-and-optimization.md](training-and-optimization.md) — how you'd actually train these and shrink them for the edge

## The pipeline this whole section is about

```
frame → [backbone CNN] → features → [detection head] → boxes + classes
                                              │
                                              ▼
                                  [tracker] → stable track IDs → (§11 analytics, §12 events)
```

**The framing line to memorize:** *"For live CCTV I run a single-stage detector — a
YOLO-family model on a CNN backbone — because on the edge I need one forward pass per
frame at real-time speed. Those detections feed a tracking-by-detection tracker like
ByteTrack for stable IDs, with ReID added when I need identity to survive occlusion or
cross cameras. I train with heavy augmentation matched to the deployment scene, then
quantize to INT8 with TensorRT while watching that mAP survives."*

→ Start: **[cnns-and-backbones.md](cnns-and-backbones.md)**
