# CV Fundamentals — Quick Refresh

One page for the classical-CV questions. Depth in the section files.

---

## Images & color
- Image = numpy array `(H, W, C)`, usually `uint8` 0–255. Pixel ops = array slicing.
- **OpenCV is BGR**, most models want **RGB** → `cv2.cvtColor(..., COLOR_BGR2RGB)`.
  Swapped channels = silent accuracy loss.
- Decoders output **YUV/NV12** → convert to BGR, ideally on GPU (`nvvidconv`).
- **HSV** for color-based segmentation (hue is lighting-robust; RGB isn't).

## Filtering & morphology
- Everything classical = **convolution** (slide a kernel, weighted sum). CNN conv =
  learned kernels.
- Blur: **Gaussian** (general), **median** (salt-and-pepper), **bilateral** (smooth
  but keep edges).
- Threshold: **adaptive** beats global under uneven lighting; **Otsu** for bimodal.
- Morphology: **erode** shrinks, **dilate** grows; **opening** removes specks,
  **closing** fills holes.
- Edges: **Canny** = blur → Sobel gradient → non-max suppression → hysteresis
  threshold (clean thin edges).

## Geometry & transforms
- Homogeneous coords `(x,y,1)` make translation + projection a matrix multiply.
- **Affine** (2×3, 3 pts) keeps parallel lines: rotate/scale/shear/translate.
- **Homography** (3×3, 4 pts) models **perspective** (parallel lines converge) — the
  transform for surround-view and **mapping detections to the floor plane**.
- Interpolation: **nearest** for label/mask maps, **bilinear** for images.

## Calibration
- **Intrinsics** (K: fx,fy,cx,cy) + **distortion** (radial k1,k2,k3 / tangential
  p1,p2); **extrinsics** (R,t) = pose in world.
- Calibrate with a chessboard at many angles; judge by **reprojection error**
  (<0.5px good).
- **Fisheye** needs OpenCV's dedicated model (pinhole leaves edge distortion).
- Undistort once via precomputed remap (not `undistort` per frame).

## Features & multi-view
- Detect **corners** (unique in all directions), describe, match.
- **SIFT** (float, L2, accurate) vs **ORB** (binary, Hamming, free, real-time/edge).
- **RANSAC** fits transforms robustly by ignoring outlier matches (4 pts for H).
- **Fundamental matrix** (uncalibrated) / **Essential matrix** (calibrated → gives
  R,t). Epipolar line turns 2D match search into 1D. Triangulate → 3D.

## Detection & tracking math
- **IoU** = overlap / union. **NMS** = sort by confidence, drop high-IoU duplicates.
- **mAP** = mean Average Precision; TP if IoU≥thresh. `mAP@0.5` vs COCO `@[.5:.95]`.
- **YOLO** = single forward pass → real-time (default for live video).
- **Kalman** predicts motion; **Hungarian** optimally assigns detections↔tracks.
- **SORT** = Kalman+IoU (fast, ID switches); **DeepSORT** adds appearance re-ID
  (survives occlusion); **ByteTrack** uses low-conf boxes too.

## Logic on detections (the JD's standout — be ready to whiteboard)
- Model gives boxes; **you** add geometry+stats: zones, counting, dwell, line-cross.
- **Point-in-polygon** with the box's **bottom-center** (where it meets the floor).
- **Line-crossing** via sign flip of cross product between frames → direction.
- Real distance = map foot point to **ground plane via homography**, measure in
  meters (pixels lie under perspective).
- **Count unique track IDs**, not detections. **Debounce** (K-of-N frames) +
  hysteresis to kill flicker → trustworthy events.

## Your CV credibility lines
- Surround-view: fisheye undistort → perspective project to bird's-eye → stitch →
  photometric blend.
- Custom pedestrian tracker beating SORT on ARM. INT8/FP16 on Jetson. RANSAC,
  SIFT/ORB, essential/fundamental matrix — all hands-on.

→ Full detail: **[README.md](README.md)**
