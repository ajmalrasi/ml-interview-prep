# Queue-Time Estimation

**TL;DR:** 3 ways to measure wait, most→least fragile: (1) track each person, (2) time two lines, (3) Little's Law (no tracking). Denser crowd → use a later one.

## 1. Per-person dwell (tracking)
- `wait[id] = exit_time − enter_time` for the queue zone.
- Use **foot point** (feet on floor), not box centre.
- Report **median / p85**, not mean (one idle cart wrecks the mean).
- **Breaks on:** ID switches in dense crowds → wait split/merged → wrong.

## 2. Boundary timing (line-crossing pairs)
- Detect **join line** + **service line** crossings; wait = gap between them.
- Identity only has to survive 2 crossings, not the whole dwell → sturdier.
- **Single-file serpentine** (immigration, service counter): FIFO pairing, no ReID needed.
- **Breaks on:** multi-lane / unordered crowds (join-order ≠ service-order).

## 3. Little's Law (no tracking — dense crowds)
```
L = λ · W     →     W = L / λ
L = people in queue (occupancy)
λ = arrival rate (people/sec entering)
W = avg wait
```
- **L** = density-map count (survives occlusion). **λ** = line-crossing counter (just counts crossings).
- Both inputs are **occlusion-robust counts** — no identities needed.
- **Assumes:** steady state over the window (arrivals ≈ departures), FIFO-ish.

**Say this:** *"In dense crowds I stop tracking individuals and use Little's Law — occupancy over arrival rate, both inputs survive occlusion."*

## Fast facts
- **Lagging vs leading:** dwell is known only after exit (lagging). Little's Law from live L,λ is leading. Often show both.
- Most "wrong queue time" bugs = **zone bugs**: staff counted, person-being-served counted, re-entries. Not model bugs.
- Validate: stopwatch a sample → report **MAE in seconds**.

## Q&A
- Median not mean? → outliers (idle cart/staff) destroy the mean.
- ID-switches tripled at peak → switch to? → **Little's Law** (occlusion-robust counts).
- `W=L/λ` valid when? → **steady state** over the window.
