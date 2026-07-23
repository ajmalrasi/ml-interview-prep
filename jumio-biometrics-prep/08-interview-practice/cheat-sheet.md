# Jumio Biometrics: Morning-Of Cheat Sheet

## Pipeline

**capture/session → detect → landmarks/align → quality → PAD → L2 embedding → cosine
match/ANN → calibrated policy → approve/review/reject**

Measure acquisition, each model stage and end-to-end journey. Preprocessing is a versioned
contract.

## Recognition

- Verification = 1:1 claim. Identification = 1:N gallery; open-set includes reject.
- Normalized embedding + cosine score.
- FaceNet: triplet metric learning.
- CosFace: cosine margin. ArcFace: angular margin.
- MagFace/AdaFace: quality-aware representation/margin ideas.
- Split by resolved identity; audit duplicates and hard-negative label errors.

## Metrics

- FMR: impostors accepted. FNMR: genuine users rejected.
- TAR = 1 − FNMR. Report **TAR at target FMR**.
- EER is summary, not policy.
- Freeze threshold on development data; final test once.
- Tail metrics need huge representative trials + identity-level confidence intervals.
- 1:N: rank-k/CMC, FPIR/FNIR/TPIR, ANN recall and realistic gallery size.

## Fairness

- Same global threshold visible across groups.
- Report acquisition, PAD, FMR/FNMR, completion + counts/CIs.
- Bootstrap by identity/session; inspect intersections.
- Diagnose: data → capture/quality → detector/alignment → PAD → encoder → policy.
- Mitigate mechanism; show global security and conversion trade-off.
- Group thresholds require explicit product/legal review.

## Security

- Match ≠ liveness. Live ≠ rightful identity.
- Presentation: print/screen/mask. Digital: deepfake/morph/replay/injection.
- APCER = attacks accepted; BPCER = bona fide rejected.
- Hold out attack instruments/devices.
- Session nonce + trusted capture binding + anti-replay + PAD + risk signals.
- Layered defense and risk-based step-up.

## Data/training

- Governed manifest: subject, consent/purpose, session/device, quality, lineage, split.
- Airflow orchestrates idempotent S3 manifest tasks; no image blobs in XCom.
- DDP first; FSDP/ZeRO when state does not fit. AMP + durable checkpoint.
- Synthetic data: measured gap → provenance/leak audit → ablation → real held-out lift.

## Production

- S3 + Airflow/MWAA → SageMaker/EC2 GPU → evaluation gates → signed registry.
- EKS/SageMaker online; bounded queues, idempotency, multi-AZ, canary and rollback.
- Bundle detector + quality + PAD + encoder + threshold + index version.
- TensorRT/ONNX: validate low-FMR tails and subgroup metrics after optimization.
- FAISS library; Milvus distributed service. ANN top-k → exact rerank → threshold.
- Templates: encrypt, purpose-limit, audit, version, delete; model upgrades need migration.

## System-design order

**requirements → threat model → data/protocol → model → operating point → fairness →
serving → monitoring/rollback → privacy → trade-offs**

## Leadership phrases

- “I would make that a release gate, not a dashboard.”
- “I’d separate the symptom by pipeline stage before retraining.”
- “Here is the security/conversion trade-off and who must approve it.”
- “The rollback unit is the complete model-and-policy bundle.”
- “I’d document uncertainty and residual risk rather than claim the bias is solved.”
