# AI Data Scientist (Video Intelligence) — Learning Path

Everything you need for the **AI Data Scientist** interview — CCTV-based video
intelligence in Abu Dhabi — in the order to study it. Read **top to bottom the
first time**. Come back to any file as a reference (or the morning of) anytime.

The role in one line: **turn live CCTV into operational decisions** — count and
time crowds, flag anomalies, and run computer-vision + deep-learning models on
the NVIDIA edge, deployed in a secure on-prem environment that never phones home.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">CCTV cameras<span class="nsub">reconnect · on-prem</span></span>
    <span class="arw"></span>
    <span class="node">ingest / decode<span class="nsub">GStreamer / DeepStream</span></span>
    <span class="arw"></span>
    <span class="node">detect + track<span class="nsub">CNN / YOLO + ByteTrack</span></span>
    <span class="arw"></span>
    <span class="node">analytics<span class="nsub">queue time / crowd density</span></span>
    <span class="arw"></span>
    <span class="node out">events / alerts<span class="nsub">anomaly + thresholds</span></span>
  </div>
</div>
```

## What this role actually wants (and how you stack up)

| JD requirement | Your resume evidence | Gap to close |
|---|---|---|
| CCTV-based video intelligence (live, 24/7) | DeepStream + GStreamer + Jetson video analytics (Integration Wizards) | **Strong** — this is exactly the live-video work you've shipped. Frame it as CCTV intelligence, not "data platform." Sections `01`, `02`. |
| Queue-time estimation & crowd analytics | Detection/tracking + zone logic on edge; analytics pipelines | **Medium** — you have the primitives (tracking, homography, counting) but need the *metric* vocabulary: Little's Law, dwell, density maps. Study `11`. |
| Operational event & anomaly detection | "Go-to engineer for hard, ambiguous problems"; logic-on-detections | **Medium** — know the standard event catalog (loitering, intrusion, abandoned object, surge) and supervised-vs-unsupervised anomaly methods cold. `12`. |
| CV + deep learning: CNNs, object detection, tracking | Surround-view C++/OpenCV, calibration, RANSAC; TensorRT model work | **Medium** — your recent years read *systems*, not *modeling*. Rebuild the DL-modeling narrative: backbones, YOLO, mAP, ByteTrack, ReID. `14` + `09`. |
| NVIDIA edge AI stack (Jetson, TensorRT, DeepStream) | TensorRT/ONNX, INT8/FP16, layer fusion, pruning, Jetson Nano, DeepStream | **Strong** — home turf. Just frame it crisply. `03`, `02`. |
| Deployment in secure on-prem environments | Dockerized inference; edge serving (Gunicorn/Celery/Kafka); GKE/Azure DevOps | **Medium** — you've deployed, but mostly *cloud*. Learn the air-gapped, data-residency, PII/face-privacy angle. `13`. |
| Model optimization & performance monitoring | TensorRT INT8/FP16, pruning; production reliability | **Medium** — optimization is strong; add the *monitoring* half — drift, per-camera health, GPU dashboards. `03` + `13`. |
| Strong Python + ML frameworks | Petabyte Dask pipelines; PyTorch/ONNX; production Python | **Strong**. |

**Headline:** You're a strong fit on the *systems + edge* half and need to
rebuild the *modeling + applied-analytics* half of the story. Your risk isn't
capability — it's that "AI **Data Scientist**" wants to hear you reason about
models, metrics (queue time, density, mAP, false-alarm rate) and secure on-prem
deployment, not only pipelines. This pack closes exactly those gaps.

## Topics (in order)

| # | Folder | What you learn |
|---|--------|----------------|
| 1 | [01-video-streaming/](01-video-streaming/) | RTSP, WebRTC, FFmpeg, codecs, frame buffers, decode/encode |
| 2 | [02-gstreamer/](02-gstreamer/) | Pipelines, elements, appsink, hardware decode, DeepStream |
| 3 | [03-low-latency-inference/](03-low-latency-inference/) | TensorRT, DeepStream, Triton, batching, zero-copy, the latency budget |
| 4 | [04-fault-tolerance/](04-fault-tolerance/) | Crash-proof design: reconnect, watchdogs, backpressure, graceful degradation |
| 5 | [05-production-python/](05-production-python/) | Threads vs async vs processes, the GIL, queues, memory leaks |
| 6 | [06-system-design/](06-system-design/) | The big whiteboard question: design a crash-proof multi-camera pipeline |
| 7 | [07-qa-drill-bank/](07-qa-drill-bank/) | Every "why X over Y" + the one-page cheat sheet |
| 8 | [08-mock-interview/](08-mock-interview/) | Staged mock questions, model answers, scoring rubric |
| 9 | [09-computer-vision-fundamentals/](09-computer-vision-fundamentals/) | Classical CV: color spaces, geometry, calibration, features, detection/tracking math |
| 10 | [10-coding-practice/](10-coding-practice/) | Runnable OpenCV problems for the proctored round |
| 11 | [11-crowd-queue-analytics/](11-crowd-queue-analytics/) | **Queue-time estimation, crowd counting/density, zones, flow, heatmaps** |
| 12 | [12-event-anomaly-detection/](12-event-anomaly-detection/) | **Operational events, anomaly methods, alerting & false-alarm control** |
| 13 | [13-secure-onprem-monitoring/](13-secure-onprem-monitoring/) | **Air-gapped deployment, security & PII, drift & performance monitoring** |
| 14 | [14-deep-learning-for-video/](14-deep-learning-for-video/) | **CNNs, object detection (YOLO), tracking (ByteTrack/ReID), training & optimization** |

> **Sections 11–14 are the new focus areas** for this JD — the applied analytics,
> event detection, secure on-prem, and DL-modeling depth the role is built
> around. Sections 01–10 are the transferable foundation.

## How to use this

- **First time:** follow the numbers 1 → 6, then the applied focus 11 → 14, plus
  9 if classical CV is rusty.
- **If the modeling story is your weak spot:** start at `14` and `11`.
- **Day before:** read `06-system-design`, `07-qa-drill-bank`, `11`, `12`, and skim `13`.
- **Morning of:** read `07-qa-drill-bank/cheat-sheet.md` + `09/cv-cheat-sheet.md`.
- **Want to rehearse out loud:** open `08-mock-interview/` — or ask me to run it
  live in chat and I'll grade your answers.

→ Start here: **[01-video-streaming/README.md](01-video-streaming/README.md)** —
or jump straight to the new focus areas in **[11-crowd-queue-analytics/](11-crowd-queue-analytics/)**.
