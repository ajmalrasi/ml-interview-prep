# Containers, Kubernetes & Kubeflow

**TL;DR:** Containers package a model with its environment; **Kubernetes** runs and
scales many containers across a cluster; **Kubeflow/KServe** add ML-specific serving and
pipelines on top. This is how model services scale, self-heal, and stay portable across
clouds.

## Containers recap

A **container** (Docker) bundles your model + code + dependencies into one portable,
immutable image (section 5). That solves "runs on my machine" but a single container
doesn't handle *scale* — many replicas, failover, rolling updates. That's Kubernetes' job.

## What Kubernetes does

**Kubernetes (K8s)** is an orchestrator that runs containers across a cluster of machines
and automates the operational hard parts:

- **Scaling** — run N replicas of your model service and add/remove them with load
  (autoscaling).
- **Self-healing** — restart crashed containers, reschedule them off dead nodes.
- **Rolling updates & rollback** — deploy a new version gradually, revert if it's bad.
- **Load balancing & service discovery** — spread traffic across replicas.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">traffic</span>
    <span class="arw"></span>
    <span class="node">load balancer</span>
    <span class="merge-arw"></span>
    <div class="lane-stack">
      <span class="node soft">replica<span class="nsub">node 1</span></span>
      <span class="node soft">replica<span class="nsub">node 2</span></span>
      <span class="node soft">replica<span class="nsub">node 3 …×5</span></span>
    </div>
  </div>
  <div class="flow-foot">K8s spreads <b>5 replicas</b> of your model service across nodes; a dead replica is <b>auto-replaced</b>.</div>
</div>
```

For an ML engineer, K8s is *why* an online model service can handle real traffic reliably
— it turns "a container" into "a resilient, scalable service." You don't need to be a K8s
expert, but you should know what it gives you and why it's everywhere.

## Kubeflow and KServe (ML on top of K8s)

- **Kubeflow** — a toolkit for running ML **pipelines** and workloads on Kubernetes
  (training jobs, workflows).
- **KServe** (and Seldon) — model **serving** on K8s with niceties like autoscaling
  (including scale-to-zero), canary rollout, and multi-framework support out of the box.

These exist so you don't hand-build ML serving/pipeline features on raw K8s.

## When you *don't* need K8s

Judgment point: K8s is powerful but heavy. For a small deployment, a managed endpoint
(SageMaker/Vertex) or a serverless container is simpler. Reach for Kubernetes when you
need fine control, multi-service orchestration, portability across clouds, or you're
already running it. "Right-size the infrastructure" is a mature thing to say.

## 🔗 Connecting the dots: the real stack

The stack is **Docker** images on **Kubernetes**, with **Kubeflow** for ML pipelines and **KServe** or **Seldon** for model serving (autoscaling, canary, scale-to-zero); **Ray** also runs on K8s for distributed train/serve. Managed K8s is **EKS / GKE / AKS**.

**How you'd say it:** *"Models ran as Docker images on GKE, served by KServe for autoscaling and canaries, with Kubeflow Pipelines handling retraining."*

## Self-check

- What does Kubernetes add over a lone container? *(scaling, self-healing, rolling
  updates/rollback, load balancing across a cluster.)*
- What do Kubeflow and KServe add on top of K8s? *(ML pipelines and ML-aware model
  serving — autoscaling, canary, multi-framework.)*
- When might you skip K8s? *(small deployments — a managed endpoint or serverless is
  simpler.)*
