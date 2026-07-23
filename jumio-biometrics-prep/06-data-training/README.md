# 6 · Data, Training & Synthetic Faces

**TL;DR:** A face model needs many clean identities, meaningful within-identity variation
and governed demographic/operating coverage. The pipeline must make identity leakage and
dataset lineage impossible to ignore.

## Dataset unit

Think in identities and sessions, not only images:

- stable internal subject identifier;
- capture session/device/source;
- consent, purpose and retention metadata;
- image/quality/condition labels;
- duplicate and identity-resolution status;
- split assignment fixed at subject level.

Balance counts at several levels: identities, images per identity, genuine trials,
impostor trials and operating conditions. Equal image counts can still leave one group
with fewer identities or less cross-session variation.

## Reproducibility contract

Every experiment should identify:

- immutable dataset manifest and query;
- label/consent policy version;
- preprocessing and augmentation version;
- code/container commit;
- model initialization and config;
- distributed-training topology;
- evaluation protocol and threshold;
- output artifact and lineage.

## Training stack

The JD expects PyTorch/TensorFlow/JAX fluency, multi-GPU scaling and AWS ownership. The
interview answer should connect them:

> “Airflow materializes a validated, identity-disjoint manifest in S3; a versioned
> container launches DDP/FSDP training on SageMaker or EC2; checkpoints and metrics go to
> S3/MLflow; an evaluation job runs biometric, fairness, PAD and latency gates before a
> signed ONNX/TensorRT artifact enters the registry.”

→ Next: **[Balanced Datasets & Airflow Pipelines](dataset-pipelines.md)**.
