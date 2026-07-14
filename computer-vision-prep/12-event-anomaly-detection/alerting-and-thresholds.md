# Alerting & False-Alarm Control

**TL;DR:** Detecting once is easy. **Trust** = the alerting layer: confirm, debounce, hysteresis, dedupe, clean schema. Cry wolf → muted in a week. The most senior topic in this section.

## Why this layer decides success
Anomalies are **rare** → 99% specific × thousands of frames × dozens of cameras = flood of false positives → operators mute. Engineer the **alert**, not just the detector.
```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">raw trigger</span>
    <span class="arw"></span>
    <span class="node">K-of-N confirm</span>
    <span class="arw"></span>
    <span class="node">hysteresis</span>
    <span class="arw"></span>
    <span class="node">debounce / cooldown</span>
    <span class="arw"></span>
    <span class="node">dedupe</span>
    <span class="arw"></span>
    <span class="node">severity + evidence</span>
    <span class="arw"></span>
    <span class="node out">operator</span>
  </div>
  <div class="flow-foot">Each stage suppresses false alarms — the difference between a trusted alert and one operators mute.</div>
</div>
```

## Techniques
- **K-of-N confirm** — fire only if condition in K of last N frames. Highest-leverage FP killer.
- **Dwell/persistence** — require duration (loiter >30s, object >60s).
- **Hysteresis** — arm at HIGH threshold, clear at LOW → stops on/off chatter at boundary.
- **Debounce/cooldown** — one alert per (camera,zone,type) + "ongoing" update, not per-frame storm.
- **Dedupe** — same real event on 2 overlapping cameras = **1 incident** (dedupe on shared floor position+time, §11).
- **Spatial filter** — mask known-noisy regions (tree, reflection, monitor showing video).

## Thresholds
- **From data**, not vibes — set at a percentile of the normal distribution, validate.
- **Precision vs recall = business call:** intrusion → **high recall** (miss nothing); retail count → **high precision**. Ask.
- Pick operating point on PR curve to hit a budget: "< 2 false alerts/camera/day."
- Expose as **per-site config**.

## Event schema (auditable)
```json
{ "event_id","type":"loitering","severity","camera_id","zone_id",
  "start_ts","end_ts":null,"track_ids":[42],"confidence":0.87,
  "evidence":{"clip","keyframe","trajectory"},"status":"active" }
```
- **Evidence** (keyframe/clip) → human adjudicates fast + audit trail.
- **State machine** active→acknowledged→resolved → SLAs, no duplicate paging.
- **Idempotent** on (type,camera,zone,time-bucket) → retries/overlap can't duplicate.

## Close the loop
- Operator **"false alarm" button** → retune thresholds + hard-mine FPs into next model (active learning, §14).
- Monitor **alerts/camera/day** — rising trend = drift or bumped camera (→ §13).

## Q&A
- Hysteresis why? → stops chatter when metric hovers at boundary.
- 2 cameras fire on 1 intrusion → how many? → 1; dedupe on world position+time.
- "Never miss an intruder" → move toward **recall**, cost = more false alarms (budget them).
- Auditable event? → self-describing schema + evidence + status state machine.
