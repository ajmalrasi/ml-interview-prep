# The Operational Event Catalogue

**TL;DR:** These are the events every video-intelligence product ends up shipping.
The reassuring secret is that almost none of them need a special model — each one is
the *same* small recipe with different parameters: take detections, give them stable
identities, place them on the floor, ask a geometric question and a timing question,
and confirm before you shout. Learn the recipe once and the whole catalogue opens up.

## The recipe that underlies everything

Before the list, here's the pattern they all share, because seeing it once means you
never have to memorise the events individually:

```
detections → track (stable IDs) → project feet onto the floor
          → geometric test  (in the zone? crossed the line? which way?)
          → temporal test   (for how long? persisting? K of the last N frames?)
          → confirm (debounce) → emit ONE event, with evidence attached
```

Two ideas in that recipe do most of the real work. The first is a **duration
threshold**: a real event almost always has a *time* attached — loitering means "in
the zone for more than thirty seconds," an abandoned object means "static for more
than a minute" — and simply requiring a duration kills the vast majority of flicker.
The second is **K-of-N confirmation**: require the condition to hold in, say, eight
of the last ten frames before you believe it, so a single noisy frame can never fire
an alert on its own. Keep those two in mind and every entry below is a variation on a
theme.

## The catalogue

**Intrusion, or zone breach**, is the simplest: a foot point enters a polygon it
shouldn't. The thing that trips it up is shadows and reflections reading as people,
and staff who are actually allowed in.

**Loitering** is intrusion plus a clock: a track that dwells in a zone longer than a
threshold. Its classic failure is subtle — when a person's ID switches, the dwell
timer resets, and a genuine loiterer is quietly forgiven.

**Abandoned or removed object** is the interesting one, so it gets its own section
below. The short version: something becomes static and stays static, or a fixture
that should be there vanishes.

**Crowd surge or overcrowding** reuses the occupancy signal from section 11 — count
in a zone, or density, above a threshold, held for a few seconds. It false-fires on
brief clustering and on a miscalibrated density estimate.

**Line-crossing and wrong-direction** watch a track cross a tripwire the wrong way
(section 11's flow logic), and mostly get fooled by tracking jitter right at the line.

**Tailgating** pairs vision with access control: two tracks cross an access line
within a moment of a single badge swipe. Two people who are simply walking close
together are the false-alarm trap.

**Fall or person-down** watches a person's box flip from tall to wide and stay low
with little motion — with the obvious confusion being someone who merely sat down or
crouched.

**Speed anomalies** flag ground-plane speed that's too high (running where nobody
should) or near zero (a collapse), and lean entirely on the speed being measured on
the floor, not in pixels.

**PPE or compliance** checks run a small attribute classifier on the person's crop —
is the helmet or vest present? — and struggle when the gear is small, occluded, or
from a site the model hasn't seen.

## Abandoned object, in depth

This is a favourite interview scenario because the naive version is a trap. If you
just flag "a static blob appeared," you'll alarm on every parked trolley and every
bag someone set down for ten seconds. The good solution has four moving parts. You
detect that a region which was moving or empty has become static and *stayed* static.
You establish **ownership** — was it left by a person who then walked away? — by
tracking the owner and only firing once the owner has been more than some distance
away for more than some time; this single step is what separates "abandoned" from
"set down for a moment." You require **persistence**, so it has to remain for a real
duration. And you attach **evidence** — the keyframe and the track history — so a
human can adjudicate in seconds. The whole art of this event is step two; everything
else is bookkeeping.

## Why rules beat "just train a model" here

It's tempting to imagine training an end-to-end "intrusion classifier," but rules win
in this domain for three concrete reasons. They're **explainable and auditable** —
you can say "this fired because track 42 stood in zone B for forty-seven seconds,"
which, in a secure government deployment in Abu Dhabi, beats a black box that can't
justify itself. They need **no labelled event data**, which is fortunate because you
can't go collect ten thousand real intrusions to train on. And they're **tunable per
site**, so an integrator can turn the thresholds up or down on the day. The model's
job is only to supply the primitives — boxes, classes, IDs, attributes — and *your*
logic on top is the event. That logic layer is exactly what the role means by
"designing complex logic layers on model detections."

**Self-check.** Loitering keeps forgiving a genuine loiterer whenever their ID
switches — how do you fix it? *(carry the dwell across short gaps, re-associate the
track with ReID, and don't reset the timer on a one-frame drop.)* How do you stop the
abandoned-object rule from alarming on every parked trolley? *(add the
owner-separation test and require persistence — don't fire on a static blob alone.)*
And why prefer rules over a learned event classifier here? *(they're explainable and
auditable, tunable on site, and no labelled event data exists to train on.)*
