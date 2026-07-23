# 02: GStreamer (and DeepStream)

**TL;DR:** GStreamer is a pipeline framework: you connect small **elements**
(source → decode → convert → sink) into a graph, and media flows through as
**buffers**. It's how you get hardware-accelerated, multi-stream video into your
model. DeepStream is NVIDIA's GStreamer plugin set that bolts inference + tracking
+ analytics directly into that pipeline.

This is *the* tool the JD names twice. You've used it (Integration Wizards +
DeepStream on Jetson) — this section makes sure you can talk about it fluently.

Files:
1. [pipeline-model.md](pipeline-model.md) — elements, pads, caps, bins, bus
2. [appsink-and-python.md](appsink-and-python.md) — getting frames into Python/OpenCV
3. [deepstream.md](deepstream.md) — inference inside the pipeline, multi-stream batching

## The one-paragraph pitch (memorize)

*"GStreamer models video as a directed graph of elements connected by pads.
Source elements produce buffers, transform elements (decoders, converters) process
them, sink elements consume them. Capabilities (caps) negotiate format between
pads. Each element can run on its own thread via `queue` elements, so a pipeline
is naturally concurrent. For NVIDIA, DeepStream adds `nvstreammux` to batch many
camera streams into one inference call, `nvinfer` for TensorRT inference, and
`nvtracker` for multi-object tracking — all keeping frames in GPU memory."*

→ Start: **[pipeline-model.md](pipeline-model.md)**
