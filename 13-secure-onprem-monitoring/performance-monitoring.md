# Performance Monitoring & Model Drift

**TL;DR:** The job description pairs *model optimization* with *performance monitoring*
deliberately, and on-prem there's a sharp reason: nobody is watching your models from a
cloud dashboard, so if you don't build the observability in, you're flying blind. You
monitor two very different things. Whether the *pipeline* is up and fast is easy — you
have those numbers directly. Whether the *model is still accurate* is hard, because in
production you have no labels telling you the right answer. Detecting that quiet loss of
accuracy — drift — is the real skill here.

## Two layers, and why they need different treatment

```
SYSTEM HEALTH — easy, you have the numbers      MODEL HEALTH — hard, no live labels
 FPS / latency per camera                        detection-confidence distribution
 GPU use / memory / temperature                  object counts and class mix over time
 dropped frames, queue depth, reconnects         event and false-alarm rate trends
 disk, retention headroom, uptime                accuracy against periodic audits
```

## System health: instrument everything, because silence lies

The system-health side is straightforward but easy to neglect, and the failures it
catches are the invisible kind. Per camera, you track effective FPS, end-to-end latency,
decode errors, RTSP reconnects, and dropped frames — because a camera that quietly sags
from 30 FPS to 2 FPS is a classic failure that nothing surfaces unless you're watching
for it. Per GPU box, you watch utilisation, memory, and especially **temperature and
throttling**, which is a live concern in a hot climate, along with the Jetson power mode
(`tegrastats` on Jetson, DCGM on servers). And across the pipeline you watch queue depths,
throughput against the section 03 latency budget, and restart counts. The whole thing runs
on **Prometheus and Grafana inside the perimeter** — the standard air-gapped combination —
with Alertmanager paging locally, because there's no cloud APM to phone home to.

## Model health: the interview differentiator

This is the part that separates candidates, precisely because it's hard: you have no
ground-truth labels at run time, so you can't directly measure accuracy. Instead you watch
*proxies* for accuracy and treat their movement as your signal.

The most useful proxy is the **confidence distribution** — the histogram of your detector's
scores. When the scene drifts (new lighting, fog, a dirty lens, a bumped camera), that
histogram shifts, and a sudden collapse in mean confidence is a genuine alarm. Alongside
it you watch **output statistics** — average object count, class mix, track lengths,
ID-switch rate, dwell distributions — because if "people per frame" or the false-alarm rate
trends away from its established baseline, *something* changed even if you can't yet say
what. To be more principled you compare the current input's feature statistics (brightness,
occupancy, scene stats) against the training reference distribution using something like PSI
or KL divergence; the usual on-prem culprit is **covariate shift** — the world changed, not
the model. But proxies only hint, so the ground truth comes from **periodic audits**: you
sample frames or events on a schedule, have a human label them, compute real precision,
recall, and count error, and trend those numbers — which is the same validation discipline
from section 11 and the false-alarm control from section 12.

It's worth being able to name the two kinds of drift, because the fixes differ. **Covariate
drift** is when the inputs shift — lighting, seasons — and you fix it by recalibrating or
retraining on the new data. **Concept drift** is when the *meaning* shifts — a zone gets
repurposed, so the very definition of "correct" changed — and that needs relabelling or a
redefinition, not just more data.

## Closing the loop: from a drift alarm back to a better model

Detecting drift is only useful if it drives an action, and the action is a loop:

```
monitor → spot drift or a regression → collect and label the hard cases (active learning, §14)
        → retrain or recalibrate → validate offline on real site clips
        → canary on a few cameras → compare to the incumbent → roll forward, or roll back
```

Two habits keep this safe on a sealed site. You never hot-swap a whole fleet blind — you
**canary** the new model on a subset and compare the same proxy metrics plus an audit, with
the old engine pinned so you can roll back. And **shadow mode** is your friend where you
can't run a cloud A/B: run the candidate alongside production without acting on its output,
and log where the two disagree. The engine of improvement underneath it all is **active
learning** — mine the low-confidence detections and the operator-flagged false alarms,
label just those high-value cases, and fold them into the next training set. That's how a
model gets *better* over time inside a locked-down environment where you can't crowdsource
labels.

## Optimization and monitoring are the same loop

Finally, notice that the job's two paired phrases really are one activity. You optimize —
INT8 and FP16, pruning, TensorRT from section 03 — to hit the latency and throughput budget
on the hardware you actually have. Then you monitor that the optimization didn't quietly
cost you accuracy, because INT8 quantization *can* drop mAP, and the only way you'd know is
that audit metric moving. Optimize, measure, watch, repeat — the two halves of the job
description are the two halves of one loop.

**Self-check.** You have no labels in production — how do you tell a model is degrading?
*(proxy signals like the confidence distribution, output statistics, and the false-alarm
trend, backed by periodic human-labelled audits.)* Give a CCTV example of covariate versus
concept drift. *(lighting or seasonal change versus a zone being repurposed so "correct"
itself changed.)* How do you roll out a retrained model on a locked-down 200-camera site
safely? *(validate offline, canary or shadow on a few cameras, compare, then roll forward or
roll back to the pinned engine.)* And what stack gives you dashboards with no cloud?
*(Prometheus, Grafana, and Alertmanager inside the perimeter, with tegrastats or DCGM for
the GPUs.)*
