# Presentation Attack Detection

**TL;DR:** PAD must generalize beyond the attack instruments seen in training. Design the
evaluation around unseen materials, displays, devices and environmental conditions.

## Attack taxonomy

- printed photos: matte/glossy, cut-out eyes, bent or wrapped;
- display replay: phone/tablet/monitor, brightness and refresh-rate variation;
- masks: paper, silicone, partial masks and 3D structures;
- video replay and pre-recorded challenge responses;
- occlusion/absence: sleeping person, partial face or multiple people.

## Signal families

Passive systems may use texture, frequency artifacts, moiré, reflections, depth cues,
remote photoplethysmography, temporal motion and multi-frame consistency. Active systems
add unpredictable challenge or illumination evidence.

Each cue has shortcuts. Texture models can learn a specific printer; temporal models can
learn one display refresh rate; rPPG degrades with compression, motion and illumination.
Use diverse capture pipelines and hold out entire **attack species/instruments**, not
only individual videos.

## Evaluation protocol

1. Separate bona fide subjects and attack source identities where possible.
2. Hold out devices and attack instruments for generalization tests.
3. Report APCER per attack type and worst-case, not just pooled.
4. Report BPCER by device, environment and demographic slice.
5. Include failure-to-acquire and latency.
6. Test adaptive attackers and repeated attempts.
7. Red-team the trusted capture boundary, not only the PAD network.

## Product policy

Use risk tiers:

- low-risk flow: passive check with bounded retry;
- uncertain/high-risk flow: active challenge or stronger device signal;
- repeated or coordinated risk: block, step up or human review.

Keep attack samples and detailed failure traces access-controlled. Security evaluation
should improve defenses without exposing operational bypass recipes.

## Interview answer

> “I would not claim PAD generalization from a random frame split. I hold out complete
> attack instruments and capture devices, report per-attack APCER and bona fide BPCER,
> test the injection boundary, and use a risk-based step-up path when passive evidence is
> uncertain.”

Reference: [ISO/IEC 30107-3 presentation attack detection testing](https://www.iso.org/standard/79520.html).
