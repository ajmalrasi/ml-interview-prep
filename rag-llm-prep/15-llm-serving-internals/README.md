# 15 — LLM Serving Internals: Beginner Path

**The big idea:** an LLM generates autoregressively — token N+1 depends on
tokens 1..N, so a 500-token answer is 500 sequential forward passes. No
shortcuts, *unless* you exploit what's repeated across those passes. Each
technique here exploits a different repetition. This is what happens inside
the box DocsMind treats as opaque — and why the roadmap swaps Ollama for
**vLLM**: to get control over that box.

> **New to serving? Start here.** vLLM does not train the model, improve its accuracy, or
> replace attention. It is the **inference runtime around the same model weights**: it
> decides which requests run now, where their temporary tensors live, and how to avoid
> repeated work. If you have used TensorRT, Triton, CUDA batching, or variable-length ML
> batches, you already know pieces of the story.

## Six words before we start

| Word | Beginner meaning |
|---|---|
| **Request / sequence** | One user's prompt plus the answer being generated |
| **Token** | A small text unit represented by an integer ID |
| **Forward pass** | Run the model once to produce probabilities for what comes next |
| **Prefill** | Process all prompt tokens and build their attention memory |
| **Decode iteration** | Advance each active request by one generated token |
| **KV cache** | Per-request GPU tensors that remember attention history; not the model weights and not an answer cache |

The one sentence to hold in your head is:

> **Prefill reads the prompt once; decode repeatedly produces the next token; vLLM keeps
> the GPU and its memory useful while many requests do this together.**

## Follow one request through vLLM

Select each stop in order. The model is still the same transformer at every stop; what
changes is scheduling and memory management around it.

```rawhtml
<div id="vllm-journey-widget"></div>
```

## Connect it to ML and computer vision

| Familiar idea | vLLM connection | Important difference |
|---|---|---|
| Dense CNN/ViT inference over a batch or all image patches | **Prefill** processes many prompt tokens in parallel | It also creates K/V state needed by later generation |
| Autoregressive tracker/RNN state update | **Decode** advances one dependent step at a time | vLLM batches one next-token step across many users |
| Cache backbone features for old video frames | **KV cache** keeps features for old tokens | The new query still reads and scores that history |
| Tile an image instead of reserving a maximum-size canvas | **PagedAttention** stores KV in small blocks | A logical sequence can map to non-contiguous physical VRAM blocks |
| Replace completed samples in a variable-length workload | **Continuous batching** refills finished sequence slots | Membership changes between token iterations, not just between batches |
| Student/teacher models | **Speculative decoding** uses a small draft and large target | Both run online; target verification preserves its output distribution |

## One story: the GPU kitchen

- **Prompt = order ticket. Prefill = prep the whole order** before the first plate can leave.
- **KV cache = labeled containers of prepared ingredients** so they are not chopped again.
- **PagedAttention = small stackable bins**, not one giant reserved shelf per customer.
- **Decode = plate one course at a time** because course N+1 depends on what was served at N.
- **Continuous batching = reuse a burner immediately** when one customer's dish finishes.
- **Speculation = a junior chef prepares a few likely next steps** and the head chef approves
  the correct prefix in one inspection.

**Where in the pipeline:** entirely *inside* the box that
[`LocalLLMClient.generate()`](../../docsmind/llm/local_client.py) treats as
a black box. Nothing here changes the `LLMClient` interface. It changes what
sits behind it at serving time.

```rawhtml
<div class="diagram">
  <div class="flow" style="margin-bottom:12px"><span class="flow-lbl">today:</span><span class="node data">docsmind</span><span class="arw"></span><span class="node">LocalLLMClient.generate()</span><span class="arw"></span><span class="node ghost">Ollama<span class="nsub">opaque</span></span><span class="arw"></span><span class="node out">tokens</span></div>
  <div class="lanes">
    <div class="flow"><span class="flow-lbl">roadmap:</span><span class="node data">docsmind</span><span class="arw"></span><span class="node">LocalLLMClient.generate()</span><span class="arw"></span><span class="node soft">vLLM server</span></div>
    <span class="merge-arw"></span>
    <div class="lane-stack">
      <span class="node ghost">KV cache</span>
      <span class="node ghost">continuous batching</span>
      <span class="node ghost">speculative decoding</span>
    </div>
  </div>
</div>
```

## Learn in this order

| Step | Page | Question it answers |
|---:|---|---|
| 1 | [Prefill, decode and scheduling](prefill-decode-scheduling.md) | Why does the first token behave differently from later tokens? |
| 2 | [KV cache and PagedAttention](kv-cache.md) | What is remembered, what still runs, and why does VRAM fill? |
| 3 | [Continuous batching](continuous-batching.md) | How can many unequal-length requests share one GPU efficiently? |
| 4 | [Speculative decoding](speculative-decoding.md) | How can one target-model pass safely commit several tokens? |
| 5 | [Latency benchmarking](latency-benchmarking.md) | Which stopwatch proves each optimization helped? |
| 6 | [vLLM in production](vllm-production.md) | Where does the engine sit in a real service? |
| Drill | [Interview questions](interview-questions.md) | Can I explain mechanism, trade-off, and measurement clearly? |

## Why each mechanism exists

| Problem you observe | Mechanism | Why this rather than the obvious alternative? |
|---|---|---|
| Long prompts pause existing streams | **Chunked prefill** | Time-slice prompt work instead of letting one full prefill monopolize the GPU |
| Old token features are unchanged | **KV cache** | Store K/V once instead of rebuilding the whole prefix every decode step |
| Different requests need different KV sizes | **PagedAttention** | Allocate small blocks on demand instead of reserving a maximum contiguous slab |
| Short requests finish before long ones | **Continuous batching** | Refill their slots instead of padding/idling until the slowest request ends |
| Predictable tokens still cost full-model passes | **Speculative decoding** | Let a cheap draft propose, but retain target-model correctness through verification |

These mechanisms are **invisible to the client**. `LocalLLMClient` doesn't need to
know any of this is happening — it sends a prompt, tokens come back faster.
That's exactly why the roadmap frames Ollama → vLLM as a serving-layer swap
with zero change to [`base.py`](../../docsmind/llm/base.py)'s contract.

## 🎯 Interview Q&A

**Q: Why is LLM inference described as memory-bound?**
Decode repeatedly streams model weights and KV history, and the cache scales
with context length × active sequences. That often makes decode bandwidth/capacity bound.
Prefill is different and can be compute-heavy, so always name the phase.

**Q: What's the actual mechanism behind vLLM's speedup claims?**
Continuous (also called "in-flight") batching, plus PagedAttention — a
memory layout trick for the KV cache, similar in spirit to OS
virtual-memory paging. Not magic. Two specific engineering decisions.

**Q: When does speculative decoding *not* help?**
Low-predictability output, or a draft model too weak to guess usefully.
You pay the draft cost and still fall back to the slow path most of the time.

**Q: How would you validate any serving claim?**
Don't repeat vendor claims — measure tok/s, time-to-first-token, throughput
vs batch size on the actual hardware (the beast's 3070 Ti). Same discipline
as [05-faiss/benchmark-results.md](../05-faiss/benchmark-results.md).

## Code

[docsmind/llm/local_client.py](../../docsmind/llm/local_client.py) — the
`POST /api/chat` call in front of whatever serving engine runs behind it.

→ Start learning: **[Prefill, Decode & Chunked Scheduling](prefill-decode-scheduling.md)**
