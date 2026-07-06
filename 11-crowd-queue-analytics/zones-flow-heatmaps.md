# Zones, Flow, Occupancy & Heatmaps

**TL;DR:** Once detections have track IDs and a floor projection, four analytics
fall out cheaply: **occupancy** (how many in a zone now), **flow** (directional
crossings/min), **dwell** (already covered), and **heatmaps** (where people spend
time). These are the dashboards clients stare at — and they're geometry, not ML.

## Zones (ROI polygons on the floor)

Define polygons on the **ground plane**, test the object's **foot point**:

- **Point-in-polygon** — ray-casting / `cv2.pointPolygonTest`. Use the foot point
  (bottom-center), projected via homography, so "in zone" = feet-on-tile.
- **Occupancy** = count of unique track IDs whose foot point is inside the polygon
  this frame. Smooth over a short window to kill flicker.
- **Capacity / crowd-limit alerts** = occupancy > threshold for K seconds (crowd
  surge → hands straight to section 12).

## Line-crossing & directional flow

A "tripwire": a virtual line with an orientation.

```
crossed? → sign of cross-product of (line vector) × (track step Pₜ₋₁→Pₜ) flips
direction → which sign it flipped to  ⇒  IN vs OUT
flow rate → crossings per minute, per direction
net occupancy = Σ(in) − Σ(out)   # people-counting without watching the whole room
```

- **Count unique track IDs**, once, per crossing — never per frame (double-count).
- **Debounce** near the line: require the crossing to be "committed" (a few px past)
  so a person loitering on the line doesn't rack up crossings.
- **Net in−out** is a classic cheap occupancy estimate for a room with known
  entrances — no need to see the whole floor.

## Flow / trajectory analytics

- **Origin-Destination** — which entrance → which exit (aggregate trajectories).
- **Speed** — pixel speed is meaningless; measure on the ground plane in m/s.
  A sudden drop in mean speed + rising occupancy = congestion forming.
- **Path/route mining** — common routes, bottleneck segments.

## Heatmaps (two very different kinds — don't confuse them)

- **Occupancy/dwell heatmap** — accumulate *time spent* per floor cell (bin foot
  points over minutes/hours). Answers "where do people linger?" Great for retail
  layout, platform hot spots.
- **Motion/flow heatmap** — accumulate *movement* (optical flow magnitude or track
  density) per cell. Answers "where is there movement?"
- Build on the **ground plane**, not the image, or perspective makes near-camera
  areas look artificially hot.

```python
# occupancy heatmap accumulation (foot points already on ground plane, in cm)
import numpy as np
H = np.zeros((floor_h, floor_w), np.float32)
for (fx, fy) in foot_points_this_frame:      # ground-plane coords
    H[fy, fx] += dt                            # add the frame duration (seconds)
# after N frames: H holds seconds-spent per cell; normalize + colormap for display
```

## Why "on the ground plane" keeps coming up

Every metric here (occupancy, speed, dwell, heatmap) is **distorted by
perspective** if computed in pixels. The homography that maps image → floor plan
(calibration page) is what turns pixel soup into meters and m² — the difference
between a demo and a product. Say this; it's the JD's "geometry" competency.

## Quick self-check

- How do you avoid double-counting at a tripwire? *(unique track IDs, debounced,
  once per commit past the line)*
- Occupancy heatmap vs motion heatmap — what does each accumulate? *(time-in-cell
  vs movement-in-cell)*
- Why compute speed on the ground plane? *(pixel speed varies with distance to
  camera; meters/s is invariant)*
