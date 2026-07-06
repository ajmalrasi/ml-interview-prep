# 12 — Operational Event & Anomaly Detection

**TL;DR:** The job asks for *operational event detection and anomaly
identification*, and the single most important thing to get straight is that those
are two different problems. An **event** is something you can describe in words
before it happens — loitering, an intrusion, an abandoned bag, a crowd surge — so you
can write a rule for it. An **anomaly** is the thing you *couldn't* list in advance
— "something's off here" — so instead of describing it you learn what normal looks
like and flag whatever deviates. Almost every real brief is mostly the first kind
with a little of the second, and knowing to say that is half the interview.

The three pages build the argument in order: first the catalogue of definable events
and how each is actually computed, then the family of methods for the genuinely
unpredictable anomalies, and finally — the part that decides whether the whole system
succeeds — how you keep the alerts trustworthy instead of drowning operators in false
alarms.

Files, in reading order:
1. [operational-events.md](operational-events.md) — the standard event catalogue, and the common recipe underneath all of it
2. [anomaly-methods.md](anomaly-methods.md) — learning "normal" and scoring deviation, from simple statistics to autoencoders
3. [alerting-and-thresholds.md](alerting-and-thresholds.md) — the layer that makes anyone trust the system

## The distinction, drawn once

```
 EVENT — known, describable                 ANOMALY — unknown, "not normal"
 "person in restricted zone for 30s"        "a motion pattern never seen here"
        │                                            │
        ▼                                            ▼
 write deterministic logic on tracks         learn a model of normal, then
 + geometry → precise, explainable           score how far this deviates
```

Why lead with this? Because when someone hands you an "anomaly detection" project, it
usually turns out to be eighty percent definable events plus a long tail of true
surprises. The senior move is to say so, and to sequence the work accordingly: ship
the high-precision, explainable rule-based events first — they deliver value on day
one and a human can audit exactly why each fired — and layer statistical or learned
anomaly detection on top for the open-ended remainder.

**The framing line to memorize:** *"I separate definable events from true anomalies.
Events are geometry-and-timing logic on tracks — precise, auditable, and what a
client actually asks for first. Anomaly detection is a learned model of 'normal' for
the open-ended rest. Either way, the hard part isn't detecting something once — it's
keeping the false-alarm rate low enough that people trust it, so I design the
confirmation logic in from the start."*

→ Start: **[operational-events.md](operational-events.md)**
