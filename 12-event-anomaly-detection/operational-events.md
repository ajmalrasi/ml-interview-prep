# Operational Event Catalogue

**TL;DR:** Every event = **same recipe**: detections → track → foot-on-floor → geometry test + time test → confirm → fire once. Not special models.

## The recipe
```
detect → track (IDs) → project feet to floor
→ geometry (in zone? crossed line? which dir?)
→ temporal (for >T? K-of-N frames? persisted?)
→ confirm (debounce) → emit ONE event + evidence
```
Two workhorses: **dwell threshold** (event needs a duration) + **K-of-N** (true in K of last N frames before firing).

## The catalogue
| Event | Compute | False-alarm trap |
|---|---|---|
| **Intrusion** | foot enters restricted ROI | shadows/reflections, allowed staff |
| **Loitering** | dwell in zone > T | ID switch resets timer |
| **Abandoned object** | static appears/persists > T | bag set down briefly; parked cart |
| **Crowd surge** | occupancy/density > thr for K sec | brief clustering |
| **Line-cross / wrong-way** | track crosses tripwire wrong dir | jitter near line |
| **Tailgating** | 2 tracks cross access line within Δt of 1 badge | two people close |
| **Fall** | box tall→wide + stays low + low motion | sitting/crouching |
| **Speed** | floor-speed too high/≈0 | tracker velocity noise |
| **PPE** | attribute classifier on person crop | small/occluded gear |

## Abandoned object (classic deep-dive)
1. **Static** — was moving/empty, now static, stays static.
2. **Ownership** — owner walked away? fire only if owner-dist > D for > T. ← the key step (kills "parked cart").
3. **Persistence** — remains > T.
4. **Evidence** — attach keyframe + track.

## Why rules > trained model here
- **Explainable/auditable** — "track 42 in zone B for 47s" (matters in gov/secure).
- **No labelled event data** exists (can't collect 10k intrusions).
- **Tunable per site** (integrator sets thresholds).
- Model supplies primitives (boxes/IDs/attributes); your **logic layer = the event**.

## Q&A
- Loitering falsely resets on ID switch → fix? → carry dwell across gaps / ReID; don't reset on 1-frame drop.
- Stop abandoned alarming on carts? → owner-separation + persistence.
- Rules over classifier why? → explainable, auditable, tunable, no labelled data.
