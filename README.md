# KoiReader Interview Prep — Learning Path

Everything you need for the **KoiReader Computer Vision Engineer** interview, in
the order to study it. Read **top to bottom the first time**. Come back to any
file as a reference (or the morning of) anytime.

The role in one line: **systems-first CV** — not training models, but building
the *high-performance highways* that run Vision AI on live video, 24/7, without
crashing.

```
RTSP cameras → ingest/decode → frame buffer → inference (TRT/DeepStream) → logic → output
     ↑              ↑              ↑                  ↑                       ↑
  reconnect      GStreamer     backpressure      batching/zero-copy      analytics/DB
  (fault tol.)   /FFmpeg       (drop frames)     (low latency)
```

## What this role actually wants (and how you stack up)

| JD core requirement | Your resume evidence | Gap to close |
|---|---|---|
| RTSP/WebRTC/FastRTC streaming, frame buffers, decode/encode | DeepStream + GStreamer + Jetson video analytics (Integration Wizards) | **Medium** — you've done GStreamer/DeepStream but resume is light on raw RTSP/WebRTC protocol detail. Study `01` + `02`. |
| Ultra-low-latency inference (Jetson + cloud) | TensorRT/ONNX, INT8/FP16, layer fusion, pruning, Jetson Nano | **Strong** — this is your home turf. Just frame it crisply (`03`). |
| Fault-tolerant, crash-proof systems | "go-to engineer for hard ambiguous problems"; seismic platform reliability | **Medium** — you have the instinct, need the streaming-specific patterns (`04`). |
| Production Python: multi-threaded/async, long-running resource mgmt | Gunicorn/Celery/Kafka edge serving; petabyte Dask pipelines | **Medium** — know GIL/threads-vs-async cold for video (`05`). |
| OpenCV + image-processing fundamentals, geometry | Surround-view C++/OpenCV, calibration, RANSAC, photometric alignment | **Strong** — emphasize the C++/OpenCV surround-view work. |
| Docker mandatory | Dockerized inference servers on GCP | **Strong**. |
| Brownie: TensorRT/DeepStream/Triton, K8s, CI/CD, SQL/NoSQL | All present (TensorRT, DeepStream, GKE, Azure DevOps) | **Strong** — you check every bonus box. |

**Headline:** You're a strong fit. Your risk isn't capability — it's that your
recent 4 years read as *data-platform/seismic*, and the interviewer wants to
hear the *live-video-systems* engineer. This pack rebuilds that narrative and
drills the streaming-specific depth.

## Topics (in order)

| # | Folder | What you learn |
|---|--------|----------------|
| 1 | [01-video-streaming/](01-video-streaming/) | RTSP, WebRTC/FastRTC, FFmpeg, codecs, frame buffers, decode/encode |
| 2 | [02-gstreamer/](02-gstreamer/) | Pipelines, elements, appsink, hardware decode, DeepStream |
| 3 | [03-low-latency-inference/](03-low-latency-inference/) | TensorRT, DeepStream, Triton, batching, zero-copy, the latency budget |
| 4 | [04-fault-tolerance/](04-fault-tolerance/) | Crash-proof design: reconnect, watchdogs, backpressure, graceful degradation |
| 5 | [05-production-python/](05-production-python/) | Threads vs async vs processes, the GIL, queues, memory leaks |
| 6 | [06-system-design/](06-system-design/) | The big whiteboard question: design a crash-proof multi-camera pipeline |
| 7 | [07-qa-drill-bank/](07-qa-drill-bank/) | Every "why X over Y" + the one-page cheat sheet |
| 8 | [08-mock-interview/](08-mock-interview/) | Staged mock questions, model answers, scoring rubric |
| 9 | [09-computer-vision-fundamentals/](09-computer-vision-fundamentals/) | Classical CV refresher: color spaces, geometry, calibration, features, detection/tracking math, logic-on-detections |

> **Section 9 is a refresher** for the CV fundamentals the JD assumes (OpenCV,
> geometry, color spaces, statistics over detections). If the classical CV is rusty,
> read it early — alongside or right after section 01.

## How to use this

- **First time:** follow the numbers, 1 → 6, plus 9 if classical CV is rusty.
- **Day before:** read `06-system-design`, `07-qa-drill-bank`, and skim `09`.
- **Morning of:** read `07-qa-drill-bank/cheat-sheet.md` + `09/cv-cheat-sheet.md`.
- **Want to rehearse out loud:** open `08-mock-interview/` — or ask me to run it
  live in chat and I'll grade your answers.

→ Start here: **[01-video-streaming/README.md](01-video-streaming/README.md)**
