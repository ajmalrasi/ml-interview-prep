# DeepStream: Inference Inside the Pipeline

**TL;DR:** DeepStream is NVIDIA's set of GStreamer plugins that put inference,
tracking, and analytics *inside* the video pipeline, keeping frames on the GPU end
to end. Its superpower is `nvstreammux`: it **batches many camera streams into one
inference call**, which is how you serve dozens of cameras on one GPU. You've
shipped this on Jetson Nano — own it.

## The canonical DeepStream pipeline

```
[cam1 rtspsrc]┐
[cam2 rtspsrc]┤→ nvstreammux → nvinfer → nvtracker → nvdsosd → nvv4l2h264enc → sink
[camN rtspsrc]┘   (batch N)    (TRT)     (track IDs)  (overlay)  (encode out)
```

Key plugins:

- **`nvstreammux`** — batches frames from N sources into a single batched buffer.
  *This is the scaling trick:* one `nvinfer` call processes all cameras together,
  amortizing GPU launch overhead. Set `batch-size = number of streams`.
- **`nvinfer`** — runs a **TensorRT** engine. Configured via a text file
  (`config_infer.txt`) pointing at the model, precision (INT8/FP16), and
  pre/post-processing. Operates as **primary** (detector) or **secondary**
  (classifier on detected crops).
- **`nvtracker`** — multi-object tracking (NvDCF, KLT, or DeepSORT-style),
  assigning persistent IDs across frames. Critical for counting/dwell-time.
- **`nvdsosd`** — on-screen display: draws boxes/labels on GPU.
- **`nvvideoconvert`** — GPU color/format conversion + scaling.
- **Metadata (`NvDsBatchMeta`)** — detections travel *alongside* frames as
  structured metadata you read in a `pad probe` (Python via pyds) to push results
  to a DB/analytics — no full-frame copy needed.

## Why batching matters (the number that impresses)

A GPU launching inference per-frame, per-camera wastes most of its time on
overhead. Batching N frames into one call can lift throughput several-fold for the
same latency budget — the difference between 4 cameras and 40 on one box. Tie this
to your TensorRT/INT8 experience: *"batch at the mux, run an INT8 TRT engine, keep
buffers in NVMM (GPU) memory — that's the multi-stream low-latency recipe."*

## Pad probes (reading results in Python)

```python
def osd_sink_probe(pad, info, u_data):
    batch_meta = pyds.gst_buffer_get_nvds_batch_meta(hash(info.get_buffer()))
    l_frame = batch_meta.frame_meta_list
    while l_frame is not None:
        frame_meta = pyds.NvDsFrameMeta.cast(l_frame.data)
        # iterate frame_meta.obj_meta_list → boxes, classes, track ids
        l_frame = l_frame.next
    return Gst.PadProbeReturn.OK
```

You don't pull pixels to Python — you read *metadata*. That's the zero-copy
philosophy in action.

## DeepStream vs rolling your own (GStreamer + appsink + PyTorch)

| | DeepStream | DIY appsink + framework |
|---|---|---|
| Multi-stream batching | Built-in (`nvstreammux`) | You build it |
| Memory | Stays on GPU (NVMM) | Easy to accidentally copy to CPU |
| Flexibility | NVIDIA-opinionated, config-driven | Total freedom, more code |
| Best for | Many cameras, NVIDIA HW, standard detect/track | Custom logic, non-NVIDIA, research |

## Triton vs nvinfer (within DeepStream)

`nvinfer` runs TensorRT engines in-process. `nvinferserver` offloads to a **Triton
Inference Server** — useful when you want a model server shared across pipelines,
multiple frameworks, or dynamic model management. (More in
[03-low-latency-inference](../03-low-latency-inference/triton.md).)

## Why X over Y

**DeepStream vs plain GStreamer + your own inference?**
DeepStream gives multi-stream batching, GPU-resident buffers, and tracking for
free on NVIDIA HW — fastest path to many cameras. Roll your own when you need
custom pipeline logic, non-NVIDIA hardware, or research flexibility. KoiReader is
NVIDIA-heavy ("latest NVIDIA Hardware"), so DeepStream is a natural fit and a
strong thing to volunteer.

**Why batch at nvstreammux instead of per-camera inference?**
Per-camera inference pays GPU launch/overhead N times and underuses the GPU.
Batching fills the GPU, amortizing overhead → higher throughput at the same
latency. It's the single biggest multi-stream scaling lever.

**Primary vs secondary nvinfer?**
Primary detects objects on full frames; secondary classifies the *crops* the
primary found (e.g., detect vehicle → classify make/color). Chaining them is how
DeepStream does cascaded inference efficiently on GPU.

→ Back to [section README](README.md) · Next section: **[03-low-latency-inference/](../03-low-latency-inference/README.md)**
