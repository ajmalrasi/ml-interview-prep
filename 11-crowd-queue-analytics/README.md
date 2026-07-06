# 11 — Crowd & Queue Analytics

**TL;DR:** This is the headline deliverable of the JD: *queue-time estimation and
crowd analytics*. The model gives you boxes and track IDs; this section is how you
turn them into the two numbers a client actually pays for — **how many people**
and **how long they wait**. Master the metric vocabulary (Little's Law, dwell,
density) and the ground-plane geometry that makes the numbers real.

Files:
1. [queue-time-estimation.md](queue-time-estimation.md) — the three ways to measure wait time, and Little's Law
2. [crowd-counting-density.md](crowd-counting-density.md) — detection vs density estimation, when each breaks
3. [zones-flow-heatmaps.md](zones-flow-heatmaps.md) — ROI zones, line-crossing, directional flow, occupancy, heatmaps
4. [calibration-and-metrics.md](calibration-and-metrics.md) — homography to the floor, real-world units, accuracy & validation

## The framing line (memorize)

*"Queue time and crowd count are geometry-plus-statistics on top of detection and
tracking. I put the camera in real-world coordinates with a homography, define
zones on the floor plan, and then it's two families of method: tracking-based
(follow individuals, measure their dwell) and estimation-based (regress a count or
a wait from density when tracking breaks down in dense crowds). I pick per the
crowd regime and validate against a ground-truth clock."*

## The two regimes (this decides everything)

```
 SPARSE / MID crowd            DENSE crowd (occlusion, >~2 ppl/m²)
 heads separable                heads merge, tracking fails
        │                              │
        ▼                              ▼
 detect + track individuals     density estimation / regression
 → count unique IDs             → integrate a density map for count
 → dwell = t_exit − t_enter     → wait ≈ Little's Law from flow + occupancy
```

Interviewers love to push you from the easy regime into the hard one: *"Your
person detector works at the counter — now it's Friday and the hall is packed and
half the heads are occluded. What breaks and what do you switch to?"* Answer:
tracking-based dwell degrades as ID switches explode; fall back to a density-map
count and a **flow-based** wait estimate (Little's Law), and report the regime you
detected.

→ Start: **[queue-time-estimation.md](queue-time-estimation.md)**
