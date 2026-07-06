# 13 — Secure On-Prem Deployment & Monitoring

**TL;DR:** The JD says *"deployment in secure on-prem environments"* and *"model
optimization and performance monitoring."* For an Abu Dhabi government/enterprise
CCTV system this is not a footnote — it's often the deciding constraint. **No
cloud. Data never leaves the premises. Everything auditable.** This section covers
the air-gapped architecture, the security/PII hardening, and the monitoring that
keeps a fleet of models healthy without a phone-home.

Files:
1. [onprem-architecture.md](onprem-architecture.md) — air-gapped topology, data residency, offline model updates
2. [security-and-privacy.md](security-and-privacy.md) — encryption, access control, PII/face privacy, audit
3. [performance-monitoring.md](performance-monitoring.md) — model drift, per-camera health, GPU/latency dashboards

## The mental model

```
        ┌───────────────  ON-PREM / AIR-GAPPED  ───────────────┐
 cameras│  edge boxes (Jetson)      on-prem GPU server(s)       │ operators
   ────►│  decode + detect + track ─► analytics + events ─► DB  │─► local dashboard
        │  (private VLAN, no WAN)     (no internet egress)      │
        └──────────────────────────────────────────────────────┘
   model updates arrive by a *controlled offline channel*, not a cloud pull
```

Contrast with your resume's cloud work (GKE, Azure DevOps, GCP): same skills,
inverted constraint. In the interview, explicitly bridge it: *"I've shipped
Dockerized inference on GKE; on-prem it's the same containers and the same TensorRT
engines, but the registry, model updates, and monitoring all live inside the
perimeter with no internet egress."*

## The framing line (memorize)

*"Secure on-prem means the data plane never leaves the site: no cloud inference, no
telemetry egress, encryption at rest and in transit, least-privilege access, and an
audit trail. Models are optimized to run on the edge/on-prem GPUs we actually have,
and monitored locally for drift and health because I can't watch them from a cloud
dashboard."*

→ Start: **[onprem-architecture.md](onprem-architecture.md)**
