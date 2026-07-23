# Experiment Walkthrough: Your FashionMNIST Quantization Project

**TL;DR:** You built the full optimization loop end-to-end: train an FP32 CNN → PTQ and QAT
(fbgemm, CPU) → TensorRT INT8 (PTQ + QAT-fed) and FP16 (GPU) → compare six variants in
MLflow. This page turns that into a **2-minute spoken story**, then fills the gaps an NVIDIA
interviewer will poke at so no follow-up catches you flat.

## The 2-minute version (rehearse this out loud)

> "I took a small CNN on FashionMNIST through the whole optimization loop and tracked every
> variant in MLflow. Baseline FP32 on GPU was my reference. Then I split the problem on two
> axes: **method** — PTQ vs QAT — and **engine** — PyTorch's native fbgemm (CPU-only INT8)
> vs TensorRT (GPU INT8). PTQ just calibrates a trained model; QAT fine-tunes with fake-quant
> so weights tolerate rounding. For real GPU INT8 I exported to ONNX and built a TensorRT
> engine with an entropy calibrator, plus an FP16 engine as the easy win.
>
> The headline result: TensorRT FP16 was basically free accuracy-wise; TensorRT INT8-PTQ hit
> an accuracy cliff on this tiny model, and feeding QAT-hardened weights through the same
> calibrated engine recovered accuracy **at identical speed** — because on TensorRT, speed
> comes from the kernels and architecture, not the weight values. The whole thing taught me to
> separate *how you pick int8-friendly numbers* from *where you execute int8 fast*."

That framing — **method axis vs engine axis** — is your strongest asset. Lead with it.

## The comparison table (know every cell and its "why")

| Variant | Method | Engine | Device | Precision | Expected result |
|---|---|---|---|---|---|
| `fp32` | — | PyTorch | GPU | FP32 | accuracy + latency reference |
| `ptq` | PTQ | fbgemm | **CPU** | INT8 | small acc drop; CPU latency (not GPU-comparable) |
| `qat` | QAT | fbgemm | **CPU** | INT8 | recovers acc; ~100× slower/sample (CPU vs GPU) |
| `trt-fp16` | — | TensorRT | GPU | FP16 | ~free accuracy, ~2× faster |
| `trt-int8-ptq` | PTQ (calib) | TensorRT | GPU | INT8 | fastest; **accuracy cliff (~0.83)** |
| `trt-int8-qat` | QAT weights + calib | TensorRT | GPU | INT8 | acc recovered, **same speed** as int8-ptq |

The three **GPU** rows (`fp32`, `trt-fp16`, `trt-int8-*`) are the only apples-to-apples
latency comparison — the `device` column exists precisely so nobody reads CPU-INT8 latency as
comparable. Be ready to say why the CPU rows are there at all: *"PyTorch's native quant only
has CPU kernels, so fbgemm INT8 measures the method, not GPU speed — TensorRT is where GPU
INT8 actually runs."*

## Gaps to fill before the interview

Your notes are strong on the conceptual story. These are the follow-ups they don't yet answer
— close them:

### 1. The ~0.83 INT8 cliff: have a root cause, not just "small model"
Don't leave it at "small models are sensitive." The concrete cause is almost certainly
**per-tensor weight quantization** on a net with few, uneven channels, plus too little
calibration data. Say: *"I'd switch to **per-channel** weight scales and more calibration
batches, and try **percentile/entropy** clipping before concluding the model needs QAT —
that ordering usually recovers most of the drop cheaply."* (See *Quantization, Deeply*.)

### 2. "Implicit vs explicit quantization" is the vocabulary for your Option A/B
You built the **implicit** path (calibrator picks scales). The **explicit** path (QDQ nodes
from QAT via Model-Optimizer) was blocked by your torch/modelopt versions and by fbgemm
fake-quant being un-exportable to ONNX. Use the official terms — it signals you know the
TensorRT model, not just your workaround. (See *TensorRT Internals*.)

### 3. Why QAT recovered accuracy at *identical* speed
Nail the reasoning: **TensorRT latency is set by architecture + selected kernels, not weight
values.** TRT-PTQ and TRT-QAT compile to the same engine shape running the same INT8 kernels
→ same latency; QAT only moves the numbers to accuracy-friendlier values. Byte-identical
speed, better accuracy.

### 4. Your latency numbers need proper GPU timing hygiene
"0.0009 ms/sample" invites *"how did you measure that?"* Answer with: **CUDA events +
synchronize + warmup**, report **p99 not just mean**, and note that locking clocks removes
boost/thermal noise. Your `warmup(10)` and `itertools.cycle` fixes are exactly this
discipline — frame them that way. (See *GPU Performance & Profiling*.)

### 5. The "GPU is idle" story is a performance-analysis story
Reframe issue #3 from "bug I fixed" to "bound I diagnosed": the model was **overhead/feed-
bound**, not compute-bound — kernels too small to saturate anything. You'd confirm on an
**Nsight Systems** timeline; the dataloader tuning fixed the feed, and **CUDA Graphs** +
bigger batches would kill launch overhead if latency mattered.

### 6. BN folding is why the QAT→plain-model remap was needed
Frame issue #7b crisply: **fused Conv+BN+ReLU** means BN params live under the fused module,
so folding them into the plain conv is *exact math*, and that's why the state-dict keys had to
be remapped. It's not a hack — it's the same fold TensorRT does internally.

### 7. Sanity numbers to have ready
FP32→INT8 is **~4× smaller / faster math**; FP16 is **~2×, near-free accuracy**. Model size
should drop ~4× for INT8, ~2× for FP16 — be ready to confirm your `model_size_mb` column
matches, and if INT8 *isn't* ~4× smaller, know why (e.g. some layers kept in higher precision).

## Strong "what would you do next" answers

These double as your project's roadmap and show optimization maturity:

- **Explicit QDQ export** so TensorRT skips calibration and honors QAT's *learned* scales
  (the one refinement your notes still list as open) — via TensorRT-Model-Optimizer on a
  compatible torch build.
- **Per-channel weight quantization + more calibration** to close the INT8 cliff cheaply.
- **Dynamic-shape engine** with a min/opt/max optimization profile → kills the fixed-batch
  padding hack and serves variable batch sizes.
- **Serve it through Triton** with dynamic batching + concurrent instances; register the best
  engine in the MLflow Model Registry.
- **Profile with Nsight** to show *where* the INT8 speedup comes from, not just that it exists.

## Self-check

- Give the 2-minute story in your own words, leading with the method-vs-engine split.
- Why is TRT-QAT the same speed as TRT-PTQ? *(same engine shape/kernels; weights only affect
  accuracy.)*
- Root-cause the INT8 accuracy cliff without saying "small model." *(per-tensor weight quant +
  scarce calibration; fix with per-channel + more/better calibration before QAT.)*
- How did you measure latency, and what would an interviewer want added? *(CUDA
  events/sync/warmup; add p99, locked clocks, Nsight to attribute it.)*
