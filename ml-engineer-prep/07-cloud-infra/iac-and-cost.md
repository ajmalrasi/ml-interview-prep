# IaC, GPUs & Cost Control

**TL;DR:** Infrastructure-as-code (Terraform) makes your cloud setup reproducible and
reviewable instead of hand-clicked and forgotten. And because GPUs and always-on
endpoints are expensive, cost control — right-sizing, spot instances, autoscaling,
batching — is a real part of the job.

## Infrastructure as code (IaC)

Instead of clicking around a cloud console to create servers and services, you **declare
your infrastructure in code** (Terraform, CloudFormation, Pulumi) and apply it. Benefits:
it's **version-controlled** (git history of your infra), **reproducible** (spin up an
identical environment in another region or account), **reviewable** (changes go through
PRs), and **less error-prone** than manual clicking. For ML, this means your training
cluster, endpoints, and storage are defined and repeatable, not snowflakes someone set up
once and can't recreate.

## GPUs: the expensive part

Training and heavy inference need GPUs, which are pricey and scarce, so how you use them
matters:

- **Right-size** — don't put a huge GPU on a small model; match the instance to the need.
- **Spot / preemptible instances** — big discounts (often 60–90%) for interruptible
  workloads like training and batch scoring; pair with checkpointing so an interruption
  just resumes.
- **Don't leave GPUs idle** — a forgotten running training instance is pure burned money;
  automate teardown.

## Cost control for serving

An always-on real-time endpoint costs money every hour whether or not it's used:

- **Autoscaling** — scale replicas with traffic; **scale-to-zero** for rarely-used models
  (KServe) so idle costs nothing.
- **Batch over real-time** — if the use case tolerates it, a scheduled batch job is far
  cheaper than a 24/7 endpoint (section 5).
- **Batching requests** — group incoming requests so the GPU processes many at once,
  raising throughput per dollar (section 8).
- **Right-size + cheaper hardware** — CPU or smaller instances for light models; quantized
  models (section 8) that run on less.

## The framing

Cost is an engineering constraint, not an afterthought: *"I treat compute cost like
latency — a number to design against. I default to batch and autoscaling, use spot for
training with checkpointing, and only run always-on GPU endpoints when the product truly
needs real-time."* Cost-awareness signals someone who's run real systems, not just demos.

## 🔗 Connecting the dots: the real stack

Infra-as-code is **Terraform** (or Pulumi / CloudFormation); node autoscaling uses **Karpenter** or the cluster-autoscaler; cost visibility is **Kubecost** or native cloud cost tools. Training runs on **spot / preemptible** instances with checkpointing to object storage.

**How you'd say it:** *"The whole cluster and endpoints were defined in Terraform; training ran on spot nodes via Karpenter with checkpoints to S3, and Kubecost kept the GPU bill honest."*

## Self-check

- Two benefits of infrastructure-as-code? *(reproducible, version-controlled/reviewable,
  less error-prone — any two.)*
- How do you train cheaply on GPUs? *(spot/preemptible instances with checkpointing;
  right-size; tear down when idle.)*
- Two ways to cut serving cost? *(autoscaling/scale-to-zero, prefer batch, batch
  requests, quantize/right-size — any two.)*
