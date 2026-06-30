# A Framework for CV-Systems Design Questions

**TL;DR:** Don't start drawing. Run this five-step loop out loud: **Clarify →
Estimate → Architect → Bottleneck → Failure**. It works for any "design a video
pipeline" prompt and shows the senior-engineer method the JD wants.

## Step 1 — Clarify (never skip)

Ask before you design. Good questions for any CV pipeline:
- **Scale:** how many cameras? resolution? framerate? Edge, cloud, or both?
- **Latency SLA:** real-time reaction (ms) or near-real-time analytics (seconds)?
- **Model:** detection/tracking/classification? given to me, or do I pick? size?
- **Output:** alerts? analytics to a DB? annotated stream to a UI?
- **Accuracy vs cost:** can I drop frames? skip cameras under load?
- **Hardware budget:** Jetson at the edge? GPUs in cloud? how many?
- **Deployment:** how many sites? connectivity reliability?

*Stating these assumptions out loud is half the score.*

## Step 2 — Estimate (back-of-envelope)

Show you can size it:
- 50 cams × 1080p × 30fps. Can one Jetson/GPU decode + infer that? NVDEC decode
  capacity? GPU inference throughput at your batch/precision?
- Bandwidth: 50 × ~4 Mbps (H.264 1080p) ≈ 200 Mbps ingest — link OK?
- Conclusion drives architecture: one box won't do 50 → distribute (e.g., edge
  boxes of 8–16 cams each, or a GPU cluster).

## Step 3 — Architect (the diagram)

A defensible default:
```
Cameras (RTSP) → Edge node(s): GStreamer/DeepStream decode (NVDEC) + batched
                 TRT inference + tracking → results as metadata
                       │ (only small metadata + optional clips leave the edge)
                       ▼
              Message bus (Kafka/Pub/Sub) → Cloud: aggregation, storage
                 (SQL/NoSQL), dashboards, WebRTC live view, retraining data
```
Key decisions to justify: edge vs cloud inference, per-camera isolation, batching
at the mux, bounded buffers, hardware decode.

## Step 4 — Bottleneck (prove you measure)

Walk the latency budget (section 03): decode, copy, inference, post, network. Name
the likely fattest slice and how you'd *measure* then fix it. Mention p99, GPU
utilization as the diagnostic. This is your "evidence-driven engineering" signature.

## Step 5 — Failure (crash-proof, section 04)

Close every design by addressing: camera drop (reconnect+backoff), silent freeze
(watchdog), overload (drop frames / degrade), process crash (supervised restart),
memory (bounded buffers, soak-tested), blast radius (per-stream isolation). They
*will* ask; bring it up first.

## The cheat phrase

*"Let me clarify scale and SLA, do a quick capacity estimate, sketch an edge-heavy
architecture, walk the latency budget to find the bottleneck, then make it
crash-proof."* — say that and you've framed the whole answer.

→ Next: **[worked-example-multicam.md](worked-example-multicam.md)**
