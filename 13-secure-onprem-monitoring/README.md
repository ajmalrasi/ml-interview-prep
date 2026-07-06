# 13 — Secure On-Prem & Monitoring

**TL;DR:** Gov/enterprise CCTV rule: **no cloud, data never leaves site, everything auditable.** Same skills as your cloud work — constraint **inverted**.

```
┌────────── ON-PREM / AIR-GAPPED ──────────┐
 cameras → Jetson edge (decode+detect+track)
         → on-prem GPU server (analytics+events) → local DB → operator dashboard
 NO internet egress. Model updates via controlled offline channel.
└───────────────────────────────────────────┘
```

**Bridge from your résumé:** *"I've shipped Dockerized inference on GKE; on-prem it's the same containers + TensorRT engines, but registry, model updates, and monitoring all live inside the perimeter with no egress."*

**Say this:** *"Secure on-prem = data plane never leaves site: no cloud inference, no telemetry egress, encryption at rest+transit, least-privilege, audit trail. Models optimized for the edge GPUs we have, monitored locally for drift + health."*

Pages: 1) architecture · 2) security & PII/privacy · 3) monitoring & drift.

→ Start: **[onprem-architecture.md](onprem-architecture.md)**
