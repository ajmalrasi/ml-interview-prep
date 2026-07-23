# 4 · Fairness in Biometric Systems

**TL;DR:** Fairness is not one score. Measure every consequential stage by governed
subgroups and intersections at the same product operating point, quantify uncertainty,
then fix the mechanism causing disparity.

## Where disparity enters

- historical collection imbalance and consent constraints;
- lower image quality for some devices, geographies or skin-tone/lighting interactions;
- inaccurate or socially ambiguous demographic labels;
- detector/landmark failures before matching;
- identity-label noise and duplicate leakage;
- global thresholds interacting with different score distributions;
- liveness or quality gates creating unequal failure-to-acquire;
- production traffic differing from the benchmark.

## What to report

For each approved subgroup and relevant intersection:

- sample/identity/trial counts and missing-label rate;
- acquisition and quality rejection;
- PAD attack and bona fide errors;
- FMR and FNMR at the **same frozen threshold**;
- TAR at the target global FMR, plus group-specific confidence intervals;
- retry/manual-review and journey completion;
- latency or device failures when they affect access.

Aggregate results remain necessary, but they cannot replace worst-group and intersectional
analysis.

## Important nuance

Using a different threshold per demographic group may equalize one metric but requires
knowing or inferring a sensitive attribute, creates policy/legal concerns, and can move
harm to another error type. Treat it as a product-policy decision, not a hidden modeling
trick. First investigate data, quality, capture guidance and representation.

The [NIST Face Recognition Technology Evaluation](https://pages.nist.gov/frvt/)
is a useful primary reference for demographic and operational evaluation.

→ Next: **[Subgroup Measurement & Uncertainty](measurement.md)**.
