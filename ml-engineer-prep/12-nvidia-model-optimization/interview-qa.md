# Interview Q&A — Rapid Fire

**TL;DR:** Last-mile drill for the NVIDIA model-optimization loop. Each answer is the
30-second spoken version. Questions are grouped the way an interviewer escalates: numerics →
TensorRT → performance → breadth. Cover the answer, say it out loud, then check.

## Quantization & numerics

**Q: Derive the INT8 scale for a symmetric quantizer with range ±α.**
scale = α / 127 (signed INT8 uses −128…127, and symmetric maps to ±127). Dequant is
`r = scale · q`, zero-point is 0. Asymmetric adds a zero-point and uses the full [β, α] range.

**Q: Symmetric vs asymmetric — when each?**
Symmetric for weights (roughly zero-centered, and it drops the zero-point term from the
matmul). Asymmetric for one-sided activations like post-ReLU, where a symmetric range would
waste half the codes.

**Q: Per-tensor vs per-channel, and why does it matter?**
Per-tensor uses one scale for the whole weight tensor; per-channel uses one scale per output
channel. Per-channel lets each channel use the full INT8 range, so it's the standard fix when
channels have very different magnitudes — it's nearly free and often recovers most of an INT8
accuracy drop.

**Q: What is calibration, and why is entropy better than min–max?**
Calibration picks the clipping range α for activations by observing real batches. Min–max
takes the observed max, so one outlier inflates the scale and coarsens every step. Entropy/KL
calibration (TensorRT's default) clips α to minimize divergence between the FP32 and INT8
distributions — robust to outliers, better accuracy.

**Q: PTQ vs QAT in one breath.**
PTQ calibrates a trained model without touching weights — fast, minutes, bigger accuracy hit.
QAT inserts fake-quant during fine-tuning so the model learns to tolerate rounding — slower,
recovers accuracy. PTQ first; QAT when PTQ drops too much.

**Q: How do you backprop through the non-differentiable round() in QAT?**
Straight-Through Estimator: treat the rounding's gradient as 1 inside the clipping range and 0
outside, so gradients flow despite the hard rounding.

**Q: FP16 vs BF16 — why does FP16 need loss scaling?**
FP16 has a narrow exponent range, so small gradients underflow to zero; loss scaling multiplies
the loss up so gradients stay representable, then unscales before the step. BF16 shares FP32's
8-bit exponent, so no underflow and no loss scaling — at the cost of fewer mantissa bits.

**Q: What's TF32 and when does it apply?**
A 19-bit tensor-core format (8 exp, 10 mantissa) used automatically for FP32 matmuls on
Ampere+. Near-FP32 accuracy at FP16-ish speed — on by default, so part of "FP32→FP16"
speedups are really TF32.

**Q: Why two FP8 formats?**
E4M3 (precision-heavy) for the forward pass — weights/activations; E5M2 (range-heavy) for
gradients. FP8 needs per-tensor scaling, handled by Transformer Engine, and doubles tensor-core
throughput vs FP16 on Hopper/Ada.

## TensorRT

**Q: What does the TensorRT builder actually do?**
Layer/tensor fusion (e.g. Conv+BN+ReLU → one kernel), kernel auto-tuning (times candidate
kernels on your GPU to pick the fastest), precision selection, and memory planning. Output is
a serialized engine specific to that GPU and TRT version.

**Q: Implicit vs explicit quantization?**
Implicit: give TRT an FP32 network + a calibrator; it picks scales and decides which layers go
INT8. Explicit (QDQ): the ONNX carries QuantizeLinear/DequantizeLinear nodes with baked-in QAT
scales that TRT honors exactly. Explicit is deterministic and the recommended path.

**Q: Do QDQ nodes slow down inference?**
No — they're build-time instructions. The builder fuses Q→Conv→DQ into one INT8 kernel and
discards the markers. They change achievable accuracy, not runtime speed, unless placed so
densely they can't be fused.

**Q: Why isn't a TensorRT engine portable across GPUs?**
Because tactic selection times kernels for a specific architecture and TRT version; an engine
built for one GPU family may be suboptimal or invalid on another. Build on the deployment GPU.

**Q: How would you serve a TensorRT engine in production?**
Behind Triton Inference Server with dynamic batching and a couple of concurrent model
instances to raise utilization, plus an optimization profile for dynamic batch sizes.

## Performance & profiling

**Q: Is this kernel compute-bound or memory-bound — how do you decide?**
Compute its arithmetic intensity (FLOPs per byte) and place it on the roofline. Low intensity
→ memory-bound (fix with fusion, better layout, lower precision); high → compute-bound (tensor
cores, tiling). Elementwise ops are almost always memory-bound.

**Q: Your GPU shows low utilization during training — what's wrong?**
Usually not compute — it's a feed or launch overhead problem. Confirm on an Nsight Systems
timeline: if the GPU is idle waiting on the dataloader, add workers/pinned memory/prefetch and
bigger batches; if it's launch-bound on tiny kernels, use CUDA Graphs.

**Q: Nsight Systems vs Nsight Compute?**
Systems is the system-wide timeline — "is the GPU busy and what's it waiting on." Compute is the
per-kernel deep dive — roofline placement, occupancy, memory vs compute for one kernel.

**Q: How do you correctly measure GPU inference latency?**
CUDA events with `torch.cuda.synchronize`, a warmup to absorb one-time costs, many iterations,
and report p50/p99 — not a single wall-clock call, because kernels are async. Lock clocks to
cut boost/thermal noise.

**Q: What is a CUDA stream good for?**
Overlapping independent work — e.g. copy the next batch (pinned + non_blocking) while computing
the current one, or running independent kernels concurrently. Higher utilization.

## Compression breadth

**Q: Why doesn't unstructured pruning speed up a GPU?**
Scattered zeros still pass through dense kernels — the hardware multiplies by zero. You need
structured pruning (whole channels) or a hardware-supported sparse pattern.

**Q: What is 2:4 sparsity?**
At most 2 non-zeros per group of 4 weights. Ampere+ sparse tensor cores skip the zeros for up
to 2× matmul throughput. Train dense → apply the 2:4 mask → fine-tune → run sparse; stacks with
INT8/FP8.

**Q: Why are soft targets better than hard labels in distillation?**
The teacher's softened probability distribution carries "dark knowledge" about class similarity
— far richer supervision than a one-hot label — so the student learns more from fewer signals.

**Q: In what order would you stack optimizations?**
Distill (smaller architecture) → prune (structured/2:4) → quantize (INT8/FP8) → compile
(TensorRT), re-measuring accuracy after each step and profiling to confirm the speedup.

## LLM inference

**Q: Why is LLM decode memory-bound, and what helps?**
Each token reads all weights + the whole KV cache but does little math per byte → bandwidth
limited. Weight-only INT4, KV-cache quantization (FP8/INT8), and GQA/MQA all cut the bytes
moved.

**Q: What does FlashAttention do?**
Fuses attention and tiles it through on-chip SRAM with an online softmax, so it never writes the
N×N score matrix to global memory — O(N) memory, far fewer HBM trips, and it's exact.

**Q: Paged attention?**
Stores the KV cache in fixed-size blocks mapped by an index table, like OS virtual memory —
eliminates fragmentation, raises batch size, and enables copy-free prefix sharing (vLLM).

**Q: Continuous / in-flight batching?**
Schedule at the token level so a finished sequence is immediately replaced and new requests join
mid-flight — keeps the GPU saturated instead of waiting for the slowest sequence in a static
batch. Biggest throughput lever for real traffic.

**Q: Tensor vs pipeline parallelism?**
Tensor parallelism splits each layer's matmul across GPUs (heavy per-layer all-reduce, wants
NVLink); pipeline parallelism puts different layers on different GPUs (has a pipeline bubble,
hidden with micro-batching). TP for latency on a big single model, PP to span many layers.

## The three questions to never fumble

**Q: What's the single mental model you bring to any optimization problem?**
Separate the three axes: **method** (how you pick int8-friendly weights/scales — PTQ/QAT/
calibration), **format** (which numbers you compute in — FP32/FP16/BF16/FP8/INT8), and **engine**
(where it runs fast — TensorRT/Triton/CUDA kernels/fusion). Most questions are asking me to hold
two of these apart.

**Q: You optimized a model — walk me through it.**
The FashionMNIST story: FP32 baseline → PTQ/QAT on the method axis, fbgemm-CPU vs TensorRT-GPU on
the engine axis, FP16/INT8 on the format axis, all tracked in MLflow — with the punchline that
QAT-fed TensorRT recovered accuracy at identical speed because TRT latency comes from kernels,
not weight values.

**Q: How do you know your optimization actually worked?**
Profile before and after — Nsight to attribute the speedup and confirm the new bottleneck,
proper CUDA-event timing with warmup and p99, and an accuracy re-check after every step. Never
claim a speedup I didn't measure, never ship an accuracy drop I didn't quantify.
