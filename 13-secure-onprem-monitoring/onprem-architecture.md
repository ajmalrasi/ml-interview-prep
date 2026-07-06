# On-Prem / Air-Gapped Architecture

**TL;DR:** On-prem means you own every box and the data never touches the internet.
That one constraint ripples outward into concrete consequences: you can't pull images
from Docker Hub, you can't autoscale when a crowd shows up, and you can't push a model
update from a cloud pipeline. This page is about designing *with* those limits rather
than being surprised by them, and about explaining the trade-offs the way someone who's
actually shipped it would.

## Why on-prem in the first place

It helps to know *why* the constraint exists, because the reasons shape the design.
The biggest is **data residency and sovereignty** — in the UAE and in government work,
footage and any biometric data often must legally stay in-country and on-site, which
can put cloud egress entirely off the table. Then there's **latency and reliability**:
an intrusion alert has to fire even when the internet is down, so the system simply
can't depend on a WAN link. **Attack surface** matters too — with no inbound cloud
endpoint, there's nothing on the public internet to compromise; the whole data plane
sits behind the perimeter. And there's plain **bandwidth**: streaming dozens of HD
cameras to a cloud is expensive and fragile, so you process at the edge and ship only
small events upstream.

## The shape of the system

```
Cameras ──(private VLAN, RTSP)──► Edge inference (Jetson Orin/NX)
                                     │  decode (NVDEC) + detect + track + event logic
                                     ▼
                            On-prem GPU server(s)   ← heavier models, cross-camera fusion
                                     │
                       ┌─────────────┼─────────────┐
                       ▼             ▼             ▼
                   local DB    object store   dashboard
                 (events/meta) (clips, w/     (operators,
                                retention)     LAN only)
        No outbound internet. Updates arrive through a controlled channel.
```

The design principle is **edge-first**, and it's worth understanding why rather than
just asserting it. If you do the decode, detection, tracking, and event logic right on
the Jetson (the pipeline from sections 02 and 03), then the raw video never has to
leave the camera's local box — you ship only metadata and events upstream. That single
choice buys you a privacy win (raw footage stays local) and a bandwidth win (you're
moving kilobytes of events, not gigabits of video) at the same time. The central
server then does the things that genuinely need a wider view: aggregation, fusing
tracks across cameras, running heavier second-stage models, storage, and the operator
dashboards.

## Deploying when there's no cloud to lean on

Every convenience of cloud deployment has an on-prem substitute, and naming them shows
you've done this before. Instead of pulling public images at runtime, you mirror them
into an **internal container registry** — a Harbor or a private Docker registry inside
the perimeter — and nodes pull from there; these are the *same* Docker images as your
cloud work, just from a different registry. Models can't be fetched from the internet
either, so they arrive as **signed artifacts** through an approved, controlled transfer
and get imported into an on-prem model registry (which can be as simple as a versioned
directory with a manifest); nothing does a `pip install` from PyPI at runtime, so you
vendor your wheels and base images ahead of time. Orchestration might be plain
`docker compose` per node or an on-prem Kubernetes like k3s for a bigger fleet — and
since you already know GKE, the point to make is that the manifests transfer; only the
control plane is now local. Secrets, including camera credentials, live in a local
store like Vault, never baked into an image.

## The thing cloud engineers underestimate: fixed capacity

Here's the trade-off that genuinely differs from cloud work and that interviewers love
to probe. You cannot autoscale. When a crowd arrives, no new GPUs spin up — so you have
to size for **peak** up front: peak camera count times model cost, worked out from the
latency budget in section 03 (frames per second times models times resolution gives you
the GPU headroom you need). You build in **redundancy** the old-fashioned way, N+1 edge
nodes and a failover server, so a dead box re-homes its cameras (the fault-tolerance
patterns from section 04). You size **storage** for a retention policy — thirty or
ninety days of clips, with legal caps — and auto-expire, which doubles as a privacy
control on the next page. And in a hot climate you take **thermal and power** seriously,
because a Jetson in an enclosed cabinet throttles, and its power modes (10W, 15W, MAXN)
are a real throughput-versus-heat trade, not an academic one.

## Updating a model on a locked-down site, safely

Rolling out a new model where you can't A/B test in a cloud takes discipline. You
validate the new engine **offline** first, on held-out clips from the actual site, not
a public benchmark. You import the signed, checksummed artifact into the on-prem
registry. You **canary** it on a handful of cameras and compare its metrics against the
model it would replace (the monitoring page shows exactly which metrics). And crucially
you keep the previous version pinned so you can **roll back** instantly — you never
overwrite in place, because on a sealed site a bad model with no rollback is a site
visit, not a click.

**Self-check.** Why do detection and tracking on the edge instead of shipping video to
a central server? *(to keep raw video local for privacy and to save bandwidth — only
metadata leaves the box.)* You can't `docker pull` from the internet on-site — how do
images and models get there? *(an internal registry plus a controlled offline import of
signed artifacts.)* And why is capacity planning harder here than on GKE? *(no
autoscale — you size GPUs for peak up front and add N+1 redundancy yourself.)*
