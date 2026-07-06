# Crowd Counting & Density Estimation

**TL;DR:** Two families. **Detection-based** counting (detect each head/person,
count boxes) is accurate and gives you identities for tracking — but collapses in
dense crowds from occlusion. **Density-estimation** (a CNN regresses a per-pixel
density map you integrate to a count) survives heavy occlusion but gives you no
identities. Pick by crowd density; know the crossover.

## Detection-based counting

Run a person/head detector (YOLO, section 14), count the boxes, optionally track
to avoid double-counting across frames.

- **Pros:** per-object — you get boxes, classes, and track IDs for free, so
  everything downstream (dwell, zones, flow) works. Interpretable.
- **Cons:** recall craters under occlusion. At high density, heads merge, NMS
  suppresses true positives, and you systematically **under-count**.
- **Head detection > body detection** in crowds — heads occlude less than torsos.
  Many crowd systems detect heads specifically.
- **Sweet spot:** roughly < 1–2 people/m² where individuals are mostly separable.

## Density-estimation (regression) counting

Instead of boxes, a CNN outputs a **density map**: each pixel holds a fractional
"person-ness" so that the **integral over a region = the count**.

```
image ─► CNN (e.g. CSRNet / MCNN) ─► density map D(x,y)
count over region R = ΣΣ D(x,y) for (x,y) in R
```

- **Training target:** annotate head points, convolve each with a Gaussian to make
  a smooth ground-truth density map; train to regress it (L2 / Bayesian loss).
- **Key models to name:** **MCNN** (multi-column, multi-scale), **CSRNet**
  (dilated convolutions, a common strong baseline), **P2PNet** (point-based).
- **Pros:** works in very dense crowds where you can't separate individuals;
  degrades gracefully.
- **Cons:** a *number*, not objects — no IDs, no per-person dwell, no tracking.
  Sensitive to scale/perspective and to domain shift (train scene ≠ deploy scene).

## Choosing (say this out loud)

| Situation | Use | Why |
|---|---|---|
| Counter, corridor, sparse lane | Detection + tracking | need IDs for dwell/flow; density is separable |
| Packed hall, festival, platform surge | Density estimation | tracking impossible; just need the count/occupancy |
| Need both count *and* wait in a dense crowd | Density for L + line-count for λ → Little's Law | combines occlusion-robust inputs (see queue-time page) |

## Perspective is the silent killer

A person far from the camera occupies far fewer pixels than a near one. Both
families need to handle this:

- **Detection:** multi-scale training / feature-pyramid; or restrict the counting
  ROI to a band at consistent scale.
- **Density:** perspective-normalized density maps, or a geometry-aware kernel.
- **Best fix when you have calibration:** project to the **ground plane via a
  homography** and count/normalize in real-world m² (see calibration page). This is
  the "geometry command" the JD wants to hear.

## Metrics

- **MAE** = mean absolute error in count (headline number for crowd counting).
- **RMSE** = penalizes big misses more (surge robustness).
- **GAME** (Grid Average Mean Error) — splits the frame into a grid and averages
  MAE per cell, so a model can't cheat by getting the *total* right while putting
  people in the wrong place.

## Quick self-check

- Why does detection under-count dense crowds and density estimation not?
  *(occlusion + NMS suppress boxes; density regresses a continuous field)*
- You need per-person dwell time in a packed hall. Is density counting enough?
  *(no — no identities; you fall back to Little's Law for wait)*
- What is the training target for a density model? *(Gaussian-blurred head-point map)*
