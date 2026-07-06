# 12 — Operational Event & Anomaly Detection

**TL;DR:** The JD's third pillar: *operational event detection and anomaly
identification*. Two distinct problems. **Events** are things you can *define*
(loitering, intrusion, abandoned object, crowd surge) — rule/logic on detections.
**Anomalies** are things you *can't* enumerate ("something unusual") — you learn
"normal" and flag deviation. Know the standard event catalog, the anomaly method
families, and — most important — how you keep false alarms low enough that anyone
trusts the system.

Files:
1. [operational-events.md](operational-events.md) — the standard event catalog and how each is computed
2. [anomaly-methods.md](anomaly-methods.md) — supervised vs unsupervised, optical flow, autoencoders, prediction error
3. [alerting-and-thresholds.md](alerting-and-thresholds.md) — debounce, confirmation, false-alarm control, alert schemas

## Events vs anomalies (get this distinction crisp)

```
 EVENT (known, definable)            ANOMALY (unknown, "not normal")
 "person in restricted zone >30s"    "motion pattern never seen here before"
        │                                    │
        ▼                                    ▼
 deterministic logic on               learn a model of normal, score
 detections/tracks + geometry         deviation (unsupervised/self-supervised)
 → high precision, explainable        → catches the unforeseen, harder to tune
```

Most production "anomaly detection" briefs are actually **80% defined events + 20%
true anomaly**. Say so: you'd ship the high-precision rule-based events first
(immediate value, explainable), and layer statistical/learned anomaly detection for
the long tail. That's the pragmatic, senior answer.

## The framing line (memorize)

*"I separate definable events from true anomalies. Events are geometry-plus-temporal
logic on tracks — high precision, auditable, and what a client actually asks for
day one. Anomaly detection is a learned model of 'normal' for the open-ended rest.
Either way the hard part isn't detecting once — it's the false-alarm rate, so I
design confirmation and debouncing in from the start."*

→ Start: **[operational-events.md](operational-events.md)**
