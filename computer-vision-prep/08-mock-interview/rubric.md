# Self-Grading Rubric

Score each answer 1–4. The bar isn't perfection — it's senior-engineer *reasoning*.

| Score | Means |
|---|---|
| 4 | Correct + names the tradeoff + ties to real experience + would convince me |
| 3 | Correct and clear, but thin on tradeoffs or examples |
| 2 | Roughly right but vague, missed the key nuance |
| 1 | Wrong, or couldn't answer |

## What interviewers actually reward (score yourself on these too)

- **Clarifies before answering** design/ambiguous questions (don't assume scale/SLA).
- **Names tradeoffs**, not just "the answer" — "X over Y because…, but the cost is…".
- **Thinks out loud** — they're scoring your reasoning, not just the conclusion.
- **Quantifies** — "NVDEC decodes dozens of streams," "INT8 ≈ 3–4×," p99 not average.
- **Connects to real work** — Jetson/DeepStream/TensorRT, the NVMe-vs-NAS diagnosis.
- **Addresses failure unprompted** — for any live-systems answer, mention what breaks.
- **Composure on curveballs** — restate, adjust, state the cost. Calm > perfect.

## Red flags to self-check

- Jumped to a solution without clarifying scale/SLA.
- Said "just add a bigger buffer / more RAM" (unbounded thinking).
- Claimed the GIL makes Python useless for video (wrong — natives release it).
- Forgot keyframes when discussing reconnect.
- No mention of measurement/profiling when asked about performance.
- Over-talked. Tight, structured answers beat rambling.

## Target before the interview

- Stage 2 rapid-fire: **all 4s** (these are recall — drill until automatic).
- Stage 3 deep dive: at least one topic at **4**, the rest **3+**.
- Stage 4 design: hit all five framework steps + handle 2 curveballs at **3+**.

## How to practice this week

1. Day 1–2: read sections 01–05, do the drill bank out loud.
2. Day 3: sections 06 + curveballs; do the design question on a whiteboard.
3. Day 4: full mock (solo or ask me to run it live), grade, re-drill weak spots.
4. Morning of: cheat-sheet.md only. Breathe.

→ Want me to run this live and grade you? Just say *"run the KoiReader mock."*
