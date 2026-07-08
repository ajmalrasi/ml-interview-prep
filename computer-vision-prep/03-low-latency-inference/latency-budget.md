# The Latency Budget

**TL;DR:** "Latency" is the sum of every stage from photon to decision. You can't
optimize what you haven't measured per-stage. Break it down, find the fattest
slice, attack that. Throughput (fps) and latency (ms per frame) are different
goals — know which the question is asking.

## The stages (and where time hides)

```
camera capture/encode   →   network transport   →   decode   →   preprocess
   (out of your hands)        (jitter buffer)        (NVDEC)     (resize/normalize/color)
        →   inference   →   postprocess (NMS, decode boxes)   →   tracking/logic   →   output
```

Typical fat slices and fixes:

| Stage | Common cost | Fix |
|---|---|---|
| Jitter/transport | 100ms–1s | smaller jitter buffer, TCP vs UDP tradeoff, GOP |
| Decode | high on CPU | move to **NVDEC** (hardware) |
| Preprocess | CPU↔GPU copies, PIL resize | do resize/normalize on GPU; avoid host round-trips |
| Inference | the model itself | TensorRT, FP16/INT8, smaller backbone, batching |
| Postprocess | NMS on CPU, Python loops | GPU NMS, vectorize, limit detections |
| Tracking/logic | per-object Python | keep it O(detections), avoid per-pixel Python |

## Latency vs throughput (the distinction that wins points)

- **Latency** = how long *one* frame takes end to end. Matters for real-time
  reaction ("obsess over milliseconds").
- **Throughput** = how many frames/sec total. Matters for *how many cameras* a box
  serves.
- **Batching raises throughput but can raise per-frame latency** (you wait to fill
  the batch). The art is choosing a batch size that maximizes cameras-served while
  staying under the latency SLA. Know your SLA before you tune.

## How to actually measure (your "evidence-driven" story)

- Timestamp at each stage boundary; log p50/p95/p99, not just the average — tail
  latency is what users feel and what causes buffer pileups.
- GPU profiling: `nsys`/`nvprof`/Nsight Systems for kernel time, `nvidia-smi
  dmon` for utilization, `tegrastats` on Jetson.
- Watch **GPU utilization**: low util + high latency = you're CPU/copy/IO-bound,
  not compute-bound. That diagnosis decides everything.
- This mirrors your resume win: *"quantifying why local NVMe outperformed
  network-attached storage"* — same method, different domain.

## Why p99 matters for video

If p99 inference time exceeds your frame interval (33ms @ 30fps), frames pile up
during those slow moments → buffer grows → latency creeps → eventually you drop or
OOM. A pipeline that's "fine on average" can still die on its tail. Design for p99
under the frame budget, or drop cleanly when you exceed it.

## Why X over Y

**Optimize latency or throughput first?**
Ask what the system needs. A single safety-critical trigger → latency. A 40-camera
analytics farm → throughput (cameras/$). Most real answers: hit a latency SLA,
then maximize throughput under it.

**Average vs p99 latency?**
Average hides the spikes that actually break video pipelines (pileups happen on the
slow tail). Always quote and design to p95/p99.

**High latency but low GPU utilization — what's wrong?**
You're not compute-bound. Suspect CPU preprocessing, CPU↔GPU copies, single-thread
decode, or network jitter. Profile to confirm before touching the model — changing
the model wouldn't help a copy-bound pipeline.

→ Next: **[tensorrt-and-quantization.md](tensorrt-and-quantization.md)**
