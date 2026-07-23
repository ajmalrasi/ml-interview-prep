# 1: ML Foundations

**TL;DR:** Before the cloud and the MLOps, you need the core ideas an interviewer
assumes you already have: how an ML project actually flows, the main *kinds* of
learning, why models fail to generalize (bias vs variance), and how you measure
"good." Four short pages.

## Why start here

Everything later — pipelines, serving, monitoring — exists to support a *model*, and
you can't reason about serving latency or drift if the modeling basics are shaky.
This section is the shared vocabulary. It's also where the "warm-up" interview
questions come from: *"explain overfitting,"* *"when would you use precision over
recall,"* *"what's the difference between supervised and unsupervised learning."*
Getting these crisp buys you credibility for the harder rounds.

## The four pages

- **The ML lifecycle** — the loop you own end to end, and why "training the model" is
  the small part.
- **Learning types & algorithms** — supervised / unsupervised / reinforcement, and
  the handful of algorithms worth knowing cold.
- **Bias, variance & overfitting** — the single most important idea in modeling: why
  models fail on new data, and the knobs that fix it.
- **Evaluation metrics** — accuracy lies; here's what to use instead, per task.

→ Start: **[ml-lifecycle.md](ml-lifecycle.md)**
