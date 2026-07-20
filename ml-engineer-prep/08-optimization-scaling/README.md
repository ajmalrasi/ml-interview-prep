# 8 — Optimization & Scaling

**TL;DR:** The JD's "optimize models for speed, efficiency, and scale." Two directions:
make the **model** smaller/faster (quantization, pruning, distillation), and make the
**training and serving** scale (distributed training, batching, caching). The goal is
the same accuracy at lower latency and cost.

## Why optimize at all

A model that's accurate but too slow or too expensive to serve is a failed product.
Optimization is how you fit a good model into a real latency budget and a real cloud
bill. It's also increasingly essential for large models (LLMs, section 9), where naive
serving is prohibitively costly.

## The four pages

- **Quantization, pruning, distillation** — shrinking the model itself.
- **Distributed training** — scaling the training side (a companion to section 3).
- **NCCL & distributed collectives** — all-reduce, all-gather, reduce-scatter,
  topology, overlap, and diagnosing communication bottlenecks.
- **Inference & serving optimization** — batching, caching, and serving tricks that cut
  latency and cost.

## The mental split

```rawhtml
<div class="compare">
  <div class="cmp-col accent">
    <div class="cmp-h">Make the MODEL cheaper</div>
    <ul>
      <li>quantization (lower precision)</li>
      <li>pruning (remove weights)</li>
      <li>distillation (small student)</li>
    </ul>
  </div>
  <div class="cmp-col blue">
    <div class="cmp-h">Make the SYSTEM scale</div>
    <ul>
      <li>distributed training (more GPUs)</li>
      <li>batching (more per GPU pass)</li>
      <li>caching (skip recompute)</li>
      <li>autoscaling (match load, §7)</li>
    </ul>
  </div>
</div>
```

→ Start: **[model-compression.md](model-compression.md)**
