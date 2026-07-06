# Crowd Counting & Density Estimation

**TL;DR:** There are two fundamentally different ways to count a crowd, and they
fail in opposite situations. One finds each person and counts them — accurate and
informative, until bodies start hiding each other. The other never separates people
at all; it estimates how "crowded" each patch of the image is and adds that up —
which keeps working in a crush where the first method is hopeless. The skill is
knowing where the crossover is and saying so.

## Counting by finding people

The natural approach is to run a person detector, get one box per person, and count
the boxes (tracking as well, so you don't recount the same person on every frame).
When it works, it's lovely: you don't just get a number, you get *who and where* —
boxes, classes, and track IDs — which means everything downstream (dwell time,
zones, flow) comes along for free. It's also easy to explain to a client, which
matters more than engineers like to admit.

The problem is occlusion, and it's not a gentle degradation. As people pack
together, near bodies hide far ones, so the detector simply never sees them. Worse,
the very step that cleans up detections — non-max suppression, which merges
overlapping boxes assuming they're duplicates of one object — starts deleting *real*
people because two heads close together look like one object seen twice. The two
effects compound, and the count doesn't drift a little; it collapses, always in the
same direction: you **under-count**. A practical mitigation is to detect **heads
instead of whole bodies**, because heads hide each other far less than torsos do,
which is why serious crowd systems often run a dedicated head detector. Roughly
speaking, detection-based counting is trustworthy while people are mostly separable
— call it up to one or two people per square metre — and degrades past that.

## Counting without separating anyone

When individuals blur together, you change the question entirely. Instead of "where
is each person," you ask "how dense is the crowd right here," at every pixel. A CNN
is trained to output a **density map**: a smooth surface over the image where each
pixel holds a fractional amount of "person-ness," arranged so that if you add up the
values over any region, you get the number of people in that region.

```
image ──► CNN (e.g. CSRNet) ──► density map ──►  count = sum of the map over a region
```

The trick that makes this trainable is in the labels. You annotate a single point on
each person's head, then blur each point with a small Gaussian into a little bump;
the sum of all those bumps is exactly the head count, and you train the network to
reproduce that smooth surface. Because the model never has to commit to discrete
boxes, it degrades gracefully in exactly the crush that breaks detection — it can
say "there are about forty people in this dense patch" without needing to find any
one of them. The models worth naming are **MCNN** (which uses several columns at
different scales to handle the huge size range in a crowd), **CSRNet** (a strong,
common baseline built on dilated convolutions), and the point-based **P2PNet**.

The catch is the mirror image of detection's strength: a density map gives you a
*number and nothing else*. No identities, no boxes, so no per-person dwell and no
tracking. It's a headcount, not a cast list. It's also touchy about perspective and
about domain shift — a model trained on one camera's viewpoint can misjudge another.

## Choosing, and saying why

The honest way to present this is that you don't pick one forever; you pick per
scene, and often you run both. At a counter or in a sparse corridor, detect and
track, because you need the identities for dwell and flow and the crowd is separable
anyway. In a packed hall or a platform surge, switch to density estimation, because
tracking is impossible and all you need is the count. And when you need *both* a
count and a wait time in a dense crowd, you combine them: density gives you the
occupancy `L`, a line-crossing counter gives you the arrival rate `λ`, and Little's
Law from the previous page turns those into a wait — every input chosen precisely
because it survives occlusion.

## The perspective problem hiding underneath both

Whichever method you use, one geometric fact keeps biting: a person far from the
camera fills a fraction of the pixels a near person does. Detection handles this with
multi-scale features (the feature-pyramid idea from section 14) or by restricting the
counting region to a band where people appear at consistent size; density handles it
with perspective-normalised maps. But the cleanest fix, when you have calibration, is
to project everything onto the **ground plane via a homography** (next page) and
reason in real-world square metres rather than pixels. That's also the "command of
geometry" the job description is angling for, so it's worth reaching for.

## How you'd score it

Interviewers will ask how you'd even know your count is right. The headline number is
**MAE** — mean absolute error in the count. **RMSE** punishes big misses harder,
which matters for surges. And **GAME** (grid average mean error) is the sharp one: it
chops the frame into a grid and checks the count *per cell*, so a model can't cheat by
getting the overall total right while putting people in the wrong places.

**Self-check.** Why does detection under-count a dense crowd while density estimation
doesn't? *(occlusion plus NMS delete real boxes; density regresses a continuous field
that never has to separate anyone.)* You need per-person dwell time in a packed hall —
is a density count enough? *(no — it has no identities, so you fall back to Little's
Law for the wait.)* And what exactly is a density model trained to reproduce? *(a map
of Gaussian-blurred head points whose integral equals the count.)*
