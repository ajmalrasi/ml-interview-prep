# AI / ML Engineer — Interview Prep

**TL;DR:** This pack covers the whole job: taking a machine-learning idea from raw
data all the way to a model running, and being *watched*, in production on the
cloud. The through-line is the **ML lifecycle** — data → model → deploy → monitor →
improve — and every section is one stage of it.

## What this role actually is

An ML Engineer sits between a data scientist and a backend engineer. You're expected
to *build models* **and** *ship them* — the data pipeline that feeds them, the
training that produces them, the service that serves them, and the monitoring that
keeps them honest once real traffic hits. The job description's seven bullets map
cleanly onto the sections here:

| JD responsibility | Where it's covered |
|---|---|
| Model development (ML & deep learning) | §1 Foundations, §3 Model Development |
| Data pipeline engineering | §2 Data Pipelines |
| Experimentation & statistical analysis | §4 Experimentation |
| Deployment / MLOps | §5 MLOps & Serving |
| Monitoring in production | §6 Monitoring & Reliability |
| Optimization for speed/scale | §7 Cloud & Infra, §8 Optimization |
| Innovation / Generative AI | §9 Generative AI & LLMs |

Two more sections round it out: **§10 ML System Design** (the open-ended "design a
recommender" whiteboard round) and **§11 Drill Bank** (rapid Q&A for the last mile).

## How each page is written

Short and clear, not keyword-terse and not an essay. Every page opens with a
one-line **TL;DR**, explains each idea in a few plain sentences (what it is, *why* it
matters, how it connects), uses a small table or diagram when that's clearer than
prose, and ends with a couple of quick self-check questions. You should be able to
read a page in a few minutes and actually *understand* it, not just recognize the
words.

## The lifecycle, in one picture

```
        ┌─────────── the loop you own end-to-end ───────────┐
 raw data → PIPELINE → TRAIN → EVALUATE → DEPLOY → MONITOR → (retrain)
   §2        §2        §3        §4        §5        §6         §6
                       ▲                                        │
                       └──────────── drift / new data ──────────┘
   cross-cutting: §7 cloud & infra · §8 optimization · §9 GenAI · §10 design
```

## Suggested order

Go top to bottom the first time — the sections are sequenced along the lifecycle, so
each builds on the last. If you want the highest-leverage interview topics first,
prioritize **§5 MLOps**, **§6 Monitoring**, and **§10 System Design**, because those
are where "ML Engineer" is tested more than "data scientist." Skim **§9 Generative
AI** even if the role isn't LLM-heavy — every team asks about it now.

→ Start: **[01-ml-foundations/README.md](01-ml-foundations/README.md)**
