# KV Cache: Stop Recomputing What You Already Computed

**TL;DR:** inside attention, each new token looks back at every previous
token through that token's key and value vectors. Those don't change between
steps — so cache them. The price: the cache lives in GPU memory for the whole
generation, which is why serving is *memory*-bound.

## Beginner mental model

In simplified attention language:

- **Query (Q):** what the current token is looking for;
- **Key (K):** how a previous token can be matched;
- **Value (V):** the information returned when that token matters.

> **CV bridge:** imagine video inference where you cache backbone features for old frames.
> A new frame still compares with the history, but you do not rerun the backbone on every
> old frame. KV cache applies that reuse idea at every transformer layer.

The notebook analogy is also useful: old notes save you from re-deriving facts, but the new
question still has to read the relevant notes. That is why the cache removes recomputation
without making attention independent of context length.

Do not mix up three different caches:

| Cache | Stores | Reuse condition |
|---|---|---|
| KV cache | Attention K/V tensors for tokens | Same live sequence; sometimes shared exact prefix |
| Prefix cache | KV blocks for a repeated token prefix | Token IDs and prefix structure must match |
| Response cache | A final application answer | Application decides the request is equivalent |

## The waste being eliminated

Inside attention, each new token looks back at every previous token.
It does that through each previous token's **key** and **value** vectors.

Here's the waste: naively, generating token 501 would recompute the keys and
values for tokens 1–500. But those haven't changed. They're the same every
step.

The **KV cache** just stores them. Token 501 computes only its own K/V pair,
then attends to the 500 cached ones.

```rawhtml
<div class="compare">
  <div class="cmp-col">
    <div class="cmp-h">Without cache</div>
    <p>Step 501 = <b>recompute</b> K,V for tokens 1..500 + compute token 501.</p>
    <span class="cmp-tag">O(n) per step</span>
  </div>
  <div class="cmp-col green">
    <div class="cmp-h">With KV cache</div>
    <p>Step 501 = <b>read cache</b> + compute token 501 only.</p>
    <span class="cmp-tag">O(1) new work + cache reads</span>
  </div>
</div>
```

Plain version: instead of re-reading the whole conversation before writing
each new sentence, you keep notes on what's been said and only read the new
part.

## Try it: what is reused, and what still runs?

Move through generation steps, then switch between **No cache** and **KV
cache**. The boxes show whether each token's key/value pair is recomputed or
read from GPU memory. The lines from the current query show the important
part people often miss: attention still looks at every previous key.

```rawhtml
<div id="kv-cache-widget"></div>
```

The cache does **not** make a decode step independent of context length. It
removes repeated projection of unchanged keys and values (and avoids rerunning
the old prefix through every layer), but the new query still reads and scores
the cached history. That is why decode becomes a memory-bandwidth problem.

## The price: memory, and lots of it

The cache must live in GPU memory for the whole generation.
It grows with **context length × batch size** (× layers × heads × head_dim,
for every token, in both K and V).

This cache is why LLM serving is called **memory-bound**, not compute-bound.
On an 8GB card, *this* is what caps context length and concurrent requests —
the exact number the roadmap's beast (RTX 3070 Ti, 8GB) benchmark needs to
measure.

Back-of-envelope for a 7B-class model (fp16): each token's KV entry across
all layers is roughly 0.5 MB. A 4k context is ~2 GB of cache — a quarter of
the card — *before* counting the model weights. Quantize the weights and the
cache becomes the dominant tenant. This single number explains most serving
behavior on consumer GPUs.

## PagedAttention: the memory layout fix

Naive serving allocates each request's cache as one contiguous block sized
for the *maximum* possible context — mostly wasted on short requests.

vLLM's **PagedAttention** carves the cache into fixed-size blocks and maps
them like OS virtual-memory pages: allocate on demand, no contiguity
requirement, near-zero fragmentation. That's not a speed trick per se — it's
what lets continuous batching pack many more concurrent requests into the
same VRAM (see [continuous-batching.md](continuous-batching.md)).

## Try it: contiguous reservations vs KV pages

Switch memory layouts and vary the request-length mix. Each square is a two-token KV
block. Max-size reservations strand unused slots inside each request's allocation;
PagedAttention allocates only the blocks each live sequence currently needs.

```rawhtml
<div id="paged-attention-widget"></div>
```

## Why pages over one contiguous allocation?

Think of variable-size images. Reserving a maximum-size canvas for every image is simple,
but mostly empty. Tiling lets each image take only the blocks it needs and lets physical
tiles live wherever space is available.

| Layout | Advantage | Problem |
|---|---|---|
| One maximum contiguous slab per request | Simple addresses and bookkeeping | External fragmentation and large unused reservations |
| Fixed KV pages allocated on demand | Packs mixed sequence lengths and frees blocks incrementally | Requires a block table and page-aware attention kernels |

**Connecting the dots:** continuous batching constantly admits and finishes requests.
PagedAttention makes those changing batch slots practical because their KV memory can grow
and disappear in small blocks.

## Trade-off and validation

KV cache trades **memory for compute** — a direct spend of GPU VRAM to buy
speed. There's no configuration where you skip it in production; the real
decisions are around what it enables and limits: max context, max batch,
whether prefix caching (sharing the cache for a common system prompt across
requests) is worth turning on.

How you'd validate on the beast: serve the same model with different max
context lengths, watch `nvidia-smi` memory, and record where requests start
queueing. That measured ceiling — not the spec sheet — is the number an
interviewer wants to hear.

→ Next: **[continuous-batching.md](continuous-batching.md)**
