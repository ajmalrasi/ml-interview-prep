# Drift & Data-Quality Monitoring

**TL;DR:** "Drift" is when production data or the relationships in it move away from
what the model trained on, quietly degrading accuracy. The two main kinds are **data
(covariate) drift** — inputs change — and **concept drift** — the input→output
relationship changes. You detect them by comparing live data to a training baseline,
usually *without* labels.

## The kinds of drift (know these names)

- **Data drift (covariate shift)** — the distribution of the *inputs* changes. A new
  user demographic signs up, a sensor is recalibrated, prices inflate. The model's logic
  is still valid, but it's now seeing inputs unlike its training data.
- **Concept drift** — the *relationship* between inputs and the target changes. What
  predicted fraud last year no longer does because fraudsters adapted. Here even the same
  inputs should map to different outputs now.
- **Label/prior drift** — the base rate of the target shifts (fraud goes from 1% to 5%).

The distinction matters because the fix differs: covariate drift often means "retrain on
newer data"; concept drift means "the problem itself changed — relabel and rethink."

## Detecting drift without labels

In production you usually don't get the true answer immediately (did this user *actually*
churn? you find out next month), so you can't measure accuracy live. Instead you watch
*proxies*:

- **Input distribution monitoring** — compare the live distribution of each feature to
  the training baseline, using tests/metrics like **PSI (population stability index)**,
  **KL divergence**, or a KS test. A big shift = data drift alarm.
- **Prediction distribution** — if the model suddenly predicts "fraud" 10× more often,
  something changed even before you have labels.
- **Delayed accuracy** — once true labels do arrive, compute real accuracy and trend it;
  this is your ground truth, just late.

## Data-quality monitoring (the boring, vital half)

Separate from drift, plain **broken data** silently poisons predictions: a feature that
starts arriving as null, a units change (dollars → cents), a schema change upstream. You
run validation checks on live inputs (ranges, nulls, types, cardinality) and **alert on
violations** — because a model can't tell you its input is garbage; it just returns
garbage. Tools: Great Expectations, Evidently, or built-in cloud monitors.

## 🔗 Connecting the dots: the real stack

Drift/quality tools: **Evidently** (open source), **Arize**, **WhyLabs**, **Fiddler**, **NannyML**, or the built-in **SageMaker Model Monitor** / **Vertex Model Monitoring**. Raw data checks stay in **Great Expectations**. These emit metrics that feed the same Prometheus/Grafana dashboards as the service.

**How you'd say it:** *"Evidently computed PSI on each feature against the training baseline nightly; a sustained shift raised an alert and, past a threshold, triggered the retraining pipeline."*

## Self-check

- Data drift vs concept drift — one line each? *(inputs change vs the input→output
  relationship changes.)*
- Why can't you just monitor accuracy in production? *(true labels are usually delayed
  or absent; you watch input/prediction distributions as proxies.)*
- Name one drift-detection metric. *(PSI, KL divergence, KS test.)*
