# Engine & Hardware Qualification

**TL;DR:** “Fastest engine” is not a reusable conclusion. Qualify the exact model, precision,
workload, GPU stack, topology, and operational constraints. Compare a common portable baseline,
then separately enable each engine's native strengths and report both portability and best
qualified performance.

## Two questions, two comparisons

1. **Controlled comparison:** what changes when only the engine changes under the closest
   common settings and API behavior?
2. **Best-qualified comparison:** what is the best production-safe configuration each stack
   can achieve while meeting the same quality and SLO contract?

The controlled comparison explains causality. The best-qualified comparison informs product
and capacity decisions. Publishing only the second can reward incompatible optimizations;
publishing only the first can hide the practical value of an engine.

## Engine map

| Engine | Start with it when | Qualification detail to expose |
|---|---|---|
| **vLLM** | Broad model support, OpenAI-compatible serving, rapid iteration, heterogeneous GPU needs | scheduler/token budget, PagedAttention/KV settings, prefix cache, chunked prefill, parallelism |
| **SGLang** | Structured generation, prefix-heavy/agent workloads, or its serving stack is a strong candidate | Radix/prefix-cache behavior, scheduler policy, attention backend, common-prefix hit rate |
| **TensorRT-LLM** | NVIDIA-specific peak optimization and a build/compile workflow is acceptable | engine build artifact, profiles, precision/calibration, plugin/kernel choices, inflight batching |

This is a starting hypothesis, not a ranking. Model support, features, kernels, and defaults
change. Pin exact versions and benchmark the required feature set.

## The fair comparison contract

Keep these equal wherever possible:

- immutable model and tokenizer revision;
- prompt text/token IDs, ISL/OSL distributions, arrival process, and request count;
- sampling parameters, stop conditions, streaming semantics, and response validation;
- precision/quantization and quality tolerance;
- GPU SKU/count/topology, clocks/power, host resources, container isolation, and measurement;
- warmup state and repeated-trial policy.

Record unavoidable differences:

- engine-native quantization formats or kernels;
- compilation/build time and artifact size;
- unsupported model/operator/API feature;
- scheduler defaults that cannot be made equivalent;
- telemetry/metric conventions;
- CUDA-only engine support when the AMD row is not applicable.

“Not supported” is a valid qualification result. Do not substitute a different model or
precision silently to fill a table cell.

## NVIDIA and AMD are separate qualified stacks

Treat the accelerator plus its software as the test target:

| Layer | NVIDIA example | AMD example | Evidence to pin |
|---|---|---|---|
| Driver/runtime | NVIDIA driver + CUDA | amdgpu + ROCm | exact versions and compatibility |
| Framework | PyTorch CUDA build | PyTorch ROCm build | image digest, build flags |
| Kernels/libraries | cuBLASLt, NCCL, attention kernels | hipBLASLt, RCCL, attention kernels | selected backend and fallbacks |
| Telemetry | DCGM / `nvidia-smi` | AMD SMI / ROCm tooling | sampled metrics and health |
| Topology | NVLink/NVSwitch/PCIe | Infinity Fabric/PCIe | link map, NUMA, collective test |

Do not present an AMD vs NVIDIA result as silicon-only. It is a result for two complete
hardware/software configurations. Validate host NUMA, power/clock policy, thermals, ECC/XID
or analogous health, peer-to-peer links, and collective bandwidth before blaming the engine.

## Dense and MoE qualification

Dense and Mixture-of-Experts models stress different resources.

- **Dense:** every token executes the same model layers; weight bandwidth and tensor-parallel
  collectives are usually central.
- **MoE:** each token routes to a subset of experts; expert balance, dispatch/all-to-all,
  expert parallelism, communication, and per-expert capacity become central.

For MoE, add routing distribution, expert load imbalance, all-to-all time, dropped/overflowed
tokens where applicable, and inter-node fabric utilization. An average tokens/sec number can
hide one hot expert or a topology-sensitive cliff.

## Qualification matrix

Build the matrix from product needs, not every possible flag:

| Dimension | Minimum useful sweep |
|---|---|
| Workload | interactive short chat, long-context prefill, decode-heavy, batch/offline, shared prefix |
| Load | concurrency and open-loop QPS from idle through overload |
| Model | small dense, large dense, MoE; exact production candidates |
| Precision | approved baseline plus candidate FP8/INT8/INT4 path |
| Parallelism | single GPU where it fits; TP/PP/EP sizes that match topology |
| Scheduler/KV | token budget, max sequences, chunked prefill, prefix cache, KV dtype |
| Hardware | each fleet SKU and supported engine stack |

Use a staged search:

1. correctness and fit;
2. coarse sweep to locate useful regions;
3. focused sweep near the SLO/capacity frontier;
4. repeated confirmation of finalists;
5. canary under production topology and traffic.

This avoids spending the full matrix on configurations that cannot load or cannot meet a
basic quality/SLO gate.

## Diagnose before tuning

| Symptom | Likely area | Next evidence |
|---|---|---|
| TTFT rises with ISL while ITL is stable | prefill/queue scheduling | prefill tokens/s, queue, chunking timeline |
| ITL worsens as contexts grow | KV reads / memory bandwidth | KV usage, bandwidth counters, decode batch |
| More TP makes latency worse | collective/topology overhead | per-layer collective time, link bandwidth |
| Throughput flat but GPU compute low | memory/communication/CPU feed/queue policy | roofline, profiler, CPU and network |
| High preemption/recompute | KV capacity or admission | cache occupancy, active tokens, fragmentation |
| MoE tails spike | routing imbalance or all-to-all | expert histogram, fabric and collective trace |

Change one causal mechanism at a time. Re-run the same workload, inspect the expected primary
metric and its counter-metrics, and preserve quality parity.

## Published and competitive benchmarks

A defensible external claim includes:

- exact date, region/endpoint, model/revision or documented provider alias;
- tokenizer and method for counting input/output tokens;
- prompt/output distribution and downloadable/privacy-safe workload;
- streaming, request rate/concurrency, duration, warmup, and retry/timeout policy;
- latency percentiles, throughput, goodput/SLO, errors, and price basis;
- repeated trials and uncertainty;
- limitations such as network distance, rate limits, unavailable configuration, or dynamic
  provider behavior.

Separate client-observed performance from internal server performance. A competitor endpoint
includes internet/network and provider routing; your lab server may not. The comparison can
still be useful if that asymmetry is explicit.

## Interview answer

> I would first run a controlled comparison under the closest common contract, then a
> best-qualified comparison where each engine uses production-safe native strengths. NVIDIA
> and AMD are separate pinned software stacks, not just GPU labels. Unsupported cells stay
> unsupported. I would qualify dense and MoE models across representative ISL/OSL and load,
> stop weak configurations early, repeat finalists, and publish quality, SLO, goodput, cost,
> uncertainty, and limitations—not a context-free tokens/sec leaderboard.

## Primary references

- [vLLM online serving](https://docs.vllm.ai/en/latest/serving/online_serving/)
- [SGLang serving benchmark guide](https://docs.sglang.ai/developer_guide/bench_serving)
- [TensorRT-LLM benchmarking](https://nvidia.github.io/TensorRT-LLM/performance/perf-benchmarking.html)
- [vLLM inference on ROCm](https://rocm.docs.amd.com/projects/ai-ecosystem/en/latest/inference/vllm.html)

→ Next: **[Capacity, COGS & Statistical Decisions](capacity-cogs-statistics.md)**
