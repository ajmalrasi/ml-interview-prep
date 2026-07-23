# Retraining Loops

**TL;DR:** Drift is inevitable, so models need refreshing. Retraining can be triggered
on a **schedule**, by a **drift/performance signal**, or when **new data** arrives — and
the retrained model must be validated and rolled out safely, never trusted blindly. This
closes the lifecycle loop.

## When to retrain

Three trigger styles, often combined:

- **Scheduled** — retrain every day/week/month regardless. Simple and predictable; may
  retrain when unnecessary or too late for a sudden shift.
- **Triggered by monitoring** — retrain when drift or a performance drop crosses a
  threshold (section 6). More efficient — you retrain because you *need* to — but
  requires solid monitoring to trigger on.
- **Data-driven** — retrain when enough new labeled data has accumulated.

The thoughtful answer combines them: *"a regular cadence as a floor, plus drift/
performance triggers so a sudden shift doesn't wait for the schedule."*

## Automate it, but keep a gate

Ideally retraining is an automated pipeline (the "CT" from section 5): fresh data →
features → train → **evaluate** → register → staged rollout. The non-negotiable step is
the **evaluation gate**: a newly retrained model only gets promoted if it beats a bar
*and* the current production model on a fresh holdout. Automation without a quality gate
just ships bad models faster.

```rawhtml
<div class="diagram">
  <div class="branch">
    <div class="flow">
      <span class="node data">new data</span>
      <span class="arw"></span>
      <span class="node">retrain</span>
      <span class="arw"></span>
      <span class="node">evaluate vs production<span class="nsub">on holdout</span></span>
    </div>
    <span class="split-arw"></span>
    <div class="fork" style="flex-direction:column; gap:12px">
      <div class="flow">
        <span class="node out">better ✓</span>
        <span class="arw tiny"></span>
        <span class="node">register</span>
        <span class="arw tiny"></span>
        <span class="node">canary rollout <span class="nsub">§5</span></span>
        <span class="arw tiny"></span>
        <span class="node">monitor <span class="nsub">§6</span></span>
      </div>
      <div class="flow">
        <span class="node ghost">worse ✗</span>
        <span class="arw tiny"></span>
        <span class="node soft">keep current model · alert</span>
      </div>
    </div>
  </div>
</div>
```

## Don't trust a retrain blindly

A retrained model can be *worse* — the new data might be corrupted, mislabeled, or itself
drifted. So you (1) validate the training data first, (2) gate on evaluation, and (3) roll
out gradually with canary/shadow so a bad retrain is caught on a slice of traffic and
rolled back. Retraining is not automatically an improvement; treat every new model as
guilty until proven better.

## The feedback-loop trap

One subtle danger: if your model *influences* the data it later trains on, it can spiral.
A recommender that only shows popular items gets clicks only on popular items, then learns
"only popular items matter," narrowing forever. Be wary of training on data your own model
shaped, and consider logging some randomized/exploration traffic to keep the feedback
honest.

## 🔗 Connecting the dots: the real stack

The loop is wired with an orchestrator — **Airflow**, **Kubeflow Pipelines**, or **Vertex Pipelines** — triggered on a schedule *or* by a drift alert from **Evidently / Arize**. It pulls fresh data (feature store), retrains, gates on **MLflow**-logged metrics vs production, and canaries out via **KServe** if it wins.

**How you'd say it:** *"A drift alert or a weekly schedule kicked off a Kubeflow pipeline: retrain, evaluate against the live model on a fresh holdout, and only promote — canaried — if it beat it."*

## Self-check

- Three retraining triggers? *(scheduled, drift/performance-triggered, new-data-driven.)*
- What's the non-negotiable gate before promoting a retrained model? *(it must beat a bar
  and the current production model on a fresh holdout.)*
- What is the feedback-loop trap? *(the model influences its future training data, so it
  reinforces its own biases; mitigate with exploration/randomized logging.)*
