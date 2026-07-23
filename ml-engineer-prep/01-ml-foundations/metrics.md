# Evaluation Metrics

**TL;DR:** "Accuracy" is often misleading — especially when classes are imbalanced.
Pick the metric that matches what the business actually cares about: catching all the
positives, or being right when you flag one, or ranking well. Know the handful below
and *when* each applies.

## Classification metrics

Start from the **confusion matrix** — true/false positives and negatives — because
every metric is built from it.

- **Accuracy** = fraction correct. Fine when classes are balanced; **dangerous when
  they're not**. A fraud model that predicts "never fraud" can be 99.9% accurate and
  useless.
- **Precision** = of the items you flagged positive, how many really were. Use when a
  false positive is costly (flagging a good transaction as fraud annoys customers).
- **Recall (sensitivity)** = of the actual positives, how many you caught. Use when a
  miss is costly (missing a cancer, missing real fraud).
- **F1** = harmonic mean of precision and recall — one number when you need to balance
  both, and the go-to for imbalanced classes.
- **ROC-AUC** = how well the model ranks positives above negatives across all
  thresholds; threshold-independent. **PR-AUC** is better than ROC-AUC when positives
  are rare.

The key insight: **precision and recall trade off**, and the trade is set by your
decision threshold. Moving the threshold to catch more positives (higher recall)
usually flags more false ones (lower precision).

### Try it: move the threshold

Each dot is one example scored by the model — **green = actually positive**, gray =
actually negative. Drag the threshold: everything to its right is *predicted positive*.
Watch precision and recall move in opposite directions.

```rawhtml
<div id="pr-widget" class="prw"></div>
```

## Regression metrics

- **MAE** (mean absolute error) — average miss in the original units; robust to
  outliers.
- **RMSE** (root mean squared error) — like MAE but punishes big misses harder; use
  when large errors are especially bad.
- **R²** — fraction of variance explained (1 = perfect, 0 = no better than the mean).

## Say this in the interview

*"I pick the metric from the cost of errors. For imbalanced classification I ignore
accuracy and look at precision, recall, and F1 or PR-AUC — and I choose between
precision and recall based on whether a false alarm or a miss is more expensive."*
That reasoning matters more than reciting formulas.

## Offline vs online

These are **offline** metrics on held-out data. In production the metric that really
counts is a **business** one — click-through, revenue, retention — measured by an A/B
test (section 4). A model can improve F1 and still lose money; always tie the offline
metric back to a business outcome.

## 🔗 Connecting the dots: the real stack

Compute these with **scikit-learn** (`sklearn.metrics`), **torchmetrics**, or HuggingFace **evaluate**, and log them per run in **MLflow / W&B**. The *business* metric that ultimately decides shipping is measured by an experimentation platform (**Optimizely / Statsig**) via an A/B test, not offline.

**How you'd say it:** *"Offline I track F1/PR-AUC in MLflow; the decision to ship is made on the online metric from an A/B test."*

## Self-check

- Why is accuracy misleading for fraud detection? *(class imbalance — predicting the
  majority class scores high while catching nothing.)*
- False positives are expensive — precision or recall? *(precision.)* A miss is
  expensive? *(recall.)*
- Rare positives — ROC-AUC or PR-AUC? *(PR-AUC.)*
