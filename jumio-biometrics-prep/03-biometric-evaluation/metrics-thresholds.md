# FMR, FNMR, TAR@FAR, EER & Thresholds

**TL;DR:** Lowering the threshold accepts more genuine users but also more impostors.
Security products therefore report genuine acceptance at a fixed, suitably low false
match rate rather than choosing the most flattering aggregate metric.

## Core definitions

At threshold `t` for a similarity matcher:

- **FMR** (false match rate): fraction of impostor trials with score ≥ `t`.
- **FNMR** (false non-match rate): fraction of genuine trials with score < `t`.
- **TAR/GAR**: true/genuine accept rate = `1 − FNMR`.
- **FRR/FAR:** often used informally, but standards distinguish transaction/system
  failures from matcher-only FNMR/FMR. Define terminology explicitly.
- **EER:** point where FMR equals FNMR. Useful as a compact comparison, rarely the
  production operating point.

If the security requirement is FMR ≤ `10⁻⁵`, report **TAR at FMR = 10⁻⁵**. A model with
better EER can still be worse in that extreme tail.

## ROC and DET curves

ROC plots TAR against FMR. Because relevant FMR values span orders of magnitude, use a
log x-axis. A DET curve plots the two error rates on transformed axes and makes certain
tail differences easier to compare.

Do not choose a threshold on the final test set:

1. train on training identities;
2. tune model/hyperparameters on validation identities;
3. select threshold on a development/calibration set;
4. freeze everything;
5. report once on held-out identities and conditions.

## Statistical precision in the tail

To estimate very low FMR, you need many **independent and representative** impostor
trials. A million correlated pairs made by repeatedly using the same few people does not
provide a million independent observations.

For zero observed false matches in `n` trials, the rate is not proven to be zero. A rough
95% upper bound is approximately `3/n`. Report confidence bounds and effective sampling
structure, especially per subgroup.

## Business operating point

Threshold selection balances:

- fraud loss and account takeover risk;
- manual-review capacity;
- user abandonment and accessibility;
- regulatory/security assurance;
- retry and fallback behavior.

> “I choose the threshold from a target risk point on a representative development set,
> freeze it, and report TAR/FNMR with confidence intervals on held-out data. EER is a model
> summary, not the production policy.”
