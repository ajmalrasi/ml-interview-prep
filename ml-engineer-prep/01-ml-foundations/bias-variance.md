# Bias, Variance & Overfitting

**TL;DR:** A model can fail two ways: too simple to capture the pattern
(**underfitting / high bias**) or so complex it memorizes the training data and flops
on new data (**overfitting / high variance**). The whole craft of modeling is
balancing these two.

## The two failure modes

**High bias (underfitting)** means the model is too simple — it misses the real
relationship, so it does poorly on *both* training and test data. A straight line
trying to fit a curve. The fix is a more expressive model or better features.

**High variance (overfitting)** means the model is too complex — it fits the training
data's noise, so it looks great in training and terrible on new data. The fix is to
*simplify or constrain* it, or to give it more data.

The tell is the gap between training and validation scores: tiny gap but both bad =
underfitting; big gap (great train, poor validation) = overfitting.

```rawhtml
<div class="compare">
  <div class="cmp-col">
    <div class="cmp-h">Underfit</div>
    <ul><li>train: <b>bad</b></li><li>test: <b>bad</b></li></ul>
    <span class="cmp-tag">high bias — too simple</span>
  </div>
  <div class="cmp-col green">
    <div class="cmp-h">Good fit</div>
    <ul><li>train: <b>good</b></li><li>test: <b>good</b></li></ul>
    <span class="cmp-tag">the sweet spot</span>
  </div>
  <div class="cmp-col">
    <div class="cmp-h">Overfit</div>
    <ul><li>train: <b>great</b></li><li>test: <b>bad</b></li></ul>
    <span class="cmp-tag">high variance — memorized noise</span>
  </div>
</div>
```

**Try it.** Drag the model complexity below. Degree 1–2 underfits (both errors high);
push it toward 10–12 and the curve wriggles through every training point while test
error blows up — that's variance. The sweet spot is where test error bottoms out.

```rawhtml
<div id="bv-widget" class="widget-host"></div>
```

## The knobs that fight overfitting

This is a classic "how would you fix overfitting?" question — have the list ready:

- **More training data** — the most reliable cure; harder to memorize a bigger set.
- **Regularization** — L1/L2 penalties that discourage extreme weights; dropout in
  neural nets; shallower trees / fewer boosting rounds.
- **Simpler model** — fewer parameters/features.
- **Cross-validation** — to *detect* it honestly (section 4).
- **Early stopping** — stop training when validation loss stops improving.
- **Feature selection** — drop noisy or redundant features.

## Why this is *the* foundational idea

Every later topic connects back here. Regularization, train/val/test splits,
augmentation, monitoring for drift — all of it is really about making a model
generalize to data it hasn't seen. If you understand bias–variance, most modeling
decisions become obvious.

## 🔗 Connecting the dots — the real stack

The anti-overfitting knobs live inside the libraries: L1/L2 and `max_depth` / `min_child_weight` in **XGBoost**, `dropout` and `weight_decay` in **PyTorch**, early-stopping callbacks in **XGBoost** and **Keras**, and cross-validation in **scikit-learn**. You *detect* the gap with an experiment tracker (**MLflow / W&B**) plotting train vs validation curves.

**How you'd say it:** *"I spot overfitting from the train/validation gap in W&B, then dial in regularization and early stopping."*

## Self-check

- Great on training, poor on test — which problem and one fix? *(overfitting /
  high variance; more data or regularization.)*
- Poor on both — which problem and one fix? *(underfitting / high bias; more
  expressive model or better features.)*
- Name three overfitting cures. *(more data, regularization/dropout, simpler model,
  early stopping — any three.)*
