# Multi-Object Tracking

**TL;DR:** Detection tells you what's in *this* frame; tracking is what stitches those
per-frame boxes into objects that persist over time, each with a stable identity. That
persistence is the thing that makes everything in sections 11 and 12 possible — you can't
measure a wait, a count, or a loitering event without knowing that the person in frame 100
is the same person from frame 1. So tracking quality doesn't just affect the analytics; it
*bounds* them, which is why noisy queue times so often trace back to a tracking problem.

## Why you can't skip it

Run through what the analytics actually need and the necessity becomes obvious. Counting
needs identities, or you'd recount the same person on every single frame. Dwell time and
queue time are literally "last seen minus first seen" for one identity. Direction, flow, and
wrong-way detection need a trajectory, which is a sequence of positions for *one* object.
Loitering and most events need "the same person, here, for more than T seconds." Every one
of these is impossible with detection alone — they all require identity to persist, and that
persistence is exactly what a tracker provides. So when an interviewer says "your queue times
look noisy, why?", the answer is very often *ID switches*, and this page is why.

## The core idea: track by detecting

The dominant approach is called tracking-by-detection, and its loop is simple to picture: on
each frame you already have detections, and you have a set of existing tracks, so the job is
just to match this frame's detections to the right tracks.

```
predict where each existing track should be now (a motion model)
        │
        ▼
match detections ↔ tracks, using a cost (box overlap, and/or appearance similarity)
        │            solved optimally by the HUNGARIAN algorithm
        ▼
update matched tracks; start new tracks for unmatched detections; retire stale ones
```

Two classic algorithms do the heavy lifting. A **Kalman filter** is the motion model: it
predicts where a track should appear next (assuming roughly constant velocity) and smooths
out the jitter in noisy boxes, which also lets it bridge a short gap where a detection is
briefly missing. The **Hungarian algorithm** then solves the matching optimally — given a
cost matrix of how well each detection fits each track, it finds the best one-to-one
assignment. Those two together *are* the original SORT tracker, and everything fancier is
built on top of them.

## The family tree, and what each addition buys

It's most memorable as a progression, because each tracker adds one idea to fix the last
one's weakness. **SORT** is Kalman plus Hungarian on box overlap alone — fast and clean, and
fine when the scene is sparse and paths rarely cross. **DeepSORT** adds an appearance
embedding (ReID) into the matching cost, so when two people cross or one is briefly hidden,
their identities survive the encounter because appearance disambiguates them where position
alone would swap them. **ByteTrack** adds a genuinely clever twist worth stating explicitly:
instead of throwing away low-confidence detections, it keeps them and matches them to
existing tracks in a second pass — and since an occluded person's box gets a *low* score,
this recovers identities right through occlusion, and it does so cheaply without needing a
heavy ReID model, which makes it a great edge answer. Beyond those, OC-SORT and BoT-SORT
refine the motion model and compensate for camera motion when you need it.

## ReID: when identity has to travel

Re-identification is an appearance embedding that lets you recognise the *same* person after
a gap or in a different camera — and combined with the foot-point-on-the-floor idea from
section 11, it's how you hand a track from one camera to the next. You need it for long
occlusions, crossing paths, multi-camera identity, and re-entries. But you can skip it in a
sparse scene with only short gaps, where plain motion and overlap (SORT or ByteTrack) suffice
and cost far less on the edge — a trade worth naming. And one careful point that connects to
section 13: a ReID embedding is derived from a real person, so you treat it as sensitive, but
it re-associates an *unnamed* track — it is not a name or an identity.

## Scoring a tracker

The metrics matter because they map onto analytics quality. **MOTA** rolls false positives,
misses, and ID switches into one headline number. **IDF1** focuses specifically on identity
consistency — how reliably the right ID stays on the right object — which is often more
telling than MOTA for analytics that live or die on identity. **ID switches** is the raw
count of times a track's identity changed, and it's the most direct driver of count and dwell
error. **HOTA** is the modern metric that balances detection quality against association
quality.

## The CCTV gotchas

The recurring enemy is occlusion, because it causes ID switches, which corrupt counts and
dwell — and the mitigations are the ones above: ByteTrack, ReID, Kalman gap-bridging, and the
downstream K-of-N confirmation from section 12. Past a certain crowd density tracking becomes
hopeless entirely, and that's your cue to switch to density estimation plus Little's Law
(section 11). And watch the frame rate: too few frames per second breaks the constant-velocity
assumption because objects jump too far between frames for the matcher to associate them — so
you budget FPS for the *tracker*, not just the detector, back in section 03.

**Self-check.** What are SORT's two algorithms, and what does each do? *(a Kalman filter for
motion prediction and smoothing, and the Hungarian algorithm for optimal detection-to-track
assignment.)* What's ByteTrack's core trick? *(also match low-confidence detections, which
recovers identities through occlusion, cheaply.)* When do you add ReID, and when skip it?
*(add it for occlusion, crossing paths, and multi-camera identity; skip it in sparse scenes to
save edge compute.)* And which metric best reflects identity consistency for analytics?
*(IDF1 — and keep an eye on ID switches.)*
