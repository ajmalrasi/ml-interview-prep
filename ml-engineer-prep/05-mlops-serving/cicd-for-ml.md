# CI/CD & Pipelines for ML

**TL;DR:** CI/CD automates the path from a code change to a deployed model — building,
testing, and releasing without manual steps. ML adds a twist: you also automate
**retraining** and you test **data and models**, not just code. And you roll out new
models gradually so a bad one can't take down everything.

## CI/CD, quickly

**Continuous Integration (CI)** = every code change is automatically built and tested.
**Continuous Delivery/Deployment (CD)** = passing changes are automatically released to
production (or staged for one click). The point is to make releases **frequent, small,
and safe** instead of rare and scary.

## What's different for ML

Regular CI/CD tests code. ML pipelines also need to test the things that make ML break:

- **Data validation** — is the incoming data schema/distribution sane? (section 2)
- **Model validation** — does the retrained model beat a threshold and the current
  production model on a holdout, before it's allowed out?
- **The training pipeline itself** is automated — data → features → train → evaluate →
  register — so retraining is a repeatable pipeline, not a person in a notebook. This is
  sometimes called **Continuous Training (CT)**, the extra "CT" in MLOps.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">code / data change</span>
    <span class="arw"></span>
    <span class="node">CI<span class="nsub">tests + data checks</span></span>
    <span class="arw"></span>
    <span class="node">train pipeline</span>
    <span class="arw"></span>
    <span class="node">evaluate vs prod</span>
    <span class="arw labeled"><span class="al">if better &amp; valid</span></span>
    <span class="node">register</span>
    <span class="arw"></span>
    <span class="node">CD<span class="nsub">staged rollout</span></span>
    <span class="arw"></span>
    <span class="node out">monitor <span class="nsub">§6</span></span>
  </div>
</div>
```

## Safe rollout strategies

You never flip 100% of traffic to a new model blindly. Standard patterns:

- **Canary** — send a small slice of traffic (say 5%) to the new model, watch metrics,
  then ramp up if healthy.
- **Blue-green** — run new (green) alongside old (blue); switch traffic over once green
  is verified, and switch back instantly if not.
- **Shadow** — run the new model on real traffic *without using its output*, just
  logging it, to compare against production safely before it makes any real decision.

These give you the two things production needs: **catch a bad model on a fraction of
traffic**, and **roll back fast**.

## Maturity levels (a nice framing to name)

Teams progress from **manual** (notebook → hand-deploy), to **automated pipelines**
(one click retrains and deploys), to **full CI/CD/CT** (data or drift triggers an
automated retrain, validate, and staged rollout). Knowing this ladder lets you place a
team — and answer "how would you improve their MLOps?"

## 🔗 Connecting the dots — the real stack

CI is **GitHub Actions** / **GitLab CI** / **Jenkins**; ML *pipelines* (data → train → eval → register) are **Kubeflow Pipelines**, **Vertex Pipelines**, **Airflow**, or **Argo Workflows**; gradual rollout uses **Argo Rollouts** or **KServe** canary. Data/model validation gates use **Great Expectations** and a metric threshold check.

**How you'd say it:** *"A push triggers GitHub Actions to run tests and data checks, then a Kubeflow pipeline retrains and evaluates against production; if it wins, it registers and canaries out via KServe."*

## Self-check

- What's the extra "CT" in MLOps beyond CI/CD? *(Continuous Training — automated
  retraining pipelines.)*
- Two things ML CI/CD tests that regular CI/CD doesn't? *(data validation and model
  validation against a threshold/production model.)*
- Name two safe-rollout strategies. *(canary, blue-green, shadow — any two.)*
