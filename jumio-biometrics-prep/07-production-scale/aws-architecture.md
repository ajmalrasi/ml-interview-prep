# AWS Training-to-Serving Architecture

**TL;DR:** Separate governed offline training from low-latency online serving, connect
them with immutable artifacts and evaluation gates, and design for regional failure and
privacy from the beginning.

## Offline path

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">S3 governed lake</span>
    <span class="arw"></span>
    <span class="node">Airflow / MWAA<span class="nsub">manifest · quality · split</span></span>
    <span class="arw"></span>
    <span class="node">SageMaker / EC2 GPU<span class="nsub">DDP · checkpoints</span></span>
    <span class="arw"></span>
    <span class="node">evaluation gates<span class="nsub">biometric · fairness · PAD · latency</span></span>
    <span class="arw"></span>
    <span class="node out">signed registry artifact</span>
  </div>
</div>
```

- S3 buckets are encrypted with KMS, versioned and separated by trust boundary.
- IAM roles grant each job only required prefixes/actions.
- Private subnets and VPC endpoints keep training traffic off the public internet.
- Spot instances reduce training cost with regular durable checkpoints.
- CloudTrail and artifact lineage make data/model access auditable.

## Online path

A common design uses an API layer and regional EKS GPU/CPU pools:

- lightweight request validation/routing on CPU;
- GPU inference pods for PAD/encoder with bounded dynamic batching;
- template store encrypted separately from general application data;
- FAISS/Milvus-style retrieval service for 1:N use cases;
- risk/policy service combining evidence;
- metrics/traces to CloudWatch/Prometheus with privacy-safe identifiers.

SageMaker endpoints are a valid managed alternative. Choose EKS when the team needs
multi-model pipelines, custom runtimes and fine-grained orchestration; choose SageMaker
when managed deployment/monitoring outweigh platform flexibility.

## Availability and rollout

- multi-AZ replicas and readiness probes;
- minimum warm GPU capacity for latency SLO;
- queue-age and concurrency-based autoscaling;
- canary/shadow evaluation against production slices;
- automatic rollback on latency, error, security or fairness proxy regression;
- regional failover policy that respects data residency and key boundaries.

## Capacity sketch

If one replica sustains 80 requests/s at target p99 and peak demand is 2,000 requests/s,
the theoretical minimum is 25 replicas. Add headroom for burst, failures, rollout,
quality/PAD branching and tail latency. Benchmark the **full pipeline**; model-only FPS
does not size the service.

## Staff-level trade-off

> “I would begin with managed training on SageMaker and a reproducible artifact contract.
> For serving I choose SageMaker or EKS from pipeline complexity and team operating model,
> then prove p99 and cost with a load test. The invariant is immutable lineage and the
> same gated model bundle across regions.”
