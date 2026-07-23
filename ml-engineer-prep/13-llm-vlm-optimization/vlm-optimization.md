# VLM Optimization

**TL;DR:** A vision-language model is **a vision encoder + a projector + an LLM decoder** — so
optimizing it is *your CNN skills for the vision tower* plus *LLM tricks for the decoder*. The
VLM-specific catch: images turn into **hundreds to thousands of tokens**, so **prefill and the
KV cache blow up**, and the single biggest lever is **reducing visual tokens**. This is your
strongest bridge page — it uses both halves of your experience.

## The architecture (know the three stages)

```rawhtml
<div class="diagram">
  <div class="vflow">
    <div class="flow">
      <span class="node data">image</span>
      <span class="arw"></span>
      <span class="node">Vision Encoder<span class="nsub">ViT / CLIP</span></span>
      <span class="arw"></span>
      <span class="node">Projector<span class="nsub">MLP / resampler</span></span>
      <span class="arw"></span>
      <span class="node soft">image tokens<span class="nsub">100s–1000s</span></span>
    </div>
    <div class="flow">
      <span class="node data">text</span>
      <span class="arw"></span>
      <span class="node soft">text tokens</span>
    </div>
    <span class="varw" title="both token streams feed the decoder"></span>
    <div class="flow">
      <span class="node">LLM Decoder<span class="nsub">attends over image + text tokens</span></span>
      <span class="arw"></span>
      <span class="node out">text</span>
    </div>
  </div>
  <div class="diagram-cap">Image and text both become tokens the decoder attends over — image tokens dominate the count.</div>
</div>
```

- **Vision encoder** — a **ViT (or CNN)** that turns the image into patch embeddings. Runs
  **once per image**. *This is exactly the kind of model you already optimized.*
- **Projector** — a small MLP or resampler mapping vision features into the LLM's token space.
  Tiny; negligible cost.
- **LLM decoder** — a standard LLM that attends over image + text tokens and generates. **All
  of [§13's LLM pages](llm-quantization.md) apply here.**

Examples: LLaVA, Qwen-VL, InternVL, Llama-Vision. Same shape, different sizes.

## Where the cost actually is (the key insight)

**Images become a lot of tokens.** One image can be ~256–576 tokens, and **high-resolution
tiling** (splitting a big image into tiles) pushes it into the **thousands**. Because those
tokens all go into the decoder's prefill and KV cache:

- **Prefill dominates** — TTFT is driven by processing a huge image-token sequence, not by the
  short text prompt. VLMs are often **prefill-heavy**, unlike text LLMs.
- **KV cache is large** — proportional to those image tokens, so long conversations with images
  get memory-hungry fast.
- **Vision encoder is a one-time cost** per image — meaningful but not the tail if you generate
  many tokens.

So the cost profile is different from a text LLM: **attack the image tokens first.**

## Optimize each stage

| Stage | Lever | Notes |
|---|---|---|
| **Vision encoder** | INT8/FP8 quantize it | It's a ViT/CNN — *your FashionMNIST playbook*: PTQ, per-channel, calibrate, TensorRT. Runs once/image. |
| **Visual tokens** | **token reduction** (pooling, pruning, merging) | **The VLM-specific big win** — fewer image tokens = shorter prefill + smaller KV. |
| **Projector** | ignore | Too small to matter. |
| **LLM decoder** | weight-only INT4 / FP8 / KV-quant | Same as any LLM ([quant page](llm-quantization.md)). |
| **Whole pipeline** | cache image features | Same image reused across turns → encode once, reuse tokens. |

## Visual token reduction (say this one)

The highest-leverage VLM-only optimization: **cut the number of image tokens** before/at the decoder.

Methods:
- **Pooling** — adaptive pooling of patch embeddings.
- **Pruning** — drop low-attention visual tokens.
- **Merging** — combine similar tokens (à la ToMe).
- **Resampler** — a Q-Former / Perceiver that compresses to a fixed small count.

Halving image tokens roughly halves **prefill cost and KV memory** with modest quality loss.
*"On a VLM, before I quantize anything I'd check whether I can halve the visual tokens — it hits
the actual bottleneck, prefill and KV, harder than quantizing the decoder."*

## What's different from a plain LLM

- **Prefill-heavy, not decode-heavy** for short answers → optimize prefill (token reduction,
  FP8 weight+activation), not just decode.
- **Vision tower is quantizable with CV methods** — the part where *your CNN experience is
  directly the answer*.
- **Dynamic resolution / tiling** → variable, often large, token counts → dynamic-shape engines
  matter even more.
- **Two calibration domains** — the vision encoder wants image calibration data; the decoder
  wants text/multimodal calibration.

## 🔗 Connecting the dots: the real stack

Vision tower: **TensorRT** INT8/FP8 (your CV toolchain). Decoder: **TensorRT-LLM / vLLM** with
AWQ/FP8 + KV-quant. Multimodal serving increasingly handled by **vLLM** and **TensorRT-LLM**'s
multimodal paths; token reduction lives in the model/adapter code.

**How you'd say it:** *"A VLM is a vision encoder feeding an LLM decoder. The encoder I'd
quantize like the CNN in my FashionMNIST project — INT8, per-channel, TensorRT. The decoder I'd
treat as an LLM — AWQ INT4 or FP8 with KV-cache quant. But the first thing I'd check is visual
token reduction, because image tokens drive prefill and KV, which is where VLM latency actually
lives."*

## Self-check

- What are a VLM's three stages and which dominates latency? *(vision encoder → projector → LLM
  decoder; image tokens make **prefill** (and KV) dominate.)*
- Which part maps directly to your CNN experience? *(the vision encoder — a ViT/CNN you quantize
  with the same PTQ/TensorRT playbook.)*
- What's the VLM-specific optimization with no LLM/CNN analog? *(visual token reduction —
  pool/prune/merge image tokens to shrink prefill + KV.)*
- Why are VLMs often prefill-heavy? *(one image = hundreds–thousands of tokens processed up
  front, dwarfing a short text prompt and a short answer.)*
