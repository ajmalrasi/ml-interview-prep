# Evaluation Protocols, Open-Set Search & Calibration

**TL;DR:** Pair construction can dominate the metric. Define identities, galleries,
probes, retries and score aggregation before looking at results.

## Verification protocol

A useful selfie-to-ID protocol controls:

- no identity overlap across train/development/test;
- one or more ID-document portraits per identity;
- realistic selfie device and session variation;
- genuine pairs across time and condition;
- impostor pairs that include random and hard/lookalike comparisons;
- documented treatment of low-quality failures and retries.

Deduplicate before splitting. Near-identical images, document re-crops and the same person
under multiple IDs can create optimistic leakage or contradictory labels.

## Identification metrics

For open-set 1:N:

- **Rank-k / CMC:** whether the true enrolled identity appears in top k.
- **FPIR:** fraction of non-enrolled probes incorrectly associated with someone.
- **FNIR:** fraction of enrolled probes not correctly identified at the operating point.
- **TPIR:** true positive identification rate, often reported at a fixed FPIR.

Evaluate at realistic gallery sizes and update patterns. Approximate search also needs
**retrieval recall**: was the true nearest candidate returned before thresholding?

## Calibration and fusion

Raw cosine scores are not probabilities. If downstream risk engines require comparable
confidence, fit a calibration mapping on representative data and monitor calibration
drift. Score calibration does not improve ranking; it improves interpretation.

When combining face match, liveness, device and document signals:

- keep each model’s evidence and reason codes observable;
- train or configure fusion on transaction-level outcomes;
- prevent one correlated weak signal from being counted repeatedly;
- measure the complete policy, including abstain/manual-review decisions.

## Retry policy

Retrying changes observed error rates. A “best of three” genuine policy may improve
completion but can increase attack opportunity if the system also takes the maximum
impostor score. Benchmark the exact production aggregation: first-pass, bounded retry,
quality-selected sample or multi-frame fusion.

## Regression gate

Ship only if the candidate meets all declared gates:

| Gate | Example |
|---|---|
| security | TAR at target FMR does not regress beyond tolerance |
| fairness | worst-group FNMR ratio/difference within approved bound |
| acquisition | failure-to-acquire and recapture rate acceptable |
| latency | p95/p99 end-to-end SLO on target hardware |
| retrieval | ANN recall at k and FPIR at production gallery size |
| operations | no new critical slice, calibration or observability regression |
