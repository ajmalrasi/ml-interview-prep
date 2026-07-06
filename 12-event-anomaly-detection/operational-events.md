# The Operational Event Catalog

**TL;DR:** These are the events every video-intelligence product ships. Each is
**detection + tracking + geometry + a temporal condition** — not a special model.
Know how each is computed and its main false-alarm trap.

## The standard catalog

| Event | How it's computed | Main false-alarm trap |
|---|---|---|
| **Intrusion / zone breach** | foot point enters a restricted ROI polygon | shadows/reflections; staff who are allowed in |
| **Loitering** | track dwell in a zone > T seconds | someone waiting legitimately; ID switch resets the timer |
| **Abandoned / removed object** | static object appears (or a fixture disappears) and persists > T | bags briefly set down; lighting change; a parked cart |
| **Crowd surge / overcrowding** | zone occupancy or density > threshold for K sec | brief clustering; miscalibrated density |
| **Line-crossing / wrong-direction** | track crosses tripwire in the disallowed direction | tracking jitter near the line |
| **Tailgating** | 2 tracks cross an access line within Δt of one badge event | two people legitimately close |
| **Fall / person-down** | box aspect ratio flips (tall→wide) + stays low + low motion | sitting/crouching; occlusion |
| **Speed anomaly** | ground-plane speed > (running) or ≈0 (collapse) | tracker velocity noise |
| **PPE / compliance** | attribute classifier on the person crop (helmet/vest present?) | small/occluded gear; domain shift |

## The recurring recipe

```
detections ─► track (stable IDs) ─► project foot point to floor
          ─► geometric test (in zone? crossed line? which direction?)
          ─► temporal test (for > T sec? K-of-N frames? persisted?)
          ─► CONFIRM (debounce) ─► emit event once, with evidence
```

Two temporal ideas do most of the work:

- **Dwell threshold** — the event needs a *duration* (loitering > 30 s, object
  static > 60 s), not a single frame. This alone kills most flicker.
- **K-of-N confirmation** — require the condition true in K of the last N frames
  before firing, so one noisy frame can't trigger an alert.

## Abandoned object — the classic deep-dive

A favorite interview scenario. Approach:

1. **Background/static detection** — a region that was moving/empty becomes static
   and stays static (dual-background or a "static-foreground" model), OR a detected
   object (bag) whose track goes stationary.
2. **Ownership / separation** — was it left by a person who then walked away? Track
   the owner; fire only if owner-distance > D for > T (distinguishes "set down for a
   second" from "abandoned").
3. **Persistence** — must remain > T seconds to fire.
4. **Evidence** — attach the frame + track history so a human can adjudicate.

The interesting part is #2 — naive "static blob" detectors alarm on every parked
trolley. Owner separation is what makes it usable.

## Why these beat "just train a model"

- **Explainable & auditable** — "fired because track 42 was in zone B for 47 s." In
  a **secure/government Abu Dhabi context**, an auditable rule beats a black box.
- **No labeled event data needed** — you can't collect 10k real intrusions.
- **Tunable per site** — thresholds are knobs an integrator sets on-site.

The model's job is only the primitives (boxes, classes, IDs, attributes). The
*event* is your logic layer on top — exactly the JD's "designing complex logic
layers on model detections."

## Quick self-check

- Loitering fires falsely every time someone's ID switches. Fix? *(persist dwell
  across short gaps / re-associate via ReID; don't reset timer on a 1-frame drop)*
- How do you stop abandoned-object alerting on every parked cart? *(owner-separation
  test + persistence, not just static-blob)*
- Why prefer rule-based events over a learned event classifier here? *(explainable,
  auditable, tunable, and no labeled event data exists)*
