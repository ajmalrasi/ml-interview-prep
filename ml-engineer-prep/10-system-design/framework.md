# A Design Framework

**TL;DR:** Answer any "design an ML system" question with the same skeleton: clarify the
problem, define the metric, sketch the data and features, pick a model, design serving,
then monitoring — talking trade-offs throughout. Structure beats cleverness.

## The steps

**1. Clarify the problem & requirements.** Don't design yet — ask. What exactly are we
predicting? What's the scale (users, requests/sec)? Latency budget (real-time or batch)?
What does success mean in business terms? These answers reshape everything, and asking them
is itself a signal of seniority.

**2. Frame it as an ML problem.** Translate the business goal into a concrete ML task:
inputs, output, and the **metric**. "Recommend products" → "rank items by predicted
click/purchase probability for this user," optimized offline for something like AUC and
online for click-through or revenue.

**3. Data & features.** What data exists (user history, item metadata, context)? How is it
collected and how fresh? What features would be predictive, and do you need a feature store
for consistency and low-latency serving (section 2)?

**4. Model.** Start simple (a baseline — popularity, logistic regression), then justify
complexity. Name a reasonable choice and *why*, and mention the baseline you'd beat. Simple-
first is a maturity signal.

**5. Serving.** Batch or real-time (section 5)? For low-latency at scale, a common pattern
is **two-stage**: a cheap **candidate generation** step narrows millions of items to
hundreds, then an expensive **ranking** model orders those. Discuss latency, scaling, caching.

**6. Monitoring & iteration.** How do you know it works in production — online metric via
A/B test (section 4), drift and quality monitoring (section 6), and a retraining plan.

## The two-stage pattern (worth memorizing)

Most large-scale ranking/recommendation/search systems use it, because scoring millions of
items per request with a heavy model is impossible in real time:

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">millions of items</span>
    <span class="arw"></span>
    <span class="node">CANDIDATE GENERATION<span class="nsub">cheap · fast · high recall</span></span>
    <span class="arw labeled"><span class="al">~hundreds</span></span>
    <span class="node">RANKING<span class="nsub">expensive · accurate</span></span>
    <span class="arw labeled"><span class="al">top-N</span></span>
    <span class="node out">user</span>
  </div>
</div>
```

## Talk trade-offs out loud

The whole point is judgment: batch (cheap, stale) vs online (fresh, costly); a bigger model
(accurate, slow, expensive) vs a smaller one; more features (better, more pipeline risk).
Naming the trade-off and *making a choice with a reason* is what they're scoring.

## 🔗 Connecting the dots — the real stack

Each layer of your answer maps to named tools, and dropping them in shows you've built, not just diagrammed: features → **Feast**; training → **PyTorch / XGBoost** on **SageMaker/Vertex/Databricks**; tracking → **MLflow**; candidate retrieval → a **vector DB / ANN** (FAISS, ScaNN); serving → **Triton / KServe**; monitoring → **Evidently + Prometheus/Grafana**; A/B → **Statsig**.

**How you'd say it:** *"I sketch the pipeline first, then name a tool per box — feature store, MLflow, an ANN index for retrieval, KServe for serving, Evidently for drift — so it's clearly a real system, not a whiteboard fantasy."*

## Self-check

- What's the first thing to do in an ML design question? *(clarify requirements — scope,
  scale, latency, success metric — before designing.)*
- What is the two-stage pattern and why use it? *(cheap candidate generation then expensive
  ranking — you can't score millions of items in real time with a heavy model.)*
- Why start with a simple baseline? *(it's a maturity signal, gives something to beat, and
  often is enough.)*
