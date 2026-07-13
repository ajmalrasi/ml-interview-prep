# 12 — NVIDIA Model Optimization

**TL;DR:** A focused deep-dive for an **NVIDIA model-optimization interview**. Section 8
covers optimization at ML-engineer altitude; this section goes to the level NVIDIA
actually probes: the **numerics of quantization**, **TensorRT internals**, **GPU
architecture and profiling**, **sparsity**, and **LLM inference**. It also turns your
FashionMNIST quantization experiment into a story you can tell out loud.

## Why a separate section

An NVIDIA model-optimization role (Deep Learning Software Engineer, TensorRT / Model
Optimization, Deep Learning Performance) is not tested like a generic ML-Engineer role.
They assume you can train a model and instead push on: *do you understand what INT8
actually does to the numbers, how TensorRT turns a graph into fast kernels, why a kernel
is memory-bound vs compute-bound, and how you'd prove any of it with a profiler.* This
section is written to survive that follow-up chain of "…and why?"

## What they actually test

| Theme | Page | The question behind it |
|---|---|---|
| Quantization numerics | Quantization, Deeply | "Derive the INT8 scale. Symmetric or asymmetric — why?" |
| GPU number formats | Numerical Precision | "FP16 vs BF16 vs FP8 vs TF32 — when each, and why loss scaling?" |
| TensorRT | TensorRT Internals | "How does TensorRT make it fast? Implicit vs explicit quantization?" |
| Performance analysis | GPU Performance & Profiling | "Is this kernel compute- or memory-bound? Prove it." |
| Model compression | Sparsity, Pruning, Distillation | "What's 2:4 sparsity and why does hardware care?" |
| LLM serving | LLM Inference Optimization | "KV cache, FlashAttention, in-flight batching, TP vs PP." |
| Your project | Experiment Walkthrough | "Walk me through something you optimized." |
| Rapid fire | Interview Q&A | The last-mile drill set. |

## The one mental model to carry in

Optimization lives on **three axes** that interviewers love to see you separate cleanly:

```
  METHOD          →  how you pick int8-friendly weights/scales   (PTQ, QAT, calibration)
  FORMAT          →  which numbers you compute in                (FP32/TF32/FP16/BF16/FP8/INT8/INT4)
  ENGINE          →  where/how the math runs fast                (TensorRT, Triton, CUDA kernels, fusion)
```

Almost every question is really asking you to hold two of these apart. Your own project's
core insight — *"PTQ/QAT is the method axis, TensorRT is the engine axis"* — is exactly
this framing, and it's the thing that makes you sound like you've done it, not read it.

## Suggested order

Read **Quantization, Deeply** and **Numerical Precision** first — everything else builds on
the numerics. Then **TensorRT Internals** and **GPU Performance** (the two hardest
follow-up areas). **Sparsity/Distillation** and **LLM Inference** round out breadth.
Finish on the **Experiment Walkthrough** and **Interview Q&A** to rehearse delivery.

→ Start: **[quantization-deep.md](quantization-deep.md)**
