# Logic Layers on Top of Detections

**TL;DR:** This is the JD's standout CV phrase: *"command over geometry and
statistics for designing complex logic layers on top of model detections."* The
model gives you boxes; *you* turn boxes into business meaning — zones, counting,
dwell time, line-crossing, real-world coordinates. It's geometry + a little
statistics, and it's the CV topic most likely to go deep because it's where CV meets
systems. **Prepare to whiteboard one of these.**

## The pattern

```
model detections (boxes + classes + track IDs)
        │
        ▼
 geometry: which zone? crossed which line? where on the floor?
        │
        ▼
 statistics/temporal: count, dwell time, rate, smoothing, dedupe
        │
        ▼
 events: "3 forklifts in bay 2 for >5 min", "pallet crossed dock line"
```

## Core geometric primitives

- **Point-in-polygon** — is an object inside a defined zone? Use the object's
  *anchor point* (usually bottom-center of the box = where it touches the floor),
  not the box center. Ray-casting / `cv2.pointPolygonTest`.
- **Line-crossing** — did the object's track cross a virtual line (and in which
  direction)? Check the sign of the cross product of the line vs the track segment
  between consecutive frames; a sign flip = a crossing. Direction → in vs out.
- **Distance / proximity** — but **in what space?** Pixel distance is meaningless
  (objects far from the camera look smaller). Convert foot points to the **ground
  plane via a homography** (sec geometry/calibration), then measure in meters.
- **ROI gating** — only run logic for detections inside a region (the loading bay),
  ignore the rest → cheaper and fewer false events.

## Counting & dwell (where statistics enters)

- **Counting** needs **tracking**, not just detection — otherwise you recount the
  same object every frame. Count unique track IDs that cross the line.
- **Dwell time** = (last_seen − first_seen) for a track inside a zone.
- **Temporal smoothing / debouncing** — a detection flickers (present frame N, gone
  N+1). Require K-of-N frames before firing an event so noise doesn't create false
  counts. This is the statistics the JD means: rates, thresholds, smoothing, outlier
  rejection over time.
- **Hysteresis** — different thresholds to *enter* vs *exit* a state, so an object
  hovering on a boundary doesn't spam events.

## Worked example (great whiteboard answer)

*"Count forklifts entering a loading bay and flag any staying >10 min."*
1. Detect + track forklifts (YOLO + DeepSORT) → boxes with stable IDs.
2. Define the bay as a polygon (in image space, or on the ground plane).
3. For each track, take the bottom-center point; point-in-polygon test → inside?
4. Debounce: require the track inside for K consecutive frames before "entered"
   (reject flicker).
5. Record `first_seen` per track in the zone; dwell = now − first_seen.
6. Fire "entered" on a line-cross/zone-enter (dedup by track ID so each forklift
   counts once); fire "overstay" when dwell > 10 min.
7. Emit events as metadata to the message bus (sec 06) — no full-frame egress.

That answer shows geometry (polygon, ground plane), statistics (debounce, dwell),
tracking literacy, *and* the systems instinct (metadata out). It's the bullseye for
this role.

## Why X over Y

**Box center vs bottom-center for zone tests?**
Use bottom-center — it approximates where the object touches the floor, which is what
zones are defined on. Box center sits in mid-air and misreads zone membership,
especially for tall objects or oblique cameras.

**Pixel distance vs ground-plane distance?**
Pixel distance is distorted by perspective (far objects look closer together). Map
foot points to the ground plane via a homography and measure in real-world units —
the only way distance/zone logic is correct across the frame.

**Why debounce/smooth instead of acting on every frame?**
Per-frame detections flicker and jitter; acting raw produces false counts and event
spam. Requiring K-of-N frames (and hysteresis on enter/exit) trades a few ms of
latency for robust, trustworthy events — exactly the "statistics layer" the JD wants.

**Why count track IDs, not detections?**
Detection fires every frame, so counting detections counts the same object hundreds
of times. Counting unique track IDs (that cross a line / enter a zone) counts objects
once — tracking is what makes counting correct.

→ Back to [section README](README.md) · Quick refresh: **[cv-cheat-sheet.md](cv-cheat-sheet.md)**
