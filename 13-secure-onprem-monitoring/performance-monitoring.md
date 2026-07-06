# Performance Monitoring & Drift

**TL;DR:** No cloud dashboard → build observability in. Two layers: **system health** (easy, you have numbers) + **model health** (hard, no live labels). Drift = the skill.

## System health (instrument everything)
- **Per camera** — FPS, latency, decode errors, RTSP reconnects, dropped frames. (Camera silently at 2 FPS = classic invisible failure.)
- **Per GPU** — util, memory, **temperature/throttle** (hot climate!), power mode. `tegrastats` (Jetson), **DCGM** (server).
- **Pipeline** — queue depth, throughput vs §03 budget, restarts.
- **Stack** — **Prometheus + Grafana + Alertmanager inside the perimeter** (no cloud APM).

## Model health (no labels → watch proxies)
- **Confidence distribution** — histogram of detection scores; shifts on drift (lighting, dirty lens, bumped camera); collapse = alarm.
- **Output stats** — avg count, class mix, track length, ID-switch rate, dwell dist. Trend away from baseline = something changed.
- **Data/domain drift** — compare input stats vs training reference (**PSI / KL**). Usual culprit = **covariate shift**.
- **Periodic audits** — sample frames/events → human label → real precision/recall + count MAE → trend. (Only true accuracy measure.)

**Drift types:** **covariate** = inputs shift (lighting/season → recalibrate/retrain) · **concept** = meaning shifts (zone repurposed → relabel).

## Close the loop
```
monitor → detect drift → collect+label hard cases (active learning §14)
→ retrain/recalibrate → offline-validate on site clips
→ CANARY on few cameras → compare → roll forward or ROLL BACK
```
- **Canary + rollback** — never hot-swap fleet blind; keep old engine pinned.
- **Shadow mode** — run candidate alongside prod, log diffs (no cloud A/B).
- **Active learning** — mine low-confidence + operator-flagged FPs → label those → retrain. How it improves in a closed site.

## Optimization ↔ monitoring = one loop
Optimize (INT8/FP16/prune/TensorRT, §03) to hit latency budget → **monitor mAP didn't drop** (INT8 can cost mAP) → stay in budget as cameras grow.

## Q&A
- No labels — detect degradation? → proxies (confidence dist, output stats, FP trend) + periodic human audits.
- Covariate vs concept drift (CCTV)? → lighting/season vs zone repurposed.
- Roll out on locked 200-camera site? → offline-validate → canary/shadow → compare → forward/rollback.
- Dashboards, no cloud? → Prometheus+Grafana+Alertmanager on-prem; tegrastats/DCGM.
