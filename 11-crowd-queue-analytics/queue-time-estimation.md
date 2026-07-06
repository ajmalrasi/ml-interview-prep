# Queue-Time Estimation

**TL;DR:** There are three ways to measure how long people wait, in increasing
order of robustness-under-crowding: **(1)** track individuals and subtract
timestamps, **(2)** measure at the boundary — time between entering and leaving a
zone via line-crossing, **(3)** don't track anyone — infer the wait from flow and
occupancy using **Little's Law**. Know all three and when each fails.

## Method 1 — Per-person dwell (tracking-based)

Follow each person with a tracker (ByteTrack/DeepSORT, see section 14). For a
queue zone `Q`:

```
enter_time[id] = first frame the track's foot point is inside Q
exit_time[id]  = last  frame it was inside Q (or when it crosses the exit line)
wait[id]       = exit_time[id] − enter_time[id]
queue_time     = median(wait[id] for id in recently-completed)
```

- **Use the foot point** (bottom-center of box), projected to the floor — not the
  box centroid — so "inside the zone" means feet-on-tile, not head-over-line.
- **Report median or a percentile (p85), not mean** — one abandoned cart that sits
  for an hour destroys the mean.
- **Fails when:** dense crowds cause ID switches. A switch splits one person's wait
  into two short waits (under-estimate) or merges two (over-estimate).

## Method 2 — Boundary timing (line-crossing pairs)

Don't track through the whole queue — just detect **two events**: crossing the
**join** line and crossing the **service** line. Pair them up (FIFO for a single
serpentine lane) and the difference is the wait. Cheaper and more robust than full
tracking because you only need identity to survive two line crossings, not the
whole dwell.

- Great for a **single-file serpentine** queue (airport, immigration, ADNOC-style
  service counter) where order is preserved → FIFO pairing needs no ReID.
- Breaks for **unordered / multi-lane** crowds where join-order ≠ service-order.

## Method 3 — Little's Law (flow-based, no tracking)

The workhorse when the crowd is too dense to track. From queuing theory:

```
        L = λ · W
  L = average number of people in the queue (occupancy)
  λ = arrival rate (people per second entering the queue)
  W = average wait time   ⇒   W = L / λ
```

You can measure **L** and **λ** without any tracking:

- **L (occupancy):** count heads inside the queue zone per frame — a **density-map
  count** works even when individuals aren't separable (section 2 of this folder).
- **λ (arrival rate):** a **line-crossing counter** at the queue entrance — you
  only need to count crossings, not identities.
- Then **W = L / λ**. Smooth L and λ over a rolling window (e.g. 1–5 min).

> **Interview gold:** "In dense crowds I stop trying to track individuals and use
> Little's Law: occupancy over arrival rate gives the average wait, and both inputs
> survive occlusion because one is a density count and the other is a crossing
> count." This shows you know the *modeling*, not just the plumbing.

**Assumptions to state:** Little's Law needs a system in rough steady state
(arrivals ≈ departures over the window) and FIFO-ish service for the *average* to
mean a typical person's wait. Call these out — interviewers probe whether you know
the model's limits.

## Practical accuracy notes

- **Validate against a clock.** Ground-truth a few people with a stopwatch (or a
  second synced camera) and compare. Report MAE in seconds, not just "looks right."
- **Latency vs freshness.** A dwell isn't known until the person leaves — so a
  live "current wait" board is always a lagging estimate. Little's Law gives a
  *leading* estimate (from instantaneous L and λ) — often you show both.
- **Zone hygiene.** Exclude staff, exclude the person being served, handle
  re-entries. Most "wrong queue time" bugs are zone-definition bugs, not model bugs.

## Quick self-check

- Why report median wait, not mean? *(outliers — abandoned objects, staff idling)*
- Your tracker's ID-switch rate just tripled at peak. Which method do you switch to
  and why? *(Little's Law — inputs are occlusion-robust counts, not identities)*
- What must be true for `W = L/λ` to be valid? *(steady state over the window)*
