# 01 — Video Streaming Fundamentals

The JD's #1 requirement: *"Deep expertise in video streaming protocols (RTSP,
WebRTC, FastRTC) and processing tools (FFmpeg, GStreamer). You know how to handle
frame buffers, decoding, and encoding efficiently."*

This is the section to nail. Files in order:

1. [protocols-rtsp-webrtc.md](protocols-rtsp-webrtc.md) — RTSP vs WebRTC vs FastRTC, when each
2. [codecs-and-frames.md](codecs-and-frames.md) — H.264/H.265, I/P/B frames, why a dropped keyframe hurts
3. [decode-encode-pipeline.md](decode-encode-pipeline.md) — the journey from packet to numpy array, hardware decode
4. [frame-buffers-backpressure.md](frame-buffers-backpressure.md) — buffers, latency vs smoothness, drop strategy

**TL;DR for the whole section:** A camera sends *compressed packets* over a
*transport protocol*. You must *decode* them into raw frames (ideally on the GPU),
hand frames to inference *fast enough to keep up*, and *drop frames* rather than
pile up memory when you can't. Everything here is about that loop running forever
without leaking or lagging.

→ Start: **[protocols-rtsp-webrtc.md](protocols-rtsp-webrtc.md)**
