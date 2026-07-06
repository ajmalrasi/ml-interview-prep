# Performance Monitoring & Model Drift

**TL;DR:** The JD pairs *model optimization* with *performance monitoring* for a
reason: on-prem, no one is watching your models from a cloud dashboard, so you must
build the observability in. Monitor **two layers**: system health (is the pipeline
up and fast?) and model health (is it still *accurate*?). The hard one — because
you have no live labels — is detecting **drift**.

## Two layers of monitoring

```
SYSTEM HEALTH (easy — you have the numbers)      MODEL HEALTH (hard — no live labels)
 FPS / latency per camera                         detection confidence distribution
 GPU util / mem / temp (tegrastats, DCGM)         object count / class-mix over time
 dropped frames, queue depth, reconnects          event / false-alarm rate trend
 disk, retention headroom, service uptime         accuracy vs periodic audits
```

## System health (instrument everything)

- **Per-camera:** effective FPS, end-to-end latency, decode errors, RTSP reconnects,
  frames dropped (backpressure — §04). A camera silently dropping to 2 FPS is a
  common, invisible-without-monitoring failure.
- **Per-GPU/box:** utilization, memory, **temperature/throttling** (critical in a
  hot climate), power mode. On Jetson: `tegrastats`; on servers: NVIDIA **DCGM**.
- **Pipeline:** queue depths, inference throughput vs the §03 latency budget,
  service uptime, restart counts.
- **Stack, on-prem:** **Prometheus + Grafana** running *inside the perimeter* (no
  cloud APM). Alertmanager for local paging. This is the standard air-gapped combo.

## Model health & drift (the interview differentiator)

You usually have **no ground-truth labels at run time**, so you monitor *proxies*
for accuracy and watch them move:

- **Confidence distribution** — the histogram of detection scores. A drifting scene
  (new lighting, fog, a dirty lens, a bumped camera) shifts it; a sudden collapse in
  mean confidence is an alarm.
- **Output statistics** — average object count, class mix, track lengths, ID-switch
  rate, dwell distributions. If "people per frame" or false-alarm rate trends away
  from the established baseline, something changed.
- **Data/domain drift** — compare current input feature stats to the training/
  reference distribution (brightness, occupancy, scene stats; PSI / KL divergence).
  Covariate shift is the usual on-prem culprit: the *world* changed, not the model.
- **Periodic ground-truth audits** — the only way to measure real accuracy: sample
  frames/events periodically, have a human label them, compute precision/recall and
  count MAE, and trend it. Feeds §11's validation and §12's false-alarm control.
- **Concept vs covariate drift** — covariate: inputs shift (lighting/season, fix by
  recalibrate/retrain on new data). Concept: the *meaning* shifts (a zone is
  repurposed) — needs relabeling/redefinition. Name both.

## Closing the loop: retraining & rollout

```
monitor → detect drift/regression → collect + label hard cases (active learning, §14)
        → retrain / recalibrate → validate offline on site clips
        → CANARY on a few cameras → compare to incumbent → roll forward or ROLL BACK
```

- **Canary + rollback** — never hot-swap a model fleet-wide blind; run new vs old on
  a subset, compare the proxy metrics + an audit, keep the old engine pinned to roll
  back to (§13 architecture).
- **Shadow mode** — run the candidate alongside production without acting on its
  output, log the diff. Great for validating on-prem where you can't A/B in a cloud.
- **Active learning** — mine low-confidence and operator-flagged false alarms into
  the next training set; this is how the system *improves* in a closed environment.

## Optimization ↔ monitoring loop

Optimization (§03: INT8/FP16, pruning, TensorRT) and monitoring are the same loop:
you optimize to hit the latency/throughput budget on the hardware you have, then
**monitor that the optimization didn't cost accuracy** (INT8 can drop mAP — watch
the audit metric) and that you're still inside budget as camera count grows.

## Quick self-check

- You have no labels in production. How do you tell a model is degrading? *(proxy
  signals — confidence distribution, output stats, false-alarm trend — plus periodic
  human-labeled audits)*
- Covariate vs concept drift, with a CCTV example of each? *(lighting/season shift
  vs a zone being repurposed)*
- How do you roll out a retrained model on a locked-down 200-camera site safely?
  *(offline validation → canary/shadow on a few cameras → compare → roll forward or
  roll back to the pinned engine)*
- What on-prem stack gives you dashboards with no cloud? *(Prometheus + Grafana +
  Alertmanager inside the perimeter; tegrastats/DCGM for GPU)*
