# Subgroup Measurement & Uncertainty

**TL;DR:** Compare error rates at a shared operating threshold, show absolute rates and
uncertainty, and inspect intersections. Ratios alone become unstable when the denominator
is tiny.

## A rigorous analysis

1. **Pre-register slices and metrics.** Do not search dozens of groups and publish only
   the largest disparity.
2. **Audit labels.** Record source, consent, missingness, uncertainty and who is excluded.
3. **Freeze the threshold.** Select it without using the final subgroup test results.
4. **Compute stage-level metrics.** Detection, quality, PAD, matching and end-to-end.
5. **Estimate uncertainty.** Bootstrap by identity/session rather than pretending every
   correlated pair is independent.
6. **Inspect intersections.** Age × gender presentation × skin tone × device/region can
   reveal mechanisms hidden by single-axis averages.
7. **Test practical significance.** A statistically detectable change may be operationally
   irrelevant; a rare but severe group failure may still require action.

## Difference and ratio

Suppose global FNMR is 2% and a subgroup FNMR is 6%:

- absolute difference = 4 percentage points;
- ratio = 3×.

Report both. If a reference FMR is 0.001%, a ratio can look enormous after one event; the
confidence interval and number of impostor trials are essential.

## Same threshold, multiple views

At minimum show:

- per-group FMR/FNMR at the global threshold;
- per-group TAR at a fixed global FMR;
- thresholds each group would require to meet the same FMR (diagnostic only);
- overall and worst-group acquisition/completion;
- error-versus-quality curves.

The diagnostic threshold spread helps reveal score-distribution shifts without silently
deploying group-specific policies.

## Avoid common mistakes

- Treating nationality or geography as a biological race label.
- Predicting demographic labels with another model and presenting them as truth.
- Balancing image counts while leaving identity counts and condition coverage skewed.
- Reporting only equalized averages after excluding failed captures.
- Declaring “no bias” when the sample is too small to detect disparity.

> “My fairness unit is the decision journey, not just the encoder. I bootstrap by identity,
> report counts and confidence intervals, keep a common production threshold visible, and
> trace a disparity back through acquisition, quality, PAD and matching.”
