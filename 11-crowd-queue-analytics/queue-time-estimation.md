# Queue-Time Estimation

**TL;DR:** "How long are people waiting?" has three answers, and they get more
robust as crowds get worse. The intuitive one — follow each person and subtract
their timestamps — is also the most fragile. The clever one — infer the wait from
how fast people arrive and how many are in line, without tracking anyone — barely
flinches when the crowd gets dense. Understanding *why* that's true is the whole
lesson here.

## Start with the obvious approach, and watch it break

The first idea anyone has is the right place to begin: if I can follow a person, I
can time them. You give each person a stable ID with a tracker (the ByteTrack /
DeepSORT machinery from section 14), and for a queue zone you simply record when
their feet enter it and when they leave:

```
enter_time[id] = first frame this person's feet are inside the queue
exit_time[id]  = the frame they cross the "being served" line
wait[id]       = exit_time − enter_time
```

Two small refinements matter more than they look. First, use the person's **feet**,
not the middle of their box, to decide "in the queue" — the feet are where they
actually stand on the floor, and we'll see on the calibration page that the floor is
the only place geometry behaves. Second, report the **median** wait, not the
average. One abandoned trolley that sits in frame for an hour will drag the mean
into fantasy; the median shrugs it off.

Now the crack: this whole method leans on identities staying correct. The moment the
crowd thickens and one person walks in front of another, the tracker can swap their
IDs. A swap chops one person's genuine wait into two short fragments, or fuses two
people into one — and your queue time quietly goes wrong with no error message. So
the honest summary is: per-person timing is the most *accurate* method when the
scene is calm, and the *first* to fail when it isn't.

## A sturdier version: time the boundary, not the whole journey

Here's a nice trick that buys robustness for little cost. Instead of following each
person through the entire queue, just watch two lines — the point where they *join*
and the point where they reach *service* — and record a crossing event at each. The
wait is the gap between a person's two crossings.

Why is this tougher than full tracking? Because identity now only has to survive two
brief moments (the two line crossings), not the whole minutes-long dwell in between.
And in a single-file serpentine queue — think an immigration hall or an ADNOC
service counter — order is preserved, so you don't even need to recognise anyone:
the first person to join is the first to be served, so you can pair crossings in
simple first-in-first-out order. Where this falls apart is an unordered, multi-lane
scrum, because then join-order and service-order no longer match and the pairing
guesses wrong.

## The method that ignores individuals entirely: Little's Law

When the crowd is genuinely dense, stop trying to follow anyone at all. There's a
result from queuing theory that lets you infer the *average* wait from two things
that are much easier to measure in a crowd:

```
        L = λ · W        which rearranges to      W = L / λ

  L = how many people are in the queue on average   (the occupancy)
  λ = how fast people are arriving                   (the arrival rate)
  W = the average time each person waits            (what we want)
```

The beauty is that both inputs survive occlusion, because neither one needs
identities. You get **L**, the occupancy, from a *density-map count* — the technique
on the next page that counts a crowd without separating it into individuals. You get
**λ**, the arrival rate, from a simple *line-crossing counter* at the entrance,
which only has to count crossings, not tell people apart. Divide one by the other,
smoothed over a rolling window of a few minutes, and you have the wait.

This is the answer that makes an interviewer nod, because it shows you're thinking
about the *model*, not just the plumbing: *"Once tracking becomes unreliable I stop
timing individuals and use Little's Law — occupancy over arrival rate gives the
average wait, and both of those inputs are counts that survive occlusion."* Just be
honest about the fine print, because they'll poke at it: the law gives you the
*average* wait, and it assumes the queue is in rough steady state over your window
(people arriving at about the rate they're leaving). State those assumptions out
loud — knowing a model's limits is what separates using it from reciting it.

## A subtlety worth raising yourself: leading vs. lagging

There's a timing paradox in all of this. A per-person wait can't be known until the
person actually *leaves* — so any "current wait" number built from completed
journeys is inherently looking backwards. Little's Law, because it's built from
instantaneous occupancy and arrival rate, gives you a *forward-looking* estimate of
what someone joining now will experience. In practice you often show both: the
measured wait of the last people through, and the projected wait for someone
arriving now. Mentioning this distinction unprompted signals real familiarity.

## Where queue-time projects actually go wrong

It's rarely the model. It's the zone. The bugs that eat these projects are almost
always definitional: staff standing in the queue zone getting counted as customers,
the person currently *being served* still counted as waiting, someone stepping out
and re-entering being counted twice. Get the zone hygiene right and most "the queue
time is wrong" complaints evaporate. And whatever method you use, prove it against a
clock — the calibration page covers exactly how.

**Self-check.** Why report the median wait rather than the mean? *(a single outlier
— an abandoned object, an idling staff member — wrecks the mean.)* Your tracker's
ID-switch rate triples at peak; which method do you fall back to and why? *(Little's
Law — its inputs are occlusion-robust counts, not fragile identities.)* And what has
to be true for `W = L/λ` to hold? *(the queue is in rough steady state over your
averaging window.)*
