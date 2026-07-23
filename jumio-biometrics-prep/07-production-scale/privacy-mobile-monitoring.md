# Privacy, Mobile/Edge & Production Monitoring

**TL;DR:** Biometric templates remain sensitive even though they are not photographs.
Minimize, encrypt, version, audit and delete them; monitor the decision pipeline without
putting faces or raw embeddings into logs.

## Privacy and security controls

- explicit purpose, consent/legal basis and retention;
- data minimization: store only what the product needs;
- encryption in transit and at rest with separated keys/roles;
- strict access and tamper-evident audit trail;
- tenant/region isolation and residency policy;
- subject deletion propagated through datasets, indexes and backups;
- signed models/SDKs and controlled supply chain;
- incident response for template or key compromise.

Templates are not easily “reset” like passwords. Consider revocable/cancelable template
transforms where they fit, but validate their effect on accuracy and interoperability.

## Mobile/edge path

Use CoreML or LiteRT/TFLite when on-device capture guidance, detection, quality or PAD
improves latency/privacy. Challenges include:

- diverse CPU/GPU/NPU operator support;
- preprocessing parity and camera orientation;
- FP16/INT8 accuracy in low-FMR tails;
- app/SDK version fragmentation;
- model extraction and tampering;
- thermal, memory and battery limits.

Keep the authoritative decision boundary explicit. On-device evidence may reduce data
transfer and improve UX, but a compromised client cannot be the only source of truth for
a high-risk transaction.

## Monitoring without labels

Immediate production labels are scarce. Monitor:

- capture success, quality reason codes and retry/abandonment;
- face/PAD/match score distributions by governed slices and device/version;
- threshold distance and manual-review rate;
- latency, queue age, GPU utilization and errors per stage;
- ANN recall canaries and index freshness;
- confirmed fraud/appeal outcomes when delayed labels arrive.

Use shadow/champion comparisons and a stable canary set. A score drift alert is a trigger
for investigation, not proof that identities or demographics changed.

## Incident example

If FNMR rises after a mobile release:

1. stop/rollback the rollout;
2. slice by SDK, device, OS and capture condition;
3. reproduce the input tensor and orientation;
4. compare detector/quality/PAD/encoder stages;
5. verify model and preprocessing hashes;
6. assess subgroup impact;
7. repair, replay the gated benchmark, and document the failure.
