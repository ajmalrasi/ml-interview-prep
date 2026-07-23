# Multi-GPU Training & Synthetic Face Data

**TL;DR:** Scale the clean baseline first, then use synthetic data only for a measured
coverage gap. Demonstrate lift on real, held-out identities and conditions.

## Multi-GPU face training

Face classification can involve millions of identities/classes, making the classifier
weights and sampling strategy significant. A practical progression:

1. establish a deterministic single-GPU baseline;
2. use AMP/BF16 and maximize stable batch size;
3. move to DDP for data parallelism;
4. shard optimizer/model/classifier state with FSDP/ZeRO or partial-FC techniques when
   memory demands it;
5. checkpoint model, optimizer, scaler, sampler and RNG state;
6. validate effective batch, learning-rate schedule and negative sampling after scaling.

Measure images/sec, GPU utilization, dataloader wait, all-reduce time and validation
metrics. More GPUs are not a win if communication or S3 input starves them.

## Synthetic data use cases

- rare pose/illumination/device combinations;
- age progression or appearance variation;
- controlled occlusions and accessories;
- presentation attacks for defensive research;
- privacy-constrained prototyping.

## Risks

- memorization or near-copying of training identities;
- demographic stereotypes and unmeasured representation gaps;
- identity collisions across synthetic samples;
- generator artifacts becoming shortcuts;
- unrealistic within-identity consistency;
- license, consent and provenance ambiguity.

## Acceptance protocol

1. State the missing real-data slice.
2. Generate with versioned prompts/models/seeds and provenance.
3. Filter for quality, duplicates and identity similarity to protected datasets.
4. Train real-only baseline and controlled real+synthetic variants.
5. Evaluate on untouched **real** benchmark identities.
6. Report overall, low-FMR, fairness and condition-specific deltas.
7. Keep synthetic proportion and ablations visible.

Synthetic test data can probe known dimensions but cannot replace real-world evaluation.

## Interview answer

> “I use synthetic faces as a targeted intervention, not a diversity checkbox. I define
> the gap, audit identity leakage and generator bias, run an ablation, and require
> improvement on real subject-disjoint data at the production operating point.”

Reuse distributed training and NCCL deep dives in the
[ML Engineer track](http://192.168.3.20:9002/#08-optimization-scaling/distributed-training.md).
