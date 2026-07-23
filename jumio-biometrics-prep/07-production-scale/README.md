# 7 · Production, AWS & Scale

**TL;DR:** The production unit is the complete decision service, not a model file.
Version preprocessing, quality, liveness, embedding, threshold and policy together.

## Online request path

1. authenticate request and create an idempotency/session key;
2. validate/decode media with strict resource limits;
3. run detection, alignment, quality and liveness;
4. produce the versioned normalized embedding;
5. compare against claimed template or retrieve gallery candidates;
6. apply calibrated threshold/risk policy;
7. return decision and non-sensitive reason codes;
8. emit traces, metrics and audit events without leaking biometric content.

## SLOs and capacity

Define:

- p50/p95/p99 end-to-end latency;
- throughput and burst behavior;
- GPU/CPU memory and queue limits;
- availability and regional recovery target;
- timeout, retry and overload policy;
- per-stage error and acquisition rate;
- security/fairness model gates.

Avoid unbounded server retries: clients may already retry and create duplicate biometric
transactions. Use idempotency and a clear deadline budget.

## Release unit

A release manifest should pin detector, landmark/alignment config, quality model, PAD
model, encoder, ANN index format, calibration and policy thresholds. Canary the bundle;
do not let independently updated components create untested combinations.

→ Next: **[AWS Training-to-Serving Architecture](aws-architecture.md)**.
