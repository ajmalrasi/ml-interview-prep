# 09 — Computer Vision Fundamentals (Refresher)

**TL;DR:** The systems sections (01–08) are the *job*. This section is the
*foundation* the JD assumes you already have: *"extensive experience with OpenCV
and image-processing fundamentals — geometry, color spaces, pixel-level
manipulation"* and *"command over geometry and statistics for designing complex
logic layers on top of model detections."* You've shipped all of this (surround-
view, calibration, RANSAC, SIFT/ORB, fisheye). This is the fast refresh.

## What the interview actually expects on CV

This is **not** a research/ML-theory grilling (the role is systems-first). Expect:

- **Rapid-fire fundamentals:** "what's a homography?", "BGR vs RGB?", "how does NMS
  work?", "what does Canny do?" — quick, confident answers.
- **The logic layer:** the JD's standout phrase is *"complex logic layers on top of
  model detections."* This is geometry + statistics over bounding boxes: zones,
  counting, line-crossing, mapping image points to the ground plane. **This is the
  CV topic most likely to go deep** because it's systems-adjacent.
- **OpenCV practical fluency:** you reach for the right function and know its cost
  (CPU vs GPU, per-pixel vs vectorized).

## Files (in order)

1. [image-basics-color-spaces.md](image-basics-color-spaces.md) — pixels, channels, BGR/RGB/YUV/NV12/HSV/gray
2. [filtering-morphology-edges.md](filtering-morphology-edges.md) — convolution, blur, threshold, morphology, Sobel/Canny
3. [geometry-and-transforms.md](geometry-and-transforms.md) — translation/rotation/scale, affine, perspective, homography
4. [camera-calibration.md](camera-calibration.md) — intrinsics/extrinsics, distortion, undistort, fisheye
5. [features-and-matching.md](features-and-matching.md) — SIFT/SURF/ORB, matching, RANSAC, epipolar geometry
6. [detection-tracking-math.md](detection-tracking-math.md) — IoU, NMS, anchors, mAP, Kalman, SORT/DeepSORT, Hungarian
7. [logic-on-detections.md](logic-on-detections.md) — the JD's logic layer: zones, counting, homography to ground

→ Quick refresh: **[cv-cheat-sheet.md](cv-cheat-sheet.md)** · Start:
**[image-basics-color-spaces.md](image-basics-color-spaces.md)**
