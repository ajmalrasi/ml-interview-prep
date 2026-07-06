# Anomaly Detection Methods

**TL;DR:** An anomaly is a problem you can't specify — you can't list the bad cases,
so you can't write a rule. Every method here gets around that the same way: learn
what *normal* looks like, then measure how far a new observation strays from it. What
separates the methods is only *what* they treat as "normal" — a number, a
still frame, a motion pattern, a prediction of the future — and how much labelled
data they demand. Once you see that shared skeleton, the zoo of techniques becomes a
short, ordered menu.

## First, make sure it's actually an anomaly

The most valuable instinct here is to *shrink* the problem before reaching for a
fancy model. If you can name the bad thing — "a person in this zone for more than
thirty seconds" — then it isn't an anomaly at all, it's an event, and a rule from the
previous page will catch it with far higher precision. Save true anomaly detection
for the genuinely open-ended part of the brief: "flag anything unusual on this
platform." Interviewers respect the candidate who narrows the question first, because
it shows judgement rather than reflexive model-reaching.

## The menu, from least to most supervision

**Start with plain statistics, no learning at all.** Track a single meaningful number
— occupancy, average speed, flow rate — and flag it when it strays. A robust z-score
(using the median and MAD so a few outliers don't poison your baseline) or an EWMA
control chart will catch a surge, or the onset of a stampede where speed spikes while
density does too. The crucial refinement is seasonality: "normal" for a mall at 6pm
is nothing like 6am, so you compare against the same time-of-week, not a global
average, or you'll alarm every single rush hour. This tier is cheap, explainable, and
should almost always be your first line.

**Next, classical unsupervised learning on features.** Extract features — trajectory
shapes, flow histograms, appearance embeddings — and fit a model of where "normal"
lives in that feature space: a one-class SVM, an isolation forest, a Gaussian mixture
or KDE. The anomaly score is simply how far outside the learned normal region a new
sample sits.

**Then the reconstruction idea — the autoencoder.** Train an autoencoder on *only*
normal footage. It gets very good at rebuilding the normal scenes it was trained on,
but when something genuinely unusual appears, it can't reconstruct it well — and that
reconstruction error *is* your anomaly score.

```
frame → encoder → small latent code → decoder → reconstruction
anomaly score = how different the reconstruction is from the input (high = unusual)
```

The appeal is that it's self-supervised: you only need normal footage, which you have
in abundance, and no anomaly labels, which you don't. The famous failure is
counter-intuitive — a *too-powerful* autoencoder generalises so well that it happily
reconstructs anomalies too, so the error stays low and the anomaly slips through.
Memory-augmented variants (MemAE) exist precisely to hobble that over-generalisation.

**Then prediction-based methods, for things that move.** Instead of rebuilding the
current frame, predict the *next* one (or the next few positions) from recent history
with something like a future-frame predictor or an LSTM over trajectories. A large
prediction error means reality did something the model of normal didn't expect —
which is exactly how you catch *motion* anomalies like someone running the wrong way
or a crowd suddenly scattering, the kind of thing a single-frame autoencoder misses.

**And the motion-specific classic, optical-flow modelling.** Build a model of the
normal motion field — the usual directions and magnitudes of movement in each region
— and flag frames whose flow breaks the pattern: people running in a walking area,
reverse flow, a crowd abruptly dispersing in panic. It's light and remarkably
effective for crowd-motion anomalies specifically.

**Finally, the modern embedding approach.** Embed short clips with a pretrained
self-supervised video backbone and score anomalies by distance from normal
embeddings — or, if you happen to have a *few* labelled incidents, use weakly
supervised multiple-instance learning on video-level labels (the UCF-Crime style).

## Choosing, in one breath

If you want something explainable over a few scalar metrics, use the statistical tier.
If the oddity is about *appearance* and you only have normal footage, reach for an
autoencoder. If it's about *motion* — running, panic, wrong-way — use optical-flow or
prediction error, not a still-frame model. And if you're lucky enough to have some
labelled incidents, weak supervision on embeddings will beat the purely unsupervised
options.

## The gotchas that haunt every method

Three problems apply no matter which technique you pick. "Normal" **drifts** —
lighting, seasons, a rearranged layout — so a frozen model of normal slowly turns
into a false-alarm generator, which is exactly why it ties into the monitoring and
retraining loop in section 13. The **base rate** is brutal: real anomalies are rare,
so even a model that's 99% specific will bury operators in false positives, which is
why the alerting design on the next page matters more than the detector itself. And
you usually have **no ground truth** for recall — you can't measure what you never
caught — so you validate on injected or known incidents and on the precision of what
actually fired.

**Self-check.** When do you use a rule instead of a learned anomaly model? *(when you
can name the bad thing — nameable means event means rule; open-ended means learned.)*
Why can a *too-good* autoencoder miss anomalies? *(it reconstructs them well too, so
the error stays low and nothing fires.)* Which method best catches "the crowd suddenly
runs"? *(an optical-flow or prediction-error motion model — a single-frame autoencoder
would miss it.)* And why does seasonality matter? *(normal depends on time of day and
week; compare like with like or you alarm at every rush hour.)*
