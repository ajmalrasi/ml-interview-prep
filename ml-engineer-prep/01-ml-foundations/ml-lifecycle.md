# The ML Lifecycle

**TL;DR:** An ML project is a loop, not a line: you frame the problem, get and clean
data, engineer features, train and evaluate, deploy, then monitor and retrain as the
world changes. Most of the real work — and most of the failures — happen *around* the
model, not in it.

## The stages

Think of it as a pipeline you'll be asked to reason about end to end:

```
1 Problem framing → 2 Data collection → 3 Preprocessing & features
→ 4 Model training → 5 Evaluation → 6 Deployment → 7 Monitoring → back to 3/4
```

**Problem framing** is deciding what you're actually predicting and how success is
measured *in business terms*. "Reduce churn" becomes "predict which users will cancel
next month, ranked, so we can target the top 5%." Getting this wrong makes everything
downstream pointless, which is why interviewers love to start here.

**Data and preprocessing** (sections 2) is where most time goes — collecting,
cleaning, and shaping raw data into features. The saying "garbage in, garbage out" is
the whole reason data engineering is half of this job.

**Training and evaluation** (sections 3–4) is the part people picture when they hear
"ML," but it's often the *fastest* stage. You fit a model and measure whether it
generalizes.

**Deployment and monitoring** (sections 5–6) is where ML *Engineering* earns its
name. A model that isn't served, watched, and retrained is a science project, not a
product.

## Why "it's a loop" matters

The world drifts — user behavior changes, new products launch, a data source
changes format — so a model that was accurate at launch slowly decays. That's why the
last arrow loops back: monitoring detects the decay, and you retrain on fresh data.
Saying "the lifecycle is a loop because of drift" signals you think past the demo.

## The interview angle

A common opener is *"walk me through how you'd build and ship an ML system."* The
lifecycle *is* your answer skeleton: frame → data → features → train → evaluate →
deploy → monitor → retrain. Hang specifics off each stage and you've structured a
strong 10-minute answer without rambling.

## 🔗 Connecting the dots — the real stack

Naming a tool for each stage is what turns "I know the lifecycle" into "I've run one." A common cloud stack:

| Stage | Typical tools |
|---|---|
| Data & features | Spark / dbt, Airflow, a feature store (Feast) |
| Train | scikit-learn, XGBoost, PyTorch — on SageMaker / Vertex / Databricks |
| Track experiments | MLflow, Weights & Biases |
| Deploy | Docker + KServe / Triton, or a managed endpoint |
| Monitor | Evidently / Arize + Prometheus / Grafana |

**How you'd say it:** *"The loop is the same everywhere — in a CV system it was DeepStream to ingest, PyTorch/TensorRT for the model, MLflow to track runs, and Prometheus/Grafana to watch it in production; the tools change, the lifecycle doesn't."*

## Self-check

- Which stage usually takes the most time, and why? *(data collection and
  preprocessing — quality of data caps model quality.)*
- What makes it a loop rather than a line? *(drift — the world changes, so models
  decay and need retraining.)*
- Where does "ML Engineer" differ from "data scientist" in this loop? *(the deploy →
  monitor → retrain half — shipping and keeping models alive.)*
