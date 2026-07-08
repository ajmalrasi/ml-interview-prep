# From Packet to NumPy: The Decode Pipeline

**TL;DR:** A frame's journey is: network packets → depacketize → decode (turn
compressed bitstream into raw pixels) → color convert (NV12/YUV → BGR/RGB) →
hand to your model. The single biggest performance lever is **decoding on the GPU
(NVDEC)** and **keeping pixels on the GPU** so you never pay the CPU↔GPU copy tax.

## The full path

```
RTSP/RTP packets
   → depayload (rtph264depay)        # strip RTP, get raw H.264 bitstream
   → parse (h264parse)               # find frame boundaries, NAL units
   → DECODE                          # bitstream → raw frame (YUV/NV12)
        ├─ CPU: avdec_h264 (FFmpeg)  # portable, burns CPU
        └─ GPU: nvv4l2decoder/NVDEC  # hardware, frees CPU, stays in GPU mem
   → color convert (NV12 → BGR)      # models usually want BGR/RGB
   → (optional resize/crop)
   → frame ready  → inference
```

## CPU decode vs hardware decode (the key decision)

- **CPU decode** (`avdec_h264`, OpenCV's default `cv2.VideoCapture`): simple,
  portable, but **one or two 1080p H.264 streams can saturate several CPU cores.**
  Does not scale to "multiple RTSP streams."
- **Hardware decode** (NVIDIA **NVDEC** via `nvv4l2decoder`/DeepStream, or VA-API
  on Intel): a dedicated silicon block decodes video, leaving CPU/GPU compute free.
  A single Jetson/GPU can decode dozens of streams. **This is the scalable answer.**

> Interview line: *"`cv2.VideoCapture` is fine for a prototype, but it decodes on
> the CPU and copies every frame to host memory. At multi-camera scale I'd decode
> on NVDEC through GStreamer/DeepStream and keep frames in GPU memory so inference
> reads them with zero copy."*

## The hidden killer: CPU↔GPU memory copies

Every `numpy` frame on the CPU that you push to the GPU for inference is a **PCIe
copy** — and back again for post-processing. At 30fps × N cameras that copy
bandwidth becomes your bottleneck.

- **Zero-copy goal:** decode on GPU → infer on GPU → only pull the *small* result
  (boxes, labels) back to CPU. Never round-trip full frames.
- DeepStream's `NvBufSurface` and CUDA unified memory exist precisely for this.

## OpenCV's role (and its trap)

- `cv2.VideoCapture("rtsp://...")` uses FFmpeg under the hood — great for quick
  work, but: CPU decode, an internal buffer that grows latency, and silent
  reconnect behavior you don't control.
- For production multi-stream you drive **GStreamer** and use OpenCV only for the
  image-processing math (geometry, color spaces, warps) it's genuinely good at.

```python
# Pulling frames from a GStreamer pipeline into OpenCV via appsink
cap = cv2.VideoCapture(
    "rtspsrc location=rtsp://cam latency=100 ! rtph264depay ! h264parse ! "
    "nvv4l2decoder ! nvvidconv ! video/x-raw,format=BGRx ! "
    "videoconvert ! video/x-raw,format=BGR ! appsink drop=1 max-buffers=1",
    cv2.CAP_GSTREAMER,
)
```

Note `drop=1 max-buffers=1` — that's the backpressure knob (next file).

## Encoding (the way back out)

If you serve an annotated stream (WebRTC/RTSP out, or save clips), you **encode**:
raw frame → NVENC (hardware H.264/H.265) → mux → transport. Use **NVENC**, not CPU
x264, for the same scaling reasons. NVDEC and NVENC are separate silicon blocks,
so you can decode and encode concurrently.

## Why X over Y

**`cv2.VideoCapture` vs GStreamer pipeline?**
VideoCapture = fast to write, CPU-bound, opaque buffering. GStreamer = explicit
control over decode hardware, buffering, and threading; scales to many streams.
Prototype with the first, ship with the second.

**Software vs hardware decode?**
Software = portable, no special HW, but CPU-bound and won't scale past a couple
streams. Hardware (NVDEC) = scales to dozens, frees CPU, keeps frames on GPU for
zero-copy inference. At KoiReader scale, hardware every time.

**Why is color conversion (NV12→BGR) a real cost?**
Decoders output YUV/NV12; models want BGR/RGB. The convert is per-pixel per-frame.
Do it on the GPU (`nvvidconv`) — doing it on CPU re-introduces the copy + compute
you just avoided.

→ Next: **[frame-buffers-backpressure.md](frame-buffers-backpressure.md)**
