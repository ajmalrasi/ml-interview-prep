# The GStreamer Pipeline Model

**TL;DR:** Elements are LEGO bricks. Pads are the studs that connect them. Caps
are the rule that says "these two bricks fit." Buffers are the data flowing
through. The bus is the intercom that tells your app about errors and end-of-stream.

## The pieces

- **Element** — one processing unit: `rtspsrc`, `h264parse`, `nvv4l2decoder`,
  `nvvidconv`, `appsink`. Has a state (NULL → READY → PAUSED → PLAYING).
- **Pad** — an element's input (**sink pad**) or output (**source pad**). Data
  enters sink pads, leaves source pads. (Confusingly, a "sink *element*" is the
  final consumer, while a "sink *pad*" is any input port.)
- **Caps (capabilities)** — the format contract negotiated between pads, e.g.
  `video/x-raw,format=NV12,width=1920,height=1080,framerate=30/1`. Mismatched caps
  = pipeline won't link.
- **Buffer** — a chunk of data (usually one frame) flowing downstream, with a
  timestamp (PTS).
- **Bin / Pipeline** — a container of elements. The top-level `Pipeline` is a bin
  that also owns the clock and bus.
- **Bus** — the message channel from pipeline → your app: `EOS` (end of stream),
  `ERROR`, `WARNING`, state changes. **You watch the bus to detect a dead camera.**

## A pipeline in words

```
rtspsrc ! rtph264depay ! h264parse ! nvv4l2decoder ! nvvidconv ! appsink
  │           │             │            │              │          │
 pull from   strip RTP   find frame   GPU decode    color/format  hand to
 camera      packaging   boundaries   (NVDEC)       convert       your code
```

The `!` is shorthand for "link the source pad of the left element to the sink pad
of the right element."

## Dynamic pads (the gotcha interviewers love)

`rtspsrc` doesn't know the stream's format until it connects, so its source pad
appears **at runtime** ("sometimes pad"). You can't link it statically — you
connect a `pad-added` callback and link then. Knowing this signals real GStreamer
experience.

```python
def on_pad_added(src, new_pad, depay):
    new_pad.link(depay.get_static_pad("sink"))
rtspsrc.connect("pad-added", on_pad_added, depay)
```

## queue = thread boundary

Inserting a `queue` element decouples upstream and downstream onto **separate
threads**, with a bounded buffer. This is how you parallelize decode vs inference
and apply backpressure (`max-size-buffers`, `leaky`). No `queue` = everything runs
in one thread, serially.

## States and why PAUSED matters

NULL (no resources) → READY (resources allocated) → PAUSED (data prerolled, clock
stopped) → PLAYING (clock running, data flows). Live sources can't fully preroll,
which is why live pipelines behave slightly differently and why you handle
`async-done`/`no-preroll`.

## Why X over Y

**GStreamer vs FFmpeg (the CLI/lib)?**
FFmpeg is a swiss-army transcoder — unbeatable for "convert/clip this file" and
great as a decode library. GStreamer is a *pipeline framework* for **live,
branching, multi-stream, plugin-extensible** apps with fine threading control.
KoiReader wants live multi-stream graphs with inference inside → GStreamer (and
DeepStream is built on it). Many shops use FFmpeg for ingest/clip and GStreamer
for the live serving graph.

**Why use `queue` elements at all?**
Without them the whole pipeline is one thread: a slow decoder stalls the source.
`queue` puts a thread boundary + bounded buffer between stages so they run
concurrently and you control drop policy.

**How do you detect a camera went down?**
Watch the **bus** for `ERROR`/`EOS`, and/or run a watchdog on frame timestamps. On
failure, tear the pipeline to NULL and rebuild (reconnect) — see
[fault tolerance](../04-fault-tolerance/README.md).

→ Next: **[appsink-and-python.md](appsink-and-python.md)**
