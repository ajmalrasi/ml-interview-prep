# 13 — Secure On-Prem & Monitoring

**TL;DR:** Gov/enterprise CCTV rule: **no cloud, data never leaves site, everything auditable.** Same skills as your cloud work — constraint **inverted**.

```rawhtml
<div class="diagram">
  <div class="loopwrap">
    <span class="loop-top">🔒 ON-PREM / AIR-GAPPED</span>
    <div class="flow">
      <span class="node data">cameras</span>
      <span class="arw"></span>
      <span class="node">Jetson edge<span class="nsub">decode + detect + track</span></span>
      <span class="arw"></span>
      <span class="node">on-prem GPU server<span class="nsub">analytics + events</span></span>
      <span class="arw"></span>
      <span class="node">local DB</span>
      <span class="arw"></span>
      <span class="node out">operator dashboard</span>
    </div>
    <div class="flow-foot"><b>No internet egress.</b> Model updates arrive via a controlled offline channel.</div>
  </div>
</div>
```

**Bridge from your résumé:** *"I've shipped Dockerized inference on GKE; on-prem it's the same containers + TensorRT engines, but registry, model updates, and monitoring all live inside the perimeter with no egress."*

**Say this:** *"Secure on-prem = data plane never leaves site: no cloud inference, no telemetry egress, encryption at rest+transit, least-privilege, audit trail. Models optimized for the edge GPUs we have, monitored locally for drift + health."*

Pages: 1) architecture · 2) security & PII/privacy · 3) monitoring & drift.

→ Start: **[onprem-architecture.md](onprem-architecture.md)**
