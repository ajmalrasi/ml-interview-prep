# 5: MLOps & Serving

**TL;DR:** MLOps is "DevOps for machine learning" — the practices and tooling to get
models into production reliably and keep them there. This section covers how you
*serve* a model (the patterns), how you *package and version* it (registry), and how
you *automate* the path from code to production (CI/CD pipelines). This is the heart of
the ML *Engineer* role.

## Why this is the core of the job

Anyone can train a model in a notebook. The value an ML engineer adds is turning that
into a **reliable, repeatable, monitored service** — one that can be updated safely,
rolled back when wrong, and reproduced months later. If a company is hiring an "ML
Engineer" over a "data scientist," this section is usually *why*.

## MLOps in one idea

Regular software has code. ML systems have **code + model + data**, and all three
change and can break you. MLOps extends DevOps to version, test, deploy, and monitor
all three together. That extra surface — models that silently decay, data that drifts —
is what makes MLOps its own discipline.

## The three pages

- **Serving patterns** — batch, online/real-time, and streaming; how a model is
  actually called.
- **Packaging, registry & versioning** — containers, the model registry, and staged
  promotion.
- **CI/CD & pipelines for ML** — automating retrain → test → deploy, with safe rollout.

→ Start: **[serving-patterns.md](serving-patterns.md)**
