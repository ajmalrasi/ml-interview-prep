# Worked Example: 50-Camera Crash-Proof Pipeline

**The prompt:** *"Design a system to run object detection + tracking on 50 RTSP
cameras across a warehouse, 24/7, low latency, that recovers from failures without
human intervention. Edge and cloud."*

This is a full model answer. Read it as *how to talk*, not a script to memorize.

## 1. Clarify (state assumptions)

"I'll assume: 50× 1080p H.264 @ 30fps; given a YOLO-class detector; need
near-real-time (~100–200ms) detections + persistent track IDs for counting/dwell;
output is analytics to a DB plus a live annotated view for operators; one warehouse
site with reliable LAN to cameras but possibly flaky WAN to cloud; NVIDIA hardware
available (Jetson Orin / dGPU). Tell me if any of that's wrong."

## 2. Capacity estimate

- Ingest: 50 × ~4 Mbps ≈ 200 Mbps on the LAN — fine.
- One dGPU (e.g., with NVDEC) can decode dozens of 1080p streams and, with batched
  INT8 TRT inference on a small detector, serve many cameras. 50 cams likely needs
  **1 strong GPU server or 2–4 Jetson Orin edge boxes** (~12–16 cams each).
- Decision: **edge-heavy** — infer at the edge, send only metadata + event clips to
  cloud, so WAN flakiness and bandwidth aren't in the critical path.

## 3. Architecture

```rawhtml
<div class="diagram">
  <div class="vflow">
    <div class="loopwrap" style="width:100%">
      <span class="loop-top">EDGE NODE ×N — each handles a camera group</span>
      <div class="flow">
        <span class="node data">cam 1..16<span class="nsub">RTSP</span></span>
        <span class="arw tiny"></span>
        <span class="node">nvv4l2decoder<span class="nsub">NVDEC</span></span>
        <span class="arw tiny"></span>
        <span class="node">nvstreammux<span class="nsub">batch = 16</span></span>
        <span class="arw tiny"></span>
        <span class="node">nvinfer<span class="nsub">INT8 TRT detector</span></span>
        <span class="arw tiny"></span>
        <span class="node">nvtracker<span class="nsub">IDs</span></span>
        <span class="arw tiny"></span>
        <span class="node">pad probe<span class="nsub">metadata: boxes, ids, ts</span></span>
      </div>
      <div class="flow" style="margin-top:8px">
        <span class="node soft">ring buffer<span class="nsub">recent frames for clips</span></span>
        <span class="node soft">local agent<span class="nsub">dedup / aggregate · write event clips</span></span>
      </div>
    </div>
    <span class="varw" title="metadata + clips (small)"></span>
    <span class="node soft">Message bus<span class="nsub">Kafka / GCP Pub/Sub</span></span>
    <span class="varw"></span>
    <div class="loopwrap" style="width:100%">
      <span class="loop-top">CLOUD</span>
      <div class="flow">
        <span class="node">stream processor</span>
        <span class="arw"></span>
        <span class="node">SQL / NoSQL<span class="nsub">events, analytics</span></span>
      </div>
      <div class="fork" style="flex-direction:column; gap:8px; margin-top:8px">
        <span class="node ghost">dashboards / alerting</span>
        <span class="node ghost">WebRTC / FastRTC live annotated view</span>
        <span class="node ghost">sampled frames → retraining dataset</span>
      </div>
    </div>
  </div>
</div>
```

**Why these choices:**
- **Edge inference**: lowest latency, no full-video egress, survives WAN outages.
- **DeepStream + nvstreammux batching**: many cams per GPU at low latency (sec 02/03).
- **INT8 TRT engine** built on the edge hardware (sec 03): max throughput.
- **Metadata-only egress**: cheap, private; clips only on events.
- **Message bus**: decouples edge from cloud; buffers during WAN blips.
- **Cloud for state/UI/retraining**: scales independently of the edge.

## 4. Latency budget

"End to end I'd budget: decode ~few ms (NVDEC) → preprocess on GPU → batched
inference (the fat slice; tune batch vs p99) → tracking (cheap) → metadata out.
Target sub-150ms to detection. I'd timestamp each stage, watch p99 and GPU
utilization; if util is low but latency high, I'm copy/CPU-bound and I keep frames
in GPU memory and move preprocessing onto the GPU."

## 5. Crash-proof (the part they're really testing)

- **Per-camera isolation:** each camera group in its own supervised pipeline/process;
  `nvstreammux` configured so one dropped source doesn't stall the batch. Blast
  radius = one camera.
- **Camera offline / EOS:** detected on the GStreamer bus → tear to NULL, reconnect
  with exponential backoff + jitter; wait for keyframe.
- **Silent freeze:** per-camera frame-freshness watchdog → force restart.
- **Overload / GPU OOM:** graceful degradation — shrink batch, drop to every-Nth
  frame, or lower inference resolution before crashing.
- **Process crash:** supervised by systemd/Kubernetes liveness probes (GKE) →
  auto-restart; crash-only design means a fresh worker has clean state.
- **WAN outage:** edge keeps running and inferring; metadata/clips buffer locally
  (bounded, drop oldest non-critical) and flush when the bus reconnects.
- **Memory:** every queue bounded, GPU surfaces released per iteration, 24–72h soak
  test proving flat memory.
- **Observability:** per-camera fps/freshness/queue-depth health endpoint +
  Prometheus; alert when a camera is down > threshold.

## 6. Scaling & evolution

- Add cameras → add edge nodes (horizontal). Cloud scales separately.
- New model → version via Triton (cloud) or rebuild TRT engine + canary one edge
  node first.
- Multi-site → same edge node template per site, central cloud aggregation.

## The 30-second summary (if they want it short)

"Decode on NVDEC, batch many cameras through one INT8 TensorRT engine via DeepStream
at the edge, keep frames on the GPU, emit only metadata to a message bus, and do
state/UI/retraining in the cloud. Each camera is an isolated, watchdogged,
auto-reconnecting worker under a supervisor, with bounded buffers and graceful
degradation — so a camera or WAN failure self-heals and never takes the system
down."

→ Next: **[curveballs.md](curveballs.md)**
