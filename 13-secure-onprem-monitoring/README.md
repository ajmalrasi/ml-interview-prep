# 13 — Secure On-Prem Deployment & Monitoring

**TL;DR:** The job description asks for *deployment in secure on-prem environments*
and *model optimization and performance monitoring*. For a government or enterprise
CCTV system in Abu Dhabi these aren't footnotes — they're often the constraint that
shapes every other decision. The rule is blunt: no cloud, the data never leaves the
building, and everything is auditable. This section is what that rule does to your
architecture, your security posture, and the way you keep a fleet of models healthy
when you can't watch them from a cloud dashboard.

The thread running through all three pages is a single inversion. Your résumé is full
of *cloud* deployment — GKE, Azure DevOps, GCP — and the skills transfer almost
completely; what flips is the constraint. Instead of "scale out in someone else's
data centre," it's "fit inside a sealed perimeter with no way out." Say that bridge
explicitly in the interview: same containers, same TensorRT engines, but the registry,
the model updates, and the monitoring all now live *inside* the fence.

Files, in reading order:
1. [onprem-architecture.md](onprem-architecture.md) — the air-gapped topology and how you deploy and update without a cloud
2. [security-and-privacy.md](security-and-privacy.md) — encryption, access control, and the CCTV-specific matter of faces and PII
3. [performance-monitoring.md](performance-monitoring.md) — keeping models accurate and healthy with no live labels and no cloud dashboard

## The mental model

```
        ┌──────────────  ON-PREM / AIR-GAPPED  ──────────────┐
 cameras│  edge boxes (Jetson)      on-prem GPU server(s)      │ operators
   ────►│  decode + detect + track → analytics + events → DB   │─► local dashboard
        │  (private VLAN, no WAN)     (no internet egress)      │
        └──────────────────────────────────────────────────────┘
      model updates arrive by a controlled offline channel, not a cloud pull
```

**The framing line to memorize:** *"Secure on-prem means the data plane never leaves
the site — no cloud inference, no telemetry leaving the building, encryption at rest
and in transit, least-privilege access, and an audit trail. Models are optimized to
run on the edge and on-prem GPUs we actually have, and monitored locally for drift and
health, because I can't watch them from a cloud dashboard."*

→ Start: **[onprem-architecture.md](onprem-architecture.md)**
