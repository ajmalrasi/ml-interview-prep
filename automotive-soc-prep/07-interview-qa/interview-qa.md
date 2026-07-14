# Interview Q&A — Rapid Fire

**TL;DR:** Each answer is the 30-second spoken version. Grouped the way an interviewer
escalates: accelerators → ONNX & quantization → models → SoC & performance → runtime &
safety → behavioral. Cover the answer, say it out loud, then check.

## Embedded accelerators

**Q: What are the compute blocks on an automotive SoC and what's each good at?**
CNNIP is a fixed-function conv engine — fastest, least flexible. NPU is a programmable tensor
accelerator (usually a systolic MAC array), fast on the standard INT8 op set. DSP is a
programmable vector core for custom ops and pre/post-processing. CPU is the universal
fallback. Efficiency goes CNNIP > NPU > DSP > CPU; flexibility goes the other way.

**Q: What happens to an operator the NPU doesn't support?**
It falls back to DSP or CPU, which forces a subgraph boundary — a tensor copy across memory
plus a cross-core sync. One unsupported op in the middle is worse than several at the end,
because it splits an NPU subgraph and inserts two boundaries instead of one.

**Q: How do you decide if a layer is compute-bound or memory-bound?**
Roofline: arithmetic intensity = FLOPs per byte moved. Low intensity (depthwise, elementwise,
small matmul) is memory-bound — capped by bandwidth. High intensity (big dense conv) is
compute-bound — capped by MAC throughput. Quantizing to INT8 cuts bytes 4×, shifting
memory-bound layers toward the compute roof.

**Q: A model is "60% on the NPU" but slow. What do you look at?**
Where the other 40% is. A fallback in the middle that splits the NPU subgraph and forces
large-tensor DMA both ways kills you; the same ops clustered at the tail (NMS, decode) cost
one boundary. I read the partition report, find the cause (dtype, dynamic shape, unsupported
attr), then push fallbacks to the boundary or the DSP, or rewrite them with supported ops.

## ONNX & quantization

**Q: What is a QDQ model?**
An FP32 ONNX graph annotated with QuantizeLinear/DequantizeLinear pairs carrying scale and
zero-point. The FP32 ops between Q and DQ are reference semantics; the compiler
pattern-matches Q→op→Q and emits a fused INT8 hardware op. It's the portable, framework-neutral
way quantization travels into the embedded compiler.

**Q: A layer unexpectedly runs in FP32 on the NPU. Why?**
Usually a missing or unfusible Q/DQ pair around it, a dynamic shape, an unsupported attribute,
or a dtype mismatch. I inspect the graph — a stray op between Q and the consumer breaks the
fusion and the region silently runs in FP32 or on the DSP. Fix by completing the QDQ,
pinning the shape, or removing the intruding op.

**Q: What's "graph surgery" and when do you use it?**
Reading and rewriting the ONNX graph — fold constants, pin dynamic shapes, remove
pre/post-processing, replace an unsupported op, or split the model — usually on a customer's
model with no training pipeline. It's a minutes-not-weeks fix that turns a 40%-on-NPU model
into a 95%-on-NPU one. Tools: onnx, onnx-graphsurgeon, onnxsim, Netron to inspect.

**Q: PTQ vs QAT, and how do you frame each in this role?**
PTQ quantizes a trained model with no gradients — needs only a representative calibration
set, runs in minutes, I own it. QAT simulates quantization during fine-tuning so weights
adapt — best accuracy, needs the training pipeline, it's a collaboration where I own the
quantization scheme and target and the training team owns the loop. PTQ first, QAT when PTQ
misses.

**Q: How does calibration pick activation ranges, and which method?**
It clips each activation to [−α, α] using stats from the calibration set. Min-max is
outlier-sensitive; percentile clips rare spikes; entropy/KL minimizes distribution divergence
(TensorRT's default); MSE minimizes quant error. Min-max for weights, entropy or percentile
for activations.

**Q: INT8 dropped mAP by 4 points. Walk me through recovering it.**
Localize with per-layer SQNR or cosine similarity — it's almost always a few layers, not the
whole net. Explain it: outliers, per-tensor on a wide range, a depthwise block, or an
approximate NPU op. Then climb the cheapest-first ladder: recalibrate, per-channel weights,
mixed precision on the sensitive layers, bias correction, then QAT. Re-check accuracy and
latency after each — pushing a layer to FP16/DSP costs a boundary.

## Models: detection, segmentation, BEV

**Q: Where's the deployment trouble in a detection model?**
Not the backbone or FPN — those are conv-heavy and map onto the NPU. It's the head: NMS and
decode are control-flow with dynamic output counts, so they stay on CPU/DSP at the graph
tail, and I pad detections to a static max so downstream shapes stay fixed.

**Q: What is BEV perception and why is it used?**
It fuses multiple cameras (and lidar/radar) into one top-down grid in vehicle coordinates —
one coherent metric representation planning can consume, instead of six inconsistent
image-space outputs. Fusion across cameras and time becomes natural.

**Q: What's hard about deploying BEVFormer vs LSS?**
LSS does a forward depth-splat — a scatter/voxel-pool that's NPU-unfriendly but otherwise
conv. BEVFormer does backward deformable attention — grid-sample, attention, LayerNorm, the
classic NPU fallbacks. In both, the projection geometry is fixed by calibration, so I
precompute the sampling as static tensors, keep the backbone and BEV head on the NPU, and
isolate the attention/scatter to the DSP in higher precision.

**Q: Why BEVFusion, and what does it cost to deploy?**
Camera + lidar fused in shared BEV — robust if one modality degrades. Cost is the lidar
branch: voxelization and sparse/3D convolution that many NPUs don't support, so it runs on
DSP/CPU or a specialized engine.

## SoC & performance

**Q: What's usually the bottleneck on these SoCs?**
Memory bandwidth and scheduling, not FLOPs. DRAM is shared across every block; a fast NPU
stalls waiting on it. So I profile per-block utilization and DMA traffic first — a
memory-bound layer gets faster from less data movement (quantize, fuse, tile to SRAM,
double-buffer DMA), not a better kernel.

**Q: What does DMA double-buffering buy you?**
Overlap. Two SRAM buffers: DMA prefetches tile N+1 while the NPU computes tile N. Transfer
hides behind compute and the NPU never stalls — it turns a memory-bound layer into a
compute-bound one. Single-buffer synchronous DMA pays full transfer latency per tile.

**Q: What's the IPMMU and how does it bite you?**
It's the MMU for the accelerators — translates the virtual addresses the NPU/DSP/DMA issue to
physical DRAM, and isolates them so a block only touches memory mapped for it. If a buffer
isn't mapped, the offload faults — nothing to do with the model. Its sibling gotcha is cache
coherence: an unflushed/uninvalidated shared buffer returns stale data with no crash.

**Q: Separate latency and throughput for me.**
Latency is one frame end-to-end, set by the critical path — the safety-relevant number.
Throughput is frames per second, set by the slowest stage once the pipeline is full.
Pipelining raises throughput to 1/max-stage without lowering latency.

**Q: Why is multi-core scaling sublinear?**
Amdahl's serial fraction, cross-block synchronization cost, shared-DRAM contention, and load
imbalance. Two NPU cores often give ~1.6×, not 2×. I attribute the gap rather than assume
linear.

## Runtime & safety

**Q: Linux vs QNX — why QNX for safety?**
QNX is a microkernel RTOS: drivers and services run isolated in user space, so a fault is
contained and restartable instead of panicking the kernel, and the small kernel is certifiable
to ASIL-D. Linux (often PREEMPT_RT) runs the rich, non-safety side. For me it means
determinism first — bounded WCET, static shapes, no surprise fallbacks.

**Q: SIL vs HIL?**
SIL runs my actual compiled software against simulated/recorded inputs on a host — where I
compare INT8 vs FP32 on a golden set to catch accuracy regressions cheaply. HIL puts the real
SoC in the loop in real time against sensor playback or a driving simulator, validating timing
and system behavior. On-target board runs give the honest latency numbers in between.

**Q: What is ASIL and where does perception land?**
Automotive Safety Integrity Level, A to D, derived from severity, exposure, controllability. D
is most stringent. AD perception is typically C or D — a missed pedestrian is severe, common,
hard to control — so maximum rigor: redundancy, coverage, tool qualification, a safety case.

**Q: Why is AI safety not just ISO 26262?**
26262 covers malfunctions — faults. But a network can work as designed and still be wrong on
an unseen scene; that's a performance limitation, covered by SOTIF (ISO 21448). You can't
prove a DNN correct, so safety relies on sensor and path redundancy, ODD monitoring, and a
simpler safety monitor that can veto or safe-stop.

## Behavioral / role

**Q: A customer says "your toolchain made my model inaccurate." How do you respond?**
Reproduce first: run their model through SIL, compare INT8 vs FP32 on their data per layer to
localize. Usually it's a few sensitive layers or an operator limitation, not the whole
toolchain. I show the SQNR breakdown, propose the mitigation (recalibrate, mixed precision,
QAT spec), quantify the accuracy/latency trade, and give them a clear recommendation and a
timeline. Turn a complaint into a diagnosed, closed issue.

**Q: How do you keep C/C++ vs Python straight in this role?**
Python for the offline/dev side — quantization, graph surgery, validation tooling, benchmark
scripts. C/C++ for the on-target runtime integration where determinism and the vendor runtime
API live. I'm strongest in Python and can work the C/C++ integration side.

**Q: You have one week to enable a new customer model on the SoC. Plan?**
Day 1: inspect the ONNX — op histogram, shapes, run it FP32 to get a reference. Day 2: graph
surgery — fold constants, pin shapes, clean pre/post-processing. Day 3: PTQ with a
representative calibration set, check the partition report. Day 4: measure accuracy (SIL) and
latency (target), diagnose fallbacks and sensitive layers. Day 5: mitigate — mixed precision,
push fallbacks to DSP/boundaries. Then write it up with the numbers and open a QAT ask if the
accuracy target isn't met.
