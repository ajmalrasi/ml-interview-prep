# SIL / HIL Validation

**TL;DR:** Automotive validation is a ladder of **"X-in-the-loop"** stages that trade
fidelity for convenience. **MIL** (model), **SIL** (software), **PIL** (processor), **HIL**
(hardware). You mostly live in **SIL** (your compiled software against simulated/recorded
inputs) and **HIL** (the real SoC in the loop against sensor playback or a simulator), plus
raw **on-target** runs. Each answers a different question.

## The X-in-the-loop ladder

| Stage | What's "in the loop" | What it validates | Fidelity / cost |
|---|---|---|---|
| **MIL** (Model-in-the-Loop) | The algorithm/model in a sim (e.g. on a host) | Does the algorithm behave correctly? | Low fidelity, cheap, fast iteration |
| **SIL** (Software-in-the-Loop) | The **actual compiled software**, run on a host/sim | Does the real code (incl. quantized model) produce right outputs? | No target HW yet |
| **PIL** (Processor-in-the-Loop) | Software running on the **target processor/ISS** | Does it behave correctly on the real ISA/toolchain? | Adds processor realism |
| **HIL** (Hardware-in-the-Loop) | The **real SoC/ECU** wired to a simulator feeding sensor data in real time | Does the whole system meet timing/accuracy on real hardware, in real time? | High fidelity, expensive |

**The progression:** as you climb, fidelity rises and iteration speed falls. You validate as
low as possible for fast feedback and as high as necessary for sign-off.

## Where you plug in

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node">quantize + compile</span>
    <span class="arw labeled"><span class="al">SIL</span></span>
    <span class="node">accuracy vs FP32<span class="nsub">recorded data</span></span>
    <span class="arw labeled"><span class="al">on target</span></span>
    <span class="node">real latency/accuracy<span class="nsub">dev board</span></span>
    <span class="arw labeled"><span class="al">HIL</span></span>
    <span class="node out">system sign-off<span class="nsub">real-time, in-loop</span></span>
  </div>
</div>
```

- **SIL for you:** run your compiled INT8 model against a **golden dataset** and compare to
  the FP32 reference — this is where you catch quantization/operator accuracy regressions
  before hardware. Fast loop, no board contention.
- **On target board:** the honest **latency, throughput, utilization** numbers (SIL can't
  give real timing). Where the perf-analysis loop from
  [multicore-scheduling](../05-soc-architecture/multicore-scheduling.md) actually runs.
- **HIL:** the SoC runs in **real time** while a rig plays back or simulates sensor streams
  and checks the system responds correctly and on time. Catches integration, timing, and
  real-world corner cases a static dataset misses.

## Key concepts to name

- **Open-loop vs closed-loop:** open-loop replays recorded sensor data and checks outputs;
  **closed-loop** puts your perception into a driving simulator whose next frame *depends* on
  the vehicle's reaction — needed to test the full perceive→plan→act cycle.
- **Golden/reference data & regression:** a fixed labeled set you re-run every release to
  catch accuracy/latency regressions (feeds the JD's "release validation activities").
- **Determinism & reproducibility:** same input must give same output — essential for
  debugging and for safety evidence.
- **Corner cases / ODD:** validation must cover the **Operational Design Domain** (the
  conditions the system is designed for) — night, rain, glare, occlusion for perception.

## Your validation deliverables (JD-aligned)

- **Accuracy report** — INT8 vs FP32 on the golden set (per-class mAP/mIoU deltas).
- **Performance report** — latency p50/p99, throughput, per-block utilization on target.
- **Regression status** — pass/fail vs the last release baseline, contributing to **weekly
  technical reports and release validation**.

## Interview soundbite

> "I validate up a fidelity ladder: SIL first — my actual compiled INT8 model against a
> golden dataset, compared to the FP32 reference, to catch accuracy regressions cheaply. Then
> on a target board for honest latency and utilization, then HIL where the real SoC runs in
> real time against sensor playback or a closed-loop simulator to validate timing and system
> behavior. Golden-set regression on every release is how the numbers stay honest."
