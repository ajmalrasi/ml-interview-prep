# Performance & Ops Monitoring

**TL;DR:** Alongside drift, you watch the model *service* like any production system —
latency, throughput, errors, resource use — plus ML-specific signals like prediction
confidence and (when labels arrive) live accuracy. The stack is usually
Prometheus + Grafana, with alerts on the numbers that matter.

## Operational metrics (same as any service)

A model behind an API is a service, so the usual SRE metrics apply:

- **Latency** — especially **p95/p99**, not just the average; a model that's fast on
  average but slow at the tail hurts real users.
- **Throughput** — requests per second the service handles.
- **Error rate** — failed requests, timeouts, exceptions.
- **Resource use** — CPU/GPU/memory, which drives cost and autoscaling (sections 7–8).

If a model is too slow or falls over under load, it doesn't matter how accurate it is —
so these are first-class.

## Model-quality signals

Because true accuracy is often delayed, you watch proxies continuously:

- **Prediction confidence / score distribution** — a shift or collapse hints the model
  is out of its depth.
- **Prediction distribution** — the mix of outputs vs the training baseline.
- **Feature drift** (previous page) — feeding into the same dashboard.
- **Live accuracy** — computed as labels trickle in, trended over time; the real signal,
  just lagged.

## Alerting well

The goal is to be told *before* users notice. Set thresholds on the metrics above and
alert on sustained breaches — but tune them so you're not flooded with noise (a page you
ignore is worthless). A good rule: alert on things that are **actionable** (latency
spiking, drift crossing a threshold, error rate rising), and dashboard the rest.

## The tooling

**Prometheus** collects metrics, **Grafana** visualizes them, **Alertmanager** pages you;
ML-specific tools like **Evidently** or the monitoring built into SageMaker/Vertex add
drift and quality dashboards on top. You don't need to memorize configs — know the roles.

## 🔗 Connecting the dots — the real stack

Ops metrics are the standard SRE stack: **Prometheus** collects, **Grafana** dashboards, **Alertmanager** pages (or **DataDog** for all three). Model-quality signals come from **Evidently / Arize** or **SageMaker Model Monitor**, plotted on the same boards so ops and model health sit side by side.

**How you'd say it:** *"Latency p99, error rate, and GPU use went to Prometheus/Grafana; prediction-confidence drift went to Evidently — one Grafana board, alerts on the actionable ones."*

## Self-check

- Why watch p99 latency, not just the average? *(the tail is what real users feel; a
  good average can hide bad worst-case latency.)*
- Two proxy signals for model quality when labels are delayed? *(prediction confidence/
  score distribution, prediction distribution, feature drift — any two.)*
- What makes a good alert? *(actionable and tuned to avoid noise — alert on things you'd
  actually respond to.)*
