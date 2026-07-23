# IDFC AI Engineer: LLM Inference & AI Infrastructure: 2-Day Path

**TL;DR:** This role is not testing RAG application wiring. It is testing whether you can
reason from an LLM request down through the scheduler, KV cache, GPU, interconnect, and
Kubernetes platform — then prove performance with measurements. Follow this path in order.

## How to use this path

- Read the linked lesson, then answer its self-check questions without looking.
- For every optimization, say which metric it improves and what it costs.
- Finish each block by explaining the system aloud as if drawing it on a whiteboard.
- Links marked **ML site** open the shared infrastructure lesson on the ML Engineering site.

## Day 1: LLM inference mechanics and measurement

### Block 1: Build the inference mental model: 90 minutes

1. [LLM Serving Internals overview](15-llm-serving-internals/README.md)
2. [Prefill, Decode & Chunked Scheduling](15-llm-serving-internals/prefill-decode-scheduling.md)
3. [KV Cache — Memory for Compute](15-llm-serving-internals/kv-cache.md)

**Exit test:** explain why prefill is usually compute-heavy, decode is usually
memory-bandwidth-bound, and a long prompt can hurt another user's inter-token latency.

### Block 2: Keep the GPU busy: 90 minutes

1. [Continuous Batching](15-llm-serving-internals/continuous-batching.md)
2. [Speculative Decoding](15-llm-serving-internals/speculative-decoding.md)
3. [LLM Inference Optimization — ML site](http://192.168.3.20:9002/#12-nvidia-model-optimization/llm-inference.md)

**Exit test:** compare static batching, continuous batching, chunked prefill, prefix
caching, and speculative decoding. For each, name the workload where it can disappoint.

### Block 3: Deploy and benchmark vLLM: 2 hours

1. [TTFT, ITL & Reproducible Benchmarks](15-llm-serving-internals/latency-benchmarking.md)
2. [vLLM in Production](15-llm-serving-internals/vllm-production.md)
3. [Production Monitoring](20-production-monitoring/README.md)

**Exit test:** design a benchmark matrix across prompt length, output length, concurrency,
and tensor-parallel size. State the SLO before choosing a winning configuration.

### Block 4: Rapid recall: 45 minutes

- [LLM Serving Interview Questions](15-llm-serving-internals/interview-questions.md)
- Re-answer every question you missed once, aloud.

## Day 2: GPU, distributed systems, and production platform

### Block 5: GPU performance engineering: 2 hours

1. [GPU Performance & Profiling — ML site](http://192.168.3.20:9002/#12-nvidia-model-optimization/gpu-performance.md)
2. [Numerical Precision — ML site](http://192.168.3.20:9002/#12-nvidia-model-optimization/numerical-precision.md)
3. [The Modern Inference Stack — ML site](http://192.168.3.20:9002/#12-nvidia-model-optimization/inference-stack.md)

**Exit test:** start from an Nsight timeline and choose between fixing data feed, kernel
launch overhead, memory traffic, compute saturation, or inter-GPU communication.

### Block 6: Multi-GPU and NCCL: 90 minutes

1. [Distributed Training — ML site](http://192.168.3.20:9002/#08-optimization-scaling/distributed-training.md)
2. [NCCL & Distributed Collectives — ML site](http://192.168.3.20:9002/#08-optimization-scaling/nccl-collectives.md)

**Exit test:** choose tensor, pipeline, or data parallelism for three model sizes. Explain
why tensor parallelism across slow inter-node links can make latency worse.

### Block 7: Kubernetes-native inference: 2 hours

1. [Containers, Kubernetes & Kubeflow — ML site](http://192.168.3.20:9002/#07-cloud-infra/containers-k8s.md)
2. [GPU Kubernetes Operations — ML site](http://192.168.3.20:9002/#07-cloud-infra/gpu-kubernetes-operations.md)
3. [Serving Architecture — ML site](http://192.168.3.20:9002/#13-llm-vlm-optimization/serving-architecture.md)
4. [CI/CD for ML — ML site](http://192.168.3.20:9002/#05-mlops-serving/cicd-for-ml.md)

**Exit test:** design a rollout with GPU nodes, device plugin, readiness probes, Helm,
canary traffic, autoscaling, DCGM metrics, model-version rollback, and no dropped streams.

### Block 8: Final system-design rehearsal: 90 minutes

Answer this twice: once for low latency, once for maximum throughput.

> Design an OpenAI-compatible service for a 70B model with bursty banking traffic. Define
> SLOs, capacity model, engine, parallelism, scheduler, KV-cache policy, Kubernetes layout,
> monitoring, failure handling, rollout, and benchmark plan.

## The answer structure interviewers can follow

1. **Workload:** model, prompt/output distributions, concurrency, streaming, SLO.
2. **Bottleneck:** memory capacity, bandwidth, compute, network, or queueing.
3. **Architecture:** engine, batching, cache, parallelism, replicas, routing.
4. **Operations:** probes, observability, autoscaling, rollouts, failure domains.
5. **Evidence:** controlled benchmark, p50/p95/p99, quality parity, cost per output token.

Never list optimizations without connecting them to a bottleneck and a measured outcome.
