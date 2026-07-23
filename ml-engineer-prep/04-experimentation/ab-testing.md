# Online A/B Testing & Stats

**TL;DR:** Offline metrics (F1, AUC) tell you a model is *technically* better; only an
online **A/B test** tells you it's *actually* better for users and the business. You
split live traffic between the old and new model and measure a business metric, then use
statistics to check the difference is real, not noise.

## Why offline isn't enough

A model can improve offline accuracy and still hurt the product — maybe it's slower,
maybe the metric didn't capture what users care about, maybe the training data doesn't
match live traffic. The only proof is exposing it to real users. This is the gap between
"data scientist" (offline metric) and "ML engineer" (does it move the real number).

## How an A/B test works

Randomly split users into a **control** group (current model, "A") and a **treatment**
group (new model, "B"), run both live, and compare a **business metric** — click-through
rate, conversion, revenue per user, retention. Randomization is what makes the two
groups comparable, so any difference is attributable to the model.

```rawhtml
<div class="diagram">
  <div class="branch">
    <span class="node data">users</span>
    <span class="split-arw" title="randomly split"></span>
    <div class="fork">
      <span class="node">A: current model<span class="nsub">measure metric</span></span>
      <span class="node soft">B: new model<span class="nsub">measure metric</span></span>
    </div>
    <span class="varw"></span>
    <span class="node out">compare</span>
  </div>
</div>
```

## Reading the statistics (without fooling yourself)

The difference you observe could be luck, so you test for **statistical significance**:

- **p-value** — roughly, the chance of seeing this difference if the models were
  actually equal. A small p-value (< 0.05 by convention) means the result is unlikely to
  be noise. It does **not** mean the effect is large.
- **Statistical power / sample size** — you need enough users, run for enough time, to
  detect a real effect. Peeking early and stopping when it looks good inflates false
  positives.
- **Practical significance** — a tiny but "significant" lift may not be worth the risk
  and cost of shipping. Significance ≠ importance.

The mature answer: *"I confirm the lift on the business metric is statistically
significant with an adequate sample and run duration, and I also check it's large
enough to matter in practice — and I watch guardrail metrics like latency and error
rate so a 'winning' model isn't quietly breaking something else."*

## Common pitfalls

Stopping the test the moment it looks good (**peeking**), running too short to see
weekly cycles, ignoring **novelty effects** (users react to *any* change at first), and
forgetting **guardrail metrics** (a model that lifts clicks but tanks latency or revenue
is not a win).

## 🔗 Connecting the dots: the real stack

Live experiments run through a feature-flag / experimentation platform — **Optimizely**, **Statsig**, **LaunchDarkly**, or **GrowthBook** — which handles the traffic split and significance math; ad-hoc stats use **scipy** / **statsmodels**. The model itself is served behind a flag so you can ramp or roll back instantly (ties to canary in §5).

**How you'd say it:** *"We shipped the new model behind a Statsig flag to 5% of traffic, watched the business metric and guardrails (latency, errors), and ramped only after it was significant."*

## Self-check

- Why A/B test if offline metrics already improved? *(offline ≠ business impact; live
  users are the only real proof.)*
- What does a p-value below 0.05 tell you — and not tell you? *(the difference is
  unlikely to be noise; it does NOT say the effect is large.)*
- Name two A/B pitfalls. *(peeking/early stopping, too-short duration, novelty effect,
  ignoring guardrails — any two.)*
