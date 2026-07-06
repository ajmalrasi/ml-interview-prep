# Calibration & Metrics — Making the Numbers Real

**TL;DR:** Every crowd/queue metric is only as trustworthy as the mapping from
pixels to the real world, and the ground truth you validate against. This page is
the **homography** (image → floor plan) and the **accuracy story** you must be able
to tell: how you'd prove a queue-time or count number is right.

## The homography (image → ground plane)

A planar homography `H` (3×3) maps image pixels to floor-plan coordinates *when the
scene is a plane* — which the floor is. Pick ≥4 known point correspondences (tile
corners, floor markings, a measured rectangle) and solve:

```
[x']       [x]
[y'] = H · [y]      then divide by the 3rd component (homogeneous → 2D)
[w']       [1]

# OpenCV
H, _ = cv2.findHomography(image_pts, floor_pts)      # floor_pts in meters/cm
foot_world = cv2.perspectiveTransform(foot_image, H) # project a foot point
```

- Project the **foot point** (feet touch the plane) — a head point is *above* the
  plane, so its projection is wrong. This is the single most common calibration bug.
- Now distances are in **meters**, areas in **m²**, speeds in **m/s** — enabling
  density (ppl/m²), real dwell distance, and calibrated speed.
- **Lens distortion** first: undistort with intrinsics (section 09 camera
  calibration) before the homography, or a wide CCTV lens curves your straight lines.

## Multi-camera & overlap

- **Common ground plane:** calibrate every camera to the *same* floor coordinate
  system → a person at (x,y) is the same point across cameras. This is how you
  de-duplicate counts across overlapping views and hand off tracks (see section 14
  ReID / section 06 multi-cam design).
- Without a shared plane, two cameras seeing the same crowd double-count it.

## Accuracy & validation (the part candidates skip — don't)

You will be asked *"how do you know your queue time / count is correct?"* Have a
concrete answer:

| Metric | What it measures | Target framing |
|---|---|---|
| **Count MAE / MAPE** | avg abs error in people counted | "±N people or ±X% vs manual count" |
| **Queue-time MAE** | avg abs error in seconds vs stopwatch | "within ±T seconds of a hand-timed sample" |
| **Precision/Recall of events** | zone entries/exits vs ground truth | for line-crossing correctness |
| **ID-switch rate / MOTA** | tracker stability (drives dwell error) | see section 14 |

**How to ground-truth:**
- **Manual count** a set of frames / a time window and compare totals.
- **Stopwatch a sample** of individuals through the queue for wait time.
- **Second synced camera** or staff logs as an independent reference.
- Report error **by regime** (sparse vs dense) — models fail differently, and a
  single average hides the dense-crowd collapse.

## Drift over time (leads into section 13)

Calibration and accuracy aren't one-and-done: a **bumped camera**, new lighting, a
seasonal crowd change, or a re-mounted lens silently breaks the homography and the
model. That's why **performance monitoring** (section 13) tracks per-camera metrics
continuously — a count that slowly diverges from a periodic manual audit is your
drift alarm.

## Quick self-check

- Why project the foot point, not the head, through the homography? *(feet lie on
  the plane the homography models; the head is above it)*
- How do you stop two overlapping cameras double-counting one crowd? *(shared
  ground-plane coordinates; de-dup by world position)*
- An interviewer asks "prove your queue time is accurate." Your answer? *(stopwatch
  a sample, report MAE in seconds, break down by crowd regime)*
