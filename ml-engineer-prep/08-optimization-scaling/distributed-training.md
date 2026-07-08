# Distributed Training

**TL;DR:** When training is too slow or too big for one GPU, spread it out. **Data
parallelism** (replicate the model, split the data, average gradients) handles most
cases; **model/pipeline parallelism** handles models too big for one device. This page
is the scaling companion to section 3.

## The two axes (recap and go deeper)

- **Data parallelism** — every GPU holds a full copy of the model and processes a
  different slice of each batch, then gradients are averaged (all-reduce) and all copies
  update identically. Multiplies throughput; the bottleneck is the **gradient sync**
  communication. Frameworks: PyTorch **DDP**, Horovod.
- **Model parallelism** — the model is too big for one GPU's memory, so you split the
  *model* across GPUs (different layers or tensor shards on different devices). More
  communication-heavy; needed for very large models.
- **Pipeline parallelism** — split the model into stages across GPUs and stream
  micro-batches through like an assembly line, keeping all stages busy.

Large-model training (think LLMs) combines all three ("3D parallelism") — e.g. via
DeepSpeed or Megatron.

## Memory-saving tricks worth naming

Even on the GPUs you have, a few techniques let you train bigger:

- **Mixed precision (FP16/BF16)** — half the memory, ~2× faster, standard.
- **Gradient accumulation** — simulate a big batch by accumulating gradients over several
  small batches before updating — fits a large effective batch in small memory.
- **Gradient checkpointing** — trade compute for memory by recomputing activations in the
  backward pass instead of storing them all.
- **ZeRO / sharding** — shard optimizer states and gradients across GPUs so no single one
  holds everything (DeepSpeed ZeRO).

## The practical instinct

Don't distribute prematurely — it adds real complexity and communication overhead. First
squeeze one GPU (mixed precision, bigger batch, a smaller model), then scale to data
parallelism across GPUs, and only reach for model/pipeline parallelism when the model
genuinely doesn't fit. "Scale when you must, not because you can."

## 🔗 Connecting the dots — the real stack

The libraries: **PyTorch DDP / FSDP**, **DeepSpeed** (ZeRO), **Megatron-LM** (tensor/pipeline parallel), **Horovod**, **Ray Train**, and **HuggingFace Accelerate** to wrap it. Mixed precision is native **AMP**. It runs on multi-GPU clusters via **SageMaker / Vertex / Databricks** or K8s.

**How you'd say it:** *"For a model that didn't fit one GPU I used DeepSpeed ZeRO (or FSDP) with mixed precision across a multi-node GPU cluster."*

## Self-check

- Data vs model parallelism — when each? *(data: model fits, need more throughput; model:
  model too big for one GPU.)*
- What's the bottleneck in data parallelism? *(gradient synchronization / communication.)*
- Two ways to train a bigger model without more GPUs? *(mixed precision, gradient
  accumulation, gradient checkpointing, ZeRO sharding — any two.)*
