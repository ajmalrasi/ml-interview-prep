# Packaging, Registry & Versioning

**TL;DR:** To ship a model reliably you **package** it (usually a container) so it runs
identically everywhere, register it in a **model registry** with a version and stage
(staging → production), and keep older versions so you can **roll back**. This is what
makes deployment repeatable instead of a scary one-off.

## Package it in a container

A model needs its exact environment — Python version, library versions, the model file
— or it behaves differently in production than in your notebook ("works on my machine").
A **Docker container** bundles the model plus its full environment into one immutable
image that runs the same on any machine. Containerizing is the baseline step that makes
everything downstream (Kubernetes, scaling, reproducibility) possible.

## The model registry

A **model registry** is a versioned catalog of trained models — the "source of truth"
for what's deployable. Each model gets a **version number**, metadata (metrics, training
data, who/when), and a **stage**: *staging* (under test) → *production* (live) →
*archived*. Tools: MLflow Model Registry, SageMaker, Vertex AI.

```
train → register (v5, metrics attached) → promote to staging → test → promote to production
                                          (v4 stays archived → instant rollback)
```

The registry gives you three things that matter in production: a clear record of what's
live, a controlled **promotion** process (nothing hits production unreviewed), and
instant **rollback** to the previous version when a deploy goes wrong.

## Versioning code, data, *and* model

Regular software versions code. ML must version **three** things, because a model is the
product of all of them:

- **Code** — git, as usual.
- **Data** — the training dataset/snapshot (DVC, or a versioned table), so you know what
  the model learned from.
- **Model** — the artifact itself, in the registry.

If you can't answer "which code + which data produced the model that's live right now,"
you can't debug or reproduce it. Versioning all three is the fix.

## Rollback: the safety net

Because models can degrade in ways tests miss, **keeping the previous version pinned and
ready** is essential — when a new model misbehaves in production, you flip back in
seconds rather than scramble to retrain. Never overwrite the live model in place.

## 🔗 Connecting the dots — the real stack

Package with **Docker**; register in the **MLflow Model Registry**, **SageMaker / Vertex** registries, or **Unity Catalog** (models beside tables). Version data with **DVC** or a Delta snapshot, and code with git — so "which code + which data made the live model" is always answerable.

**How you'd say it:** *"The model ships as a Docker image, registered in MLflow with its metrics and data version, promoted staging → production, and the previous version stays pinned for instant rollback."*

## Self-check

- Why containerize a model? *(bundle the exact environment so it runs identically
  everywhere — no "works on my machine.")*
- What does a model registry give you? *(versioning, staged promotion to production,
  and instant rollback.)*
- What three things must ML version, and why? *(code, data, model — a model is the
  product of all three, needed to reproduce/debug.)*
