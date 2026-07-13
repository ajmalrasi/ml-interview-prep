# Worked Example: Hybrid Perception Platform

**TL;DR:** *"Petabytes of perception data land daily. Design a hybrid platform that trains
on **both** on-prem and cloud GPUs, picks the location by availability, and keeps code,
data, and artifacts reproducible with centralized metrics and easy rollbacks."* This is the
ML-platform question (§ ML Platform) at autonomy scale — the winning insight is **data
gravity**: at petabyte scale you move *compute to data*, never data to compute.

## Frame it first (say this out loud)

- **Data gravity dominates.** PBs don't get streamed to the cloud on a whim — egress cost
  and time kill you. That single fact *justifies* the hybrid design.
- **It's a batch + experiment platform, not a latency service.** Real-time inference happens
  at the edge (the car/robot); the platform does ingest, curation, training, and re-sim, so
  SLAs are relaxed and the scheduler can place work opportunistically.
- **"Availability-based placement" = one fungible GPU pool** with different cost/latency/
  capacity profiles that a single scheduler chooses between.

## Walk the planes

```rawhtml
<div class="diagram">
  <div class="vflow">
    <span class="node">EDGE<span class="nsub">sensors → local buffer → bulk offload at depot (ship disks — sneakernet is valid)</span></span>
    <span class="varw"></span>
    <span class="node soft">DATA LAYER — source of truth<span class="nsub">object store (on-prem Ceph/MinIO + cloud S3/GCS) · content-addressed · immutable · tiered hot/warm/cold · Iceberg/lakeFS versioning · catalog DB + feature/label store</span></span>
    <span class="varw"></span>
    <span class="node">CONTROL PLANE — cloud-hosted, HA<span class="nsub">API + orchestrator (Argo/Temporal/Flyte) · FEDERATED SCHEDULER (the “cloud or on-prem?” brain) · metadata/lineage DB</span></span>
    <span class="varw"></span>
    <span class="node">COMPUTE<span class="nsub">on-prem K8s/Slurm ⇄ cloud K8s — joined by ONE scheduler over a private backbone</span></span>
    <span class="varw"></span>
    <span class="node out">Observability<span class="nsub">centralized metrics · lineage · model registry · dashboards</span></span>
  </div>
</div>
```

## The five subsystems they asked for

- **Control plane** — stateless services + a durable metadata store, **cloud-hosted for HA**,
  dispatches to either site. Its core piece is a **placement engine** that scores jobs on:
  on-prem queue depth, cloud spot price/quota, **data locality (biggest weight)**, priority,
  and cost budget. Policy: *prefer on-prem (sunk cost, no egress); burst to cloud when the
  queue exceeds a threshold or the data already lives there.* Multi-cluster via Karmada /
  Admiralty / Volcano / Slurm-bridge.
- **Data layer** — immutable, content-addressed object store; **range reads** over ~1 GB
  shards (not billions of tiny files); dataset versioning (lakeFS/DVC + Iceberg); a catalog
  so engineers query *"left-turns in rain at night"* without scanning PBs.
- **Experiment handling / reproducibility** — pin the triple **code SHA + data snapshot hash
  + container image digest**; track with MLflow/W&B; promote immutable models through a
  registry (dev → shadow → canary → prod). Given a run ID, reconstruct the run bit-for-bit.
- **Networking** — private interconnect (Direct Connect / Cloud Interconnect), not
  VPN-over-internet; RDMA/InfiniBand for distributed training; **egress-aware scheduling** so
  moving data to cloud is priced in; service mesh (mTLS) between sites.
- **Security** — SSO/OIDC + RBAC, short-lived workload identity (SPIFFE/SPIRE); encryption at
  rest (KMS) and in transit; **PII redaction** (faces/plates) at ingest + data-residency
  policies that *also* constrain the scheduler (EU data may not leave region); signed images
  and signed model bundles; immutable audit log.

## Rollbacks fall out of immutability (for free)

- **Model** — repoint the registry/deployment to the previous digest; the fleet pulls the
  prior signed bundle and converges.
- **Data / pipeline** — pin the previous dataset snapshot.
- **Infra** — GitOps (Argo CD / Flux): the platform is declarative in git, so `git revert` +
  reconcile rolls back the control plane too, with a clean audit trail.

## The trade-offs to name

Sneakernet vs. live upload; spot-instance preemption (checkpoint often); shard size (big =
cheap sequential reads but coarse shuffle); on-prem sunk cost vs. cloud elasticity; and GPU
nondeterminism capping bit-exact reproducibility.

## 🔗 How you'd say it

*"At petabyte scale, **data gravity forces a data-local, compute-follows-data design**, and
**immutability + content addressing** is the one primitive that gives me reproducibility,
rollbacks, and auditability at once. The control plane stays small and cloud-hosted for HA,
making cost/availability/locality-weighted placement across one federated GPU pool. Metrics,
networking, and security are all built to preserve that immutable lineage end to end."*

## Self-check

- Why hybrid, in one phrase? *(data gravity — PBs are too expensive to move, so compute
  follows data.)*
- What decides cloud vs on-prem? *(a scoring scheduler: locality > queue depth > spot price >
  budget; prefer on-prem, burst to cloud.)*
- What makes it reproducible **and** rollback-able? *(immutable, content-addressed artifacts +
  the pinned code/data/image triple + GitOps.)*
