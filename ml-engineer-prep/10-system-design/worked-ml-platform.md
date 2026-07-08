# Worked Example: ML Platform

**TL;DR:** Sometimes the design question is *infrastructure*, not a single model: "design a
platform so our data scientists can train, deploy, and monitor many models." The answer is
essentially the whole MLOps stack from sections 2–7, assembled into a self-serve system.

## What's being asked

Not "build one model" but "build the paved road many models run on." The goal is to let
teams go from idea to production **fast, safely, and repeatably**, without each team
reinventing pipelines, serving, and monitoring. This tests whether you see the big picture.

## The components (walk the lifecycle)

```
Data layer      → ingestion, storage (lake/warehouse), FEATURE STORE (shared features)
Experiment layer→ notebooks/compute, EXPERIMENT TRACKING, data versioning
Training layer  → scalable training (K8s/managed), pipelines, HPO
Registry        → MODEL REGISTRY (versioned, staged promotion)
Serving layer   → batch + online serving, autoscaling, canary rollout
Monitoring layer→ drift, data quality, ops metrics, alerting, retraining triggers
Cross-cutting   → CI/CD/CT automation, IaC, access control, cost tracking
```

Each box maps to a section here: feature store (§2), tracking (§4), registry & CI/CD (§5),
monitoring (§6), infra (§7). The platform is those pieces integrated into a **self-serve**
workflow.

## The design principles to voice

- **Self-serve & standardized** — a data scientist should deploy via a paved path, not a
  ticket to the infra team. Standard templates beat bespoke setups.
- **Reproducible** — versioned data, code, and models; anything in production can be
  recreated.
- **Observable** — every model is monitored by default, not as an afterthought.
- **Modular** — teams can swap a component (a different model server) without rebuilding
  everything.
- **Build vs buy** — lean on managed platforms (SageMaker/Vertex) or open source (MLflow,
  Kubeflow, Feast) rather than hand-building all of it; justify where you'd customize.

## The trade-offs to name

Flexibility vs standardization (too rigid and teams route around it; too flexible and it's
chaos), build vs buy (control vs speed), and cost vs capability. A good answer explicitly
picks a point on each and says why.

## 🔗 Connecting the dots — the real stack

The platform *is* a named toolchain. Open-source assembly: **Feast** (features) + **MLflow** (tracking/registry) + **Kubeflow** (pipelines) + **KServe** (serving) + **Evidently** (monitoring) + **Airflow** (orchestration) + **Terraform** (infra), on **Kubernetes**. Managed equivalent: **Databricks** or **SageMaker / Vertex** covering the same boxes end to end.

| Platform layer | Open source | Managed |
|---|---|---|
| Feature store | Feast | SageMaker / Vertex / Databricks FS |
| Tracking + registry | MLflow | SageMaker / Vertex / Unity Catalog |
| Pipelines / CT | Kubeflow, Airflow | Vertex / SageMaker Pipelines |
| Serving | KServe / Seldon | SageMaker / Vertex endpoints |
| Monitoring | Evidently + Prometheus | Model Monitor |

**How you'd say it:** *"The paved road was Feast, MLflow, Kubeflow, KServe, and Evidently on GKE, wired by Terraform — so a data scientist went from notebook to a monitored, canaried endpoint without touching infra."*

## Self-check

- What is an ML platform *for*? *(a self-serve paved road so many teams train, deploy, and
  monitor models fast, safely, and reproducibly.)*
- Name four layers it needs. *(data/feature store, experiment tracking, training, registry,
  serving, monitoring — any four.)*
- One key design principle? *(self-serve/standardized, reproducible, observable-by-default,
  modular — any one.)*
