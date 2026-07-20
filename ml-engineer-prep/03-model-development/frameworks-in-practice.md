# PyTorch, TensorFlow & Keras in Practice

**TL;DR:** Framework APIs differ, but a production training loop has the same invariants:
deterministic data/versioning, explicit train/eval behavior, correct gradient lifecycle,
mixed-precision safety, checkpoint/resume, distributed synchronization, validation, and
tracked artifacts. Interviewers care more about those invariants than syntax trivia.

## Where each tool fits

| Tool | Strength | Watch for |
|---|---|---|
| PyTorch | imperative/debuggable research-to-production workflow; broad LLM ecosystem | easy to write flexible but slow Python or forget mode/device details |
| TensorFlow | mature graph/distribution/serving ecosystem | tracing/retracing and graph/eager boundary surprises |
| Keras | high-level training/model API, now multi-backend | convenience can hide exact step behavior until customization is needed |

Choose from team expertise, model/tool ecosystem, deployment target, and profiling evidence.
Do not answer as if one framework makes the mathematics different.

## The invariant training step

Every framework implements this sequence:

1. fetch and move a batch;
2. forward pass in training mode;
3. compute loss, including masks/regularization;
4. backpropagate gradients;
5. optionally unscale and clip gradients;
6. optimizer update and learning-rate schedule;
7. clear/replace accumulated gradients;
8. record metrics and periodically validate/checkpoint.

In PyTorch, the explicit form is easy to reason about:

```python
model.train()
optimizer.zero_grad(set_to_none=True)
with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
    loss = loss_fn(model(inputs), targets) / accumulation_steps
loss.backward()
if update_now:
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm)
    optimizer.step()
    scheduler.step()
```

Real FP16 training often uses a gradient scaler; BF16 usually does not need loss scaling
because it has FP32-like exponent range. Gradient accumulation must divide/normalize loss
consistently and only step/clear at the intended boundary.

## Train mode and evaluation mode

PyTorch's `model.train()` / `model.eval()` changes Dropout and BatchNorm behavior; it does
not enable or disable gradient recording. Use `torch.no_grad()` or inference mode separately.
The equivalent concern exists across frameworks: validation must not update weights or
training-state statistics accidentally.

For sequence models, validate masks, padding, label shift, tokenizer revision, and ignored
loss positions. A syntactically correct loop can train the wrong objective.

## Input pipeline and GPU utilization

When the GPU is idle, the model may not be the bottleneck. Inspect:

- data decode/augmentation CPU time;
- worker count and queue depth;
- pinned memory and asynchronous host-to-device transfer;
- storage throughput and small-file overhead;
- batch collation/tokenization;
- synchronization accidentally inserted by logging or `.item()` calls.

Prefetch, parallel workers, efficient sharding, vectorized transforms, and overlapping copy
with compute often beat changing the network.

## Distributed choices

- **PyTorch DDP / TensorFlow multi-worker data parallelism:** each rank has the model, sees a
  different batch shard, and synchronizes gradients.
- **FSDP / ZeRO-style sharding:** shards parameters, gradients, and/or optimizer state to fit
  larger models; trades memory for communication and orchestration.
- **Tensor/pipeline parallelism:** splits model computation when one model replica will not fit.

The sampler/input pipeline must avoid giving every rank the same examples. Save enough state
to resume consistently: model, optimizer, scheduler, scaler, global step, RNG state, and data
position where exact continuation matters.

## Checkpointing and failure recovery

A good checkpoint is atomic, versioned, and validated after writing. Store it outside the
ephemeral worker. For large distributed models, coordinated sharded checkpoints avoid
gathering everything onto rank 0 and reduce recovery time.

Define recovery objectives: can the job lose five minutes or five hours? Checkpoint cadence
balances storage/network cost against recomputation. Test restore before trusting it.

## Reproducibility without pretending hardware is perfectly deterministic

Record:

- code and environment/container version;
- immutable data and tokenizer versions;
- model initialization/pretrained revision;
- hyperparameters and random seeds;
- hardware/world size and framework/compiler settings;
- exact validation outputs and final artifact lineage.

Some GPU kernels and distributed reductions can be nondeterministic, and changing world size
changes numerical order. State the acceptable tolerance and validate metrics rather than
promising bitwise identity in every environment.

## Common interview bugs

| Symptom | Likely mistake |
|---|---|
| Validation changes between runs | model still in train mode, random preprocessing, data drift |
| Loss never improves | labels/masks wrong, LR wrong, gradients cleared/disabled incorrectly |
| OOM after several steps | retained graph/tensors, accumulating metrics on GPU, variable sequence spikes |
| Scaling adds no speed | input bottleneck, small per-rank batch, collective/network overhead |
| Resume diverges | scheduler/scaler/RNG/data position not restored |
| GPU utilization sawtooth | loader stalls, sync logging, uneven batches, checkpoint pauses |

## Framework comparison answer

> I am strongest in the framework I have operated, but I separate API familiarity from
> training-system fundamentals. In any framework I verify the data shard, train/eval state,
> precision and gradient lifecycle, distributed synchronization, checkpoint/resume, and
> profiling. I would choose PyTorch for the broad LLM stack, TensorFlow where its established
> serving/distribution ecosystem fits the team, and Keras when high-level portability and
> iteration speed matter—then profile the actual deployment path.

## Primary references

- [PyTorch automatic mixed precision](https://docs.pytorch.org/docs/stable/amp.html)
- [PyTorch distributed overview](https://docs.pytorch.org/tutorials/beginner/dist_overview.html)
- [TensorFlow distributed training](https://www.tensorflow.org/guide/distributed_training)
- [Keras distributed training](https://keras.io/guides/distributed_training_with_tensorflow/)

→ Next: **[Training at Scale](training-at-scale.md)**
