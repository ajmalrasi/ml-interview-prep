# 6 — Monitoring & Reliability

**TL;DR:** A deployed model isn't done — it's a liability you have to watch. Unlike
regular software, a model can **silently get worse** while every server stays green,
because the world it learned drifts away from the data it sees now. This section is how
you detect that decay (drift and data-quality monitoring), watch the service health,
and close the loop by retraining.

## The core idea: models decay silently

Normal software fails loudly — an error, a crash, a 500. A model fails **quietly**: it
keeps returning confident predictions that are increasingly wrong, and nothing throws an
error. So you can't wait for it to "break"; you have to actively monitor whether it's
still *accurate*. This is the single most important reliability concept for ML.

## Two layers to watch

Just like a system has both "is it up?" and "is it correct?", ML monitoring splits into:

- **Operational** — latency, throughput, errors, resource use (standard service
  monitoring).
- **Model/data** — drift, data quality, and prediction/accuracy metrics (the ML-specific
  part, and the hard part because you often have no immediate labels).

## The three pages

- **Drift & data-quality monitoring** — the different kinds of drift and how you detect
  them without labels.
- **Performance & ops monitoring** — service health plus proxy signals for model quality.
- **Retraining loops** — closing the loop: when and how to retrain.

→ Start: **[drift-and-quality.md](drift-and-quality.md)**
