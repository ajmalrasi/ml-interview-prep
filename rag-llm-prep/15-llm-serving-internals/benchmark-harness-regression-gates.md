# Benchmark Harness & CI Regression Gates

**TL;DR:** A serious benchmark is a versioned test product: workload manifests, isolated
runners, immutable environment metadata, raw request records, repeatable summaries, and an
explicit decision policy. CI should reject a measured regression against a comparable
baseline—not reject random noise or reward a faster but lower-quality configuration.

## The SDET mental model

Treat each benchmark like an integration test whose output is a distribution rather than a
boolean.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">manifest<span class="nsub">model · workload · SLO</span></span><span class="arw"></span>
    <span class="node">provision<span class="nsub">pinned image + GPU</span></span><span class="arw"></span>
    <span class="node">warm + run<span class="nsub">raw request records</span></span><span class="arw"></span>
    <span class="node soft">summarize<span class="nsub">percentiles · goodput · cost</span></span><span class="arw"></span>
    <span class="node out">decide<span class="nsub">pass · fail · investigate</span></span>
  </div>
</div>
```

The runner should collect evidence. The policy layer should decide. Keeping them separate
lets you improve statistical rules without rerunning an expensive GPU matrix.

## Repository boundaries

| Component | Responsibility | Must not own |
|---|---|---|
| Workload catalog | Versioned prompt/output distributions and cohorts | Engine flags |
| Adapter | Start/query one engine through a stable contract | Pass/fail thresholds |
| Orchestrator | Provision, warm, sweep, retry infrastructure failures | Rewrite results |
| Collector | Request timings, engine metrics, GPU telemetry, logs | Aggregate away raw data |
| Summarizer | Percentiles, throughput, goodput, variance, cost | Decide business release |
| Comparator | Match candidate to baseline and calculate deltas | Run unrelated workloads |
| Policy | Required cohorts, allowed regressions, quality/SLO gates | Hide uncertainty |
| Reporter | Human report plus machine-readable decision | Become source of truth |

## Start with a workload manifest

Do not bury the experimental contract in a shell command. A reviewable manifest might carry:

```yaml
suite: interactive-chat-v3
model_revision: exact-immutable-revision
tokenizer_revision: exact-immutable-revision
traffic:
  mode: open_loop
  request_rates: [1, 2, 4, 8, 12]
cohorts:
  - name: short-chat
    input_tokens: {p50: 256, p95: 1024}
    output_tokens: {p50: 128, p95: 512}
  - name: long-context
    input_tokens: {p50: 8192, p95: 32768}
    output_tokens: {p50: 128, p95: 256}
slos:
  p95_ttft_ms: declared-by-product
  p99_itl_ms: declared-by-product
  min_goodput_rps: declared-by-capacity-plan
quality_gate: exact-suite-and-tolerance
```

Use either real, privacy-reviewed traffic samples or a synthetic generator fitted to the
production histograms. Averages are insufficient: two workloads with the same mean ISL can
have very different tails and KV pressure.

## Preserve one raw record per request

The summary is reproducible only if the raw evidence remains available. Record:

- run ID, trial ID, workload/cohort ID, request ID, timestamps, status, and error class;
- observed input/output token counts and whether the response streamed;
- queue time where exposed, TTFT, every ITL or a documented aggregation, and E2E latency;
- model/tokenizer, engine/container/config, hardware/topology, driver/runtime, and code SHA;
- server metrics and GPU telemetry over the same monotonic time window.

Use explicit units in field names (`ttft_ms`, `energy_joules`) and schema-version the record.
Never silently interpret seconds as milliseconds after a tool upgrade.

## Run lifecycle and failure handling

1. **Preflight:** validate GPU health, clocks/power policy, free memory, topology, disk, and
   required versions.
2. **Start:** launch the pinned container/config and capture logs plus resolved defaults.
3. **Health:** wait for model readiness, then issue correctness smoke requests.
4. **Warmup:** exercise representative shapes until compilation, caches, and allocators settle.
5. **Measure:** run one cell of the matrix for a fixed duration/request count.
6. **Cooldown/reset:** prevent the previous cell's queue or cache state leaking accidentally.
7. **Repeat:** use independent trials; randomize cell order when time trends could bias it.
8. **Finalize:** upload raw records and metadata atomically, then mark the run complete.

Give every matrix cell an idempotency key. On runner failure, retry only the incomplete cell
on a clean server. Never append a retry to a partial measurement window and call it one run.
Classify infrastructure failure separately from a performance failure.

## Comparable baselines

A candidate is comparable only when the intended invariants match:

- same model and tokenizer revision;
- same quality-affecting generation settings;
- same workload manifest and load-generator version;
- same GPU SKU/count/topology and power policy;
- same warmup, measurement window, repetitions, and metric convention.

An engine or precision change is often the experiment itself, so it may differ—but all other
dimensions should remain controlled. If the fleet or workload changed, establish a new
baseline instead of pretending the old number is directly comparable.

## A three-layer gate

| Layer | Example decision | Why it exists |
|---|---|---|
| Correctness | no crashes; valid responses; quality within tolerance | Faster wrong output is failure |
| SLO | required cohorts meet TTFT/ITL/error/goodput limits | Protect the customer contract |
| Relative regression | candidate delta versus matched baseline stays within budget | Catch degradation before the SLO is exhausted |

Use cohort-specific budgets. A 5% TTFT change may matter for short interactive traffic while
being irrelevant to an offline throughput pool. Keep absolute SLO and relative-regression
decisions visible separately.

## Statistical rigor without theatre

- Prefer several independent trials over one very long run when host/run variance matters.
- Report per-trial results, median/mean as appropriate, dispersion, and sample count.
- Use paired comparisons when baseline and candidate can run on matched hosts under matched
  conditions; rotate order to reduce thermal/time bias.
- Bootstrap a confidence interval for percentile or goodput deltas when analytical assumptions
  are weak.
- Inspect the distribution and raw tails. A p99 from too few requests is not trustworthy.
- Define the minimum practically important regression before seeing the result.

A useful automated policy has three outcomes:

- **pass:** SLO and quality pass; regression is smaller than the practical budget;
- **fail:** SLO/quality fails, or a material regression is supported by adequate evidence;
- **investigate:** result is noisy, samples are insufficient, or environment comparability failed.

“Investigate” is not a free pass. It routes to a bounded rerun/owner instead of making a
random CI fluctuation block the company indefinitely.

## CI/CD placement

| Cadence | Scope | Typical purpose |
|---|---|---|
| Pull request | tiny deterministic smoke/perf checks | API/schema breakage and catastrophic regression |
| Nightly | representative single-GPU and critical cohorts | trend detection |
| Engine/model qualification | full workload × config × hardware matrix | release decision and tuning recipe |
| Canary | sampled production traffic and real SLOs | environment/workload reality |

GPU benchmarks are expensive and noisy. Do not force the full matrix into every code review.
Use change detection to select relevant suites, cache immutable build artifacts, and keep the
full release gate asynchronous with an auditable status.

## Tool adapters, not tool lock-in

`vllm bench serve`, `python -m sglang.bench_serving`, NVIDIA AIPerf/GenAI-Perf, and
`trtllm-bench` expose overlapping but non-identical metrics and traffic controls. NVIDIA's
current documentation says GenAI-Perf is being phased out in favor of AIPerf—an ideal example
of why the harness needs adapters. Wrap every tool behind a canonical result schema, while
retaining its native artifact for audit. Before migrating or upgrading a load generator, run
old and new versions against a frozen server to detect metric-definition, tokenizer, or
traffic-generation changes.

## Interview answer

> I would version the workload and result schemas, pin the model, engine image, hardware,
> and load generator, then run clean warmup plus repeated open- and closed-loop sweeps. Each
> request and environment is stored as raw evidence. A separate comparator matches only
> compatible baselines and applies correctness, absolute SLO, and cohort-specific regression
> gates with uncertainty. Infrastructure failures and inconclusive noise are not mislabeled
> as product regressions. The same artifact feeds CI, Grafana annotations, tuning reports,
> and capacity planning.

## Primary references

- [vLLM online serving benchmark](https://docs.vllm.ai/en/stable/api/vllm/benchmarks/serve/)
- [SGLang serving benchmark guide](https://docs.sglang.ai/developer_guide/bench_serving)
- [NVIDIA AIPerf profiling](https://docs.nvidia.com/aiperf/getting-started/profiling-with-ai-perf)
- [NVIDIA GenAI-Perf](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/perf_analyzer/genai-perf/README.html)
- [TensorRT-LLM benchmarking](https://nvidia.github.io/TensorRT-LLM/performance/perf-benchmarking.html)

→ Next: **[Engine & Hardware Qualification](engine-hardware-qualification.md)**
