# NCCL & Distributed Collectives

**TL;DR:** NCCL implements GPU collectives over NVLink/NVSwitch, PCIe, shared memory, and
network fabrics. Distributed performance depends on *which tensor moves in which collective,
how many bytes move, across what topology, and whether communication overlaps useful compute*.

## The collective vocabulary

For `P` ranks:

| Collective | Result | Typical ML use |
|---|---|---|
| broadcast | one rank's tensor copied to all | initialize/model state distribution |
| all-reduce | reduce values, result on every rank | DDP gradient synchronization |
| reduce-scatter | reduce then give each rank one shard | sharded gradient/optimizer flow |
| all-gather | gather shards so every rank has the full tensor | FSDP parameter materialization |
| all-to-all | each rank sends a distinct shard to each other rank | MoE expert-token routing |
| send/recv | point-to-point transfer | pipeline-parallel activations |

The operation name is less important than the byte path. Ask: tensor shape/dtype, frequency,
world size, link bandwidth/latency, and whether it blocks the critical path.

## How parallelism creates communication

- **DDP:** each rank computes gradients on a different batch shard; gradient buckets are
  all-reduced so replicas apply the same update.
- **FSDP/ZeRO:** parameters are all-gathered when needed and gradients reduce-scattered back
  to owners, reducing memory but increasing communication sensitivity.
- **Tensor parallelism:** layer matmuls are split; collectives can occur every transformer
  block, so low-latency high-bandwidth links are critical.
- **Pipeline parallelism:** adjacent stages send activations/gradients; microbatches reduce
  idle bubbles but add scheduling complexity.
- **MoE expert parallelism:** token routing often creates all-to-all traffic and load skew.

This is why "eight GPUs" is not a complete resource description. Eight GPUs under one
NVSwitch are a different machine from eight GPUs spread across slow nodes.

## Ring intuition

A ring all-reduce can be viewed as reduce-scatter followed by all-gather. Each rank exchanges
chunks with neighbors, using bandwidth efficiently for large tensors. Tree-style algorithms
can reduce latency for smaller messages. Libraries select algorithms/protocols from topology
and message size; your job is to provide a correct topology and measure, not force folklore.

## Communication-to-compute ratio

Scaling helps while reduced compute time exceeds added communication and coordination. Small
per-rank batches, frequent tiny collectives, slow inter-node links, or imbalance can make
more GPUs slower.

Approximate the step:

```rawhtml
<div class="formula"><div class="frow"><span class="fexpr">step_time ≈ exposed_compute + exposed_communication + input + imbalance</span></div></div>
```

"Exposed" matters because DDP can overlap bucket all-reduce with backprop. A 100 ms
collective is less harmful if 80 ms overlaps compute than if all 100 ms sits after backprop.

## Overlap techniques

- bucket gradients so early layers communicate while later backprop continues;
- use asynchronous collectives only with correct stream/event dependencies;
- prefetch FSDP parameter shards before their layer executes;
- overlap pipeline stages with microbatches;
- avoid CPU synchronizations that drain CUDA streams;
- size batches/sequence packing so ranks have balanced useful work.

Overlap can increase peak memory because tensors live longer. Measure both step time and
memory headroom.

## Topology checklist

1. Inspect GPU-to-GPU topology and link type (`nvidia-smi topo -m`).
2. Keep chatty tensor-parallel groups inside NVLink/NVSwitch domains.
3. For cross-node jobs, verify NIC bandwidth, RDMA/GPU-direct path, interface choice, MTU,
   and that traffic does not fall back silently to a slow route.
4. Place ranks consistently and ensure each process binds the correct device.
5. Compare collective bandwidth with expected fabric capability before blaming the model.

## Debugging a scaling regression

When 4→8 GPUs gives little or negative speedup:

- compare per-rank compute, collective, input, and idle time in a distributed trace;
- check one slow rank (data skew, thermal issue, CPU/storage contention) because collectives
  wait for stragglers;
- inspect message sizes and bucket timing;
- verify topology and whether traffic crossed nodes/PCIe unexpectedly;
- confirm per-rank batch did not become too small;
- look for data-loader duplication or shared-storage saturation;
- enable targeted NCCL diagnostics such as `NCCL_DEBUG=INFO` for the failing run, then turn
  verbosity back down.

Collective hangs are often rank divergence: one rank errored, took a different branch, or
called collectives in a different order. Capture logs from every rank and preserve the first
failure, not just the eventual timeout.

## Inference relevance

Tensor-parallel LLM decode invokes frequent collectives for small per-token work, making link
latency especially visible. Pipeline parallelism can cross nodes more naturally but adds
bubbles and activation transfer. Data-parallel replicas avoid cross-replica communication at
inference and are ideal for throughput once the model fits per replica.

## Interview answers

**Q: All-reduce vs reduce-scatter + all-gather?**
All-reduce leaves the full reduced result on every rank. Reduce-scatter leaves one reduced
shard per rank; all-gather reconstructs the full tensor later. Sharded training uses the split
to save memory and schedule communication around layer use.

**Q: Why can TP across nodes hurt LLM latency?**
Each layer may wait on collectives, and decode has little compute per token to hide them.
Inter-node latency/bandwidth can dominate; keep TP in a fast-link domain or reconsider PP/model
shape.

**Q: What proves NCCL is the bottleneck?**
A distributed trace showing exposed collective time on the critical path, low compute overlap,
and measured collective bandwidth below or near the topology limit—not merely low GPU usage.

## Primary references

- [PyTorch distributed communication package](https://docs.pytorch.org/docs/stable/distributed.html)
- [NVIDIA NCCL user guide](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/)

→ Next: **[Inference & Serving Optimization](inference-optimization.md)**
