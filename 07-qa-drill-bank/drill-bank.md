# Drill Bank — Rehearse Out Loud

Cover the answer, say yours, compare. Grouped by topic. Depth lives in the
numbered sections; this is for reps.

---

## Streaming protocols

**Q: RTSP vs WebRTC — when do you use each?**
RTSP to ingest from IP cameras (that's what they emit; pull, ~0.5–3s). WebRTC to
deliver to browsers/peers at sub-500ms. Real systems use both: RTSP in, WebRTC out.

**Q: Why not HLS/DASH for live inference delivery?**
They segment video → 6–30s latency. Fine for broadcast/CDN, useless for "obsess
over milliseconds." WebRTC is the interactive low-latency choice.

**Q: RTSP over UDP or TCP?**
UDP = lowest latency, tolerates loss. TCP = reliable, survives flaky networks, a bit
more latency. Many-camera over imperfect networks → TCP for stability.

**Q: What's FastRTC and why would you use it?**
A Python library wrapping WebRTC so you can pipe live video to/from ML code in a few
lines — it handles signaling and the peer connection, hands you numpy frames. Use it
for fast browser-facing low-latency model loops and operator UIs.

**Q: Why does a stream show garbage right after connecting/reconnecting?**
You can only start decoding at an I-frame (keyframe). Until the next keyframe
arrives, P/B frames have nothing to build on. Shorter GOP shortens that window.

---

## Codecs & frames

**Q: I vs P vs B frames?**
I = full image, decodable alone. P = diff from previous. B = diff from past+future
(smallest, but adds latency). Live low-latency pipelines often disable B-frames.

**Q: H.264 vs H.265?**
H.265 ≈ half the bandwidth at same quality, but heavier decode + licensing. Use it
only if HW decode supports it and you have compute headroom; else H.264.

**Q: Why does a lost keyframe matter more than a lost P-frame?**
Every P/B frame in the GOP references back to the keyframe. Lose the I-frame and the
whole group is undecodable until the next one. Lose a P-frame and you get a brief
glitch.

---

## Decode & buffers

**Q: cv2.VideoCapture vs a GStreamer pipeline?**
VideoCapture = quick, but CPU decode + hidden buffering, won't scale past a couple
streams. GStreamer = explicit hardware decode, threading, backpressure; scales to
many. Prototype with one, ship the other.

**Q: Software vs hardware (NVDEC) decode?**
Software burns CPU and caps at ~1–2 streams. NVDEC decodes dozens on dedicated
silicon, frees CPU, keeps frames in GPU memory for zero-copy inference. Scale →
hardware.

**Q: Consumer slower than producer — what do you do?**
Bounded queue, drop oldest, keep latest (live). Never an unbounded queue — that's
the classic memory-leak/latency-creep death. Offline/recorded → block + bounded to
keep every frame.

**Q: Why max-buffers=1 drop=true on appsink?**
Makes it a "latest frame" tap: bounded memory, minimal latency, drops stale frames
under load instead of piling up.

**Q: Why .copy() a frame in an appsink callback?**
The numpy array points into GStreamer's mapped buffer; after unmap/return that
memory is recycled. Copy if the frame outlives the callback.

---

## GStreamer / DeepStream

**Q: One-line description of GStreamer?**
A pipeline framework: elements (source→decode→convert→sink) connected by pads, media
flows as buffers, caps negotiate format, queues add thread boundaries + backpressure.

**Q: What does nvstreammux do and why does it matter?**
Batches frames from many camera streams into one batched buffer so a single
inference call serves all of them — the key trick for many cameras per GPU.

**Q: GStreamer vs FFmpeg?**
FFmpeg = swiss-army transcoder + decode lib, great for files/clips. GStreamer = live,
branching, multi-stream, plugin-extensible pipelines with threading control →
KoiReader's live serving graphs (DeepStream is built on it).

**Q: How do you detect a camera went offline in GStreamer?**
Watch the bus for ERROR/EOS, plus a frame-freshness watchdog for silent freezes.
Then tear to NULL and reconnect.

**Q: DeepStream vs rolling your own inference pipeline?**
DeepStream gives multi-stream batching, GPU-resident buffers, tracking for free on
NVIDIA HW — fastest path to many cameras. DIY when you need custom logic or
non-NVIDIA hardware.

---

## Inference & optimization

**Q: What does TensorRT do?**
Compiles a model (via ONNX) into a GPU-specific engine: layer fusion, kernel
auto-tuning, precision lowering (FP16/INT8), memory reuse. Big latency/throughput
win.

**Q: FP16 vs INT8?**
FP16 ≈ 2×, near-lossless, almost free — try first. INT8 ≈ 3–4× + ¼ memory but needs
calibration and risks accuracy — for max edge throughput, validate mAP after.

**Q: How does INT8 calibration work / why can it hurt accuracy?**
It maps floats to 256 levels using a representative calibration set to pick per-layer
ranges. Unrepresentative calibration data → wrong ranges → accuracy drop. Use QAT if
PTQ drops too much.

**Q: Why build the TensorRT engine on the deployment hardware?**
TRT tunes kernels/memory for the specific GPU arch; an engine built elsewhere may be
suboptimal or fail to load. Build on target, cache the engine.

**Q: Quantization vs pruning vs distillation?**
Orthogonal: quantization = cheaper math, pruning = fewer weights, distillation =
smaller architecture. Stack them.

**Q: Triton vs in-process TensorRT?**
In-process = lowest latency, simplest, edge. Triton = a network hop but dynamic
batching, multi-model, versioning, metrics — a cloud inference service.

**Q: Latency vs throughput — what's the difference and which do you optimize?**
Latency = time for one frame; throughput = frames/sec total. Real-time reaction →
latency; many-camera scale → throughput. Usually: hit a latency SLA, then maximize
throughput under it.

**Q: GPU utilization is low but latency is high — what's wrong?**
Not compute-bound. Suspect CPU preprocessing, CPU↔GPU copies, single-thread decode,
or network jitter. Profile before touching the model.

---

## Production Python

**Q: Does the GIL kill a video pipeline?**
No — decode (cv2/NVDEC), numpy, and CUDA/TensorRT release the GIL, so threads give
real parallelism on the native+I/O path. The GIL only bites pure-Python hot loops;
keep those off the per-frame path.

**Q: Threads vs async vs processes for video?**
Threads for I/O + GIL-releasing native work (decode/infer) — the default. Async for
many concurrent connections / web serving. Processes for CPU-bound pure-Python or
crash isolation.

**Q: Biggest source of memory leaks in long-running video services?**
Unbounded queues (consumer < producer), unreleased GPU surfaces, un-unmapped
buffers, ever-growing state/caches. Fix: bound buffers, release per iteration, soak
test 24h+.

**Q: How do you prove no memory leak?**
Plot RSS + GPU memory over hours under load — a leak is a slope, healthy is flat.
tracemalloc/objgraph for Python, nvidia-smi/tegrastats for GPU. Soak test before
shipping.

---

## Fault tolerance

**Q: A camera goes offline — what happens?**
Detect (bus EOS/ERROR or freshness watchdog) → isolate (one worker, blast radius =
1) → reconnect with exponential backoff + jitter → wait for keyframe → resume. Other
cameras unaffected.

**Q: How do you catch a silent freeze (no error fires)?**
Per-camera watchdog on last-frame timestamp; if stale beyond a threshold, force
restart even without an exception.

**Q: What's graceful degradation here?**
Under overload, shed load instead of crashing: smaller batch, process every Nth
frame, lower resolution, drop non-critical writes — keep the video loop alive.

**Q: Process-per-camera vs thread-per-camera?**
Process = strongest isolation (native crash contained, no GIL) at higher memory.
Thread = lighter, shared memory, but a native crash/GIL can hurt all. Many flaky
streams → process isolation.

---

## OpenCV / math (your strength — be ready)

**Q: Color spaces — why does it matter?**
Decoders output YUV/NV12; models want BGR/RGB. Convert on GPU (nvvidconv) to avoid
re-introducing copies. BGR is OpenCV's default ordering — mismatches silently wreck
accuracy.

**Q: Camera calibration / undistortion — when in the pipeline?**
For fisheye/wide-angle (your surround-view work): undistort using intrinsics +
distortion coeffs before geometry-dependent logic. Do it on GPU if per-frame.

**Q: You designed logic on top of detections — example?**
Geometry/statistics over boxes: zone intersection (is this box in the loading bay?),
homography to map image points to floor coordinates, tracking + line-crossing for
counting, temporal smoothing to reject flicker. (The JD's "complex logic layers on
top of model detections.")

---

## Behavioral-adjacent (they'll sneak these in)

**Q: Tell me about a hard ambiguous systems problem you solved.**
Use the NVMe-vs-network-attached-storage diagnosis or a DeepStream/Jetson latency
fix: hypothesis → isolate variables → benchmark → validate → fix. Quantify the
result.

**Q: Why do you want a systems-first CV role after data-platform work?**
Honest arc: started in edge CV/video analytics (Jetson, DeepStream, TensorRT), spent
4 years going deep on distributed systems + performance engineering at scale, now
want to bring that systems rigor back to live Vision AI — which is exactly this role.

→ Morning of: **[cheat-sheet.md](cheat-sheet.md)**
