# Anomaly Detection Methods

**TL;DR:** Anomaly = "not normal," where you can't enumerate the bad cases. The
core trick is always the same: **learn a model of normal, then score how far a new
observation deviates.** They differ in *what* they model (a scalar metric, an
appearance frame, a motion pattern, a future prediction) and in how much
supervision they need. Match the method to what "normal" looks like in the scene.

## First: is it really anomaly detection?

If you can name the bad thing ("person in zone > 30 s"), it's an **event** (section
1 of this folder) — use a rule; it's higher-precision. Reserve true anomaly methods
for the **open-ended** part: "flag anything unusual on this platform." Interviewers
respect the candidate who *narrows* the problem before reaching for a fancy model.

## Method families (weakest supervision → strongest)

### 1. Statistical / metric-based (no learning)
Track a scalar (occupancy, mean speed, flow rate) and flag deviation:
- **Z-score / robust z (MAD)** — flag when a metric is > k σ from its rolling mean.
- **EWMA / control charts** — smooth baseline, flag sustained excursions.
- **Seasonal baselines** — "normal" depends on hour/day (a busy mall at 6pm ≠ 6am);
  compare against the same time-of-week, not a global mean.
- Cheap, explainable, great first line. Catches surges, stampede-onset (speed drop +
  density spike), sudden emptying.

### 2. Classical unsupervised ML on features
Extract features (trajectory shapes, HOG/flow histograms, embeddings) and model
normal density:
- **One-Class SVM**, **Isolation Forest**, **Gaussian Mixture / KDE**, **k-NN
  distance**. Score = how far outside the learned normal region.

### 3. Reconstruction-based (autoencoder)
Train an **autoencoder** (or conv-AE) only on *normal* footage. It learns to
reconstruct normal well; **anomalies reconstruct poorly → high reconstruction
error** is the anomaly score.
```
frame ─► encoder ─► latent ─► decoder ─► reconstruction
anomaly score = || frame − reconstruction ||   (high = unusual)
```
- Self-supervised: only needs normal data (abundant), no anomaly labels.
- Watch-out: strong AEs "generalize" and reconstruct anomalies too well → misses.
  Mitigate with memory-augmented AEs (MemAE) or constraints.

### 4. Prediction-based (temporal)
Predict the **next frame** (or next positions) from recent ones; **large prediction
error = anomaly** (a future-frame-prediction GAN/U-Net, or an LSTM over
trajectories). Good for *motion* anomalies — wrong-way, sudden scatter, fall — that
a single-frame AE misses.

### 5. Optical-flow / motion anomaly
Model the **normal motion field** (direction + magnitude histograms per region).
Flag frames whose flow deviates — people running in a walking area, a crowd
suddenly dispersing (panic), reverse flow. Classic, light, and effective for
crowd-motion anomalies specifically.

### 6. Modern: video embeddings + distance
Embed clips with a pretrained video/self-supervised backbone; score anomalies by
distance to normal embeddings, or use weakly-supervised MIL (video-level "normal vs
anomaly" labels, e.g. the UCF-Crime style) when you have *some* labeled incidents.

## Choosing (say the trade-off)

| Scene / need | Reach for |
|---|---|
| A few scalar metrics, want explainable, fast | Statistical (z-score / EWMA / seasonal) |
| Appearance anomaly, only normal footage | Autoencoder (reconstruction error) |
| Motion/behavior anomaly (running, panic, wrong-way) | Optical-flow model or prediction error |
| Some labeled incidents exist | Weakly-supervised MIL on embeddings |

## The universal gotchas

- **"Normal" drifts** — lighting, seasons, layout changes. A static normal model
  ages into a false-alarm generator → ties to monitoring/retraining (section 13).
- **Base-rate problem** — real anomalies are *rare*, so even 99% specificity buries
  operators in false positives. This is why alerting design (next page) matters more
  than the detector.
- **No ground truth** — you often can't measure recall (you don't know what you
  missed). Validate on injected/known incidents and precision of what fired.

## Quick self-check

- When do you use a rule (event) vs a learned anomaly model? *(nameable → rule;
  open-ended → learned)*
- Why can a *too-good* autoencoder miss anomalies? *(it reconstructs them well too;
  low error → missed)*
- Which method best catches "crowd suddenly runs"? *(optical-flow / prediction-error
  motion model, not a single-frame AE)*
- Why does seasonality matter? *(normal is time-of-day/week dependent; compare like
  for like or you alarm every rush hour)*
