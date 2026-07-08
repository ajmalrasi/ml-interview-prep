# Rapid Q&A

Tap a question to reveal the answer. Hide all and quiz yourself top to bottom.

## Foundations

**Q: Walk through the ML lifecycle.** Frame the problem → collect data → preprocess &
engineer features → train → evaluate → deploy → monitor → retrain. It's a loop because the
world drifts.

**Q: Overfitting vs underfitting?** Overfitting = great on training, poor on new data (high
variance); underfitting = poor on both (high bias). Fix overfitting with more data /
regularization / simpler model; fix underfitting with a more expressive model or better
features.

**Q: Best default model for tabular data, and when do you switch to deep learning?** Gradient
boosting (XGBoost/LightGBM). Switch to deep learning for unstructured data (images, text) or
very large datasets.

**Q: Precision vs recall — when each?** Precision when false positives are costly; recall when
misses are costly. F1 or PR-AUC when classes are imbalanced. Accuracy is misleading under
imbalance.

**Q: Bagging vs boosting?** Bagging = parallel trees averaged to cut variance (Random Forest);
boosting = sequential trees each fixing the last's errors to cut bias (XGBoost).

## Data & experimentation

**Q: What is data leakage?** Training on information unavailable at prediction time (e.g.
fitting the scaler on all data before splitting, or a feature that's a proxy for the label).
It inflates offline metrics and fails in production.

**Q: Why three data splits, not two?** Train to fit, validation to tune/choose, test opened
once for an honest estimate — because tuning and reporting on the same set makes the score
optimistic.

**Q: How do you split time-series data?** By time — train on the past, test on the future. A
random split leaks the future into training.

**Q: What is train/serve skew and how does a feature store fix it?** Features computed
differently in training vs serving, so the model sees mismatched inputs. A feature store
defines each feature once and serves it to both, keeping them identical.

**Q: Batch vs streaming — how do you choose?** By required freshness. Default to batch
(simpler, cheaper); use streaming only when you need sub-minute freshness.

**Q: Why A/B test if offline metrics improved?** Offline gains don't guarantee business
impact; only live users prove it. Check statistical significance, adequate sample/duration,
and guardrail metrics.

## MLOps & serving

**Q: What does MLOps add over DevOps?** It versions, tests, deploys, and monitors code + data
+ model (not just code), and adds continuous training — because models decay silently.

**Q: Three serving patterns?** Batch (scheduled, bulk), online/real-time (per request, low
latency), streaming (per event, continuous). Choose by latency need.

**Q: Why containerize a model?** To bundle the exact environment so it runs identically
everywhere — no "works on my machine."

**Q: What does a model registry give you?** Versioning, staged promotion (staging →
production), metadata, and instant rollback to a previous version.

**Q: Name safe rollout strategies.** Canary (small traffic slice first), blue-green (switch
between two, revert instantly), shadow (run on real traffic without using the output).

## Monitoring & reliability

**Q: Why is monitoring different for ML?** Models fail silently — they keep returning
confident but increasingly wrong predictions with no error thrown.

**Q: Data drift vs concept drift?** Data drift = input distribution changes; concept drift =
the input→output relationship changes. Covariate drift often means retrain; concept drift
means the problem itself changed.

**Q: How do you detect drift without labels?** Compare live input/prediction distributions to
a training baseline (PSI, KL divergence, KS test); compute real accuracy later as labels
arrive.

**Q: When do you retrain?** On a schedule as a floor, plus drift/performance triggers — and
always gate on the new model beating production on a fresh holdout before promoting.

## Cloud, optimization, scaling

**Q: Name the flagship ML platform on each cloud.** AWS SageMaker, GCP Vertex AI, Azure ML.

**Q: What does Kubernetes give a model service?** Scaling, self-healing, rolling updates/
rollback, and load balancing across a cluster.

**Q: How do you train cheaply on GPUs?** Spot/preemptible instances with checkpointing, right-
sizing, mixed precision, and tearing down idle instances.

**Q: Quantization vs pruning vs distillation?** Quantization = lower-precision numbers; pruning
= remove unimportant weights; distillation = train a small student to mimic a big teacher.

**Q: Data vs model parallelism?** Data parallelism replicates the model and splits the data
(average gradients); model parallelism splits the model itself across GPUs when it doesn't
fit.

**Q: Latency vs throughput, and how does batching relate?** Latency = one prediction's speed;
throughput = predictions/sec. Batching raises throughput but can add latency.

## Generative AI

**Q: What are LLMs trained to do?** Predict the next token over massive text; attention lets
them weigh all token relationships in parallel, which is why they scale.

**Q: RAG vs fine-tuning — which for what?** RAG adds knowledge (your private/fresh facts,
reduces hallucination); fine-tuning changes behavior/style. Don't fine-tune to inject facts.

**Q: How does RAG work?** Index documents as embeddings in a vector DB → retrieve chunks
similar to the query → put them in the prompt so the model answers grounded in them.

**Q: What is LoRA?** A parameter-efficient fine-tuning method: freeze the base model, train
tiny low-rank adapters (<1% of params) — cheap and swappable per task.

**Q: Why is evaluating LLM output hard, and one approach?** Usually no single correct answer;
use human eval, LLM-as-judge, or task-specific checks like groundedness for RAG.

## System design

**Q: First move in an ML system design question?** Clarify requirements — scope, scale,
latency, success metric — before designing anything.

**Q: What is the two-stage pattern?** Cheap candidate generation narrows millions of items to
hundreds (high recall), then an expensive ranking model orders those — because you can't
score millions in real time.

**Q: Two recommender gotchas?** Cold start (no history for new users/items → popularity/
content fallback) and feedback loops (popular items self-reinforce → add exploration).

→ Done — if these felt easy, you're ready. Skim the cheat sheet last.
