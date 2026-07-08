# Geometry & Transforms

**TL;DR:** Moving/warping pixels is matrix multiplication on coordinates. Translate,
rotate, scale → **affine** (2×3, keeps parallel lines). Map a tilted plane to a flat
one (or one camera view to another) → **homography / perspective** (3×3, parallel
lines can converge). Homography is *the* transform behind your surround-view and
behind "map a detection to the floor plane."

## Coordinates and homogeneous form

A point is `(x, y)`. To express translation as a matrix multiply, we add a 1:
`(x, y, 1)` — **homogeneous coordinates**. Then every transform is "multiply the
point by a matrix." This is why transforms compose by multiplying matrices.

## The ladder of 2D transforms

| Transform | Matrix | Preserves | Degrees of freedom | Example |
|---|---|---|---|---|
| **Translation** | 2×3 | everything, just shifts | 2 | move ROI |
| **Euclidean (rigid)** | 2×3 | distances, angles | 3 | rotate + translate |
| **Similarity** | 2×3 | angles, ratios | 4 | rotate + uniform scale |
| **Affine** | 2×3 | parallel lines, ratios | 6 | shear, non-uniform scale |
| **Homography (projective)** | 3×3 | straight lines only | 8 | perspective / plane-to-plane |

## Affine vs perspective (the one they ask)

- **Affine (`warpAffine`, 2×3):** parallel lines stay parallel. Rotation, scaling,
  shear, translation. Defined by **3 point correspondences**.
- **Perspective / homography (`warpPerspective`, 3×3):** parallel lines can
  **converge** (like railroad tracks to a vanishing point). Maps any planar quad to
  any other quad. Defined by **4 point correspondences**. This is what models
  perspective/viewpoint change.

> Rule of thumb: if the camera viewpoint or a tilted plane is involved →
> **homography**. If it's just rotate/scale/shift in-plane → **affine**.

## Homography in practice (your bread and butter)

A homography H (3×3) maps points on one plane to another:
```
[x']     [x]
[y'] = H [y]      (then divide by the 3rd coord — the "perspective divide")
[w']     [1]
```
Uses you can cite:
- **Surround-view / bird's-eye:** warp ground-plane pixels from each fisheye camera
  into a top-down stitched view (perspective projection — literally your resume).
- **Map detections to the floor:** given a camera-to-ground homography, convert a
  person's foot pixel `(x, y)` to real-world floor coordinates → measure distance,
  zones, dwell. (This is the JD's "logic layers on top of detections" — see
  [logic-on-detections.md](logic-on-detections.md).)
- **Image stitching / registration:** align overlapping views.

You estimate H from ≥4 correspondences, usually with **RANSAC** to reject outliers
(next file).

## Interpolation (the "how" of warping)

When you warp, output pixels land between input pixels — you interpolate:
- **Nearest-neighbor** — fastest, blocky (use for label/mask maps so you don't
  invent classes).
- **Bilinear** — smooth, the default for images.
- **Bicubic / Lanczos** — sharper, slower (upscaling quality).

## Why X over Y

**Affine vs homography?**
Affine keeps parallel lines (rotate/scale/shear/translate), needs 3 points, 6 DOF.
Homography models perspective (parallel lines converge), needs 4 points, 8 DOF. Use
homography whenever viewpoint/plane perspective matters; affine for simpler in-plane
transforms (cheaper, more stable).

**Nearest vs bilinear interpolation?**
Nearest = fast, no new values invented (mandatory for segmentation masks/label
maps). Bilinear = smooth and the default for photographic images. Never bilinear-
interpolate a class-label map — it fabricates non-existent classes at boundaries.

**Why homogeneous coordinates at all?**
They let translation *and* projection be expressed as a single matrix multiply, so
transforms compose by multiplication and perspective (the divide by w) falls out
naturally. Without them, translation isn't linear.

→ Next: **[camera-calibration.md](camera-calibration.md)**
