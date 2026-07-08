# Hyperparameter Tuning

**TL;DR:** Hyperparameters are the settings you choose *before* training (learning
rate, tree depth, regularization strength) — as opposed to parameters the model learns.
Tuning searches for the best combination. Know the search strategies and, crucially,
how to tune *without* fooling yourself.

## Parameters vs hyperparameters

**Parameters** are learned from data (the weights). **Hyperparameters** are knobs *you*
set: learning rate, number of trees, max depth, dropout rate, batch size. The model
can't learn these itself, so you search for good values.

## Search strategies

- **Grid search** — try every combination in a predefined grid. Thorough but explodes
  combinatorially; wasteful because most combinations are bad.
- **Random search** — sample combinations at random. Surprisingly, it usually beats
  grid search for the same budget, because only a few hyperparameters actually matter
  and random sampling explores those more efficiently.
- **Bayesian optimization** — build a model of "which settings look promising" from
  past trials and focus the search there. More sample-efficient; used by tools like
  **Optuna**, Hyperopt, and cloud tuners.
- **Early-stopping search (Hyperband/ASHA)** — start many configs, kill the bad ones
  early, give survivors more budget. Great when each training run is expensive.

Order of preference in practice: random or Bayesian over grid; add early-stopping when
runs are costly.

## The pitfall: tuning on the test set

If you tune hyperparameters against your **test** set, you've secretly leaked it — the
test score is now optimistic and won't hold in production. The fix is a **validation**
set (or cross-validation, section 4): tune on validation, and touch the test set only
*once* at the very end for an honest estimate. This is a favorite "what's wrong with
this workflow?" interview trap.

## Track everything

Tuning produces dozens or hundreds of runs, so you log each config and its score with
an experiment tracker (section 4) — otherwise you can't reproduce the winner or know
why it won.

## 🔗 Connecting the dots — the real stack

**Optuna** is the popular Bayesian/pruning library; **Ray Tune** parallelizes big searches; **W&B Sweeps** and the **SageMaker / Vertex** built-in tuners do it as a managed service. Every trial's config and score is logged to the experiment tracker so the winner is reproducible.

**How you'd say it:** *"I run Optuna with early-stopping pruning, parallelized on Ray Tune, and log every trial to MLflow so I can reproduce the best config."*

## Self-check

- Parameter vs hyperparameter? *(learned from data vs set by you before training.)*
- Why does random search often beat grid search? *(few hyperparameters matter; random
  sampling explores them better per unit budget.)*
- Why never tune on the test set? *(it leaks the test set, giving an optimistic score;
  tune on validation, use test once at the end.)*
