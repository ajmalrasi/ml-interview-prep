# 7: Cloud & Infra

**TL;DR:** Modern ML runs on the cloud, so you should know what the big three (AWS, GCP,
Azure) offer for ML, how **containers and Kubernetes** run your models at scale, and how
**infrastructure-as-code** and **cost control** keep it all manageable. You don't need
deep expertise in all three clouds — you need the concepts and the vocabulary.

## Why this section

The JD is "ML on the cloud." Interviewers want to know you can operate in a cloud
environment: pick the right managed service, containerize and orchestrate, provision GPUs
without setting money on fire, and reason about cost and scale. This is the infrastructure
layer under everything in sections 5–6.

## The four pages

- **AWS / GCP / Azure ML stacks** — the managed ML platforms and the building blocks
  (compute, storage) they share.
- **Containers, Kubernetes & Kubeflow** — how models are packaged and orchestrated at
  scale.
- **GPU Kubernetes operations** — device plugins, GPU Operator, scheduling, Helm,
  MIG, autoscaling, and DCGM observability.
- **IaC, GPUs & cost control** — reproducible infra and not overspending on compute.

## The shared mental model

Every cloud gives you the same primitives under different names: **compute** (VMs, GPUs),
**storage** (object stores), **a managed ML platform** (train + deploy + monitor), and
**orchestration** (Kubernetes). Learn the pattern once and the vendor names are just
translation.

→ Start: **[cloud-ml-stacks.md](cloud-ml-stacks.md)**
