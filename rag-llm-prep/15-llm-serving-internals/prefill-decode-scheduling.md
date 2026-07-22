# Prefill, Decode & Chunked Scheduling

**TL;DR:** An LLM request is two different workloads sharing one GPU. **Prefill** processes
all prompt tokens with large parallel matrix operations; **decode** emits one token at a
time while repeatedly reading weights and KV cache. A production scheduler must prevent
large prefills from blocking active decodes while still keeping the GPU full.

## Beginner mental model

> **CV bridge:** prefill is closest to a dense ViT/CNN forward pass—many prompt-token
> positions can use large parallel matrix operations. Decode is closer to an autoregressive
> tracker: the next state cannot exist until the current state is known.

Use the kitchen story: **prefill prepares the order; decode plates one course at a time**.
The first plate cannot leave until preparation is done, so prefill affects **time to first
token (TTFT)**. The delay between later plates is **inter-token latency (ITL)**.

Three details prevent most confusion:

1. Prefill does **not** generate the prompt token by token; the prompt is already known.
2. One decode iteration generates one next token **per active sequence**, not one token for
   the entire server.
3. Chunking changes when prompt work runs. It does not change the transformer or its answer.

## One request, two performance regimes

| Phase | Work | Typical pressure | User-visible metric |
|---|---|---|---|
| Queue | Wait for admission and capacity | scheduler saturation | queue time |
| Prefill | Process prompt and build KV cache | compute, prompt length | TTFT |
| Decode | Generate one token per iteration | memory bandwidth, KV capacity | ITL / TPOT |

Prefill exposes parallelism across the prompt, so it usually forms large GEMMs and uses
Tensor Cores efficiently. Decode has little parallel work *within one sequence*: every next
token depends on the previous token. With enough concurrent sequences, batching restores
parallelism, but each step still streams model weights and active KV blocks from memory.

The interview-ready sentence is:

> Prefill is usually compute-heavy and drives time-to-first-token; decode is usually
> memory-bandwidth and KV-capacity constrained and drives inter-token latency.

"Usually" matters. A tiny model, short prompt, slow tokenizer, PCIe transfer, or overloaded
network can move the bottleneck elsewhere. Measure before declaring the phase.

## The head-of-line problem

Imagine 30 chats are already decoding smoothly. A request with a 32k-token prompt arrives.
If the scheduler prefills all 32k tokens in one iteration, the large compute block delays
decode steps for everyone else. The new request may get a respectable TTFT, but existing
users see a long pause between streamed tokens.

That is **head-of-line blocking**: one large prefill monopolizes an iteration and damages
the ITL of unrelated requests.

## Chunked prefill

Chunked prefill splits a long prompt into bounded token chunks and interleaves those chunks
with decode work:

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">decode batch</span><span class="arw"></span>
    <span class="node">prefill chunk 1</span><span class="arw"></span>
    <span class="node data">decode batch</span><span class="arw"></span>
    <span class="node">prefill chunk 2</span><span class="arw"></span>
    <span class="node out">first token</span>
  </div>
</div>
```

## Try it: protect active streams or finish the new prompt first?

Scrub through the schedule and switch policies. **Full prefill** lets one long prompt own
the GPU for a large block of work. **Chunked prefill** spends part of each token budget on
the prompt while preserving a decode step for chats that are already streaming.

```rawhtml
<div id="prefill-scheduler-widget"></div>
```

## Why one policy over another?

| Policy | Choose it when | What you pay |
|---|---|---|
| Full prefill | Low concurrency, short prompts, or the new request's TTFT matters most | Existing streams can pause behind a long prompt |
| Chunked prefill | Interactive multi-user traffic with mixed prompt lengths | The long request may need more scheduler iterations before its first token |
| Strict decode priority | You must protect active-stream ITL for a short burst | New prefills can starve under sustained load |

The production answer is usually a **token budget plus fairness/aging**, not one policy
forever. Measure prompt-length distribution and separate TTFT and ITL SLOs.

It gives the scheduler a token budget per iteration. Decode tokens normally get priority;
remaining budget is filled with prefill chunks. This improves fairness and protects active
streams, but it is not a free speedup:

- Smaller chunks improve decode responsiveness but add more scheduling boundaries.
- Larger chunks use the GPU efficiently but can increase ITL for active decodes.
- The new request waits across more iterations, which can increase its TTFT.
- The best budget depends on prompt distribution, output distribution, model, GPU, and SLO.

So the tuning question is not "should chunking be on?" It is:

> What chunk and batched-token budget maximizes throughput while keeping p99 TTFT and ITL
> inside their separate SLOs for our real prompt distribution?

## Prefix caching is a different lever

**Chunked prefill** schedules unavoidable prompt work fairly. **Prefix caching** avoids
repeating prompt work when requests share the same token prefix, such as a long system
prompt or common document context.

Cache effectiveness depends on exact token-prefix reuse. It drops when prompts contain
request-specific timestamps, random IDs, reordered instructions, or different tokenization.
Track hit rate and saved tokens; do not assume a common-looking prompt is cacheable.

## Admission control protects the whole service

The scheduler cannot accept unlimited work merely because requests fit in an HTTP queue.
Each admitted sequence consumes KV blocks, and long contexts can evict or preempt useful
work. Production admission considers:

- prompt tokens and requested maximum output tokens;
- currently free KV-cache blocks;
- active sequences and queue age;
- per-tenant limits and priority classes;
- timeout/deadline and whether degradation is allowed.

Useful overload behaviors include a bounded queue, `429` with retry guidance, smaller
maximum output, routing to another replica, or a lower-priority batch pool. Swapping KV
state to CPU can preserve requests but may create a PCIe latency cliff; it is a last-resort
capacity valve, not invisible free memory.

## When to disaggregate prefill and decode

At large scale, separate worker pools can specialize: prefill workers favor compute, while
decode workers favor memory capacity/bandwidth. They can scale independently and keep long
prompts away from active token streams.

The cost is KV transfer. Moving a large cache between workers can erase the benefit unless
the fabric is fast (NVLink, InfiniBand/RDMA, or equivalent) and routing preserves locality.
Start with an aggregated engine; disaggregate only after workload measurements show that
prefill and decode have materially different scaling pressure.

## Diagnostic signatures

| Symptom | Likely cause | First evidence to inspect |
|---|---|---|
| TTFT rises, ITL stable | prefill/queue pressure | prompt length, queue time, prefill time |
| ITL spikes when long prompts arrive | prefill blocks decode | scheduler timeline, chunk budget |
| Both rise with concurrency | saturation | running/waiting requests, KV usage |
| Throughput flat, GPU partly idle | scheduler/CPU/network gap | Nsight Systems and server timeline |
| Frequent preemption/recompute | KV cache overcommitted | cache usage, active sequence lengths |

## Interview Q&A

**Q: Does chunked prefill always reduce TTFT?**
No. It primarily improves fairness and protects decode latency by breaking a long prefill
into schedulable pieces. The long-prompt request may wait through more iterations.

**Q: Why not always prioritize decode?**
Strict decode priority can starve new prefills under sustained load. Use budgets, aging, or
priority classes so existing streams stay smooth without making new requests wait forever.

**Q: Chunked prefill vs prefill/decode disaggregation?**
Chunking time-slices both phases on the same engine. Disaggregation places them in separate
worker pools and transfers KV state, enabling independent scaling at much higher complexity.

## Primary references

- [vLLM metrics design](https://docs.vllm.ai/en/latest/design/metrics/)
- [vLLM online serving documentation](https://docs.vllm.ai/en/latest/serving/online_serving/)
- [NVIDIA Dynamo disaggregated serving](https://docs.nvidia.com/dynamo/components/router/disaggregated-serving)

→ Next: **[KV Cache — Memory for Compute](kv-cache.md)**
