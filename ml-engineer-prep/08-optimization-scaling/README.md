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

## The three pages

- **Quantization, pruning, distillation** — shrinking the model itself.
- **Distributed training** — scaling the training side (a companion to section 3).
- **Inference & serving optimization** — batching, caching, and serving tricks that cut
  latency and cost.

## The mental split

```
make the MODEL cheaper        make the SYSTEM scale
 quantization (lower precision) distributed training (more GPUs)
 pruning (remove weights)       batching (more per GPU pass)
 distillation (small student)   caching (skip recompute)
                                autoscaling (match load, §7)
```

→ Start: **[model-compression.md](model-compression.md)**
