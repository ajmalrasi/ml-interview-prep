# Crowd Counting & Density

**TL;DR:** Two families, opposite failures. **Detection** counts boxes — accurate + gives IDs, dies under occlusion (under-counts). **Density** regresses a per-pixel map you sum — survives crush, but no IDs.

## Detection-based
- Detect people/heads, count boxes (+ track to avoid recount).
- **Pros:** boxes + classes + **track IDs** free → dwell/zones/flow all work. Explainable.
- **Cons:** occlusion → recall collapses; **NMS deletes real nearby people** → **under-count**.
- **Detect heads > bodies** in crowds (heads occlude less).
- Sweet spot: **< ~1–2 ppl/m²**.

## Density-estimation
```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">image</span>
    <span class="arw"></span>
    <span class="node">CNN</span>
    <span class="arw"></span>
    <span class="node out">density map <span class="nsub">D(x, y)</span></span>
  </div>
  <div class="formula"><div class="frow"><span class="fexpr">count = <span class="fv">ΣΣ D</span> over region</span><span class="fnote">sum the density map, don't detect individuals</span></div></div>
</div>
```
- Train target: **head points blurred with Gaussians** (integral = count).
- Models: **MCNN** (multi-scale), **CSRNet** (dilated conv, strong baseline), **P2PNet**.
- **Pros:** works in dense crush; degrades gracefully.
- **Cons:** just a **number** — no IDs, no dwell, no tracking. Sensitive to perspective/domain shift.

## Choosing
| Scene | Use |
|---|---|
| counter, corridor, sparse | detection + tracking (need IDs) |
| packed hall, surge | density estimation |
| count **and** wait, dense | density = L + line-count = λ → Little's Law |

## Perspective = silent killer
Far person = fewer pixels. Fix: multi-scale/FPN, or **project to floor plane (homography)** and count in m². ← the "geometry" the JD wants.

## Metrics
- **MAE** = headline count error · **RMSE** = punishes big misses (surge) · **GAME** = per-grid-cell MAE (can't cheat on total).

## Q&A
- Why detection under-counts, density doesn't? → occlusion+NMS delete boxes; density = continuous field.
- Per-person dwell in packed hall from density? → no (no IDs) → Little's Law.
- Density train target? → Gaussian-blurred head-point map.
