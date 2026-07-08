# AWS / GCP / Azure ML Stacks

**TL;DR:** All three clouds give you the same building blocks — object storage, GPU
compute, and a managed ML platform that handles training, deployment, and monitoring.
Know the flagship platform names and the shared primitives; don't memorize every service.

## The managed ML platforms

Each cloud has one umbrella platform that covers the ML lifecycle end to end:

| Cloud | ML platform | Object storage | Data warehouse |
|---|---|---|---|
| **AWS** | **SageMaker** | S3 | Redshift |
| **GCP** | **Vertex AI** | GCS | BigQuery |
| **Azure** | **Azure ML** | Blob Storage | Synapse |

These platforms give you managed **training jobs** (spin up GPUs, run, tear down),
**hosted endpoints** (deploy a model behind an autoscaling API), a **model registry**,
**pipelines**, and **monitoring** — i.e. much of sections 4–6 as a service. The pitch is
that you get MLOps plumbing without building it yourself; the trade-off is cost and some
lock-in.

## The primitives underneath

Strip away the branding and every cloud offers the same core resources:

- **Object storage** (S3/GCS/Blob) — cheap, near-infinite storage for datasets, models,
  artifacts. The default home for ML data.
- **Compute** — VMs, and crucially **GPU/accelerator instances** for training and heavy
  inference; also **spot/preemptible** instances at a steep discount for
  interruptible jobs.
- **Managed databases / warehouses** — for structured data and features.
- **Serverless** (Lambda/Cloud Functions) — for lightweight glue and event-driven steps.

## Build vs buy

A recurring judgment call: use the managed platform (fast, less ops, more cost/lock-in)
or assemble open-source tools yourself on raw compute (more control, more work). The
sensible default for most teams is *"use the managed platform to move fast, drop to
custom infra only where you have a specific need it can't meet."* Being able to reason
about this trade-off is more valuable than knowing every service name.

## 🔗 Connecting the dots — the real stack

Beyond the three clouds, **Databricks** is the cross-cloud **lakehouse** ML platform (Delta + Unity Catalog + **MLflow**, which it created). The recurring build-vs-buy choice is managed platform (SageMaker / Vertex / Databricks) versus assembling open source (**MLflow + Feast + Kubeflow + KServe + Evidently**) on raw compute.

**How you'd say it:** *"On a lakehouse I lean on Databricks + MLflow end to end; on raw cloud I assemble MLflow, Feast, KServe, and Evidently myself — same lifecycle, more control."*

## Self-check

- Name the flagship ML platform on each cloud. *(SageMaker, Vertex AI, Azure ML.)*
- What are the shared primitives every cloud provides for ML? *(object storage, GPU
  compute, managed ML platform, warehouses.)*
- What are spot/preemptible instances good for? *(cheap compute for interruptible jobs
  like training or batch — big discount, can be reclaimed.)*
