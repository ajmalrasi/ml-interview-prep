# 11 — Crowd & Queue Analytics

**TL;DR:** The two numbers the client pays for: **how many people** + **how long they wait**. Detector→tracker gives boxes+IDs; you turn them into counts, dwell, flow — on the **floor plane**, not pixels.

**The one rule that decides every method — which regime are you in?**

| Regime | Method | Why |
|---|---|---|
| **Sparse/mid** (heads separable) | detect + track individuals | count IDs, dwell = exit−enter |
| **Dense** (occlusion, >~2 ppl/m²) | density estimation + Little's Law | tracking fails; count the mass |

**Interview trap:** "Counter works Tuesday morning — now it's a festival, half the heads hidden. What breaks?" → tracking → ID switches → fall back to **density + Little's Law**.

**Say this:** *"Queue time and count are geometry + statistics on detection+tracking. Put the camera on the floor plane via a homography, then pick by crowd regime: track individuals when I can, estimate from density+flow when I can't. Validate against a clock."*

Pages: 1) queue-time · 2) crowd counting/density · 3) zones/flow/heatmaps · 4) calibration/metrics.

→ Start: **[queue-time-estimation.md](queue-time-estimation.md)**
