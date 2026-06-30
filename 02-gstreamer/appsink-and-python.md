# Getting Frames into Python: appsink

**TL;DR:** `appsink` is the element that hands buffers *out of* the pipeline into
your Python code; `appsrc` pushes frames *in*. The trick is to pull frames without
copying more than necessary and without letting the buffer grow. Configure
`appsink` with `max-buffers=1 drop=true` and you have a "latest frame only" tap.

## Two ways to consume

**A) Via OpenCV (quick):**
```python
pipeline = (
    "rtspsrc location=rtsp://cam latency=100 protocols=tcp ! "
    "rtph264depay ! h264parse ! nvv4l2decoder ! "
    "nvvidconv ! video/x-raw,format=BGRx ! videoconvert ! "
    "video/x-raw,format=BGR ! appsink drop=1 max-buffers=1 sync=false"
)
cap = cv2.VideoCapture(pipeline, cv2.CAP_GSTREAMER)
while True:
    ok, frame = cap.read()   # frame is a BGR numpy array
    if not ok:
        break                # → trigger reconnect logic
```

**B) Via GObject/Gst directly (full control):**
```python
import gi; gi.require_version("Gst", "1.0")
from gi.repository import Gst
Gst.init(None)

appsink = pipeline.get_by_name("sink")
appsink.set_property("emit-signals", True)
appsink.set_property("max-buffers", 1)
appsink.set_property("drop", True)

def on_new_sample(sink):
    sample = sink.emit("pull-sample")
    buf = sample.get_buffer()
    caps = sample.get_caps()
    ok, mapinfo = buf.map(Gst.MapFlags.READ)
    try:
        frame = np.ndarray(
            (height, width, 3), buffer=mapinfo.data, dtype=np.uint8
        )
        handle(frame.copy())   # copy if you keep it past this callback
    finally:
        buf.unmap(mapinfo)     # ALWAYS unmap — else you leak buffers
    return Gst.FlowReturn.OK

appsink.connect("new-sample", on_new_sample)
```

The `buf.unmap()` in a `finally` is the kind of detail that separates "used it
once" from "ran it in production." Forgetting it is a textbook leak.

## sync=false (the latency knob)

By default a sink waits for each buffer's presentation time (`sync=true`) to play
at real-time speed. For inference you usually want frames **as fast as available**
→ `sync=false`. Combined with `drop=true max-buffers=1`, you always process the
newest frame with minimal lag.

## appsrc (pushing frames back in)

When you've annotated a frame and want to encode/stream it out, push it into an
`appsrc` feeding `nvv4l2h264enc ! rtspclientsink`/WebRTC. You must set caps and
timestamps (PTS) correctly or downstream stalls.

## Why X over Y

**appsink vs cv2.VideoCapture?**
`VideoCapture` *uses* an appsink internally but hides it. Direct appsink gives you
the callback, GPU buffer access, explicit unmap, and zero-copy options. Prototype
with VideoCapture; use direct appsink when you need control or zero-copy.

**Why `.copy()` the numpy frame in the callback?**
The numpy array points into GStreamer's mapped buffer memory. Once you `unmap`/
return, that memory is recycled — keeping the array without copying = corruption.
Copy if the frame outlives the callback (e.g., goes into a queue).

**Why `max-buffers=1 drop=true`?**
It makes appsink a "latest frame" tap: if your consumer lags, GStreamer drops
stale frames instead of queuing them → bounded memory, minimal latency. This is
the backpressure policy from section 01 expressed in one line.

→ Next: **[deepstream.md](deepstream.md)**
