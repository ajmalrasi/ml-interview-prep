# Codecs, GOP, and I/P/B Frames

**TL;DR:** Video isn't a stream of pictures — it's mostly *diffs*. A keyframe (I)
is a full image; P/B frames only store what changed. This is why you can't just
"grab any frame," why a lost keyframe wrecks seconds of video, and why GOP size
trades latency against bandwidth.

## The intuition

Imagine mailing a friend a flipbook. Instead of redrawing every page, you send
one full drawing (the **I-frame**), then tiny notes: "page 2: move the ball 3cm
right" (a **P-frame**). Cheap to send, but if the full drawing is lost, every
"move the ball" note after it is meaningless until the next full drawing arrives.

## Frame types

- **I-frame (Intra / keyframe):** complete standalone image. Big. Decodable alone.
- **P-frame (Predicted):** stores changes from the *previous* frame. Small.
- **B-frame (Bi-directional):** references *past and future* frames. Smallest, but
  adds latency (decoder must wait for the future frame) → **many low-latency
  pipelines disable B-frames.**

## GOP (Group of Pictures)

The pattern between keyframes, e.g. `IPPPPPP...` repeating every N frames.

- **Short GOP** (frequent keyframes) → faster recovery after loss, faster stream
  start/seek, **more bandwidth**.
- **Long GOP** → less bandwidth, but a lost keyframe means longer corruption and
  slower join time.
- **You can only cleanly start decoding / reconnect at an I-frame.** That's why a
  freshly connected stream may show gray/garbage until the first keyframe.

## Codecs you'll name

- **H.264 (AVC):** the default everywhere. Universal hardware decode. Safe answer.
- **H.265 (HEVC):** ~50% less bandwidth at same quality; heavier to decode,
  licensing friction. Good for many-camera bandwidth savings if HW supports it.
- **MJPEG:** every frame is a standalone JPEG (all I-frames). No inter-frame
  compression → huge bandwidth, but zero inter-frame latency and trivial frame
  extraction. Some industrial cams use it.
- **AV1:** royalty-free, great compression, decode still maturing on edge HW.

## Why this matters for the JD

**"Handle frame buffers, decoding efficiently"** → you must understand that:
1. You decode *packets*, and a decoder needs a keyframe to start.
2. Dropping a P/B frame is survivable; dropping an I-frame corrupts the GOP.
3. If you reconnect, you wait for the next keyframe — budget for that gray period.

## Why X over Y

**H.264 vs H.265 for 50 cameras?**
H.265 halves bandwidth/storage — attractive at scale — but costs more decode
compute and has licensing complexity. Pick H.265 *only if* your decode hardware
(Jetson NVDEC, GPU) supports it and CPU/GPU headroom exists; otherwise H.264 is
the reliable default.

**Why disable B-frames for live inference?**
B-frames reference future frames, so the decoder must reorder and wait → added
latency and jitter. For "obsess over milliseconds," an `IPPP` (no-B) GOP is
lower-latency and simpler to reason about.

**Why does latency spike right after reconnect?**
You can only resume at an I-frame. With a long GOP you may wait up to one GOP
interval for the next keyframe. Mitigation: request shorter GOP on the camera, or
ask for an on-demand IDR (instantaneous decoder refresh) if supported.

→ Next: **[decode-encode-pipeline.md](decode-encode-pipeline.md)**
