# 12 — Event & Anomaly Detection

**TL;DR:** Two different problems. **Event** = you can name it (loitering, intrusion, abandoned bag) → write a **rule**. **Anomaly** = can't list it → **learn "normal", flag deviation**. Most briefs = 80% events + 20% anomaly.

| EVENT (known) | ANOMALY (unknown) |
|---|---|
| "person in zone >30s" | "motion never seen here" |
| rule on tracks + geometry | learn normal, score deviation |
| precise, explainable, auditable | catches the unforeseen, harder to tune |

**Senior move:** ship rule-based events first (day-1 value, auditable), layer anomaly for the long tail.

**Say this:** *"I split definable events from true anomalies. Events = geometry+timing logic on tracks: precise, auditable, what clients ask for. Anomaly = learned model of normal for the rest. Either way the hard part is the false-alarm rate, so I design confirmation in from the start."*

Pages: 1) event catalogue · 2) anomaly methods · 3) alerting & false-alarms.

→ Start: **[operational-events.md](operational-events.md)**
