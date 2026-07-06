# Zones, Flow, Occupancy & Heatmaps

**TL;DR:** Once your detections have stable IDs and you can place people on the
floor, a whole dashboard falls out almost for free — how many are in this area right
now, how many crossed that doorway and in which direction, where people linger. The
striking thing is that none of it is machine learning. It's geometry and counting
laid on top of the model's output. This is the layer clients actually stare at.

## Zones: asking "who's standing here?"

A zone is just a polygon you draw on the floor — a waiting area, a restricted bay, a
shop section. To decide whether a person is inside it, you take their **foot point**
(the bottom-centre of their box, projected onto the floor with the homography from
the next page) and test whether that point falls inside the polygon. That's a
classic point-in-polygon test — ray casting, or `cv2.pointPolygonTest` in OpenCV.

Count the unique IDs whose feet are inside right now and you have **occupancy**: how
many people are in this area at this moment. Smooth it over a second or two so a
single flickery frame doesn't make the number jump. And the instant you have
occupancy, you have a crowd-safety signal for free: occupancy above a threshold, held
for a few seconds, *is* an overcrowding event — which hands straight to the crowd-surge
detector in section 12.

## Flow: counting people crossing a line

Some of the most useful analytics don't need you to watch a whole room — just a
doorway. Draw a virtual line with a direction across it, a tripwire. A person crosses
it when their track steps from one side to the other, which you can detect cleanly
with a bit of vector algebra: watch the sign of the cross product between the line and
the person's movement between two frames, and when that sign flips, they've crossed.
*Which* sign it flips to tells you whether they went in or out.

```
crossed?    the sign of (line) × (this step of the track) flips
direction?  which sign it flipped to  →  IN vs OUT
flow rate?  crossings per minute, per direction
```

Two details save you from embarrassing bugs. Count each **unique ID once** per
crossing, never once per frame, or a person dawdling on the line racks up dozens of
phantom entries — so debounce it by only committing the crossing once they're clearly
past the line. And here's a genuinely useful consequence: if you count everyone in
and everyone out of a room with known doorways, then **in minus out** is the room's
occupancy, and you never had to see the middle of the room at all.

## Flow, continued: where people go and how fast

Aggregate enough trajectories and richer patterns appear — which entrance leads to
which exit, which corridors are the common routes, where the bottleneck segment is.
Speed is part of this too, but only if you measure it correctly: pixel speed is
meaningless because a person near the camera covers more pixels per step than a
distant one, so you measure on the floor, in metres per second. And that gives you an
early-warning signal worth knowing — when average speed drops while occupancy climbs,
congestion is forming before it's obvious to the eye.

## Heatmaps: two kinds people constantly confuse

"Make me a heatmap" can mean two different things, and mixing them up produces
nonsense. An **occupancy (or dwell) heatmap** accumulates *time spent* in each patch
of floor: bin every foot point over minutes or hours, adding the frame's duration
each time, and you get a map of where people linger — gold for retail layout or
spotting platform hot spots. A **motion heatmap** accumulates *movement* instead —
optical-flow magnitude or track density — answering "where is there activity" rather
than "where do people stay." Same colours, opposite questions.

```python
# occupancy heatmap: foot points already projected to the floor, in cm
import numpy as np
H = np.zeros((floor_h, floor_w), np.float32)
for (fx, fy) in foot_points_this_frame:   # ground-plane coordinates
    H[fy, fx] += dt                        # add this frame's duration in seconds
# after a while, H holds seconds-spent-per-cell; normalise and colour-map to display
```

Build these on the **floor**, not the raw image — otherwise perspective makes the
area nearest the camera look permanently hot simply because people cover more pixels
there.

## The refrain: it all lives on the floor

Notice that every metric on this page — occupancy, crossings, speed, dwell, heatmaps
— quietly assumes you've mapped the image onto the floor plan. That mapping, the
homography, is what converts pixel soup into metres and square metres, and it's the
difference between a demo that looks plausible and a product whose numbers hold up.
That's the whole of the next page, and it's the geometry competence the role keeps
asking about.

**Self-check.** How do you avoid double-counting at a tripwire? *(count each unique
track ID once, debounced, only after it's clearly past the line.)* Occupancy heatmap
versus motion heatmap — what does each accumulate? *(time-spent-in-a-cell versus
movement-in-a-cell.)* Why compute speed on the floor rather than in pixels? *(pixel
speed changes with distance from the camera; metres per second doesn't.)*
