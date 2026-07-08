# Mock Interview — Model Answers

These are *strong reference* answers, not scripts. Say it in your words. Numbers in
**bold** are the points an interviewer actually rewards.

---

## Stage 1 — Warm-up

**1. Background + why this role.**
"7 years as an engineer; I started in **edge computer vision and video analytics** —
Jetson Nano, DeepStream, GStreamer, TensorRT with INT8/FP16, custom trackers
outperforming SORT on ARM. Then I spent **4 years going deep on distributed systems
and performance engineering** building petabyte-scale data platforms on GCP/K8s.
This role is the intersection: it wants someone who can make Vision AI **run** on
live video, reliably and fast — that's edge-CV depth *plus* systems rigor, which is
exactly my arc."

**2. Maps to systems-first how?**
"My CV background isn't notebook training — it was always **deployment**: porting
models to NXP/Samsung SOCs with quantization, real-time DeepStream pipelines on
Jetson, Dockerized inference servers behind REST. And my data-platform years were
pure systems: throughput, fault tolerance, profiling. The JD's pillars — streaming
pipelines, low-latency inference, crash-proof systems, performance debugging — are
the things I've actually shipped."

**3. Why move back.**
"I love the systems side, and live vision is where I get to apply it to something
physical and real-time. The data-platform work made me a much better *systems*
engineer — measurement-driven, comfortable with ambiguity, obsessed with what fails
at scale. I want to point that at Vision AI again."

---

## Stage 2 — Rapid-fire (keep these tight)

**4.** RTSP to ingest from cameras (pull, ~0.5–3s); WebRTC to deliver to browsers/
peers (<500ms). Real systems use both.

**5.** HLS segments video into multi-second chunks → 6–30s latency. Built for
CDN broadcast, not "obsess over milliseconds." WebRTC for interactive.

**6.** I = full keyframe (standalone). P = diff from previous. B = diff from past
*and future*. Disable B-frames for low latency because the decoder must wait for the
future frame to decode the B-frame — adds latency and reordering.

**7.** Because P/B frames are diffs that reference back to a keyframe. With no
keyframe in hand there's nothing to apply the diffs to — you must wait for the next
I-frame.

**8.** It decodes on the **CPU** (FFmpeg under the hood) and copies every frame to
host memory, with opaque internal buffering. One or two 1080p streams saturate
several cores; 30 is impossible. Use **GStreamer + NVDEC**, keep frames on GPU.

**9.** Bounded queue, **drop oldest / keep latest** for live. A big buffer doesn't
help — if you can't catch up, it just means you're always acting on increasingly
*old* frames, and it grows latency and memory unboundedly. Live wants *now*.

**10.** No — for video. The GIL only blocks two threads running **Python bytecode**
at once. Decode (cv2/NVDEC), numpy, and CUDA/TensorRT calls **release the GIL**, so
threads run those in parallel. The GIL only bites pure-Python hot loops, which I
keep off the per-frame path. CPU-bound Python → processes.

**11.** FP16 ≈ 2× faster, half memory, near-lossless — try first. INT8 ≈ 3–4× and ¼
memory but needs a **calibration dataset** to set per-layer float ranges, and risks
accuracy — so I always re-measure mAP, and use QAT if PTQ drops too much.

---

## Stage 3 — Deep dive

**12. PyTorch detector → fastest stable Jetson inference.**
"Export to **ONNX**; build a **TensorRT** engine **on the Jetson itself** so kernels
are tuned for that arch. Start FP16 (near-free), then INT8 with a representative
calibration set, re-validating mAP each step. Run decode on **NVDEC**, preprocess
(resize/normalize/color) **on the GPU** to avoid host copies, batch with
**nvstreammux** if multi-camera, run inference via DeepStream `nvinfer`, do NMS on
GPU, and pull only **metadata** (boxes/IDs) back to CPU. Then I **profile** with
nsys/tegrastats, check p99 and GPU utilization, and attack the fattest stage. Cache
the engine so startup doesn't rebuild it."

**13. INT8 dropped mAP 4 points — debug.**
"First suspect **calibration data**: was it representative of deployment lighting/
angles/classes? Re-calibrate with better samples. Check whether specific *layers*
are sensitive — mixed precision (keep those in FP16, rest INT8). Compare per-class
metrics to see if it's one class collapsing. If PTQ can't recover it, move to **QAT**.
And confirm it's the quantization, not a preprocessing mismatch between calibration
and inference — same resize/normalize/color path."

**14. Silent freeze in a 40-camera system.**
"No error means the bus won't tell me, so I run a **per-camera freshness watchdog**:
track the timestamp of the last frame; if `now - last > threshold`, declare it dead.
For recovery, each camera is an **isolated supervised worker** (its own process or a
DeepStream source the mux tolerates dropping) — blast radius is one camera. On
detection I tear the pipeline to NULL, **reconnect with exponential backoff +
jitter**, and wait for the next keyframe. The other 39 never see it because they
share no state with the dead one and the mux is configured to proceed without a
stalled source."

**15. Reconnect floods logs / hammers camera.**
"That's a missing **backoff**. Replace fixed-interval retries with exponential
backoff (1s, 2s, 4s… capped at ~30s) plus random **jitter** so 40 cameras don't
retry in lockstep after a network blip. Log at decreasing frequency or aggregate
(`camera X down, N attempts`). Reset the counter on successful reconnect."

---

## Stage 4 — System design

**16.** See [../06-system-design/worked-example-multicam.md](../06-system-design/worked-example-multicam.md)
for the full answer. Skeleton: clarify (scale/SLA/edge-cloud) → estimate (one GPU
won't do 50 → edge nodes of ~16) → architecture (NVDEC → nvstreammux batch → INT8
TRT + tracker at edge → metadata to message bus → cloud storage/UI/retraining) →
latency budget (find fat slice, p99, GPU util) → crash-proof (isolate, watchdog,
backoff, degrade, supervise, bounded memory).

**Curveballs:** answers in
[../06-system-design/curveballs.md](../06-system-design/curveballs.md). The pattern:
restate constraint → name the tradeoff it stresses → change the minimum → state what
you give up.

---

## Stage 5 — Your questions (have 3+ ready)

Strong ones (signal seniority + genuine fit):
- "What's the proprietary vision framework built on — GStreamer/DeepStream, or
  something custom? Where does it hurt today?"
- "Where's the current bottleneck — decode, inference, network, or the cloud
  aggregation layer?"
- "How is ownership split between the ML team training models and the systems team
  running them? Where does my role sit?"
- "What does 'crash-proof' currently look like in production — what's your worst
  recurring failure mode?"
- "What scale are you at now (cameras/sites) and where do you need it to go?"

Avoid: questions answered on the careers page, or only about perks.

→ Grade yourself: **[rubric.md](rubric.md)**
