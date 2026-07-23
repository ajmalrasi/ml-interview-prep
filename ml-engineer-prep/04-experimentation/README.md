# 4: Experimentation

**TL;DR:** ML is empirical — you don't know what works until you test it. This section
is how you test *honestly*: splitting data so your metrics mean something, tracking
experiments so you can reproduce winners, and running online A/B tests to prove the
model actually helps the business.

## Why a whole section on this

The JD asks for "running ML tests and experiments and statistical analysis." The skill
isn't running one model — it's setting up a process where results are **trustworthy and
reproducible**. Most bad ML decisions come from fooling yourself with a leaky split or
an untracked lucky run. Getting experimentation right is what separates rigor from
guesswork.

## The three pages

- **Validation & data splits** — train/validation/test, cross-validation, and the
  time-series gotcha.
- **Experiment tracking** — logging runs so results are reproducible and comparable.
- **Online A/B testing & stats** — proving the model helps real users, and reading the
  statistics without being fooled.

→ Start: **[validation-splits.md](validation-splits.md)**
