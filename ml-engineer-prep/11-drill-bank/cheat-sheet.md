# One-Page Cheat Sheet

**TL;DR:** The whole pack compressed — key distinctions, decision rules, and "say this"
lines. Skim this last.

## The lifecycle (your answer skeleton)
frame → data → features → train → evaluate → deploy → monitor → retrain. **A loop**, because
of drift. "ML Engineer" = the deploy → monitor → retrain half.

## Modeling
- Tabular → **gradient boosting** (XGBoost). Unstructured/huge → **deep learning**.
- **Bagging** = parallel, cuts variance. **Boosting** = sequential, cuts bias.
- Overfit = great train / poor test → more data, regularization, simpler. Underfit = poor
  both → more expressive, better features.
- Metrics: precision (false positives costly), recall (misses costly), F1/PR-AUC (imbalance).
  Accuracy lies under imbalance. Offline metric ≠ business metric.

## Data
- **Lake** = raw/cheap (schema-on-read); **warehouse** = clean/structured (schema-on-write).
- **Batch** (default: simple, cheap) vs **streaming** (only when freshness demands).
- **Leakage** = train-time use of prediction-time-unavailable info → fit preprocessing on
  train split only.
- **Feature store** kills **train/serve skew**: define a feature once, serve offline+online.

## Experimentation
- 3 splits: train (fit) / validation (tune) / test (once). Time-series → split by time.
- **Track every run** (params, metrics, artifacts, data version) → reproducibility.
- **A/B test** for real impact: significance + sample/duration + guardrails.

## MLOps
- Version **code + data + model**. **Container** for reproducible environment.
- **Registry** = versioning + staged promotion + rollback.
- Rollout: **canary / blue-green / shadow**. CI/CD/**CT** (continuous training).

## Monitoring
- Models fail **silently**. Watch ops (latency p99, errors) + model (drift, quality).
- **Data drift** (inputs shift) vs **concept drift** (relationship shifts). Detect via PSI/KL
  on distributions (no labels needed); real accuracy comes later.
- Retrain: schedule + drift trigger; **gate** on beating production on a holdout.

## Cloud & optimization
- Platforms: **SageMaker / Vertex AI / Azure ML**. Primitives: object storage, GPU compute,
  managed platform, K8s.
- **K8s** = scale + self-heal + rollout. **IaC** (Terraform) = reproducible infra.
- Cheap GPUs: **spot + checkpointing**. Cheap serving: batch, autoscale/scale-to-zero.
- Shrink model: **quantization** (FP16/INT8) → **pruning** → **distillation**.
- Scale training: **data parallelism** (default), model/pipeline parallelism (too big),
  mixed precision.
- Serve fast: **batching**, caching, **TensorRT/ONNX** compile. Profile first.

## Generative AI
- LLM = big transformer, **next-token prediction**; **attention** = weigh all tokens in
  parallel. **Context window** = working memory, drives cost.
- Decision spine: **prompt → RAG (add knowledge) → fine-tune (change behavior)**.
- **RAG** = embed docs → vector DB → retrieve → ground the prompt. Fixes stale facts +
  hallucination.
- **LoRA** = train <1% adapters, cheap + swappable. Fine-tune for *behavior*, not facts.
- LLMOps: cost per token, token-by-token latency, guardrails, hard eval (human /
  LLM-as-judge / groundedness).

## System design
- **Clarify first** (scope, scale, latency, metric). Then: frame → data/features → model →
  serving → monitoring, trading off out loud.
- **Two-stage**: cheap candidate generation → expensive ranking. Baseline first.
- Recommender gotchas: **cold start**, **feedback loops** (add exploration), freshness.

## The three "say this" instincts
1. *"I default to the simpler/cheaper option (batch, small model, prompt) and add complexity
   only when the requirement demands it."*
2. *"I profile to find the real bottleneck and attack the biggest number — I don't guess."*
3. *"A model isn't done at deploy — I monitor for silent decay and retrain, with a quality
   gate and safe rollout."*

## 🔗 Tool map: the production stack at a glance
- **Storage:** lake = S3/GCS + Delta/Iceberg · warehouse = Snowflake/BigQuery · lakehouse = Databricks + Unity Catalog.
- **Pipelines:** batch = Spark/dbt + Airflow · streaming = Kafka + Flink · quality = Great Expectations.
- **Features:** Feast (offline = Delta/BigQuery, online = Redis/DynamoDB).
- **Train:** scikit-learn/XGBoost, PyTorch/HuggingFace · scale = DDP/FSDP/DeepSpeed, Ray · tune = Optuna/Ray Tune.
- **Track/registry:** MLflow, W&B; DVC for data; Unity Catalog for governance.
- **Serve:** FastAPI/BentoML, Triton, KServe/Seldon, SageMaker/Vertex endpoints · LLM = vLLM/TGI.
- **CI/CD/CT:** GitHub Actions + Kubeflow/Vertex Pipelines/Airflow · rollout = KServe/Argo canary.
- **Monitor:** Evidently/Arize + Prometheus/Grafana + Alertmanager; SageMaker Model Monitor.
- **Cloud/infra:** SageMaker/Vertex/Azure ML/Databricks · K8s (EKS/GKE/AKS) · Terraform · spot + Karpenter.
- **Optimize:** TensorRT/ONNX Runtime, bitsandbytes/GGUF (LLM); Triton batching; Redis cache.
- **GenAI/RAG:** LangChain/LlamaIndex · vector DB = Pinecone/Weaviate/Qdrant/pgvector/FAISS · embeddings = BGE/OpenAI · fine-tune = PEFT/LoRA + bitsandbytes/Axolotl · eval = Ragas/LangSmith/Langfuse · guardrails = Guardrails AI/NeMo.
