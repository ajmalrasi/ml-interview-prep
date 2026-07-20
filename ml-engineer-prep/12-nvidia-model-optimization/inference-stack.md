# The Modern Inference Stack

**TL;DR:** vLLM, SGLang, Triton, TensorRT-LLM, TorchDynamo, NVIDIA Dynamo, XLA, MLIR,
LLVM, CUTLASS, and CUDA Graphs are not interchangeable competitors. They occupy different
layers: frontend graph capture, compiler IR, kernels, inference engine, server, distributed
runtime, and fleet orchestration. Place each tool before comparing it.

## The layer map

| Layer | Job | Examples |
|---|---|---|
| Model/framework | express model and eager execution | PyTorch, TensorFlow/JAX |
| Graph capture/compiler frontend | turn dynamic program into optimizable graph | TorchDynamo / `torch.compile`, TorchScript/export |
| Compiler IR/backend | transform, fuse, lower, generate code | TorchInductor, XLA, MLIR, LLVM |
| Kernel library/codegen | fast device operations | cuBLAS, cuDNN, CUTLASS, Triton language, FlashAttention |
| Optimized inference engine | plan memory, kernels, precision, scheduling | TensorRT, TensorRT-LLM, vLLM, SGLang |
| Model server/API | networking, model instances, metrics, batching surface | Triton Inference Server, vLLM/SGLang servers |
| Distributed LLM runtime | routing, discovery, KV-aware/disaggregated serving | NVIDIA Dynamo, llm-d |
| Cluster platform | placement, rollout, scaling, health | Kubernetes, Helm, GPU Operator |

A product may combine layers. vLLM is both engine and OpenAI-compatible server. Triton
Inference Server can host a TensorRT/TensorRT-LLM backend. "Triton" can also mean the Python-
embedded GPU programming language/compiler used by TorchInductor—clarify which one.

## Two Dynamos that are not the same

- **TorchDynamo** is the graph-capture frontend behind `torch.compile`. It observes Python
  bytecode, creates FX graphs guarded by runtime assumptions, and hands them to a backend such
  as TorchInductor. Graph breaks or recompilations can erase the gain.
- **NVIDIA Dynamo** is a distributed inference runtime for routing and orchestrating LLM
  engines, including disaggregated prefill/decode and KV-aware routing.

Saying "Dynamo compiles the model across a cluster" mixes two unrelated products.

## Engines: choose for the workload

### vLLM

Strong general-purpose LLM serving with paged KV-cache management, continuous batching,
prefix caching, parallelism, and an OpenAI-compatible surface. Good default when model support,
rapid iteration, and throughput matter.

### SGLang

LLM/VLM serving runtime with scheduling and prefix/KV reuse designed for structured and agentic
workloads as well as general serving. Evaluate when request programs or repeated prefixes are
important; benchmark against the same workload rather than comparing headline numbers.

### TensorRT-LLM behind Triton

NVIDIA-focused path for aggressive kernel fusion, precision tuning, in-flight batching,
parallel execution, and a managed serving surface. It can deliver excellent results on
supported NVIDIA models/hardware, with more build/tuning/version-coupling work.

### NVIDIA Dynamo / llm-d

Fleet-level systems for routing and distributed inference. They become relevant when one
engine process is no longer the architecture: many replicas, KV-aware routing, separate
prefill/decode pools, multi-node fabrics, and independent scaling. They add control-plane and
KV-transfer complexity; they are not automatically better for a modest single-cluster service.

## Compilers and kernels

**TorchDynamo + TorchInductor:** capture PyTorch graphs, fuse/lower operations, and generate
CPU/GPU code (often using Triton language on GPU). Inspect graph breaks, guards, recompilation,
compile time, memory, and numerical parity.

**XLA:** graph compiler used in ecosystems such as JAX and TensorFlow/XLA; performs
whole-graph transformations and lowers to device code.

**MLIR and LLVM:** compiler infrastructure/IR layers used to build transformation and codegen
pipelines. They are foundations, not turnkey serving engines.

**CUTLASS:** NVIDIA CUDA C++ templates/components for high-performance matrix operations. It is
a building block for kernels and engines, useful when standard library paths do not match a
specialized layout/epilogue.

**CUDA Graphs:** capture a stable sequence of GPU operations and replay it with far less CPU
launch overhead. Best when shapes/control flow and memory addresses are sufficiently stable;
dynamic request shapes can reduce capture coverage or require multiple graph variants.

## What building a custom inference engine entails

"Custom engine" is not just writing one CUDA kernel. It requires:

1. model import and operator coverage;
2. graph transformations, fusion, layout, precision and kernel selection;
3. memory planning and allocator behavior;
4. dynamic-shape/profile strategy;
5. KV-cache layout and scheduler for LLMs;
6. multi-GPU collectives and topology;
7. correctness across models/dtypes/shapes;
8. benchmarking, observability, failure handling and upgrades.

Start by profiling the existing engine, then replace the smallest dominant path with a custom
kernel/plugin. Full engines are justified only when the performance or hardware requirement
cannot be met by extending a maintained runtime.

## Decision table

| Need | First candidate | Why |
|---|---|---|
| Fast OpenAI-compatible LLM service | vLLM or SGLang | serving features with quick iteration |
| Maximum NVIDIA-specific optimization | TensorRT-LLM + Triton | tuned kernels/precision/runtime |
| General PyTorch model speedup | `torch.compile` | low-friction graph capture and fusion |
| Stable tiny workload is launch-bound | CUDA Graphs | amortize CPU launch overhead |
| Multi-node disaggregated LLM fleet | Dynamo/llm-d class | routing, discovery, KV movement |
| Missing specialized GEMM/epilogue | CUTLASS/Triton/custom CUDA | targeted kernel extension |

Always qualify the choice with model support, hardware, latency/throughput SLO, engineering
budget, debuggability, correctness, and upgrade burden.

## Interview trap questions

**Q: Triton vs TensorRT?**
Clarify: Triton Inference Server is a serving platform; NVIDIA TensorRT is an optimization/
execution engine; the Triton programming language is a GPU kernel language/compiler. They can
coexist in one stack.

**Q: vLLM vs Kubernetes?**
They solve different layers. vLLM runs/schedules model inference; Kubernetes places,
restarts, scales, and rolls the vLLM pods and their GPU nodes.

**Q: Why not compile everything?**
Dynamic shapes/control flow, unsupported ops, graph breaks, compile latency, memory growth,
and numerical risk can outweigh runtime gains. Profile and validate end-to-end.

**Q: When does disaggregated prefill/decode lose?**
When the service is too small, phases do not need different scaling, or KV transfer/routing
overhead exceeds the scheduling benefit—especially without a fast fabric.

## Primary references

- [PyTorch `torch.compile`](https://docs.pytorch.org/docs/stable/generated/torch.compile.html)
- [vLLM online serving](https://docs.vllm.ai/en/latest/serving/online_serving/)
- [NVIDIA Dynamo disaggregated serving](https://docs.nvidia.com/dynamo/components/router/disaggregated-serving)
- [NVIDIA Triton Inference Server](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/)
- [NVIDIA CUTLASS](https://docs.nvidia.com/cutlass/)

→ Next: **[GPU Performance & Profiling](gpu-performance.md)**
