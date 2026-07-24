# DigitalOcean Senior Engineer: LLM Benchmarking & Performance: 2-Day Path

**TL;DR:** This role is asking for a performance engineer with an SDET mindset. The winning
answer is not “engine X is fastest.” It is: define the customer workload and SLO, build a
reproducible harness, find the saturation knee, explain the bottleneck, turn the result into
a capacity/cost decision, and prevent regressions from shipping.

## What the interview process is testing

| Stage | Scheduled | What to prove |
|---|---|---|
| Hiring Manager, virtual | July 27–29, 2026 | Ownership, honest benchmarking, cross-team decisions, mentoring, and clear communication |
| Coding assessment | August 1, 2026, in person | Clean Python/Go, testability, edge cases, data handling, and complexity |
| Assessment review + technical deep dive | August 1, 2026 | Benchmark design, LLM serving, GPU reasoning, CI gates, capacity, and defensible conclusions |

This is narrower than a general ML interview. Deprioritize RAG retrieval, prompt engineering,
and model training unless they support a serving-performance answer.

**Current tooling note:** the JD names GenAI-Perf, while NVIDIA's current documentation says
it is being phased out in favor of AIPerf. Know the GenAI-Perf concepts, but use this as a
senior-level discussion about pinned versions, result-schema adapters, migration validation,
and never tying the benchmark platform to one load generator.

## How to use this path

- Read each linked lesson, then close it and answer the **exit test** aloud.
- For every result, say **workload → metric → bottleneck → change → trade-off → evidence**.
- Do not memorize vendor claims or hard-coded thresholds. State what you would measure.
- Keep one running design: qualifying a 70B model on both NVIDIA and AMD fleets.
- Links marked **ML site** open the shared GPU/Kubernetes lesson on the ML Engineering site.

## Before Day 1: Hiring Manager story bank: 60 minutes

Prepare five two-minute STAR stories. End each with a measured result and what you learned.

1. A performance problem you owned from vague symptom to verified fix.
2. A benchmark or test whose first conclusion was misleading.
3. A regression you prevented, detected, or helped recover from.
4. A disagreement with product or engineering about speed, cost, or launch readiness.
5. A system/tool you made maintainable for other engineers, including mentoring or docs.

**DigitalOcean lens:** emphasize simplicity, developer empathy, end-to-end ownership, open
source, and making a complex performance result legible to product and leadership.

**Exit test:** answer “Why DigitalOcean, why this role, and why you?” in 90 seconds without
reciting the job description.

## Day 1: Measurement, automation, and qualification

### Block 1: Metrics and saturation: 90 minutes

1. [TTFT, ITL & Reproducible LLM Benchmarks](15-llm-serving-internals/latency-benchmarking.md)
2. [Prefill, Decode & Chunked Scheduling](15-llm-serving-internals/prefill-decode-scheduling.md)
3. [KV Cache — Memory for Compute](15-llm-serving-internals/kv-cache.md)

**Exit test:** explain why p95 TTFT, p99 ITL, output-token throughput, and goodput answer
different questions. Sketch the curve where throughput flattens but tail latency explodes.

### Block 2: Build the benchmark as production software: 2 hours

1. [Benchmark Harness & CI Regression Gates](15-llm-serving-internals/benchmark-harness-regression-gates.md)
2. [Continuous Batching](15-llm-serving-internals/continuous-batching.md)
3. [vLLM in Production](15-llm-serving-internals/vllm-production.md)

**Exit test:** design the repository, workload manifest, runner, result schema, warmup,
repetitions, artifact store, comparison job, and release gate. Explain what happens when a
runner crashes halfway through a matrix.

### Block 3: Compare engines and GPU fleets fairly: 2 hours

1. [Engine & Hardware Qualification](15-llm-serving-internals/engine-hardware-qualification.md)
2. [The Modern Inference Stack — ML site](http://192.168.3.20:9002/#12-nvidia-model-optimization/inference-stack.md)
3. [GPU Performance & Profiling — ML site](http://192.168.3.20:9002/#12-nvidia-model-optimization/gpu-performance.md)
4. [Numerical Precision — ML site](http://192.168.3.20:9002/#12-nvidia-model-optimization/numerical-precision.md)

**Exit test:** propose a fair vLLM vs SGLang vs TensorRT-LLM comparison on NVIDIA and AMD.
Name what must be identical, what cannot be identical, and how you would present that caveat.

### Block 4: Capacity, statistics, and COGS: 90 minutes

1. [Capacity, COGS & Statistical Decisions](15-llm-serving-internals/capacity-cogs-statistics.md)
2. [Speculative Decoding](15-llm-serving-internals/speculative-decoding.md)

**Exit test:** turn a concurrency sweep into a safe requests-per-replica limit, GPU count,
headroom policy, and cost per million tokens. Explain why one fast run is not a baseline.

## Day 2: Tuning, production operations, and rehearsal

### Block 5: Tune from evidence: 90 minutes

1. [LLM Inference Optimization — ML site](http://192.168.3.20:9002/#12-nvidia-model-optimization/llm-inference.md)
2. [NCCL & Distributed Collectives — ML site](http://192.168.3.20:9002/#08-optimization-scaling/nccl-collectives.md)
3. [Serving Architecture — ML site](http://192.168.3.20:9002/#13-llm-vlm-optimization/serving-architecture.md)

Practise this diagnosis order:

1. split queue, prefill, and decode;
2. check KV capacity/preemption;
3. check compute, memory bandwidth, and kernels;
4. check collectives and topology;
5. change one mechanism;
6. repeat the same workload and quality gate.

**Exit test:** diagnose three cases: long-prompt TTFT regression, decode ITL regression after
adding tensor parallelism, and strong throughput with poor goodput.

### Block 6: Observability and release safety: 90 minutes

1. [Inference Observability with Prometheus & Grafana](20-production-monitoring/inference-observability.md)
2. [CI/CD for ML — ML site](http://192.168.3.20:9002/#05-mlops-serving/cicd-for-ml.md)
3. [GPU Kubernetes Operations — ML site](http://192.168.3.20:9002/#07-cloud-infra/gpu-kubernetes-operations.md)

**Exit test:** draw one dashboard from gateway to scheduler to GPU, then define a blocking
offline regression gate, a canary rollback signal, and a production alert. Keep them separate.

### Block 7: Coding assessment rehearsal: 75 minutes

Implement this in Python or Go without external libraries:

> Read benchmark records as a stream. Validate required fields, group compatible trials,
> calculate p50/p95/p99 latency and goodput, compare candidate with baseline, and emit a
> machine-readable pass/fail report. Malformed records must not corrupt valid groups.

Before coding, state:

- input/output contract and units;
- percentile convention and small-sample behavior;
- time and space complexity;
- deterministic tests for boundaries, empty input, malformed rows, and exact threshold ties;
- how the production version would avoid loading a multi-GB result file into memory.

Then use the concurrency chapter in the separate Python Interview Prep site to explain how you would run
many remote benchmark jobs without turning CPU-bound analysis into an async bottleneck.

### Block 8: Technical deep dive and final mock: 2 hours

1. [LLM Serving Interview Questions](15-llm-serving-internals/interview-questions.md)
2. Re-answer every weak question using the six-part structure below.
3. Do the system-design prompt twice: first in 10 minutes, then in 25 minutes with challenges.

> Design a continuous qualification platform for dense and MoE models across NVIDIA and AMD
> GPU fleets using vLLM, SGLang, and TensorRT-LLM where supported. It must run realistic
> ISL/OSL and QPS/concurrency sweeps, detect regressions, produce tuning recipes, size
> capacity, calculate COGS, publish defensible comparisons, and support safe model/engine
> rollouts.

## The six-part answer structure

1. **Contract:** model, workload distribution, streaming, traffic, SLO, quality parity.
2. **Experiment:** controlled variables, workload matrix, warmup, repetitions, artifacts.
3. **Measurement:** TTFT, ITL/TPOT, E2E, throughput, goodput, errors, utilization, cost.
4. **Diagnosis:** prefill/decode, compute/bandwidth, KV, queueing, collectives, topology.
5. **Decision:** configuration, capacity, headroom, uncertainty, and rejected alternatives.
6. **Guardrail:** CI gate, canary, dashboard, rollback, and owner.

## Five traps to avoid

- Comparing advertised tokens/sec from different workloads.
- Reporting only averages or only maximum throughput.
- Changing engine, hardware, precision, and request shape in one experiment.
- Treating GPU utilization as proof of useful work.
- Blocking releases on noisy microbenchmarks without repetitions, uncertainty, or a triage path.

## Your final one-page artifact

Before the interview, produce one sheet with:

- metric definitions and units;
- the benchmark matrix;
- a request → scheduler → GPU bottleneck map;
- KV-cache and cost formulas;
- the engine/hardware qualification table;
- three regression-gate examples;
- five HM stories and their measured outcomes.

If you can explain that sheet without notes, you are preparing for the actual role rather
than merely reading about its tools.
