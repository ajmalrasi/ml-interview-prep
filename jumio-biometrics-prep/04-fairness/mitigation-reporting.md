# Fairness Mitigation, Thresholds & Reporting

**TL;DR:** Mitigate the measured failure mechanism, then re-evaluate security and
customer-friction trade-offs. Do not optimize a fairness ratio in isolation.

## Diagnosis-to-action map

| Evidence | Likely intervention |
|---|---|
| subgroup has smaller/blurrier faces | capture UX, camera handling, quality-aware recapture |
| detector miss disparity | targeted detector data and threshold analysis |
| within-group genuine scores shift low | harder positive variation, quality-aware loss, alignment review |
| impostor tail shifts high | identity-label audit, hard negatives, representation/model changes |
| PAD bona fide rejection disparity | representative bona fide data and sensor/illumination analysis |
| gap appears only on one device/region | domain coverage, device calibration, routing or fallback |

## Mitigation ladder

1. Fix label errors, duplicates and preprocessing inconsistencies.
2. Improve capture guidance and quality-aware retry.
3. Add governed data for the exact missing condition.
4. Rebalance by identity and condition; use careful sample weighting.
5. Apply augmentation that represents a real capture process.
6. Try quality-aware or margin/model changes.
7. Add abstention/manual review for uncertain high-risk cases.
8. Consider policy/threshold changes only with explicit legal and product review.

Synthetic data can increase coverage, but a generator may reproduce its own demographic
stereotypes or add artifacts the classifier exploits. Validate identity uniqueness,
realism, downstream lift and subgroup impact on real held-out data.

## Fairness release card

Every model release should record:

- intended use and excluded uses;
- dataset/protocol and label provenance;
- global and subgroup operating metrics with intervals;
- worst slices and known limitations;
- changes versus champion model;
- mitigation attempted and residual risk;
- owner, approval and rollback rule.

## Staff-level communication

Present a trade-off curve, not a promise:

> “At the current global threshold the candidate reduces the worst-group FNMR from 6.0%
> to 3.8% while global FMR remains within its confidence bound at the required security
> point. Failure-to-acquire also drops 0.7 points. The remaining gap is concentrated in
> low-light front-camera captures, so I recommend a bounded rollout plus targeted capture
> work rather than a group-specific threshold.”
