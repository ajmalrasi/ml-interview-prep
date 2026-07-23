# Verification, Identification & Template Management

**TL;DR:** Verification compares one claimed pair; identification searches a gallery.
The same encoder can support both, but their metrics, failure probabilities and serving
architectures are different.

## 1:1 verification

Given normalized templates `x` and `y`, compute cosine similarity `s = x·y`. Accept when
`s ≥ threshold`. The threshold is chosen on representative development data to meet a
business/security operating point, then frozen before final evaluation.

Possible pair types in selfie-to-ID:

- selfie versus portrait extracted from an ID;
- new selfie versus enrolled selfie/template;
- multiple recent templates combined by score fusion or quality-weighted aggregation.

Document portraits introduce print, scan, crop, age and document-design variation. A
benchmark made only of two high-quality selfies will overstate production performance.

## 1:N identification

Search a query embedding against a gallery, retrieve top-k candidates, then apply a
decision threshold. Open-set search has two questions:

1. Did retrieval return the true identity when present?
2. Did the decision reject people who were not enrolled?

As the gallery grows, each query gets more impostor comparisons, increasing the chance
that at least one impostor obtains a high score. Revalidate thresholds at realistic
gallery sizes; do not transfer a 1:1 FMR directly to 1:N risk.

## Template lifecycle

Templates are sensitive derived biometric data. Treat them as versioned records:

- subject/consent and purpose reference;
- encoder and preprocessing version;
- quality and capture metadata;
- encryption/key version;
- enrollment/update timestamp;
- retention/deletion status.

An encoder upgrade changes the vector space. Options are re-enrollment, background
re-embedding from lawfully retained source captures, or dual-read migration while both
versions run. Never silently compare embeddings from incompatible models.

## Adaptive enrollment

Adding every successful authentication template can improve cross-time coverage but also
risks **template poisoning**. Require high-confidence match plus liveness, cap template
count, preserve lineage, detect sudden drift and make updates reversible.

## Interview comparison

| Question | Verification | Identification |
|---|---|---|
| Candidate count | one claim | gallery of N |
| Main errors | FMR / FNMR | FPIR / FNIR, rank-k |
| Serving primitive | pair score | ANN retrieval + rerank |
| Scale risk | transaction volume | transaction volume × gallery size |
| Threshold | one comparison distribution | depends on gallery and search protocol |
