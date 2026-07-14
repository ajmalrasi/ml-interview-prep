# 4 · BEV & Perception Models

**TL;DR:** These are the **models** the JD names — object detection, segmentation,
classification, and **BEV** (bird's-eye-view) perception. You need enough to (a) talk about
their architecture and metrics, and (b) reason about *why they're hard to deploy* on an NPU
(view transforms, dynamic shapes, transformer heads). You don't need to be a research
scientist — you need the deployment engineer's view of them.

## Why this matters for the role

You're "enabling" these models on the SoC. When BEVFormer won't map cleanly to the NPU, you
must know *which part* is the problem (the spatial cross-attention, the grid-sample view
transform) and how to handle it — which requires knowing what these models actually do.

## Pages

- **[Detection & Segmentation for AD](detection-segmentation.md)** — the CV backbone-neck-head
  pattern, one-stage detectors, semantic/instance/panoptic segmentation, and the metrics
  (mAP, IoU) — with the deployment angle on each.
- **[BEV: LSS, BEVFormer, BEVFusion, Occupancy](bev-models.md)** — how multi-camera images
  become a top-down BEV grid, the three canonical approaches, and what makes each
  NPU-friendly or not.

## What overlaps with your other prep

Classical detection/tracking and CNN backbones are covered in **computer-vision-prep §14**
([object-detection](../../computer-vision-prep/14-deep-learning-for-video/object-detection.md),
[cnns-and-backbones](../../computer-vision-prep/14-deep-learning-for-video/cnns-and-backbones.md))
and the camera-geometry that BEV rests on is in **§09**
([camera-calibration](../../computer-vision-prep/09-computer-vision-fundamentals/camera-calibration.md),
[geometry-and-transforms](../../computer-vision-prep/09-computer-vision-fundamentals/geometry-and-transforms.md)).
This section adds the **BEV** models and the **deployment** lens those pages don't cover.

## The one-liner to have ready

> "Automotive perception is moving from per-camera 2D detection to a shared **BEV
> representation** where all sensors are fused into one top-down grid that planning consumes.
> The deployment challenge is the **view transform** — lifting image features into BEV — and
> the transformer heads, which use ops (grid-sample, attention, dynamic shapes) that don't
> map cleanly to a fixed NPU, so they're where the partitioning and accuracy work goes."
