# Training & Model Optimization for the Edge

**TL;DR:** As a data scientist you own the model's whole life, and it has two halves that
pull in opposite directions. Training is about making the model *accurate* on your actual
scene — which comes far more from data than from architecture. Optimization is about making
it *fast* enough to run on a Jetson — without giving back the accuracy you just earned. And
because this is a sealed on-prem site, there's a third act: the model improves over time by
learning from its own mistakes. This page walks that arc.

## Where accuracy really comes from: the data

The uncomfortable truth is that the biggest lever on accuracy isn't the architecture, it's
the data — and specifically whether it *matches your scene*. A model trained on tidy web
images falls apart on real CCTV, which is shot from a high angle through a wide lens, often
at night in infrared, through weather and motion blur. So the single most valuable thing you
can do is collect and label footage from the *actual cameras* in their *actual conditions*.
Two things make or break that data: **labelling consistency**, because if you're vague about
conventions — head or full body, how to handle an occluded object — noisy labels quietly cap
how good the model can ever get; and **coverage of hard cases**, because a model only learns
what it has seen, so you deliberately include night, crowds, occlusion, and the rare events
you care about.

## Augmentation: buying generalisation cheaply

Augmentation stretches the data you have to cover conditions you haven't photographed yet, and
you aim it deliberately at your deployment. **Geometric** transforms — flips, scaling, crops,
rotations — teach the model to handle objects at any position and size, which directly
addresses the CCTV scale range. **Photometric** ones — brightness, contrast, hue, noise, blur,
JPEG artefacts — teach robustness to lighting, weather, infrared, and compression. And there
are **detection-specific** tricks: mosaic (tiling four images into one, a YOLO staple that's
great for small objects and context), mixup, copy-paste, and random erasing to simulate
occlusion. The mindset is to augment *toward* your real conditions — if you'll deploy at
night in the rain, simulate night and rain.

## Transfer learning: almost always the right start

You rarely train from scratch, and you should be ready to say why. You start from a backbone
pretrained on ImageNet or COCO and **fine-tune** it on your data, which needs far less data
and compute than starting cold and generalises better — you can even freeze the early layers,
which have already learned generic edges and textures, and adapt only the head and later
layers to your specific classes and scene. Training a detector from scratch on-site is almost
never justified, and saying so shows judgement.

Along the way you'll hit the usual problems, each with a standard answer. Class imbalance,
where "person" dominates, is handled with focal loss or resampling. Overfitting is fought with
more and harder augmentation, dropout, weight decay, and early stopping. Small objects want
higher resolution, FPN, and tiling. And — a point worth making unprompted — you evaluate on a
held-out *scene* or camera, not random frames from the same clip, because near-duplicate
frames leak between train and test and inflate your metrics into a lie.

## Optimization: making it fit on a Jetson

Now the other half. A trained model is often too heavy for the edge, so you shrink it — the
job's "model optimization" — while watching that accuracy survives. The main tool is
**precision reduction**: FP16 roughly doubles speed for usually negligible accuracy loss,
while INT8 gives a bigger speedup but needs calibration and can cost you mAP, so you *measure*
it. INT8 comes in two flavours worth distinguishing: **post-training quantization** calibrates
on a representative sample after training — fast, no retraining, small accuracy hit — and when
that hit is too big you move to **quantization-aware training**, which simulates INT8 during
training so the model learns to tolerate it and recovers most of the lost accuracy. Beyond
precision, **pruning** removes low-importance weights or channels and then fine-tunes to
recover, and **knowledge distillation** trains a small "student" model to mimic a big
"teacher," keeping much of the accuracy at a fraction of the cost — a strong, specific answer
for edge deployment. Finally **TensorRT** fuses layers, autotunes kernels, and bakes in the
chosen precision to produce a hardware-specific engine (the section 03 material) — and the
non-negotiable habit is to **re-measure mAP afterward**, because an optimization that quietly
tanks accuracy is a failure, which is exactly why the monitoring in section 13 keeps watching.

```
train (transfer + augment) → validate on a held-out SCENE
   → optimize (FP16/INT8: PTQ then QAT if needed, prune, distill) → TensorRT engine
   → RE-MEASURE mAP and latency → deploy (§13 canary) → monitor for drift (§13)
```

## The third act: getting better inside a sealed site

On-prem you can't crowdsource labels, but here's the elegant part — the running system
*generates its own* hardest examples, so you let it teach itself. You mine the low-confidence
detections and the false alarms operators flagged (from section 12), label just those, since a
few well-chosen labels are worth far more than many random ones, then retrain, validate, and
canary the result. That's **active learning**, and it's how accuracy climbs over time in a
locked-down environment without an endless labelling budget — a mature thing to volunteer
before you're asked.

**Self-check.** What's the biggest lever on CCTV accuracy — architecture or data?
*(domain-matched data and augmentation from the real cameras.)* PTQ versus QAT — when do you
use each? *(PTQ first, because it's fast and needs no retraining; QAT when INT8 drops mAP too
far.)* Why validate on a held-out scene rather than random frames? *(random frames from the
same clip leak near-duplicates into the test set and inflate your metrics.)* And how does a
model improve on a closed on-prem site? *(active learning — mine low-confidence and flagged
cases, label those, retrain, and canary.)*
