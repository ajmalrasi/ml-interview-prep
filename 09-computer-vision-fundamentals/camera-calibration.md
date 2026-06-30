# Camera Calibration & Distortion

**TL;DR:** A real camera bends straight lines (lens distortion) and has its own
geometry (focal length, optical center). **Calibration** recovers those numbers so
you can *undistort* images and connect pixels to real-world geometry. **Intrinsics**
= the camera's internal parameters; **extrinsics** = where the camera sits in the
world. You did exactly this in surround-view (fisheye correction + calibration).

## Intrinsics vs extrinsics

- **Intrinsics (K, 3×3):** focal lengths `(fx, fy)`, principal point `(cx, cy)`,
  skew. Fixed per camera+lens. Maps 3D camera-space rays to image pixels.
- **Distortion coefficients:** radial (`k1, k2, k3`) — barrel/pincushion bending —
  and tangential (`p1, p2`) — lens not perfectly parallel to sensor.
- **Extrinsics (R, t):** rotation + translation — the camera's pose in world
  coordinates. Changes if you move the camera.

The full pinhole model: `pixel = K · [R | t] · world_point` (in homogeneous coords).

## Distortion (why straight lines curve)

- **Radial:** straight lines bow outward (**barrel**, common on wide/fisheye) or
  inward (**pincushion**). Worse toward image edges.
- **Tangential:** from lens/sensor misalignment; mild skew.
- **Undistortion** (`cv2.undistort` / `initUndistortRectifyMap` + `remap`): uses K +
  distortion coeffs to straighten the image. Do geometry-dependent logic *after*
  undistorting. For per-frame video, precompute the remap once and reuse — don't
  recompute the maps every frame.

## How calibration works (the procedure)

Show a known pattern (chessboard / ChArUco) at many angles, detect its corners,
and solve for K + distortion that best explain where those known 3D points land in
2D. `cv2.calibrateCamera` returns K, distortion, and per-view R,t. **Reprojection
error** (in pixels) tells you how good the calibration is — under ~0.5px is good.

## Fisheye (your surround-view domain)

Fisheye lenses have extreme radial distortion — the standard pinhole model breaks,
so OpenCV has a dedicated **`cv2.fisheye`** model. Pipeline for surround-view:
fisheye undistort → perspective project each camera to the ground plane (homography)
→ stitch into a bird's-eye view → blend seams (photometric alignment so brightness
matches across cameras — literally on your resume). Great concrete story to tell.

## Why it matters for KoiReader

Warehouse/supply-chain cameras are often wide-angle and mounted at awkward angles.
To turn a detection into *real-world meaning* (which loading bay? how far apart? did
it cross this line on the floor?), you need calibration + a ground-plane homography.
That's the bridge from "the model found a box" to "the box is in zone 3" — the logic
layer the JD prizes.

## Why X over Y

**Pinhole vs fisheye model?**
Pinhole handles normal/mild lenses with radial+tangential coeffs. Fisheye lenses
distort too severely for that model, so use OpenCV's dedicated fisheye model — using
pinhole on a fisheye leaves big residual distortion at the edges.

**Undistort every frame vs precompute maps?**
`cv2.undistort` recomputes the mapping each call (wasteful per-frame). For video,
build the remap once with `initUndistortRectifyMap` and apply `cv2.remap` each frame
— same result, far cheaper, ideally on GPU.

**Why undistort before measuring geometry?**
Distortion bends straight lines, so any distance/angle/zone math on a distorted
image is wrong, worst at the edges. Undistort first, then the homography-to-ground
math is valid.

→ Next: **[features-and-matching.md](features-and-matching.md)**
