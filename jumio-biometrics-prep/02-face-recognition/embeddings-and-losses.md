# Embeddings, Angular Margins & Hard Negatives

**TL;DR:** FaceNet popularized metric learning with triplets; ArcFace-family methods train
with a classification head and an explicit angular margin. In either case, sampling and
label quality often matter as much as the loss formula.

## Three loss families

| Method | Mechanism | Practical concern |
|---|---|---|
| Contrastive | pull genuine pairs together, push impostor pairs apart | pair count explodes; many pairs are trivial |
| Triplet / FaceNet | anchor-positive closer than anchor-negative by margin | mining controls convergence and stability |
| Angular-margin softmax | classify identities on a normalized hypersphere with margin | large class count and noisy identity labels |

For normalized embedding `x` and class weight `W`, cosine similarity is their dot product.
ArcFace adds a margin to the target angle before softmax. This directly encourages
compact intra-class clusters and separated inter-class centers in the same geometry used
at inference.

## ArcFace, CosFace and quality-aware variants

- **CosFace:** subtracts an additive cosine margin.
- **ArcFace:** adds an angular margin with a clear geometric interpretation.
- **MagFace:** relates feature magnitude to sample quality while maintaining identity
  discrimination.
- **AdaFace:** adapts the margin using a quality proxy, helping with low-quality faces.

Do not select from paper accuracy alone. Reproduce on your capture distribution and
measure low-FMR performance, fairness, latency and calibration.

## Hard negatives

Random impostor pairs quickly become too easy. Useful mining finds lookalikes or close
embeddings, but the hardest examples can be mislabeled identities, duplicates or
synthetic artifacts.

A safe loop:

1. train a baseline;
2. embed a governed candidate pool;
3. retrieve near neighbors;
4. audit duplicates and label conflicts;
5. upweight confirmed hard cases;
6. monitor subgroup composition and instability.

## Identity leakage

Split by **person**, never by image. If images of the same person appear in train and
test, the benchmark measures memorization rather than generalization to unseen identities.
Near-duplicate and cross-source identity resolution must happen before the final split.

## Interview soundbite

> “I would start with a normalized encoder and ArcFace-style objective, but the decisive
> work is identity-clean data, subject-disjoint evaluation and audited hard-negative
> mining. A clever loss cannot repair duplicate identities or leaked subjects.”

Primary references: [FaceNet](https://arxiv.org/abs/1503.03832),
[ArcFace](https://arxiv.org/abs/1801.07698), [MagFace](https://arxiv.org/abs/2103.06627),
[AdaFace](https://arxiv.org/abs/2204.00964).
