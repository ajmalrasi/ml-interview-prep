# 10 — ML System Design

**TL;DR:** The open-ended interview round: *"design an ML system for X"* (recommendations,
fraud, search, a feed). It's not about one model — it's about the whole pipeline: framing
the problem, data, features, model, serving, and monitoring, with sensible trade-offs. This
section gives you a repeatable **framework** plus four worked examples.

## What they're testing

Not whether you know the fanciest model, but whether you can **structure a full solution**
and reason about trade-offs like a senior engineer: latency vs accuracy, batch vs online,
build vs buy, cost vs freshness. A candidate who jumps straight to "I'd use a neural
network" fails; one who clarifies the problem and walks the pipeline succeeds.

## The pages

- **A design framework** — the repeatable structure to answer *any* ML design question.
- **Worked example: recommender** — the classic, walked end to end.
- **Worked example: ML platform** — designing the *infrastructure* many models run on.
- **Worked example: hybrid perception platform** — petabyte-scale, on-prem + cloud GPUs,
  reproducibility, and rollbacks.
- **Worked example: data-loading library** — the classes and interfaces for a streaming
  loader that keeps the GPU fed.

## The golden rule

Start by **asking questions**, not answering. Scope, scale, latency, and success metric
change the whole design — clarify them first, then structure your answer with the
framework.

→ Start: **[framework.md](framework.md)**
