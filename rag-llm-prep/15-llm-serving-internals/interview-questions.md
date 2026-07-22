# LLM Serving Internals — Interview Questions

## Beginner answer recipe

Do not start with flags or acronyms. Build every answer in four sentences:

1. **Problem:** name the wasted compute, memory, GPU slot, or user-visible delay.
2. **Mechanism:** say exactly what vLLM reuses, allocates, or schedules differently.
3. **Trade-off:** explain when it helps and what resource or latency it can worsen.
4. **Evidence:** name the metric and workload you would measure.

Example: “Static batches leave slots idle when short answers finish. Continuous batching
admits queued requests into those slots between decode iterations. It helps mixed-length
concurrent traffic, not a single request, and aggressive batching can hurt ITL. I would sweep
concurrency and report throughput plus p95/p99 TTFT and ITL.”

That structure sounds senior because it connects **why → how → when → proof**, even when
the underlying explanation stays simple.

## Q: How do you optimize LLM latency and reduce inference cost?

Separate the two levers first, because they have different answers:

- **Application level (any deployment):** use a smaller/faster model where
  quality allows (e.g. Haiku vs Opus), cap `max_tokens`, cache the prompt
  prefix (share the KV cache for a common system prompt across requests), and
  stream so the user sees partial output while generation continues. In a RAG
  pipeline the LLM call is the bottleneck — retrieval is sub-millisecond, the
  API call is seconds — so optimize that side, not the search.
- **Serving level (self-hosted, under load):** three internals do the heavy
  lifting — **KV cache** (with PagedAttention) sets your memory ceiling,
  **continuous batching** keeps the GPU saturated under concurrency, and
  **speculative decoding** cuts per-token latency for structured output.

The senior framing is phase-specific: **prefill is often compute-heavy; decode is often
memory-bandwidth and KV-capacity bound**. KV memory commonly caps context length and
concurrent requests, while long-prompt prefill can still saturate compute.

---

## Q: What is the KV cache and why does it make serving memory-bound?

Inside attention, each new token looks back at every previous token through
that token's **key** and **value** vectors — and those don't change between
steps. Naively, generating token 501 would recompute K/V for tokens 1–500. The
KV cache stores them instead, so per-step work drops from O(n) recompute to
O(1) new work plus cache reads.

The price: the cache lives in GPU memory for the *whole* generation and grows
with context length × batch size (× layers × heads, for K and V). For a
7B-class model in fp16, a 4k context is ~2 GB of cache — a quarter of an 8 GB
card — before the model weights. Quantize the weights and the cache becomes the
dominant tenant. That single number explains most serving behavior on consumer
GPUs, and it's why serving is memory-bound. **PagedAttention** (vLLM) is the
memory-layout fix: carve the cache into fixed-size pages allocated on demand,
near-zero fragmentation, so you can pack far more concurrent requests into the
same VRAM.

---

## Q: What is continuous batching and when does it help?

Naive (static) batching groups N requests and waits for *all* of them to finish
before starting the next batch — one long answer stalls everyone behind it and
the GPU idles on the straggler. **Continuous batching** tracks each request
independently at the token level: the moment one finishes, a queued request
slots into the freed spot mid-batch. The GPU stays busy, throughput rises, and
short requests stop paying for long ones. It's the core trick behind vLLM and
TGI, and it pairs with PagedAttention because requests joining and leaving
mid-batch need cache memory allocated and freed in small blocks.

The catch: it only helps under **concurrent** load. A dev box serving one
request at a time gets nothing from it — there's nothing to interleave. It's a
production-multi-user optimization, which is exactly why it matters for "deploy
at scale" and not for a local demo.

---

## Q: What is speculative decoding, and does it change the output?

Generation is normally one token per forward pass because you can't know token
N+1 before token N. Speculative decoding breaks that with two models: a small,
fast **draft model** guesses several tokens ahead cheaply, then the big model
verifies all of them in a *single* pass. Verification has no one-at-a-time
dependency — "would I have written these?" can be checked in parallel. Correct
guesses are accepted almost for free; the first wrong guess is discarded and the
big model's own token is used.

The correctness point worth stating explicitly: greedy verification follows the target's
choices, and a correctly implemented sampling algorithm preserves the target distribution.
It's a latency trick, not permission to return the draft unchecked. But it lives or dies on
the draft model's hit rate — structured
output (code, JSON, tool calls) has predictable next tokens and sees large
speedups; creative high-entropy text has a low hit rate and speculation can be
net negative.

---

## Q: How would you validate any of these serving optimizations?

Measure on the actual hardware, don't quote vendor slides — the whole
discipline is "I measured this on my own card," which is the entry-gate bullet:

- **KV cache / memory ceiling:** serve the model at different max context
  lengths, watch `nvidia-smi` memory, record where requests start queueing.
  That measured ceiling — not the spec sheet — is the answer.
- **Continuous batching:** benchmark throughput (req/s and tok/s) vs concurrency
  level, same model, Ollama vs vLLM. Expected shape: near-identical at
  concurrency 1, vLLM pulling ahead as concurrency rises.
- **Speculative decoding:** measure tok/s with and without a draft model *per
  workload type*, and always report the acceptance rate alongside the speedup.
  A speedup without the acceptance rate is a vendor slide.
