# On-Prem / Air-Gapped Architecture

**TL;DR:** On-prem means you own every box and the data never touches the internet.
That changes deployment in concrete ways: an internal container registry, offline
model delivery, local storage with retention limits, and hardware you size up-front
because you can't autoscale in someone's cloud. Know the topology and the trade-offs.

## Why on-prem for CCTV here

- **Data residency / sovereignty** — UAE and government rules often require footage
  (and any biometric data) to stay in-country and on-site. Cloud egress may be
  legally off the table.
- **Latency & reliability** — events must fire even if the internet is down; the
  system can't depend on a WAN link.
- **Attack surface** — no inbound cloud endpoint to compromise; the whole data
  plane sits behind the perimeter.
- **Bandwidth** — streaming dozens of HD cameras to a cloud is expensive and
  fragile; process at the edge, ship only small events/metadata.

## Reference topology

```
Cameras ──(private VLAN, RTSP)──► Edge inference (Jetson Orin/NX)
                                     │  decode(NVDEC)+detect+track+events
                                     ▼
                            On-prem GPU server(s)   ← heavier models / aggregation
                                     │
                       ┌─────────────┼─────────────┐
                       ▼             ▼             ▼
                   local DB    object store     dashboard
                 (events/meta) (clips, retention) (operators, LAN only)
        NO outbound internet.  Updates in via a controlled channel.
```

- **Edge-first:** do decode + detection + tracking + event logic on the Jetson so
  raw video stays local and you ship only metadata/events upstream (privacy +
  bandwidth win). Ties to sections 02/03.
- **Central server:** aggregation, cross-camera fusion, heavier/second-stage models,
  storage, dashboards.

## Deploying without a cloud

- **Internal container registry** — mirror images into an on-site registry (Harbor
  or a private Docker registry); nodes pull from inside the perimeter. Same Docker
  images as your cloud work — different registry.
- **Offline model delivery** — models arrive as signed artifacts on approved media
  or via a one-way/controlled transfer, imported into an on-prem **model registry**
  (even a versioned directory + manifest). No `pip install` from PyPI at runtime;
  vendor wheels/base images in advance.
- **Orchestration** — could be plain `docker compose` per node, or on-prem
  Kubernetes (k3s/RKE) for a larger fleet. You already know GKE — call out that the
  manifests transfer; only the control plane is local.
- **Config & secrets** — a local secrets store (Vault) or sealed secrets; never bake
  camera credentials into images.

## Hardware sizing (you can't autoscale)

- **Capacity is fixed** — you must size GPUs for **peak** camera count × model cost
  up front. Plan streams-per-Jetson from your latency budget (§03): frames/s ×
  models × resolution → GPU headroom.
- **Redundancy** — N+1 edge nodes, failover for the central server; a camera's
  streams should re-home if its edge box dies (§04 fault tolerance).
- **Storage & retention** — footage/clips have a retention policy (e.g. 30/90 days)
  and legal caps; size disks for it and auto-expire. Retention is also a privacy
  control (next page).
- **Thermal/power** — Jetson power modes (10W/15W/MAXN) trade throughput vs heat;
  in a hot climate / enclosed cabinet this is real, not academic (§03, tegrastats).

## Updating models safely in a locked-down site

1. Validate the new engine **offline** on a held-out clip set from the actual site.
2. Import the signed artifact to the on-prem registry (version + checksum).
3. **Canary** on a subset of cameras; compare metrics to the incumbent (next page).
4. Roll forward or **roll back** to the pinned previous version. Keep both; never
   overwrite in place.

## Quick self-check

- Why do detection + tracking on the edge instead of shipping video to a server?
  *(keep raw video local for privacy + save bandwidth; only metadata leaves)*
- You can't `docker pull` from Docker Hub on-site. How do images/models get there?
  *(internal registry + controlled offline import of signed artifacts)*
- Why is capacity planning harder on-prem than on GKE? *(no autoscale — size GPUs
  for peak up front, plus N+1 redundancy)*
