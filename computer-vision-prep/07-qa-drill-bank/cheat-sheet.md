# Cheat Sheet: One Page, Morning Of

Read this and nothing else the morning of. Depth is in the numbered sections.

---

## The role in one breath
Systems-first CV: build the pipelines that run Vision AI on live video 24/7, fast
and crash-proof. Not training models — making them *run*.

## Streaming
- **RTSP** in (cameras, pull, ~0.5–3s), **WebRTC/FastRTC** out (browsers, <500ms).
  HLS/DASH = broadcast, too slow for live.
- **RTSP transport:** UDP = low latency/lossy; TCP = reliable/stable. Many cams →
  TCP.
- **I/P/B frames:** I = full keyframe, P = diff from past, B = past+future (disable
  for low latency). Can only start decoding at a **keyframe**.
- **H.264** default; **H.265** halves bandwidth but heavier + licensing.

## Decode & buffers
- **NVDEC hardware decode**, not CPU — scales to dozens of streams, keeps frames on
  GPU (zero-copy).
- **Bound every queue; drop oldest, keep latest** for live. Unbounded queue = the
  classic leak + latency creep.
- appsink: `max-buffers=1 drop=true sync=false`. `.copy()` frames that outlive the
  callback; always `unmap`.

## GStreamer / DeepStream
- GStreamer = elements + pads + caps + buffers; `queue` = thread boundary +
  backpressure.
- **nvstreammux batches many cameras into one inference call** → the key multi-cam
  scaling trick.
- DeepStream = inference + tracking + analytics inside the pipeline, GPU-resident.
- Detect dead camera: **bus EOS/ERROR + freshness watchdog**.

## Inference (your strength: lead here)
- **TensorRT**: ONNX → engine, layer fusion + kernel tuning + precision. Build **on
  the target GPU**.
- **FP16** ≈ 2×, near-lossless (try first). **INT8** ≈ 3–4×, ¼ mem, needs
  calibration — validate mAP.
- Quantization (math) vs pruning (weights) vs distillation (architecture) — stack
  them.
- **Triton** = cloud model server (dynamic batching, versioning); in-process TRT =
  edge minimum latency.
- **Latency ≠ throughput.** Hit the latency SLA, then maximize throughput (batch
  size) under it.
- **Low GPU util + high latency = copy/CPU/network-bound, not the model.** Profile
  first.

## Production Python
- **GIL doesn't block** decode/numpy/CUDA (they release it) → **threads** are the
  default for video. **Async** for many connections. **Processes** for CPU-bound
  Python / isolation.
- **No leaks:** bound buffers, release GPU surfaces per iteration, soak-test 24h+
  (leak = a slope on the memory graph).

## Crash-proof (they WILL probe this)
- **Isolate** each camera (blast radius = 1) → **watchdog** freshness → **reconnect
  with exponential backoff + jitter** → wait for keyframe.
- **Graceful degradation:** under load, shrink batch / skip frames / lower res —
  don't crash.
- **Supervise:** systemd / k8s liveness (GKE) auto-restarts crashed workers.
- WAN drop → edge keeps inferring, buffer metadata locally (bounded), flush later.

## System-design loop (say it out loud)
**Clarify → Estimate → Architect → Bottleneck → Failure.**
Default architecture: NVDEC decode → nvstreammux batch → INT8 TRT + tracker at the
**edge** → metadata-only to a **message bus** → cloud for storage/UI/retraining.

## Your pitch (the narrative)
"Edge-CV/video-analytics roots (Jetson, DeepStream, TensorRT, INT8) → 4 years deep
in distributed systems + performance engineering at petabyte scale → now bringing
that systems rigor to live Vision AI. I work by measurement: hypothesis, isolate,
benchmark, validate."

## Don't forget to ask them
Scale (cameras/res/fps)? Latency SLA? Edge or cloud? What's the proprietary
framework built on? Team size / who owns the ML vs systems split?

**Breathe. Clarify before answering. Think out loud. You've shipped this stuff.**
