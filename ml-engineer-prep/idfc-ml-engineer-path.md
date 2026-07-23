# IDFC ML Engineer: 2-Day Path

**TL;DR:** This interview spans ML fundamentals, LLM training, GPU/distributed computing,
data systems, and production MLOps. The fastest preparation strategy is breadth first, then
one end-to-end system-design story that connects the layers.

## How to use this path

- Spend more time explaining trade-offs aloud than rereading definitions.
- At the end of each block, write a five-line design or debugging answer from memory.
- Links marked **RAG site** reuse the deeper LLM-serving lessons instead of duplicating them.

## Day 1: Models, frameworks, and distributed training

### Block 1: ML judgment: 90 minutes

1. [ML Foundations](01-ml-foundations/README.md)
2. [Evaluation Metrics](01-ml-foundations/metrics.md)
3. [Classical ML](03-model-development/classical-ml.md)
4. [Validation & Data Splits](04-experimentation/validation-splits.md)

**Exit test:** select a model, split strategy, and metric for imbalanced fraud detection
with time-dependent labels. Name the leakage risks.

### Block 2: Deep learning and framework fluency: 90 minutes

1. [Deep Learning Essentials](03-model-development/deep-learning.md)
2. [PyTorch, TensorFlow & Keras in Practice](03-model-development/frameworks-in-practice.md)
3. [Transformers & How LLMs Work](09-generative-ai-llms/transformers-and-llms.md)
4. [Fine-Tuning & PEFT](09-generative-ai-llms/fine-tuning.md)

**Exit test:** sketch a safe fine-tuning loop with mixed precision, gradient accumulation,
checkpointing, validation, experiment tracking, and recovery from OOM.

### Block 3: Scale training across GPUs: 2 hours

1. [Training at Scale](03-model-development/training-at-scale.md)
2. [Distributed Training](08-optimization-scaling/distributed-training.md)
3. [NCCL & Distributed Collectives](08-optimization-scaling/nccl-collectives.md)
4. [GPU Performance & Profiling](12-nvidia-model-optimization/gpu-performance.md)

**Exit test:** compare DDP, FSDP/ZeRO, tensor parallelism, and pipeline parallelism. Diagnose
a job whose step time doubles when scaling from four to eight GPUs.

### Block 4: LLM inference bridge: 75 minutes

1. [Prefill, Decode & Chunked Scheduling — RAG site](http://192.168.3.20:9001/#15-llm-serving-internals/prefill-decode-scheduling.md)
2. [KV Cache — RAG site](http://192.168.3.20:9001/#15-llm-serving-internals/kv-cache.md)
3. [vLLM in Production — RAG site](http://192.168.3.20:9001/#15-llm-serving-internals/vllm-production.md)

## Day 2: Data, MLOps, cloud, and system design

### Block 5: Large-scale data pipelines: 90 minutes

1. [Data Pipelines overview](02-data-pipelines/README.md)
2. [Spark & Hadoop at Scale](02-data-pipelines/spark-hadoop-at-scale.md)
3. [Preprocessing & Data Quality](02-data-pipelines/preprocessing-and-quality.md)
4. [Feature Stores](02-data-pipelines/feature-stores.md)

**Exit test:** debug a Spark feature job with skewed joins, executor OOMs, too many small
files, and train/serve skew.

### Block 6: Production MLOps: 2 hours

1. [Experiment Tracking](04-experimentation/experiment-tracking.md)
2. [Packaging, Registry & Versioning](05-mlops-serving/packaging-and-registry.md)
3. [CI/CD for ML](05-mlops-serving/cicd-for-ml.md)
4. [Drift & Data-Quality Monitoring](06-monitoring-reliability/drift-and-quality.md)
5. [Retraining Loops](06-monitoring-reliability/retraining-loops.md)

**Exit test:** describe the path from a Git commit and data snapshot to a canary model,
automatic rollback, lineage in MLflow, and a controlled retraining trigger.

### Block 7: Cloud and Kubernetes: 90 minutes

1. [AWS / GCP / Azure ML Stacks](07-cloud-infra/cloud-ml-stacks.md)
2. [Containers, Kubernetes & Kubeflow](07-cloud-infra/containers-k8s.md)
3. [GPU Kubernetes Operations](07-cloud-infra/gpu-kubernetes-operations.md)
4. [IaC, GPUs & Cost Control](07-cloud-infra/iac-and-cost.md)

### Block 8: System design and rapid fire: 2 hours

1. [ML System Design Framework](10-system-design/framework.md)
2. [Worked ML Platform](10-system-design/worked-ml-platform.md)
3. [Worked Data-Loading Library](10-system-design/worked-data-loader-library.md)
4. [Decision Tradeoffs](11-drill-bank/decision-tradeoffs.md)
5. [Rapid Q&A](11-drill-bank/drill-bank.md)

## Final rehearsal prompt

> Design a platform that trains and serves a BERT-class model over a large banking dataset.
> Cover ingestion, Spark processing, data/version lineage, distributed GPU training,
> evaluation, registry, Kubernetes deployment, monitoring, rollback, and cost controls.

Answer in this order: **requirements → data → training → serving → reliability → security →
cost → measurement**. Make assumptions explicit before naming tools.
