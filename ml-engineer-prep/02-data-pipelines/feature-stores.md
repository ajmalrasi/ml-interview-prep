# Feature Engineering & Feature Stores

**TL;DR:** Features are the model's inputs, and **feature engineering** — crafting good
ones — often beats fancier models. A **feature store** is the system that computes,
stores, and serves those features consistently to both training and production,
solving the sneaky "train/serve skew" bug.

## Feature engineering

A feature is any signal you feed the model. Engineering them means turning raw columns
into more predictive inputs: aggregations ("purchases in last 30 days"), ratios,
time-based features (day of week, time since last login), interactions, and
domain-specific transforms. On tabular problems, good features usually move the needle
more than a better algorithm — which is why this is a core skill, not an afterthought.

## The train/serve skew problem

Here's the bug a feature store exists to prevent. You compute a feature one way in your
training notebook (in Python, over historical data) and someone re-implements it
*slightly differently* in the production service (in another language, over live
data). Now the model sees different values in production than it trained on, and it
quietly underperforms. This mismatch is **train/serve skew**, and it's one of the most
common, hardest-to-spot MLOps bugs.

## What a feature store does

A feature store is a central place to **define a feature once** and serve it two ways:

```
feature definition (written once)
        │
   ┌────┴─────┐
   ▼          ▼
 OFFLINE     ONLINE
 store       store
 (history,   (fresh values,
  training)   low-latency serving)
```

- **Offline store** — historical feature values for training, with correct
  *point-in-time* joins so you don't leak the future into the past.
- **Online store** — the latest feature values in a fast key-value store (Redis-like)
  for real-time serving at low latency.
- **One definition** feeds both → training and serving compute features identically →
  **no skew**. It also lets teams **reuse** features instead of rebuilding them.

Tools: Feast (open source), or managed ones in SageMaker / Vertex AI / Databricks.

## Point-in-time correctness (the subtle part)

When you build a training set, each label must be paired with the feature values *as
they were at that moment* — not today's values. Using a feature computed after the
event leaks the future and inflates offline metrics. Feature stores handle these
point-in-time joins for you, which is a big reason they exist.

## 🔗 Connecting the dots — the real stack

The open-source standard is **Feast**; managed options are **Tecton** and the **Databricks / SageMaker / Vertex** feature stores. Under the hood the **offline store** is Delta / BigQuery / Parquet (for training) and the **online store** is a low-latency key-value store like **Redis** or **DynamoDB** (for serving).

**How you'd say it:** *"We defined features once in Feast; training read the offline store from Delta and the real-time service read the same definitions from Redis — so there was no train/serve skew."*

## Self-check

- What is train/serve skew? *(features computed differently in training vs production,
  so the model sees mismatched inputs.)*
- How does a feature store prevent it? *(define the feature once, serve the same
  definition to both offline training and online serving.)*
- Why does point-in-time correctness matter? *(pairing a label with future feature
  values leaks the future and inflates offline metrics.)*
