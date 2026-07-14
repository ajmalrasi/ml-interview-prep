# 13 — LLM & VLM Optimization

**TL;DR:** Your FashionMNIST project was a **CNN**. The same optimization *loop* —
baseline → quantize → serve → compare — absolutely applies to **LLMs** and **VLMs**, but
the details flip: LLM inference is **memory-bound** not compute-bound, activations have
**outliers** that break naive INT8, models are too big to retrain (so **PTQ and weight-only
INT4 dominate**), and you measure **perplexity and tokens/sec**, not top-1 accuracy. This
section maps your CNN skills onto that world.

## Does the CNN loop transfer? Yes — with three twists

The **method / format / engine** mental model from [§12](../12-nvidia-model-optimization/README.md)
carries over unchanged. What changes is *which choices win*:

```rawhtml
<div class="diagram">
  <table class="maptable">
    <thead><tr><th>CNN (your project)</th><th class="marw"></th><th>LLM / VLM — which choice wins</th></tr></thead>
    <tbody>
      <tr><td class="mfrom">INT8, compute-bound</td><td class="marw"></td><td class="mto">memory-bound decode → weight-only INT4 shines</td></tr>
      <tr><td class="mfrom">PTQ + QAT both practical</td><td class="marw"></td><td class="mto">PTQ / weight-only; QAT too costly (QLoRA instead)</td></tr>
      <tr><td class="mfrom">clean INT8 activations</td><td class="marw"></td><td class="mto">activation outliers → need SmoothQuant / AWQ</td></tr>
      <tr><td class="mfrom">top-1 accuracy</td><td class="marw"></td><td class="mto">perplexity + task benchmarks (MMLU…)</td></tr>
      <tr><td class="mfrom">fixed input size</td><td class="marw"></td><td class="mto">variable seq length + a KV cache to manage</td></tr>
      <tr><td class="mfrom">TensorRT engine</td><td class="marw"></td><td class="mto">TensorRT-LLM / vLLM / llama.cpp</td></tr>
    </tbody>
  </table>
</div>
```

## What each page covers

| Page | The question it answers |
|---|---|
| CNN → LLM/VLM | "My experiment was a CNN — what transfers and what breaks?" |
| LLM Quantization | "Weight-only INT4 vs W8A8/FP8, GPTQ/AWQ/SmoothQuant, KV-cache quant." |
| The Loop in Practice | "How would you actually run baseline→quantize→serve→compare for an LLM?" |
| Serving Architecture | "Where does the inference engine sit — Deployment vs Job vs serverless, and how do I not pay for an idle GPU?" |
| VLM Optimization | "A vision-language model has a vision tower *and* an LLM — optimize which, how?" |
| Experiment Redo | "Redo my FashionMNIST table as an LLM/VLM project." |
| Interview Q&A | Rapid-fire drill. |

## Why VLMs are the natural bridge for you

A VLM is literally **your CNN skills + an LLM stapled together**: a vision encoder (a ViT/CNN
— exactly the model you already optimized) feeds a language decoder. So you can say *"the
vision tower I'd quantize the way I did my FashionMNIST CNN; the decoder I'd treat as an
LLM"* — one sentence that shows both halves of your experience. That's the page to land.

→ Start: **[cnn-to-llm.md](cnn-to-llm.md)**
