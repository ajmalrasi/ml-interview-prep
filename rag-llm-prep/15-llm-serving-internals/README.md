# 15 — LLM Serving Internals: KV Cache, Batching, Speculative Decoding (concept, roadmap)

**The big idea:** an LLM generates autoregressively — token N+1 depends on
tokens 1..N, so a 500-token answer is 500 sequential forward passes. No
shortcuts, *unless* you exploit what's repeated across those passes. Each
technique here exploits a different repetition. This is what happens inside
the box DocsMind treats as opaque — and why the roadmap swaps Ollama for
**vLLM**: to get control over that box.

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

## Files in this folder

| File | What it covers |
|------|----------------|
| [prefill-decode-scheduling.md](prefill-decode-scheduling.md) | Why prefill and decode behave differently; chunked prefill and scheduler trade-offs |
| [kv-cache.md](kv-cache.md) | Stop recomputing attention history — and why serving is *memory*-bound |
| [continuous-batching.md](continuous-batching.md) | The core trick behind vLLM: never let the GPU idle behind a slow request |
| [speculative-decoding.md](speculative-decoding.md) | A draft model guesses ahead; the big model verifies in bulk |
| [latency-benchmarking.md](latency-benchmarking.md) | TTFT, ITL/TPOT, throughput, load shapes, and reproducible performance evidence |
| [vllm-production.md](vllm-production.md) | Deploying and operating vLLM behind a production application layer |

## How the three stack

| Technique | Solves | Cost of *not* having it |
|---|---|---|
| KV cache | Recomputing unchanged attention history every token | O(n²)-ish recompute per token instead of O(n) |
| Continuous batching | GPU idling behind slow requests in a static batch | Throughput capped by your slowest concurrent request |
| Speculative decoding | One token per full forward pass | Full model cost per token even when tokens are "easy" (predictable) |

All three are **invisible to the client**. `LocalLLMClient` doesn't need to
know any of this is happening — it sends a prompt, tokens come back faster.
That's exactly why the roadmap frames Ollama → vLLM as a serving-layer swap
with zero change to [`base.py`](../../docsmind/llm/base.py)'s contract.

## 🎯 Interview Q&A

**Q: Why is LLM inference described as memory-bound?**
The KV cache sits in GPU memory for the entire generation, and it scales
with context length × batch size. You run out of memory long before you run
out of compute on most consumer GPUs.

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

→ Next: **[16-python-concurrency/README.md](../16-python-concurrency/README.md)**
