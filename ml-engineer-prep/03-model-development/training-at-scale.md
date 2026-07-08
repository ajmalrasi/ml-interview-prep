# Training at Scale

**TL;DR:** When data or the model no longer fits on one machine, you distribute the
work. The common case is **data parallelism** (same model copied across many GPUs, each
sees different data); the harder case is **model parallelism** (one model too big for
one GPU, split across several). Know the difference and why big-data training uses
frameworks like Spark.

## Two kinds of "too big"

**Too much data** for one machine to churn through in reasonable time, or **too big a
model** to fit in one GPU's memory. They call for different strategies.

## Data parallelism (the common one)

Copy the *same* model onto each of N GPUs, give each a different slice of the batch,
let each compute gradients, then **average the gradients** across GPUs and update all
copies identically. You've effectively multiplied your batch throughput by N. This is
how most large models are trained, and it's what tools like PyTorch DDP or Horovod do.

```
GPU0: model copy + data slice 0 ─┐
GPU1: model copy + data slice 1 ─┼→ average gradients → sync update
GPU2: model copy + data slice 2 ─┘
```

The catch is **communication cost**: syncing gradients every step across many GPUs
becomes the bottleneck, so scaling isn't perfectly linear.

## Model parallelism (when the model won't fit)

If a single model is too large for one GPU's memory (think large LLMs), you split the
*model itself* across GPUs — different layers or tensor slices on different devices.
It's more complex and communication-heavy, used mainly for very large models. A related
idea, **pipeline parallelism**, splits layers into stages so different GPUs work on
different micro-batches like an assembly line.

## Big-data preprocessing and training

Separately from GPUs, when the *dataset* is huge you distribute the data processing
itself across a cluster with **Spark** (or Dask/Ray) — mapping the work over many nodes.
This is the "scalable data pipeline" muscle: the same job that's a pandas one-liner on a
laptop becomes a distributed job on terabytes.

## Mixed precision — cheap speedup

Training in **FP16/BF16** instead of FP32 roughly doubles throughput and halves memory
with negligible accuracy loss, so it's standard for large-model training. Worth naming
as the first optimization you'd reach for before adding more hardware.

## 🔗 Connecting the dots — the real stack

Multi-GPU data parallelism is **PyTorch DDP** or **Horovod**; very large models use **DeepSpeed**, **PyTorch FSDP**, or **Megatron-LM**. **Ray Train** and **Spark** distribute across a cluster; **HuggingFace Accelerate** wraps the boilerplate. Mixed precision is native **AMP** (`torch.cuda.amp`). It all runs on managed GPU clusters (**SageMaker / Vertex / Databricks**), often on **spot** instances with checkpointing.

**How you'd say it:** *"For a big model I'd use FSDP or DeepSpeed with mixed precision on a multi-GPU spot cluster, checkpointing to S3 so a preemption just resumes."*

## Self-check

- Data vs model parallelism — one line each? *(replicate the model, split the data and
  average gradients vs split the model itself across GPUs.)*
- What's the main bottleneck in data parallelism? *(communication cost of syncing
  gradients across GPUs.)*
- Cheapest way to speed up large-model training before adding GPUs? *(mixed-precision
  FP16/BF16.)*
