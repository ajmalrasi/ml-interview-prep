# RTSP vs WebRTC vs FastRTC

**TL;DR:** RTSP is how IP cameras stream (pull, TCP/UDP, ~1–3s latency). WebRTC
is how browsers stream peer-to-peer (push, sub-500ms, NAT-traversing). FastRTC is
a thin Python wrapper that makes WebRTC easy to wire to ML code. KoiReader ingests
cameras (RTSP) and may serve live results to browsers/agents (WebRTC/FastRTC).

## The mental model

Think of it like plumbing. **RTSP** is the industrial pipe bolted to a factory
camera — rugged, standard, slightly slow. **WebRTC** is the flexible hose that
snakes through any firewall to reach a browser, designed for real-time calls.
**FastRTC** is the quick-connect fitting so you don't hand-thread the hose.

## RTSP (Real-Time Streaming Protocol)

- **What:** A *control* protocol ("VCR remote" — PLAY, PAUSE, TEARDOWN). The
  actual video rides on **RTP** (over UDP or TCP), control/stats on **RTCP**.
- **Pattern:** *Pull.* Your pipeline connects to `rtsp://user:pass@cam-ip:554/stream`.
- **Transport choice:**
  - **RTP/UDP** — lowest latency, but packets can drop → tearing/artifacts.
  - **RTP/TCP (interleaved)** — reliable, slightly higher latency, survives lossy
    networks. Most production multi-camera setups use TCP for stability.
- **Latency:** ~500ms–3s depending on buffering and GOP size.
- **This is what 95% of CCTV/industrial cameras speak.** KoiReader's "multiple
  RTSP streams" requirement lives here.

```
# What a GStreamer RTSP source looks like (more in section 02)
rtspsrc location=rtsp://... protocols=tcp latency=200 ! rtph264depay ! ...
```

## WebRTC

- **What:** A full real-time media stack built for **browsers and peers**. Bundles
  ICE/STUN/TURN (NAT traversal), DTLS (encryption), SRTP (media), and congestion
  control. No plugins, sub-second.
- **Pattern:** *Push / bidirectional.* Peers negotiate via an **SDP offer/answer**
  exchanged through a **signaling server** (you build/host signaling; WebRTC
  doesn't define it).
- **Latency:** typically **100–500ms** — the lowest of the three.
- **Why a vision team cares:** serving a live annotated feed to a dashboard, a
  human-in-the-loop reviewer, or a remote operator — all in-browser, no install.
- **Cost:** more moving parts (signaling, TURN relays when P2P fails).

## FastRTC

- **What:** A Python library (from the Gradio/HF ecosystem) that wraps WebRTC so
  you can stream audio/video to/from Python ML code with a few lines — it handles
  signaling, the peer connection, and gives you frames as numpy arrays.
- **Why it's in the JD:** it signals they want someone who can stand up a
  real-time WebRTC ↔ model loop *quickly*, not hand-roll the WebRTC stack.
- **Honest framing in the interview:** "I've built real-time inference serving
  with Gunicorn/Celery/Kafka and DeepStream pipelines; FastRTC is the modern
  Python-native path to the same goal — wiring a live WebRTC feed straight into a
  model. I'd reach for it for browser-facing low-latency demos and operator UIs."

## Why X over Y (interview gold)

**RTSP vs WebRTC — when each?**
RTSP to *ingest from cameras* (that's what they emit). WebRTC to *deliver to
browsers/peers* with the lowest latency. A real system uses **both**: RTSP in,
WebRTC out.

**Why not just HTTP (HLS/DASH) for delivery?**
HLS/DASH chunk video into segments → 6–30s latency. Great for Netflix-style
scale and CDN caching, **terrible for real-time** ("obsess over milliseconds").
Rule of thumb: HLS = broadcast, WebRTC = interactive.

**UDP vs TCP for RTSP?**
UDP = lowest latency, tolerates loss (you'd rather skip a frame than wait).
TCP = reliable, survives bad networks, what you pick when stability > a few ms.
Many cameras over flaky factory WiFi → TCP.

**Why does RTSP need a keepalive?**
RTSP sessions time out. You send periodic `GET_PARAMETER`/`OPTIONS` (or RTCP) to
keep the session alive, else the camera tears down and you must reconnect — which
ties directly into [fault tolerance](../04-fault-tolerance/README.md).

→ Next: **[codecs-and-frames.md](codecs-and-frames.md)**
