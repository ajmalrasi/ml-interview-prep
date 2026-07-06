# Alerting, Thresholds & False-Alarm Control

**TL;DR:** Detecting an event once is the easy part. The part that decides whether the
whole system lives or dies is what happens *after* the detection — how you confirm it,
debounce it, deduplicate it, and hand it to a human. A system that cries wolf gets
muted within a week, and a muted system detects nothing. So the most senior thing you
can talk about in this entire section isn't the detector at all; it's the alerting
layer wrapped around it.

## Why this layer, and not the detector, decides success

The reason comes straight from the previous page: anomalies and events are *rare*, and
rare things are unforgiving. Picture a detector that's 99% specific — sounds great —
now run it across thousands of frames per second, times dozens of cameras. That 1%
becomes a flood of false positives, an operator mutes the alerts, and your beautifully
accurate detector is now worthless. The only cure is to engineer the *alert*, not just
the detection. Think of it as a pipeline that a raw per-frame trigger has to survive
before it's allowed to reach a person:

```
raw trigger (this frame)
   → temporal confirmation (K-of-N, or a dwell)   kill single-frame noise
   → hysteresis (arm high, clear low)             stop flicker at the boundary
   → debounce / cool-down per camera+zone+type    one alert, not five hundred
   → dedupe across cameras (one real-world event) overlapping views = one incident
   → add severity + evidence → route to operator
```

## The techniques, and the intuition for each

**K-of-N confirmation** is the highest-leverage tool you have: only fire if the
condition held in, say, eight of the last ten frames. One noisy frame can no longer
trigger anything. **Dwell or persistence** is its cousin — insist on a real duration
(loitering over thirty seconds, an object static over a minute) so momentary blips
never qualify.

**Hysteresis** solves a specific, maddening problem: a metric hovering right on the
threshold. If occupancy is oscillating around its cap, a single threshold makes the
alarm chatter on and off dozens of times. The fix is two thresholds — arm the alarm
at a *high* level, but don't clear it until it drops to a *lower* one — so the state
is sticky and the chatter stops.

**Debounce, or cool-down**, says that once you've fired for a given camera, zone, and
event type, you suppress repeats for a while and send one "still ongoing" update
rather than a per-frame storm. **Deduplication** handles the multi-camera case: the
*same* real-world intrusion seen by two overlapping cameras is **one** incident, not
two, and you enforce that by deduping on shared floor position and time — which is
exactly why the shared ground-plane calibration from section 11 keeps paying off. And
plain **spatial filtering** rounds it out: mask off the known-noisy regions — a
swaying tree, a reflective floor, a wall-mounted monitor showing video — before they
ever generate a trigger.

## Where the thresholds actually come from

Not from guessing. You collect the normal distribution of whatever metric you're
thresholding and set the cut at a chosen percentile or cost trade-off, then validate
it. And the direction you lean is a *business* decision, not a technical default: a
security intrusion wants high recall — miss nothing, tolerate some false alarms — while
a retail footfall count wants high precision. So you ask which the client actually
wants rather than assuming, and you pick your operating point on the precision-recall
curve to hit an agreed budget, something as concrete as "fewer than two false alerts
per camera per day." Finally, you expose these thresholds as per-site configuration,
because scenes differ far too much for one global number to fit them all.

## Designing the event itself so it's auditable

In a secure deployment, the shape of the event object matters as much as the logic
that produced it, because it's what makes the system auditable after the fact. A clean
event is self-describing and carries its own evidence:

```json
{
  "event_id": "uuid",
  "type": "loitering",
  "severity": "medium",
  "camera_id": "cam-07",
  "zone_id": "restricted-b",
  "start_ts": "2026-07-06T09:14:03Z",
  "end_ts": null,                       // stays open while ongoing
  "track_ids": [42],
  "confidence": 0.87,
  "evidence": { "clip": "…", "keyframe": "…", "trajectory": [] },
  "status": "active"                    // active → acknowledged → resolved
}
```

Three things make it trustworthy. It carries **evidence** — a keyframe, a clip, the
track — so a human can judge it in seconds and the record survives for later audit. It
moves through a **state machine** — active, then acknowledged, then resolved — which
supports SLAs and stops the same incident paging three people. And it's **idempotent**:
because it's keyed on type, camera, zone and a time bucket, a retry or an overlapping
view can't manufacture a duplicate.

## Closing the loop, which is what impresses

The detail that signals real maturity is treating false alarms as fuel rather than
noise. Give operators a "false alarm" button, and every press feeds a dataset you use
to retune thresholds and to hard-mine those false positives into the next model — the
active-learning loop from section 14. And keep watching the false-alarm rate itself:
alerts per camera per day is a metric, and a rising trend is often the first sign of
model drift or a camera that's been bumped, which walks you straight into the
monitoring in section 13.

**Self-check.** Why hysteresis instead of a single threshold? *(it stops the alarm
chattering on and off when the metric hovers right at the boundary.)* Two overlapping
cameras both fire on one intrusion — how many incidents should there be, and how do you
enforce it? *(one; dedupe on shared floor position and time.)* A client says "never
miss an intruder" — which way do you move the operating point, and what does it cost?
*(toward recall, at the price of more false alarms, which you budget explicitly.)* And
what makes an event auditable in a secure deployment? *(a self-describing schema with
attached evidence and a status state machine.)*
