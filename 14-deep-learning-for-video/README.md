# 14 — Deep Learning for Video

**TL;DR:** "Data **Scientist**" = reason about **models**, not just pipeline. The chain: **backbone CNN** → features → **detection head** → boxes → **tracker** → IDs → (§11/§12).

```
frame → [backbone CNN] → features → [detector] → boxes+classes
                                          → [tracker] → IDs → §11 analytics, §12 events
```

**Say this:** *"For live CCTV: single-stage YOLO-family detector on a CNN backbone (one forward pass, real-time FPS on the edge). Detections feed a tracking-by-detection tracker (ByteTrack) for stable IDs, + ReID for occlusion/cross-camera. Train with heavy augmentation for the deploy scene, quantize INT8 with TensorRT while watching mAP."*

Pages: 1) CNNs/backbones · 2) detection · 3) tracking · 4) training & optimization.

→ Start: **[cnns-and-backbones.md](cnns-and-backbones.md)**
