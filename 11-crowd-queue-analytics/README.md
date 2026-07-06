# 11 — Crowd & Queue Analytics

**TL;DR:** This is the headline deliverable of the whole job: *queue-time
estimation and crowd analytics*. Everything upstream — the cameras, the detector,
the tracker — exists to produce two numbers a client will actually pay for: **how
many people are here**, and **how long they're waiting**. This section is the bridge
from "boxes on a screen" to those two numbers.

Here's the story the four pages tell. A detector gives you boxes; a tracker gives
those boxes identities that persist across frames. But a box in the *image* isn't
yet a person standing on a *floor* — and until you fix that, every distance, speed,
and density you compute is distorted by perspective. So the real work is: put the
scene into real-world coordinates, decide which regime you're in (can you follow
individuals, or is the crowd too dense?), and then measure. We'll build it in that
order.

Files, in reading order:
1. [queue-time-estimation.md](queue-time-estimation.md) — three ways to measure a wait, and why one survives a packed hall when the others don't
2. [crowd-counting-density.md](crowd-counting-density.md) — counting by detecting people vs. counting without ever separating them
3. [zones-flow-heatmaps.md](zones-flow-heatmaps.md) — turning tracks into occupancy, flow, and heatmaps
4. [calibration-and-metrics.md](calibration-and-metrics.md) — the homography that makes it all real, and how you'd prove your numbers are right

## The one idea that ties the section together

There are really only two situations you can be in, and knowing which one you're in
decides every method you reach for:

```
 When you CAN tell people apart          When you CAN'T (dense, occluded crowd)
 (sparse to moderate crowd)              heads merge, tracking falls apart
        │                                       │
        ▼                                       ▼
 follow individuals, measure them        stop tracking; estimate from the
 directly: count IDs, time their dwell    aggregate — density and flow
```

A favourite interview move is to start you in the easy world and then push you into
the hard one: *"Your counter works fine on a Tuesday morning — now it's a festival
and half the heads are hidden. What breaks, and what do you switch to?"* If you can
narrate that transition calmly, you've shown you understand the whole section. The
short version, which the pages unpack: as the crowd thickens, tracking-based methods
degrade because identities start swapping, so you fall back to methods that work on
the *mass* of the crowd rather than its individuals.

**The framing line to memorize:** *"Queue time and crowd count are geometry plus
statistics layered on detection and tracking. I put the camera into real-world
coordinates with a homography, then pick my method by the crowd regime: follow
individuals when I can, and estimate from density and flow when I can't. Then I
validate against a ground-truth clock."*

→ Start: **[queue-time-estimation.md](queue-time-estimation.md)**
