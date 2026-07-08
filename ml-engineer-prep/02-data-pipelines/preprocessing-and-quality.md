# Preprocessing & Data Quality

**TL;DR:** Raw data is never model-ready. Preprocessing turns it into clean numeric
inputs — handling missing values, scaling, encoding categories — and data-quality
checks stop bad data from silently poisoning your model. This is unglamorous and it's
half the job.

## Common preprocessing steps

- **Missing values** — drop rows, or *impute* (fill with mean/median/mode, or a
  model-based guess). Which you choose depends on how much is missing and why.
- **Scaling / normalization** — put numeric features on a comparable range
  (standardization to mean 0 / std 1, or min-max to 0–1). Essential for distance- and
  gradient-based models (linear models, neural nets, k-NN); tree models don't care.
- **Encoding categoricals** — turn categories into numbers: **one-hot** for low-
  cardinality (color = red/green/blue), **target/embedding** encoding for high-
  cardinality (zip code, user ID).
- **Outlier handling** — cap, remove, or transform extreme values that would distort
  training.
- **Text/date parsing** — extract usable features (day-of-week, tokens, embeddings).

## The leakage trap (interviewers love this)

**Data leakage** is when information that won't be available at prediction time sneaks
into training — and it makes your offline metrics look amazing and your production
model fail. Two classic forms: (1) computing scaling or imputation statistics on the
*whole* dataset before splitting, so test information leaks into training — always fit
preprocessing on the training split only; (2) including a feature that's a proxy for
the answer (e.g. "account_closed_date" when predicting churn). If a model seems too
good to be true, suspect leakage first.

## Data quality: stop bad data early

A model can't tell good data from bad — it'll happily train on corrupted inputs. So
you validate data *before* it reaches the model, checking things like: are values in
expected ranges, are required fields present, did the schema change, is the
distribution similar to before? Tools like **Great Expectations** or built-in
validation in feature/pipeline platforms automate this. The principle: **fail fast and
loudly** on bad data rather than let it silently degrade the model — a bad-data alert
is cheap, a mysteriously worse model in production is expensive.

## 🔗 Connecting the dots — the real stack

Transforms run in **pandas / Polars** (small) or **Spark** (big); wrap them in a **scikit-learn Pipeline** so preprocessing is fit on the train split only (no leakage). Data-quality gates use **Great Expectations**, **Pandera**, or **Evidently**, run as an Airflow step that fails the pipeline loudly on bad data.

**How you'd say it:** *"Every pipeline had a Great Expectations check as its first step — schema, nulls, ranges — so bad upstream data failed the run instead of silently degrading the model."*

## Self-check

- Which models need feature scaling and which don't? *(gradient/distance-based need
  it; tree-based don't.)*
- What is data leakage and one way it happens? *(train-time use of info unavailable at
  prediction; e.g. fitting the scaler on all data before the split.)*
- Why validate data before training? *(models can't detect bad data; catch it early
  and loudly instead of shipping a silently worse model.)*
