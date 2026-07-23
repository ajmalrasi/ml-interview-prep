# Classical ML (Trees & Boosting)

**TL;DR:** For structured/tabular data, tree-based models — especially **gradient
boosting** (XGBoost, LightGBM) — are usually the best choice: accurate, fast, and
needing little preprocessing. Understand how a tree splits, and the two ways to combine
many trees (bagging vs boosting).

## A decision tree

A tree asks a series of yes/no questions on features ("age > 30?", "country = UK?"),
splitting the data to separate the classes. It's wonderfully **interpretable** but a
single deep tree **overfits** — it memorizes the training data. So in practice you
combine many trees, and there are two ways to do that.

## Bagging vs boosting (the key distinction)

- **Bagging (Random Forest)** — train many trees **in parallel**, each on a random
  subset of data and features, then average their votes. Averaging independent trees
  *reduces variance*, so a forest is robust and hard to overfit, with little tuning.
  Great, sturdy default.
- **Boosting (XGBoost, LightGBM)** — train trees **in sequence**, where each new tree
  focuses on the errors the previous ones made. This *reduces bias* and typically
  reaches higher accuracy, at the cost of more careful tuning (it can overfit if you
  push it).

```rawhtml
<div class="compare">
  <div class="cmp-col accent">
    <div class="cmp-h">Bagging</div>
    <p>Many trees in <b>parallel</b>, then average their votes.</p>
    <span class="cmp-tag">cuts variance · robust · Random Forest</span>
  </div>
  <div class="cmp-col accent">
    <div class="cmp-h">Boosting</div>
    <p>Trees in <b>sequence</b>, each fixing the last one's mistakes.</p>
    <span class="cmp-tag">cuts bias · top accuracy · XGBoost</span>
  </div>
</div>
```

## Why boosting wins on tabular data

Gradient boosting consistently tops leaderboards and production systems for structured
data because it captures complex feature interactions, handles mixed feature types,
needs no scaling, and is fast. When someone hands you a table of rows and columns, the
correct first instinct is *"gradient-boosted trees"* — and being able to say *why*
(sequential error-correction, low bias, minimal preprocessing) is the mark of
experience.

## Interpretability

Trees are more explainable than neural nets — you can see which features matter
(**feature importance**), and **SHAP values** explain individual predictions. In
regulated settings (finance, healthcare) this interpretability is often a requirement,
not a nicety, and it's a point worth raising.

## 🔗 Connecting the dots: the real stack

The workhorses are **XGBoost**, **LightGBM**, and **CatBoost**, usually driven through **scikit-learn** Pipelines; explainability comes from **SHAP** (per-prediction) and built-in feature importances. Training and tuning run on a single big VM or a managed job (**SageMaker / Vertex / Databricks**).

**How you'd say it:** *"For a tabular churn model I'd train LightGBM in a scikit-learn Pipeline, explain it with SHAP for the compliance team, and log everything to MLflow."*

## Self-check

- Bagging vs boosting in one line each? *(parallel trees averaged to cut variance vs
  sequential trees correcting errors to cut bias.)*
- Best default for tabular data and why? *(gradient boosting — accuracy, handles
  interactions, minimal preprocessing.)*
- How do you explain a tree model's predictions? *(feature importance; SHAP for
  per-prediction explanations.)*
