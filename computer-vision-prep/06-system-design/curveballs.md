# Design Curveballs (The Follow-Ups)

**TL;DR:** After your main answer, they pile on constraints to see how you adapt.
Here are the common ones with crisp directions. The meta-move: restate the new
constraint, name the tradeoff it forces, adjust one part of the design.

## "Now make it 500 cameras."
Horizontal scale: more edge nodes (camera groups of 12–16 each), unchanged per-node
design. Cloud aggregation scales out (partitioned Kafka topics, sharded DB). The
edge template is the unit of scale — that's why edge-heavy design scales linearly.

## "Latency must be under 50ms."
Attack the budget: smaller/distilled detector, lower inference resolution, INT8,
reduce batch size (less fill-wait) and add more parallel instances/streams, drop
B-frames, shrink jitter buffer. Move *all* pre/post to GPU; eliminate CPU round
trips. Accept fewer cameras per GPU.

## "The GPU keeps running out of memory."
Diagnose: count decode buffers + model workspace × instances + batch tensors. Fixes:
smaller batch, fewer model instances, lower decode buffer count, INT8 (¼ memory),
release surfaces per iteration. Add graceful degradation so OOM-risk sheds load,
not crashes.

## "A camera sends corrupted/garbage frames."
Validate frames (resolution/format sanity, decode errors from the bus). Skip bad
frames, keep the stream. If persistent, mark camera unhealthy, backoff-reconnect,
alert. Never let one malformed stream segfault the shared pipeline — isolation +
input validation.

## "Cloud connection drops for an hour."
Edge keeps inferring (that's the point of edge inference). Buffer metadata/clips
locally in a bounded store (drop oldest non-critical first), flush on reconnect.
Critical alerts get a local fallback path (on-site siren/log). System degrades, not
dies.

## "How do you deploy a new model with zero downtime?"
Canary: build/validate the new TRT engine, roll it to one edge node, compare
detections/metrics against the old, then progressive rollout. Cloud models via
Triton version hot-swap. Keep the old engine to roll back instantly.

## "How do you know it's actually working in production?"
Observability: per-camera fps/freshness, queue depths, p99 latency, GPU util,
detection-rate anomalies (a camera that suddenly detects nothing may be
mispointed/frozen). Health endpoint + Prometheus + alerts. "You can't operate what
you can't see" — ties to your benchmarking/measurement ethos.

## "Detections look wrong on some cameras."
Could be: domain shift (lighting/angle differs from training), wrong calibration,
resolution mismatch in preprocessing, or quantization accuracy drop. Diagnose by
isolating: check raw frames, check preprocessing, A/B FP16 vs INT8, error-analyze
by camera. (Your model-eval + error-analysis background.)

## "Edge vs cloud inference: defend your choice."
Edge: lowest latency, no video egress, privacy, survives WAN loss — but limited
compute, harder to update, per-site hardware cost. Cloud: elastic compute, easy
updates, central management — but latency, bandwidth/egress cost, WAN dependency.
Most real systems: **infer at edge, manage/aggregate/retrain in cloud** (what you'd
propose).

## The meta-pattern for any curveball

1. Restate the constraint.
2. Name which budget/tradeoff it stresses (latency / throughput / memory /
   reliability / cost).
3. Change the minimum needed.
4. State what you give up.

Composure + tradeoff fluency beats a perfect answer.

→ Back to [section README](README.md) · Next: **[07-qa-drill-bank/](../07-qa-drill-bank/README.md)**
