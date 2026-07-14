# Anomaly Methods

**TL;DR:** Can't list the bad cases → **learn normal, score deviation**. Methods differ only in *what* is "normal" (a metric, a frame, a motion pattern, a prediction) + how much supervision.

## First: is it even an anomaly?
Can you name it? → it's an **event** → use a rule (higher precision). Reserve anomaly methods for open-ended ("flag anything unusual"). **Narrow the problem first.**

## Methods (least → most supervision)
- **Statistical (no learning)** — track a scalar (occupancy, speed, flow); flag with **z-score/MAD, EWMA, control charts**. Use **seasonal baseline** (6pm ≠ 6am). Cheap, explainable, first line. Catches surges, stampede onset.
- **Classical unsupervised** — features → **One-Class SVM / Isolation Forest / GMM/KDE**; score = distance outside normal.
- **Autoencoder (reconstruction)** — train on **normal only**; **high reconstruction error = anomaly**. Self-supervised (no anomaly labels). ⚠ too-strong AE reconstructs anomalies too → misses (fix: MemAE).
```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">frame</span>
    <span class="arw"></span>
    <span class="node">encoder</span>
    <span class="arw"></span>
    <span class="node soft">latent</span>
    <span class="arw"></span>
    <span class="node">decoder</span>
    <span class="arw"></span>
    <span class="node out">recon</span>
  </div>
  <div class="formula"><div class="frow"><span class="fexpr">score = <span class="fv">‖ frame − recon ‖</span></span><span class="fnote">high reconstruction error = anomaly (never seen in training)</span></div></div>
</div>
```
- **Prediction-based** — predict next frame/positions; **big prediction error = anomaly**. Good for **motion** anomalies (wrong-way, fall, scatter) an AE misses.
- **Optical-flow** — model normal motion field; flag running-in-walk-zone, reverse flow, panic dispersal. Light + effective for crowd motion.
- **Embeddings + weak supervision (MIL)** — if you have *some* labelled incidents (UCF-Crime style).

## Choosing
| Need | Use |
|---|---|
| explainable scalar metrics | statistical |
| appearance, only normal footage | autoencoder |
| motion/behaviour (run, panic) | optical-flow / prediction |
| some labelled incidents | weakly-supervised MIL |

## Gotchas (all methods)
- **Normal drifts** (lighting/season/layout) → false-alarm generator (→ §13 retrain).
- **Base rate** — anomalies rare → even 99% specificity floods operators → alerting matters more (next).
- **No ground truth for recall** — can't measure misses; validate on injected/known incidents + precision of what fired.

## Q&A
- Rule vs learned? → nameable → rule; open-ended → learned.
- Too-good AE misses why? → reconstructs anomalies well too, low error.
- "Crowd suddenly runs"? → optical-flow / prediction (not single-frame AE).
- Seasonality why? → normal = time-of-day/week; compare like-for-like.
