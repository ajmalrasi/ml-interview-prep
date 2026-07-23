# 3 · Biometric Evaluation

**TL;DR:** A biometric model is not “98% accurate.” It has score distributions and
threshold-dependent error rates under a declared protocol. Always name the task,
population, operating conditions and operating point.

## Genuine and impostor trials

- A **genuine** trial compares two samples of the same identity.
- An **impostor** trial compares samples from different identities.
- The matcher produces a similarity score; a threshold turns the score into accept/reject.

The benchmark protocol determines which pairs exist. Use subject-disjoint partitions and
make pairs resemble the product: selfie-to-ID, cross-device authentication, cross-age
comparison, or open-set gallery search.

## Evaluation layers

1. **Acquisition:** could the system capture a usable face?
2. **PAD/liveness:** did it distinguish bona fide presentation from attack?
3. **Matching:** did the face comparison make the correct decision?
4. **Journey:** did the combined policy approve good users, stop attacks and preserve
   conversion under latency and fairness constraints?

Report each layer plus end-to-end performance. Conditional matcher metrics alone hide
people rejected upstream.

## Required claims

A defensible result states:

- dataset/source and collection purpose;
- number of identities and trials;
- subject-disjoint split and duplicate controls;
- capture conditions and demographic coverage;
- threshold-selection dataset;
- metric with confidence interval;
- model, preprocessing and index version.

→ Next: **[FMR, FNMR, TAR@FAR & Thresholds](metrics-thresholds.md)**.
