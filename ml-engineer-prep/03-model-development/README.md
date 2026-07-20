# 3 — Model Development

**TL;DR:** This is the "designing and developing ML/DL systems" bullet. Two worlds:
**classical ML** (still the winner on tabular data, mostly boosted trees) and **deep
learning** (for images, text, audio, and huge datasets). Plus how you train when data
or models outgrow one machine, and how you tune the knobs.

## The honest framing

Deep learning gets the headlines, but a huge share of real business ML is still
gradient-boosted trees on tabular data. A strong ML engineer knows *both* and picks by
the problem, not the hype. This section gives you enough of each to reason well and to
answer "how would you model this?" credibly.

## The five pages

- **Classical ML** — trees, random forests, and gradient boosting (XGBoost/LightGBM):
  the tabular workhorses.
- **Deep learning essentials** — neurons, backprop, and the main architectures (CNN,
  RNN/Transformer) at a level you can discuss.
- **PyTorch, TensorFlow & Keras in practice** — what changes between frameworks and
  the production training loop invariants that do not.
- **Training at scale** — what to do when data or the model won't fit on one machine.
- **Hyperparameter tuning** — how to search the knobs efficiently.

→ Start: **[classical-ml.md](classical-ml.md)**
