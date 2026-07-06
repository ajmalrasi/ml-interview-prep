# Multi-Object Tracking

**TL;DR:** Detection tells you *what's in this frame*; tracking gives objects
**stable IDs across frames** — which is what makes counting, dwell, flow, and
loitering possible. The dominant paradigm is **tracking-by-detection**: detect each
frame, then associate detections to existing tracks. Know the SORT→DeepSORT→ByteTrack
lineage, the Kalman+Hungarian core, when you need ReID, and the MOT metrics.

## Why tracking at all

- **Counting** needs IDs or you recount the same person every frame.
- **Dwell / queue time** = last_seen − first_seen for a track (§11).
- **Direction / flow / wrong-way** need a trajectory, not a point.
- **Loitering / events** need "the *same* person for > T seconds" (§12).

So tracking quality (ID stability) directly bounds the accuracy of every §11/§12
number. Interviewers link them: *"your queue times are noisy — why?"* → often
**ID switches**.

## The tracking-by-detection core

```
predict each track's next position (motion model)
        │
        ▼
match detections ↔ tracks   (cost = IoU and/or appearance distance)
        │                    solved by the HUNGARIAN algorithm (optimal assignment)
        ▼
update matched tracks; birth unmatched detections; kill stale tracks
```

- **Kalman filter** — the motion model; predicts where a track goes next
  (constant-velocity) and smooths noisy boxes. Bridges short detection gaps.
- **Hungarian algorithm** — optimal one-to-one assignment of detections to tracks
  given a cost matrix. (These two are the SORT recipe.)
- **Cost** — IoU (position/overlap) and/or appearance embedding distance.

## The lineage (name these, know the diff)

| Tracker | Adds | Use when |
|---|---|---|
| **SORT** | Kalman + Hungarian on IoU only | fast, clean scenes, few crossings |
| **DeepSORT** | + appearance **ReID** embedding in the cost | occlusion / crossings — ID survives a gap |
| **ByteTrack** | associate **low-score** detections too, in a second stage | crowded/occluded — big MOTA gain, still fast |
| **OC-SORT / BoT-SORT** | better motion / camera-motion comp + ReID | moving-camera or heavy occlusion |

**ByteTrack's key insight** (worth stating): don't throw away low-confidence
detections — an occluded person's box gets a low score; matching those to existing
tracks in a second pass recovers IDs through occlusion without a heavy ReID model.
Great edge answer: strong tracking, cheap.

## ReID (re-identification)

An embedding of a person's appearance so the *same* person matches across a gap or
across cameras (foot point + ReID = cross-camera handoff, §11 calibration).

- **When you need it:** long occlusions, crossing paths, multi-camera identity,
  re-entry.
- **When you can skip it:** sparse scene, short gaps → motion/IoU (SORT/ByteTrack)
  is enough and far cheaper on the edge.
- **Privacy note (§13):** a ReID embedding is derived from a person — treat as
  sensitive, scope its retention. It re-associates an *unnamed* track; it is **not**
  a name/identity.

## MOT metrics (the tracking scorecard)

- **MOTA** — combines false positives, misses, and **ID switches** into one score
  (higher better). The headline.
- **IDF1** — identity-focused F1: how consistently the right ID stays on the right
  object. Often more telling than MOTA for analytics that depend on identity.
- **ID switches** — count of times a track's ID changes — the direct driver of
  count/dwell error.
- **HOTA** — modern balance of detection vs association accuracy.

## CCTV gotchas

- **Occlusion** → ID switches → wrong counts/dwell. Mitigate: ByteTrack, ReID,
  Kalman gap-bridging, K-of-N confirmation downstream (§12).
- **Crowd density** — past a point, tracking is hopeless → switch to density
  estimation + Little's Law (§11).
- **Frame rate** — too-low FPS breaks the constant-velocity assumption (objects jump
  too far between frames) → association fails. Budget FPS for tracking, not just
  detection (§03).

## Quick self-check

- What are SORT's two algorithms and what does each do? *(Kalman = motion predict/
  smooth; Hungarian = optimal detection↔track assignment)*
- ByteTrack's core trick? *(also associate low-confidence detections → recover IDs
  through occlusion, cheaply)*
- When do you add ReID, and when skip it? *(add for occlusion/crossing/multi-camera;
  skip in sparse scenes to save edge compute)*
- Which metric best reflects identity consistency for analytics? *(IDF1; watch ID
  switches)*
