# Frame Buffers & Backpressure

**TL;DR:** Cameras produce frames at a fixed rate; your model consumes them at a
variable rate. When the model is slower than the camera, frames pile up. You have
exactly three choices: **buffer** (latency grows), **drop** (stay real-time), or
**block** (stall the source). For live inference the right default is almost
always **drop the oldest, keep latest**.

## The core problem (producer/consumer mismatch)

```
Camera @ 30fps  ──>  [ queue ]  ──>  Model @ 22fps
   producer          buffer            consumer (slower!)
```

If producer > consumer forever, the queue grows without bound → **memory leak,
ever-increasing latency**, eventual OOM crash. This is the #1 way naive video
pipelines die in production. The JD's "without memory leaks" and "manage resources
in long-running processes" point straight here.

## The three strategies

| Strategy | What happens | Use when |
|---|---|---|
| **Bounded queue + drop oldest** | Keep newest frame, discard stale | **Live inference** — you want *current* reality, not a backlog |
| **Bounded queue + block** | Source waits for consumer | Offline/batch processing of recorded video where every frame matters |
| **Unbounded queue** | Grows forever | **Never** in production — this is the bug, not a strategy |

**Latency vs completeness is the tradeoff.** A live anomaly detector wants the
*latest* frame (drop). A forensic counting job on a recording wants *every* frame
(block + bounded).

## How you actually express "drop"

GStreamer:
```
appsink drop=true max-buffers=1   # only ever hold the newest frame
# or on a leaky queue element:
queue max-size-buffers=2 leaky=downstream
```

Python (your own thread):
```python
from collections import deque
frame_buf = deque(maxlen=1)        # bounded; appending evicts the old frame
# producer thread:
frame_buf.append(frame)            # never blocks, never grows
# consumer thread:
frame = frame_buf[-1] if frame_buf else None
```

A `deque(maxlen=N)` or a `queue.Queue(maxsize=N)` with `put_nowait` + drop-on-full
is the canonical "crash-proof buffer."

## Latency vs jitter (don't confuse them)

- **Latency** = how old the frame is when you act on it.
- **Jitter** = variation in frame arrival timing.
- A *small* jitter buffer smooths bursty networks; a *large* one trades latency
  for smoothness. RTSP `latency=` and GStreamer `rtpjitterbuffer` tune this.
  For "obsess over milliseconds," keep it small (~100–200ms).

## Backpressure across stages

In a multi-stage pipeline (decode → infer → analytics → DB), the *slowest stage*
sets the pace. Each stage needs a bounded buffer in front of it so a slow DB write
can't back up into dropped *decoded* frames silently. Design rule: **bound every
queue, and decide the drop policy per stage.**

## Why X over Y

**Drop frames vs buffer them?**
Live = drop (you want now, not a backlog; buffering inflates latency forever if
you can't catch up). Recorded/offline = buffer/block (correctness over latency).

**Why `maxsize=1` instead of a big buffer for live inference?**
A big buffer just means you're always acting on old frames during any slowdown.
Size 1–2 keeps you on the freshest frame; if you fall behind you skip, not lag.

**queue.Queue vs collections.deque for the buffer?**
`queue.Queue` is thread-safe with blocking/timeout semantics (good for
producer/consumer with backpressure signaling). `deque(maxlen=N)` is lock-free-ish
for simple append/peek and auto-evicts — great for "latest frame only." Pick Queue
when you need blocking/coordination, deque for pure latest-wins.

**What causes the classic video-pipeline memory leak?**
An unbounded queue (consumer slower than producer) **or** holding references to
decoded frames (GPU surfaces) you never release. Fix: bound the queue + explicitly
free/unmap GPU buffers each iteration.

→ Back to [section README](README.md) · Next section: **[02-gstreamer/](../02-gstreamer/README.md)**
