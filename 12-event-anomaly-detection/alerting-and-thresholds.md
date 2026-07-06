# Alerting, Thresholds & False-Alarm Control

**TL;DR:** Detecting an event once is easy. Making operators *trust* the system is
the real job — and it lives entirely in the alerting layer: **confirmation,
debouncing, hysteresis, deduplication, and a clean event schema**. A system that
cries wolf gets muted in a week. This is the most senior thing you can talk about
in this whole section.

## Why the alerting layer decides success

Anomalies/events are **rare** → the base rate is brutal. Even a great detector at
99% specificity, watching thousands of frames × dozens of cameras, produces a flood
of false positives. Operators mute muted systems. So you engineer the alert, not
just the detector:

```
raw trigger (per frame)
   → temporal confirmation (K-of-N / dwell)     # kill single-frame noise
   → hysteresis (enter high, clear low)          # stop flicker at the boundary
   → debounce / cool-down per (camera,zone,type) # one alert, not 500
   → dedupe across cameras (same world event)    # overlap views = one incident
   → severity + evidence  → route to operator
```

## The core techniques

- **K-of-N confirmation** — fire only if the condition holds in K of the last N
  frames. The single highest-leverage false-alarm reducer.
- **Dwell / persistence** — require a duration (loiter > 30 s, object static > 60 s).
- **Hysteresis (two thresholds)** — enter the alarm state at a *high* threshold,
  clear it at a *lower* one. Prevents rapid on/off chatter when a metric hovers on
  the line (e.g. occupancy oscillating around the cap).
- **Debounce / cool-down** — after firing for a (camera, zone, type), suppress
  repeats for a window; send one "ongoing" update, not a per-frame storm.
- **Deduplication** — the *same* real-world event seen by two overlapping cameras
  is **one** incident (dedupe on shared ground-plane position + time; see §11
  calibration).
- **Spatial/temporal filtering** — ignore known-noisy regions (a swaying tree, a
  reflective floor, a monitor showing video), and known busy periods.

## Setting thresholds

- **Derive from data, not vibes** — collect the metric's normal distribution and set
  thresholds at a chosen percentile / cost trade-off, then validate.
- **Precision–recall trade-off is a business decision** — a **security intrusion**
  wants high recall (miss nothing, tolerate false alarms); a **retail marketing
  count** wants high precision. Ask which the client wants; don't assume.
- **ROC/PR + operating point** — pick the threshold on the PR curve that hits the
  agreed false-alarm budget (e.g. "< 2 false alerts per camera per day").
- **Per-site tuning** — expose thresholds as config an integrator sets on-site;
  scenes differ too much for one global value.

## The event/alert schema (design it deliberately)

A clean, self-describing event object is what makes the system auditable — critical
in a secure government deployment:

```json
{
  "event_id": "uuid",
  "type": "loitering",
  "severity": "medium",
  "camera_id": "cam-07",
  "zone_id": "restricted-b",
  "start_ts": "2026-07-06T09:14:03Z",
  "end_ts": null,                       // open until cleared → ongoing
  "track_ids": [42],
  "confidence": 0.87,
  "evidence": { "clip": "…", "keyframe": "…", "trajectory": [] },
  "status": "active"                    // active → acknowledged → resolved
}
```

- **Include evidence** (keyframe/clip/track) so a human can adjudicate fast and the
  record is auditable later.
- **State machine** — active → acknowledged → resolved; supports SLAs and stops
  duplicate paging.
- **Idempotency** — dedupe by (type, camera, zone, time-bucket) so retries/overlap
  don't double-alert.

## Closing the loop (this impresses)

- **Operator feedback** — a "false alarm" button feeds a dataset to retune
  thresholds and hard-mine false positives into the next model (active learning,
  §14).
- **Continuous false-alarm-rate monitoring** — track alerts/camera/day; a rising
  trend is an early warning of drift or a bumped camera (→ §13 monitoring).

## Quick self-check

- Why hysteresis instead of one threshold? *(stops on/off chatter when the metric
  hovers at the boundary)*
- Two overlapping cameras both fire on one intrusion — how many incidents, and how
  do you enforce it? *(one; dedupe on shared world position + time)*
- Client says "never miss an intruder." Which way do you move the operating point,
  and what's the cost? *(toward recall; more false alarms — budget them explicitly)*
- What makes an event auditable in a secure deployment? *(self-describing schema +
  attached evidence + status state machine)*
