# Validation & Data Splits

**TL;DR:** You split data into **train** (fit the model), **validation** (tune and
choose), and **test** (a final honest estimate touched once). Cross-validation makes
this more robust on limited data. And time-series data needs a special split or you
cheat by predicting the past from the future.

## The three-way split

- **Training set** — the model learns its parameters here.
- **Validation set** — you tune hyperparameters and compare models here.
- **Test set** — a locked box you open *once* at the end to estimate real-world
  performance.

The reason for three (not two) is subtle but important: if you both tune *and* report
on the same held-out set, you've indirectly fit to it, so its score is optimistic. The
test set stays untouched during development precisely so its number is trustworthy.

## Cross-validation

With limited data, a single validation split is noisy — you might get lucky or unlucky.
**k-fold cross-validation** splits the data into k parts, trains k times (each time
holding out a different part as validation), and averages the scores. You get a more
stable estimate and use all your data for both roles. Standard k is 5 or 10. Use it
when data is scarce; skip it when data is huge and one split is plenty.

```
5-fold: [test][    train    ]   fold 1
        [train][test][train ]   fold 2  ... average the 5 scores
```

## The time-series trap

If your data has time order (sales, sensor readings, user events), a *random* split
lets the model train on future data and predict the past — leakage that inflates your
score and collapses in production. Instead, split **by time**: train on earlier data,
validate/test on later data (a "rolling" or "expanding window" split). Whenever the
problem has a time dimension, say this unprompted — it's a common gotcha.

## Class imbalance in splits

When one class is rare, use **stratified** splitting so each split keeps the same class
ratio — otherwise a fold might contain almost no positives and give meaningless scores.

## 🔗 Connecting the dots — the real stack

In practice this is **scikit-learn** `model_selection`: `KFold`, `StratifiedKFold` for imbalance, `TimeSeriesSplit` for time-ordered data, and `cross_val_score` / `cross_validate` to run it. Pair it with **DVC** or a Delta snapshot so the *exact* split and data version are reproducible.

**How you'd say it:** *"For time-series I use `TimeSeriesSplit` so I never train on the future, and I version the dataset with DVC so a split is reproducible."*

## Self-check

- Why three splits instead of two? *(tuning and reporting on the same set makes the
  score optimistic; test stays untouched for an honest estimate.)*
- When is cross-validation worth it? *(limited data — it gives a stable estimate and
  uses all data; less needed when data is huge.)*
- How do you split time-series data and why? *(by time, train on past / test on future;
  a random split leaks the future.)*
