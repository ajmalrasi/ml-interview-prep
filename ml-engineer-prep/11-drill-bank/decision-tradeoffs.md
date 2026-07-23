# Decision Tradeoffs: "Why X over Y"

**TL;DR:** Interviewers rarely ask "what is X" — they ask *"X or Y, and why?"* The strong
answer always names the **one axis the decision turns on**, picks the **simpler/cheaper
option by default**, and states the **failure mode of the wrong pick**. This page is every
canonical head-to-head in the pack, compressed to that shape. Master the *axis*, not the
memorized verdict.

## The universal template

Any "X vs Y" question answers in three beats:

1. **The deciding axis** — *"This comes down to «latency / data size / freshness / cost / how much labeled data I have»."*
2. **The rule + default** — *"I default to «the simpler one» and only reach for «the complex one» when «the axis» demands it."*
3. **The wrong-pick cost** — *"Pick the other one and you pay «the specific failure»."*

Say the axis out loud *before* the verdict. That's what separates "I memorized the answer"
from "I understand the tradeoff."

## Modeling

- **Gradient boosting vs deep learning** — *Axis: data type.* Tabular/structured → boosting
  (XGBoost/LightGBM): more accurate, less tuning, no scaling, trains on a CPU. Unstructured
  (images, text, audio) or huge data → deep learning. *Wrong pick:* a neural net on a 50k-row
  table — slower, worse, and harder to explain than one XGBoost line.
- **Bagging vs boosting** — *Axis: is your error variance or bias?* Bagging (Random Forest) =
  parallel trees averaged → cuts **variance**, robust, little tuning. Boosting = sequential
  trees fixing prior errors → cuts **bias**, top accuracy, careful tuning. *Wrong pick:*
  over-pushed boosting overfits; a forest plateaus below what boosting could reach.
- **L1 vs L2 regularization** — *Axis: do you want feature selection?* L1 (Lasso) drives
  weights to exactly zero → sparse, built-in selection. L2 (Ridge) shrinks smoothly → keeps
  all features, handles correlated ones better. *Tie-breaker:* ElasticNet blends both.
- **More layers/params vs more data** — *Axis: are you underfitting or overfitting?* Underfit
  (poor on both train and test) → more capacity/features. Overfit (great train, poor test) →
  more data, regularization, simpler model. *Wrong pick:* adding capacity to an overfit model
  makes it worse.

## Metrics

- **Precision vs recall** — *Axis: which error is costlier?* Precision when false positives
  hurt (spam filter eating real mail). Recall when misses hurt (cancer screening, fraud).
  *Wrong pick:* optimizing precision on a cancer detector quietly ships false negatives.
- **Accuracy vs F1/PR-AUC** — *Axis: class balance.* Balanced → accuracy is fine. Imbalanced
  → accuracy lies (99% by always predicting "no"); use F1 or PR-AUC. *Say this:* "Accuracy is
  the first metric to distrust under imbalance."
- **ROC-AUC vs PR-AUC** — *Axis: how rare is the positive class?* Heavy imbalance (fraud at
  0.1%) → PR-AUC, because ROC-AUC looks flatteringly high when true negatives dominate.
- **Offline metric vs business metric** — *Axis: none — you need both.* Offline (AUC, RMSE)
  gates what ships; the business metric (revenue, retention) is the real target. *Wrong pick:*
  shipping on offline gains alone → the A/B test shows no lift (see Experimentation).

## Data

- **Data lake vs warehouse vs lakehouse** — *Axis: schema-on-read vs schema-on-write.* Lake =
  raw, cheap, any format, schema-on-read (great for ML/exploration). Warehouse = clean,
  structured, schema-on-write, fast SQL (great for BI). Lakehouse (Databricks/Delta) = one
  system for both. *Wrong pick:* forcing raw sensor data into a warehouse schema up front
  throws away signal you didn't know you needed.
- **Batch vs streaming (data)** — *Axis: required freshness.* Default batch — simpler,
  cheaper, easy to backfill. Streaming only when you need sub-minute freshness (fraud, live
  personalization). *Wrong pick:* standing up Kafka+Flink for a nightly report burns
  complexity for zero business value.
- **Normalization vs standardization** — *Axis: distribution + model.* Standardize (zero mean,
  unit variance) for roughly-Gaussian features and distance/gradient models. Min-max normalize
  for bounded ranges (images to 0–1). *Note:* trees need neither.
- **Oversample vs undersample vs class weights** — *Axis: how much data you can spare.* Lots of
  data → undersample the majority. Scarce data → oversample/SMOTE the minority. Simplest first
  → class weights in the loss. *Wrong pick:* oversampling *before* the train/test split leaks
  duplicates across the split and inflates your score.
- **Build vs buy a feature store** — *Axis: train/serve skew risk × team size.* The value is
  defining a feature *once* and serving it to both training and inference, killing skew. Buy
  (Feast/Tecton) when many models share features; skip it for one model with simple features.

## Experimentation

- **Grid vs random vs Bayesian search** — *Axis: how expensive is one training run?* Cheap runs
  / few params → grid. Many params → random (finds good regions faster). Expensive runs (deep
  nets) → Bayesian (Optuna) to spend trials wisely. *Wrong pick:* grid search over 6
  hyperparameters is exponential and wasteful.
- **Holdout vs k-fold CV** — *Axis: dataset size.* Big data → a single holdout is enough and
  cheap. Small data → k-fold for a stable estimate. *Wrong pick:* one small holdout gives a
  noisy, lucky-or-unlucky number.
- **A/B test vs offline eval** — *Axis: do you need proof of real-world impact?* Offline gates
  candidates cheaply; the A/B test is the only thing that proves business lift on live users.
  *Wrong pick:* trusting offline lift → you ship a model users quietly hate. Watch
  significance, sample size/duration, and guardrail metrics.

## MLOps & serving

- **Batch vs online vs streaming serving** — *Axis: when is the prediction needed?* Later/in
  bulk → batch (cheapest, no always-on service). Per user request, now → online API. Per event,
  continuously → streaming. *Default:* if a nightly table satisfies the product, don't build a
  real-time service.
- **REST vs gRPC** — *Axis: latency + who calls it.* REST/JSON for public, browser-facing,
  easy-to-debug endpoints. gRPC (binary, HTTP/2) for internal, high-throughput,
  service-to-service and streaming — lower latency and payload. 
- **FastAPI vs a dedicated model server** — *Axis: GPU + throughput needs.* FastAPI/BentoML for
  a simple CPU model or glue logic. Triton/TorchServe/TF-Serving when you need GPU **dynamic
  batching**, multi-model, and high throughput. LLMs → vLLM/TGI specifically (paged-attention
  batching). *Wrong pick:* a raw FastAPI loop wastes the GPU by serving one request at a time.
- **Canary vs blue-green vs shadow** — *Axis: what risk are you buying down?* Canary = small
  traffic slice first (catch bad models on few users). Blue-green = two full envs, instant
  switch/rollback (minimize downtime). Shadow = run on real traffic but *don't* use the output
  (validate safely, zero user risk). Often shadow → canary → full.
- **Registry vs versioned files in a bucket** — *Axis: do you need staged promotion + audit?* A
  registry (MLflow/Unity) adds staging→prod promotion, lineage, and one-click rollback. Files
  in S3 work for a solo experiment but give you no promotion story or audit trail.

## Monitoring

- **Data drift vs concept drift** — *Axis: what changed?* Data/covariate drift = the **inputs**
  shift (new user mix) → often a retrain fixes it. Concept drift = the **input→output
  relationship** shifts (fraud tactics change) → the problem itself moved; retraining on old
  labels won't save you. *Wrong pick:* treating concept drift as data drift → you retrain and
  still degrade.
- **PSI vs KL vs KS for drift** — *Axis: feature type + what you have.* All compare live vs a
  training baseline **without labels**. PSI = a simple, thresholded bucketed score (industry
  default). KL = information-theoretic divergence. KS = distance for continuous distributions.
  Real accuracy comes later, once labels land.
- **Schedule vs trigger retraining** — *Axis: predictable decay vs event-driven.* Schedule =
  a floor (nightly/weekly). Drift/perf **trigger** = react when it actually degrades. Do both,
  and always **gate**: promote only if the new model beats production on a fresh holdout.

## Cloud & optimization

- **Managed platform vs DIY on Kubernetes** — *Axis: control vs ops burden.* SageMaker/Vertex =
  fast, less to run, some lock-in. Self-managed K8s (KServe/Kubeflow) = full control and
  portability, more to operate. *Default:* start managed; go DIY when cost or flexibility
  forces it.
- **Spot/preemptible vs on-demand** — *Axis: is the work interruptible?* Spot (50–90% cheaper)
  for fault-tolerant training **with checkpointing**. On-demand for latency-critical serving
  that can't vanish mid-request. *Wrong pick:* spot for a live endpoint → it disappears under
  load.
- **Data vs model vs pipeline parallelism** — *Axis: does the model fit on one GPU?* Fits →
  **data parallelism** (replicate, split the batch, average gradients) — the default. Too big
  → model/tensor parallelism (split the model) or pipeline parallelism (split by layer stage).
  *Say this:* "Data parallelism first; model parallelism only when a single GPU can't hold the
  weights."
- **Quantization vs pruning vs distillation** — *Axis: how you're shrinking.* Quantization =
  lower-precision numbers (FP16/INT8), biggest win for least effort → try first. Pruning =
  drop unimportant weights. Distillation = train a small student to mimic a big teacher.
  Order: quantize → prune → distill.
- **CPU vs GPU inference** — *Axis: model size × QPS.* Small models / low traffic → CPU is
  cheaper and simpler. Large models or high throughput with batching → GPU. *Wrong pick:*
  a GPU serving 3 requests/sec is money on fire.
- **Latency vs throughput** — *Axis: you're usually trading them.* Latency = one prediction's
  speed (user-facing SLA). Throughput = predictions/sec (cost efficiency). Batching *raises
  throughput but adds latency* — tune the batch window to your p99 budget. **Profile before
  optimizing; attack the biggest number.**

## Generative AI

- **Prompt vs RAG vs fine-tune** — *Axis: what's actually missing?* Prompt first (free,
  instant). Missing **knowledge/your data** → RAG (grounds answers, cuts hallucination,
  updates by re-indexing). Wrong **behavior/format/tone** that no prompt fixes → fine-tune.
  *Wrong pick — the classic:* fine-tuning to inject facts. RAG is cheaper and right for facts.
- **Full fine-tune vs LoRA/PEFT** — *Axis: budget × how many tasks.* LoRA trains <1% of params
  → cheap, fast, swappable adapters per task, tiny artifacts. Full fine-tune only when you have
  the data/compute and need to move the whole model. *Default:* LoRA.
- **Closed API vs open self-hosted LLM** — *Axis: control/privacy/cost-at-scale vs
  time-to-market.* API (GPT/Claude) = best quality, zero ops, per-token cost, data leaves your
  walls. Self-hosted (Llama/Mistral on vLLM) = data stays in, cheaper at high volume,
  customizable, but you run the GPUs. *Axis for regulated/on-prem work:* privacy usually
  forces self-hosting.
- **Bigger context vs RAG** — *Axis: cost + relevance.* Stuffing everything into a huge context
  is simple but expensive and dilutes attention. RAG retrieves only what's relevant → cheaper,
  sharper, and cites sources. *Wrong pick:* paying for 100k tokens when top-5 chunks would do.

## How you'd say it

*"For almost every one of these I start from the axis the decision turns on, default to the
simpler and cheaper option — batch over streaming, boosting over deep nets on tables, prompt
before RAG before fine-tuning — and only add complexity when the requirement forces it. Then I
name what the wrong pick actually costs. That framing matters more than any single verdict,
because the numbers change but the axis doesn't."*

## Self-check

- What three beats does every "X vs Y" answer need? *(the deciding axis; the rule + simpler
  default; the wrong-pick failure mode.)*
- RAG vs fine-tuning — the axis and the classic mistake? *(axis = knowledge vs behavior;
  mistake = fine-tuning to add facts.)*
- Data vs model parallelism — the deciding axis? *(does the model fit on one GPU.)*
- Why default to batch serving and undersampling-with-care? *(cheaper/simpler; and oversampling
  before the split leaks duplicates.)*
- Spot vs on-demand — the one word that decides it? *(interruptibility.)*
