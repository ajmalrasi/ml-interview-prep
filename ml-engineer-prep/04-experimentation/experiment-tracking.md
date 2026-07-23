# Experiment Tracking

**TL;DR:** ML involves running *many* experiments — different data, features, models,
hyperparameters. Without tracking, you can't reproduce the good one or explain why it
won. An experiment tracker (MLflow, Weights & Biases) logs each run's inputs and
results so the process is reproducible and comparable.

## The problem it solves

Picture running 50 variations over two weeks. Later, "the good model" is a file called
`model_final_v3_really.pkl` and nobody remembers which data, features, or learning rate
produced it. That's not a hypothetical — it's the default state without discipline. ML
is empirical and iterative, so **reproducibility** is a first-class concern.

## What to log per run

- **Parameters** — hyperparameters, model type, feature set.
- **Metrics** — accuracy, F1, loss, and so on, over training.
- **Artifacts** — the trained model file, plots, the confusion matrix.
- **Code + data version** — the git commit and which dataset/version was used.
- **Environment** — library versions, so it can be rebuilt.

The goal is that any past run can be **reproduced** and any two runs **compared** side
by side.

## Tools

**MLflow** (open source: tracking + a model registry, section 5), **Weights & Biases**
and **Neptune** (rich dashboards and collaboration), plus the built-in tracking in
SageMaker and Vertex AI. Any of them beats spreadsheets and filenames.

## Reproducibility is more than the tracker

True reproducibility also means **versioning your data** (tools like DVC or a data
snapshot), **pinning random seeds**, and **containerizing** the environment (section
5). A model is the product of code + data + config + environment — pin all four or "it
worked last week" becomes a mystery.

## Why interviewers care

Tracking is a marker of maturity: it's the difference between a hobbyist who trains
models and an engineer who runs a *process*. Being able to say "I log every run's
params, metrics, artifacts, and data version so any result is reproducible and
comparable" signals you've worked on real teams.

## 🔗 Connecting the dots: the real stack

The tools are **MLflow** (tracking + model registry, the open-source default), **Weights & Biases** and **Neptune** (richer dashboards), with **DVC** versioning the data. On a lakehouse, MLflow ties runs to the exact **Delta / Unity Catalog** data version, and the registered model promotes straight to serving.

**How you'd say it:** *"I log params, metrics, artifacts, the git commit, and the data version to MLflow, so any past run — and the model it produced — can be reproduced exactly."*

## Self-check

- What breaks without experiment tracking? *(reproducibility — you can't recreate or
  explain the winning run.)*
- Name three things to log per run. *(params, metrics, artifacts, code/data version,
  environment — any three.)*
- What four things must you pin for true reproducibility? *(code, data, config,
  environment.)*
