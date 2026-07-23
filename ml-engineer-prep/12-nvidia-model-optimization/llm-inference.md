# LLM Inference Optimization

**TL;DR:** LLM inference has a structure classic CNNs don't: a compute-heavy **prefill** then
a memory-bound, token-by-token **decode** whose cost is dominated by the **KV cache**. The
optimization greatest-hits — KV cache, FlashAttention, paged attention, continuous batching,
tensor/pipeline parallelism — all attack that structure. Even if the role isn't LLM-first,
NVIDIA asks, because TensorRT-LLM is a flagship.

## The two phases (frame everything around this)

```rawhtml
<div class="compare">
  <div class="cmp-col blue">
    <div class="cmp-h">PREFILL</div>
    <p>Process the <b>whole prompt in parallel</b> — big matmuls on tensor cores.</p>
    <span class="cmp-tag">compute-bound</span>
  </div>
  <div class="cmp-col accent">
    <div class="cmp-h">DECODE</div>
    <p>Generate <b>1 token, append, repeat</b> — read all weights + KV every step.</p>
    <span class="cmp-tag">memory-bound</span>
  </div>
</div>
```

Decode is the expensive part for long generations, and it's **memory-bandwidth bound**: each
new token must read every weight and the whole KV cache from memory but does very little math
per byte. **This is why weight-only INT4 quantization helps LLM decode so much** — it cuts the
bytes you move, which is the actual bottleneck (tie this back to the roofline page).

## KV cache (the central data structure)

Attention needs the keys/values of all previous tokens. Recomputing them every step is
O(n²); instead you **cache** past keys and values and only compute the new token's Q·K. The
cache **grows linearly with sequence length × batch × layers × heads** and quickly dominates
memory. Managing it *is* LLM-serving optimization:

- **Size** is the problem — long contexts and big batches blow up HBM.
- **KV-cache quantization** (INT8/FP8 KV) roughly halves it.
- **GQA / MQA** (grouped/multi-query attention) — multiple query heads share one K/V head,
  shrinking the cache several-fold. A standard modern-architecture answer.

**Feel the memory wall.** Estimate serving VRAM below. Start at 7B / FP16 and weights
dominate — so quantizing them is the win. Now crank context length and batch: the KV
cache overtakes the weights and the total explodes past a single 80 GB GPU. That crossover
is exactly why paged attention, KV quantization, and GQA exist.

```rawhtml
<div id="llmmem-widget" class="widget-host"></div>
```

## FlashAttention (the kernel-level win)

Naive attention materializes the full **N×N** score matrix in HBM — O(N²) memory and lots of
slow reads. **FlashAttention** fuses the whole attention op and **tiles** it through fast
on-chip **SRAM/shared memory**, computing softmax **online** (running max/sum) so it never
writes the N×N matrix to global memory. Result: **O(N) memory, far fewer HBM trips, big
speedup** — a textbook "memory-bound op fixed by fusion + tiling," which is exactly the
roofline lesson applied to attention. Know it's **exact, not approximate**.

## Paged attention / vLLM (the memory-management win)

The KV cache is normally one contiguous block per sequence, which **fragments** memory and
forces over-allocation for the max length. **PagedAttention** (vLLM) stores the KV cache in
fixed-size **blocks** mapped by an index table — like **OS virtual-memory paging**. Benefits:
near-zero fragmentation, higher batch sizes, and **copy-free sharing** of common prefixes
(system prompts, beam search). This is what lets vLLM pack far more concurrent requests per
GPU.

## Continuous (in-flight) batching (the scheduling win)

Static batching wastes the GPU: a batch waits for its **slowest** sequence to finish before
starting the next batch, and finished sequences sit idle. **Continuous batching** schedules at
the **token/iteration level** — as soon as one sequence finishes, a new one takes its slot,
and new requests join mid-flight. This keeps the GPU saturated and is the single biggest
throughput lever for real LLM traffic. TensorRT-LLM calls it **in-flight batching**; vLLM
does it too.

## Parallelism across GPUs (when the model doesn't fit)

| Kind | What's split | Cost | When |
|---|---|---|---|
| **Tensor parallelism (TP)** | each layer's matmul split across GPUs | heavy all-reduce every layer → needs **NVLink** | model too big for one GPU; low latency |
| **Pipeline parallelism (PP)** | different **layers** on different GPUs | pipeline "bubble"; micro-batching hides it | very deep models across nodes |
| **Data parallelism** | different **requests/batches** per GPU replica | none between GPUs | throughput scaling of a model that fits |
| **Expert parallelism** | MoE experts across GPUs | routing/all-to-all | Mixture-of-Experts models |

One-liner: *"TP for a single big model where latency matters and you have NVLink bandwidth;
PP to span many layers across nodes; DP to scale throughput once it fits."* (Training adds
**ZeRO/FSDP** sharding of optimizer states — related but a training concern.)

## Speculative decoding (bonus lever)

A small **draft** model proposes several tokens; the big model **verifies** them in one
parallel pass, accepting the longest correct prefix. Since decode is memory-bound, verifying
K tokens costs about the same as generating one — so you get **multiple tokens per big-model
pass** with identical output distribution. Good "how else would you speed up decode" answer.

## 🔗 Connecting the dots: the real stack

**TensorRT-LLM** (NVIDIA — in-flight batching, fused kernels, FP8, TP/PP) served via
**Triton**; **vLLM** (PagedAttention, continuous batching); **TGI**; **FlashAttention** /
FlashInfer kernels; **SGLang**. Weight quant via **AWQ/GPTQ**, KV-cache quant via FP8.

**How you'd say it:** *"LLM decode is memory-bound, so I optimize the KV cache first — paged
attention for memory efficiency, GQA and FP8 KV to shrink it, FlashAttention for the kernel,
and continuous/in-flight batching for throughput. For a model that doesn't fit, tensor
parallelism over NVLink. On NVIDIA I'd reach for TensorRT-LLM behind Triton."*

## Self-check

- Why is LLM decode memory-bound and what quantization helps most? *(reads all weights + KV
  per token with little math → weight-only INT4 cuts the bytes moved.)*
- What does FlashAttention change and is it approximate? *(tiles attention through SRAM,
  online softmax, never materializes N×N → O(N) memory; exact.)*
- Paged attention solves what? *(KV-cache fragmentation/over-allocation → higher batch,
  prefix sharing, à la OS paging.)*
- TP vs PP? *(TP splits each layer's matmul, needs fast interconnect; PP splits layers across
  GPUs with a pipeline bubble.)*
- Continuous vs static batching? *(schedule per-token so finished sequences are replaced
  immediately and new requests join mid-flight → far higher GPU utilization.)*
