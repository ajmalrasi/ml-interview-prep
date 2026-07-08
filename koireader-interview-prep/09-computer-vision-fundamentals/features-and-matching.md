# Features, Matching & Epipolar Geometry

**TL;DR:** A **feature** is a distinctive, repeatable point (a corner, not a flat
wall). You **detect** keypoints, **describe** them as vectors, then **match**
descriptors across images to find correspondences. Because matches are noisy,
**RANSAC** robustly fits the transform (homography / fundamental matrix) while
ignoring outliers. This underpins stitching, tracking init, and multi-view geometry
— all on your resume (SIFT/SURF/ORB, RANSAC, fundamental/essential matrix).

## Why corners, not edges or flat areas

A flat patch looks like every other flat patch — you can't localize it. An edge is
ambiguous *along* the edge. A **corner** is unique in both directions → repeatable
and matchable. That's the Harris corner intuition: large intensity change in *all*
directions.

## Detect → Describe → Match

1. **Detect keypoints** — find corners/blobs (Harris, FAST, DoG).
2. **Describe** — encode each keypoint's neighborhood as a vector invariant to
   scale/rotation/lighting.
3. **Match** — compare descriptors across images (nearest neighbor + Lowe's ratio
   test to drop ambiguous matches).

| Detector/Descriptor | Type | Notes |
|---|---|---|
| **SIFT** | float (128-d) | scale+rotation invariant, accurate, slower; now patent-free |
| **SURF** | float | faster SIFT approximation; was patented |
| **ORB** | binary (256-bit) | FAST + BRIEF, **free, real-time**, great on edge/ARM |

- **Float descriptors (SIFT)** → match with L2 distance.
- **Binary descriptors (ORB)** → match with **Hamming distance** (super fast). ORB
  is the go-to when you need real-time on constrained hardware (your ARM/Jetson
  world).

## RANSAC (the robust-fitting workhorse)

Matches contain wrong pairs (outliers). RANSAC: randomly pick the minimal sample
(4 points for a homography), fit the model, count inliers (matches that agree),
repeat, keep the best. Result: a transform fit on the *good* matches, ignoring
outliers. You cite this for homography/fundamental-matrix estimation.

## Epipolar geometry (two views)

When two cameras see the same scene:
- **Fundamental matrix (F):** relates corresponding points across two **uncalibrated**
  views: `x'ᵀ F x = 0`. A point in one image constrains its match to a **line**
  (the epipolar line) in the other — turns 2D search into 1D.
- **Essential matrix (E):** same idea for **calibrated** cameras (`E = Kᵀ F K`); you
  can decompose E into relative **R, t** between cameras → recover camera motion.
- **Triangulation:** with two known camera poses + a matched point, intersect the
  rays to get the **3D** position. Basis of stereo depth / structure-from-motion.

## Where this shows up in the role

Less day-to-day than tracking math, but it's the classical foundation interviewers
test for "do they really know CV." Realistic uses: registering/stitching camera
views, initializing or validating tracks, stereo/depth, and the geometric reasoning
behind multi-camera setups.

## Why X over Y

**SIFT vs ORB?**
SIFT = more accurate, scale/rotation invariant, float descriptor, heavier. ORB =
binary, free, real-time, Hamming-matchable — the practical choice on edge/ARM (your
hardware). Use SIFT when accuracy dominates and compute is available; ORB for
real-time/embedded.

**L2 vs Hamming distance for matching?**
Float descriptors (SIFT/SURF) compare with L2 (Euclidean). Binary descriptors (ORB/
BRIEF) compare with Hamming (count differing bits) — a couple of XOR+popcount ops,
extremely fast. Match the metric to the descriptor type.

**Fundamental vs essential matrix?**
Fundamental works with *uncalibrated* cameras (pixels). Essential needs *calibrated*
cameras (it folds in K) and, unlike F, can be decomposed into relative rotation +
translation. Calibrated → essential (you get motion); uncalibrated → fundamental.

**Why RANSAC instead of least-squares on all matches?**
Least squares is wrecked by outliers (one bad match skews the whole fit). RANSAC
fits on random minimal samples and keeps the model with the most inliers, so it's
robust to the wrong matches that always exist. Essential whenever data has outliers.

→ Next: **[detection-tracking-math.md](detection-tracking-math.md)**
