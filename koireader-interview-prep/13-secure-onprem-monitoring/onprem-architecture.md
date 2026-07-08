# On-Prem / Air-Gapped Architecture

**TL;DR:** You own every box, no internet. Consequences: internal registry, offline model delivery, **no autoscale** (size for peak), signed artifacts.

## Why on-prem
- **Data residency** — UAE/gov: footage + biometrics stay in-country/on-site; cloud egress may be illegal.
- **Latency/reliability** — alerts fire even if internet down.
- **Attack surface** — no inbound cloud endpoint.
- **Bandwidth** — don't stream dozens of HD cameras to cloud; process at edge, ship events.

## Topology
```
Cameras ─(private VLAN, RTSP)→ Jetson edge: decode(NVDEC)+detect+track+events
       → on-prem GPU server: aggregation, cross-camera fusion, heavy models
       → local DB (events) + object store (clips, retention) + LAN dashboard
NO outbound internet.
```
**Edge-first:** do detect+track+events on Jetson → raw video stays local (privacy) + only metadata leaves (bandwidth). (§02/§03)

## Deploy without cloud
- **Internal registry** (Harbor / private Docker) — same images, different registry.
- **Offline model delivery** — signed artifacts via controlled transfer → on-prem model registry. No runtime PyPI; vendor wheels/base images.
- **Orchestration** — docker compose per node, or on-prem k8s (k3s). GKE manifests transfer; only control plane is local.
- **Secrets** — local Vault; never bake camera creds in images.

## Fixed capacity (differs from cloud!)
- **No autoscale** → size GPUs for **peak** (cameras × model cost, from §03 latency budget).
- **N+1 redundancy** — dead box re-homes cameras (§04).
- **Retention** — 30/90 days, legal caps, auto-expire (also privacy).
- **Thermal/power** — Jetson modes 10W/15W/MAXN throttle in hot cabinets (real, §03).

## Safe model update
Offline-validate on site clips → import signed artifact → **canary** on few cameras → compare to incumbent → roll forward or **roll back** (keep old engine pinned; never overwrite in place).

## Q&A
- Detect/track on edge why? → raw video stays local (privacy) + save bandwidth.
- No `docker pull` on-site → how? → internal registry + controlled import of signed artifacts.
- Capacity harder than GKE? → no autoscale; size for peak + N+1.
