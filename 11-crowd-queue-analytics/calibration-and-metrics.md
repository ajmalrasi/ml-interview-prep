# Calibration & Metrics

**TL;DR:** Numbers are only as good as (1) pixel→world mapping (**homography**) and (2) the **ground truth** you validate against. Be ready for "how do you *know* it's right?"

## Homography (image → floor plane)
- 3×3 `H` maps image→floor because the **floor is a plane**.
- ≥4 known point pairs (tile corners, markings, measured rectangle).
```
H,_ = cv2.findHomography(image_pts, floor_pts)      # floor_pts in m/cm
foot_world = cv2.perspectiveTransform(foot_image, H)
```
- **Project the FOOT point** (feet on plane). Head is above plane → wrong. #1 bug.
- Gives metres / m² / m/s → density, real dwell, real speed.
- **Undistort first** (lens intrinsics, §09) or wide CCTV lens warps it.

## Multi-camera
- Calibrate all cameras to **one shared floor frame** → same (x,y) across cameras.
- Enables de-dup of overlapping counts + cross-camera track handoff (§14 ReID).
- No shared plane → two cameras double-count one crowd.

## Validation (don't skip — you WILL be asked)
| Metric | Measures |
|---|---|
| Count **MAE/MAPE** | ±N people vs manual count |
| Queue-time **MAE** | ±T seconds vs stopwatch |
| Event **precision/recall** | line-crossing correctness |
| **ID-switch / MOTA** (§14) | tracker stability → dwell error |

Ground-truth by: **manual count**, **stopwatch sample**, **2nd synced camera**. Report error **by regime** (sparse vs dense), not one blended average.

## Drift (→ §13)
Bumped camera, new lighting, re-mounted lens → homography+model silently wrong. No error thrown. Monitoring catches divergence from periodic audits.

## Q&A
- Foot not head through H? → feet lie on the plane H models.
- Stop 2 cameras double-counting? → shared floor coords, de-dup by world position.
- "Prove queue time is accurate"? → stopwatch sample, MAE in seconds, split by regime.
