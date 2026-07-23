# Worked Design: Global Selfie-to-ID Verification

**TL;DR:** Start with the decision and threat model, then design the model pipeline and
AWS platform around measurable security, fairness, latency and privacy requirements.

## 1. Clarify requirements

Assume:

- user submits ID portrait plus live selfie/video;
- return approve, reject or review;
- peak 2,000 requests/s across regions;
- p99 under 1.5 seconds excluding user capture;
- target FMR set by fraud policy; maximize TAR and completion within it;
- PAD protects presentation attacks and capture channel resists replay/injection;
- data residency, deletion and audit are mandatory.

Ask about regions, document/device mix, acceptable manual-review rate, enrollment versus
authentication, 1:N search requirement and retention.

## 2. Request path

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">mobile/web SDK<span class="nsub">nonce · encrypted media</span></span>
    <span class="arw"></span>
    <span class="node">regional API<span class="nsub">auth · idempotency · limits</span></span>
    <span class="arw"></span>
    <span class="node">biometric pipeline<span class="nsub">quality · PAD · embed · score</span></span>
    <span class="arw"></span>
    <span class="node">risk policy<span class="nsub">device · document · graph signals</span></span>
    <span class="arw"></span>
    <span class="node out">approve / review / reject</span>
  </div>
</div>
```

Use a transaction/session ID throughout. Validate file type/size and decode in a
resource-limited service. Keep each stage’s reason code and latency, but do not log raw
faces or embeddings.

## 3. Model pipeline

1. document portrait extraction and quality;
2. selfie face count, detection, landmarks and alignment;
3. capture quality and bounded recapture decision;
4. PAD plus session/device anti-replay evidence;
5. versioned face embeddings and cosine comparison;
6. calibrated score plus document/device/risk signals;
7. threshold policy with abstain/manual-review band.

Deploy a tested bundle of all component versions and thresholds.

## 4. AWS platform

- Route to the permitted region; terminate TLS and authenticate at the edge/API layer.
- EKS or SageMaker hosts autoscaled CPU/GPU inference.
- S3 stores encrypted, governed training artifacts; online media retention is minimal.
- Template/risk stores have isolated IAM/KMS boundaries.
- Airflow/MWAA creates immutable datasets and launches SageMaker/EC2 multi-GPU jobs.
- Registry promotion requires biometric, fairness, PAD, latency and security gates.
- Multi-AZ service; cross-region recovery follows residency constraints.

## 5. Evaluation and fairness

Freeze a subject-disjoint protocol reflecting selfie-to-document conditions. Report
TAR@target-FMR, acquisition, BPCER/APCER, completion and latency by device, region and
approved demographic intersections with identity-level confidence intervals.

The production threshold is global unless policy/legal review explicitly approves
otherwise. Use targeted data/capture/model mitigation for gaps and show residual risk.

## 6. Reliability and rollout

- canary 1% with champion shadow scores;
- rollback on p99, error, acquisition or safety/fairness proxy gate;
- idempotency prevents duplicate retry transactions;
- bounded queues shed load before tail latency explodes;
- version/model/index mismatch fails closed;
- delayed fraud and appeal outcomes feed controlled evaluation, not automatic retraining.

## 7. Trade-offs to state

- passive liveness friction versus attack generalization;
- EKS flexibility versus SageMaker operational simplicity;
- dynamic batching throughput versus p99;
- stricter quality/PAD versus customer completion;
- source-image retention for re-embedding versus privacy minimization;
- ANN scale versus exact-search assurance.

## Two-minute close

> “I would own this as a decision system. The capture is session-bound, quality and PAD
> gate the face encoder, and the match score is evaluated at a fraud-defined operating
> point with an abstain path. Offline, immutable subject-disjoint data and multi-GPU
> training feed a registry only after biometric, fairness, PAD and latency gates. Online,
> a regional AWS service deploys the whole versioned bundle, canaries against the champion,
> and monitors acquisition, score distributions, journey outcomes and p99 without logging
> biometric content.”
