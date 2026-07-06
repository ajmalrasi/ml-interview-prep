# Multi-Object Tracking

**TL;DR:** Detection = this frame; **tracking = stable IDs over time**. IDs make count/dwell/flow/events possible. Tracking quality **bounds** all §11/§12 numbers (noisy queue time = usually ID switches).

## Why
- Count → needs IDs (else recount every frame).
- Dwell/queue = last_seen − first_seen for one ID.
- Direction/flow → needs trajectory.
- Loitering → "same person > T sec".

## Core = tracking-by-detection
```
predict track's next pos (motion model)
→ match detections↔tracks (cost = IoU and/or appearance)
   solved by HUNGARIAN (optimal assignment)
→ update matched, birth new, kill stale
```
- **Kalman** = motion model (constant-velocity predict + smooth + bridge short gaps).
- **Hungarian** = optimal one-to-one detection↔track assignment.
- Kalman + Hungarian = **SORT**.

## Family tree (each fixes the last)
| Tracker | Adds | Use |
|---|---|---|
| **SORT** | Kalman+Hungarian, IoU only | sparse, few crossings |
| **DeepSORT** | + appearance **ReID** in cost | occlusion/crossings |
| **ByteTrack** | also match **low-score** detections (2nd pass) | crowded — recovers IDs thru occlusion, cheap, no heavy ReID |
| OC-SORT/BoT-SORT | better motion / camera-motion comp | moving camera |

**ByteTrack trick:** occluded person's box = low score; matching those recovers IDs through occlusion. Great edge answer.

## ReID
- Appearance embedding → same person across gap/camera (+ foot point = cross-camera handoff, §11).
- **Need:** long occlusion, crossing paths, multi-camera, re-entry.
- **Skip:** sparse + short gaps (SORT/ByteTrack cheaper on edge).
- **Privacy (§13):** derived from a person → sensitive; but re-associates an **unnamed** track, not a name.

## Metrics
- **MOTA** — FP+miss+ID-switch in one (headline).
- **IDF1** — identity consistency (often more telling for analytics).
- **ID switches** — direct driver of count/dwell error.
- **HOTA** — modern detect vs association balance.

## CCTV gotchas
- Occlusion → ID switch → wrong count/dwell → ByteTrack/ReID/Kalman + K-of-N (§12).
- Too dense → tracking hopeless → density + Little's Law (§11).
- Low FPS breaks constant-velocity → association fails → budget FPS for tracker (§03).

## Q&A
- SORT's two algos? → Kalman (motion), Hungarian (assignment).
- ByteTrack trick? → match low-conf detections → recover IDs thru occlusion, cheap.
- ReID when/skip? → occlusion/cross-camera; skip sparse to save edge.
- Identity-consistency metric? → IDF1 (watch ID switches).
