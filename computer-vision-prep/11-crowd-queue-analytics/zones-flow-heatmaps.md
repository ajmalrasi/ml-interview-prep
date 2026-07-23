# Zones, Flow, Occupancy & Heatmaps

**TL;DR:** With IDs + floor projection you get occupancy, flow, dwell, heatmaps almost free. It's **geometry + counting**, not ML. This is the client dashboard.

## Zones (ROI polygons on the floor)
- **Point-in-polygon** on the **foot point** (`cv2.pointPolygonTest`).
- **Occupancy** = # unique IDs with feet inside now; smooth to kill flicker.
- Occupancy > threshold for K sec = **overcrowding event** (→ §12).

## Line-crossing / flow
```rawhtml
<div class="diagram">
  <table class="maptable">
    <tbody>
      <tr><td class="mfrom"><b>crossed?</b></td><td class="marw"></td><td class="mto">sign of the cross-product (line × track-step) flips</td></tr>
      <tr><td class="mfrom"><b>direction?</b></td><td class="marw"></td><td class="mto">which sign → IN vs OUT</td></tr>
      <tr><td class="mfrom"><b>rate?</b></td><td class="marw"></td><td class="mto">crossings / min per direction</td></tr>
    </tbody>
  </table>
</div>
```
- Count **unique ID once** per crossing (never per frame); **debounce** past the line.
- **In − Out = room occupancy** (never watch the whole room).

## Flow analytics
- Origin→destination, common routes, bottlenecks.
- **Speed on floor (m/s)**, not pixels. Speed drop + occupancy rise = **congestion forming**.

## Heatmaps: 2 kinds (don't mix)
- **Occupancy/dwell heatmap** = accumulate **time-in-cell** → "where people linger."
- **Motion heatmap** = accumulate **movement-in-cell** → "where activity is."
- Build on the **floor**, not the image (else near-camera looks fake-hot).

```python
H = np.zeros((floor_h, floor_w), np.float32)
for (fx, fy) in foot_points_this_frame:   # floor coords
    H[fy, fx] += dt                         # seconds per cell
```

## Why "on the floor" keeps recurring
Occupancy, speed, dwell, heatmaps are all **perspective-distorted in pixels**. Homography → metres/m². Demo vs product.

## Q&A
- Avoid double-count at tripwire? → unique ID, debounced, once past line.
- Occupancy vs motion heatmap? → time-in-cell vs movement-in-cell.
- Speed on floor why? → pixel speed varies with distance; m/s invariant.
