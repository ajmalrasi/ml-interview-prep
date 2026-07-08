# Triton Inference Server

**TL;DR:** Triton is NVIDIA's production model server. Instead of baking the model
into your app, you run a server that hosts models and serves inference over
HTTP/gRPC. It adds **dynamic batching**, **multi-model** hosting, **multiple
framework backends** (TensorRT, ONNX, PyTorch, TF), and **model versioning** — for
free. Use it when inference is a *shared service*, not when one tight edge loop
needs absolute minimum latency.

## What you get out of the box

- **Dynamic batching** — Triton holds incoming requests for a few ms and batches
  them automatically to fill the GPU (throughput win without you coding it).
- **Concurrent model execution** — multiple models, or multiple *instances* of one
  model, on the same GPU.
- **Multiple backends** — serve a TensorRT engine, an ONNX model, and a PyTorch
  model side by side.
- **Model repository + versioning** — drop a new version in a folder, hot-swap
  without redeploying clients.
- **Metrics** — Prometheus endpoints for latency/throughput/utilization.
- **Ensembles** — chain preprocess → model → postprocess as one served unit.

## Where it fits in this role

- **Cloud side** of "Edge devices and Cloud servers": a Triton fleet behind a load
  balancer serving many pipelines.
- **Within DeepStream:** `nvinferserver` calls Triton instead of in-process
  `nvinfer` — handy when several pipelines share models or you want central model
  management.

## The tradeoff (say this out loud)

A network hop to a server adds latency vs in-process TensorRT. For a single edge
device chasing minimum latency, in-process `nvinfer`/TensorRT wins. For a *cloud
service* with many clients and models where you want dynamic batching, versioning,
and ops tooling, Triton's throughput and manageability win. **Different jobs.**

## Why X over Y

**Triton vs in-process TensorRT?**
In-process = lowest latency, simplest deploy, one model per app — ideal at the
edge. Triton = a hop of latency but gives dynamic batching, multi-model,
versioning, metrics, and shared GPU utilization — ideal as a cloud service.

**Triton's dynamic batching vs DeepStream's nvstreammux batching?**
Both batch to fill the GPU. `nvstreammux` batches *synchronized camera streams* in
a live pipeline. Triton's dynamic batching batches *independent client requests*
arriving over the network. Same goal (GPU utilization), different source of
requests.

**Why version models in Triton instead of redeploying?**
Hot-swapping a model version in the repository lets you roll forward/back without
touching clients or restarting pipelines — safer, faster iteration, and easy A/B.
Matches the JD's "open to experiments" culture.

→ Next: **[batching-and-throughput.md](batching-and-throughput.md)**
