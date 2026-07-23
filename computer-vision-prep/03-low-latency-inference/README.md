# 03: Low-Latency Inference

**TL;DR:** This is your home turf (TensorRT, ONNX, INT8/FP16, Jetson). The job is
to turn a trained model into the fastest possible stable inference, and to *know
your latency budget* — where every millisecond goes. Lead with this section in the
interview; it's where you're strongest.

Files:
1. [latency-budget.md](latency-budget.md) — where the milliseconds actually go
2. [tensorrt-and-quantization.md](tensorrt-and-quantization.md) — TRT, FP16/INT8, calibration
3. [triton.md](triton.md) — Triton inference server, when and why
4. [batching-and-throughput.md](batching-and-throughput.md) — batching, throughput vs latency

## The framing line (memorize)

*"Low latency isn't one trick — it's a budget. Decode on NVDEC, keep frames in GPU
memory, batch at the mux, run an INT8 TensorRT engine with fused layers, and only
move small results back to the CPU. Then you measure each stage and attack the
biggest number — I don't guess, I profile."*

That last sentence is straight from your resume's "evidence-driven engineering"
and it's exactly the JD's "diagnose bottlenecks — CPU, GPU, or Network."

→ Start: **[latency-budget.md](latency-budget.md)**
