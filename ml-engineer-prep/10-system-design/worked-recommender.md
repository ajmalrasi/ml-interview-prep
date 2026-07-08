# Worked Example: Recommender

**TL;DR:** "Design a recommendation system" walked through the framework. The headline
answer is the **two-stage** design (candidate generation → ranking) plus honest handling of
the classic gotchas: cold start, feedback loops, and freshness.

## 1. Clarify

Ask: recommend *what* (products, videos, posts) and *where* (homepage, "related items")?
Scale (how many users/items)? Latency (must render in ~100ms)? Success metric (clicks,
watch time, purchases, retention)? Assume: recommend products on the homepage, millions of
items, real-time, optimize for purchases with click-through as a proxy.

## 2. Frame as ML

Predict, for a (user, item) pair, the probability the user engages (clicks/buys), then rank
items by that score. Offline metric: AUC or a ranking metric (NDCG); online metric:
click-through and purchase rate via A/B test.

## 3. Data & features

- **User features** — history, demographics, recent activity/session context.
- **Item features** — category, price, popularity, embeddings.
- **Interaction data** — the clicks/purchases that are your labels (implicit feedback).
- Serve these via a **feature store** so training and real-time serving agree (section 2).

## 4. Model — the two-stage design

You can't score millions of items per request in 100ms, so split it:

```
all items (millions)
  → CANDIDATE GENERATION: cheap retrieval → ~hundreds of plausible items
      (embedding similarity / collaborative filtering / "users like you bought")
  → RANKING: a stronger model (gradient boosting or a neural ranker) scores those
      few hundred with rich features → top-N ordered list → user
```

Candidate generation optimizes **recall** (don't miss good items) and speed; ranking
optimizes **precision/order** with an expensive model on a small set. This split is the
core insight of the whole answer.

## 5. Serving

Precompute item embeddings offline; do candidate retrieval with a **vector/ANN index**
(approximate nearest neighbor) for speed; run ranking online behind a low-latency service;
**cache** where possible. Fresh signals (this session's clicks) feed in real time.

## 6. The classic gotchas (raise these unprompted)

- **Cold start** — new users/items have no history. Fall back to popularity, content-based
  features, or ask for a few preferences. Naming cold start scores big.
- **Feedback loop** — recommending only popular items makes them more popular forever;
  inject **exploration** (some diverse/random items) to keep learning (section 6).
- **Freshness** — trends and new items matter; blend real-time signals and re-index often.
- **Bias & diversity** — avoid filter bubbles; sometimes optimize for diversity, not just
  predicted clicks.

## 7. Monitor

A/B test the online metric, watch drift and engagement over time, and retrain regularly as
tastes shift.

## 🔗 Connecting the dots — the real stack

Concrete pieces: candidate generation is a **two-tower** embedding model with an **ANN index** (**FAISS**, **ScaNN**, or **Vespa** / a vector DB); features come from a **feature store** (Feast); ranking is **XGBoost** or a neural ranker (**DLRM**); serving is **Triton / KServe**; freshness flows through **Kafka**. Everything is tracked in **MLflow** and A/B tested via **Statsig**.

**How you'd say it:** *"Candidate gen was a two-tower model served from a FAISS index, ranking was XGBoost on feature-store features via KServe, and new models shipped behind a Statsig A/B with exploration traffic to avoid feedback loops."*

## Self-check

- Why two stages instead of one model over all items? *(can't score millions in real time;
  cheap recall then expensive ranking on a small set.)*
- What is cold start and one fix? *(no history for new users/items; use popularity/content
  features or ask preferences.)*
- Why add exploration? *(to break the feedback loop where popular items self-reinforce.)*
