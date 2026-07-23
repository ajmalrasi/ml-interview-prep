# Sparsity, Pruning & Distillation

**TL;DR:** Three ways to shrink the model itself rather than the number format.
**Pruning** removes weights; **structured 2:4 sparsity** is the pruning pattern NVIDIA
hardware can actually accelerate; **distillation** trains a small student to copy a big
teacher. Quantization (previous pages) is usually the first reach; these are how you get a
*fundamentally* smaller or sparser model.

## Pruning: unstructured vs structured

- **Unstructured pruning** — zero out individual low-magnitude weights anywhere. You can
  reach very high sparsity with little accuracy loss, **but a random scatter of zeros doesn't
  speed up dense GPU kernels** — the hardware still multiplies by zero. It only helps if you
  have sparse kernels or you're compressing for storage/transfer.
- **Structured pruning** — remove whole **channels, filters, or heads**. This shrinks the
  actual tensor dimensions, so *any* dense kernel gets faster — no special hardware needed.
  The cost is it's coarser, so it usually needs fine-tuning to recover accuracy.

The one-liner: *"Unstructured prunes more but doesn't speed up dense GPUs; structured prunes
less but actually shrinks the compute. I'd pick structured for latency, then fine-tune."*

## 2:4 structured sparsity (the NVIDIA-specific one)

Ampere (A100) and newer have **sparse tensor cores** that accelerate a specific pattern:
**in every contiguous group of 4 weights, at most 2 are non-zero** (aka "2:4" or
fine-grained structured sparsity). The hardware stores only the 2 non-zeros + a 2-bit index
and skips the zeros, giving **up to 2× matmul throughput**.

```rawhtml
<div class="compare">
  <div class="cmp-col">
    <div class="cmp-h">Dense</div>
    <p><span class="fexpr">[ w0 w1 w2 w3 ]</span></p>
    <span class="cmp-tag">4 multiplies</span>
  </div>
  <div class="cmp-col accent">
    <div class="cmp-h">2:4 structured sparse</div>
    <p><span class="fexpr">[ w0 <span class="fv">0</span> w2 <span class="fv">0</span> ]</span></p>
    <span class="cmp-tag">2 multiplies on sparse tensor cores · ≈2×</span>
  </div>
</div>
```

**Workflow:** train dense → prune to the 2:4 mask → **fine-tune** to recover accuracy → run on
sparse tensor cores (TensorRT + `apex`/`ASP` support it).

**Why it matters:** it's the rare pruning scheme with a **guaranteed hardware speedup**, so it's
a likely question. Know that it's **50% structured**, needs a fine-tune step, and stacks with INT8/FP8.

## Knowledge distillation

Train a large accurate **teacher**, then train a small **student** to match the teacher's
**soft outputs** — the full probability distribution, "softened" by a temperature `T` — not
just the hard labels.

Why soft targets help: they carry **dark knowledge** — how the teacher spreads probability
across classes ("this 4 looks a bit like a 9") — which is far richer supervision than a one-hot label.

```rawhtml
<div class="formula">
  <div class="frow"><span class="fexpr">loss = <span class="fv">α</span> · CE(student, hard_labels) + (1−<span class="fv">α</span>) · <span class="fv">T²</span> · KL(student_T ‖ teacher_T)</span></div>
  <div class="frow"><span class="fnote">hard-label term + temperature-softened distillation term</span></div>
</div>
```

- **Temperature `T`>1** softens both distributions so small logit differences matter; the
  `T²` term keeps gradient magnitudes comparable.
- Variants: **response-based** (match logits, above), **feature-based** (match intermediate
  activations), **relation-based** (match relationships between layers/samples).
- This is how DistilBERT, TinyBERT, and most on-device models are made — and how big LLMs are
  distilled into small deployable ones.

## Choosing and stacking

They're complementary, and the standard production recipe stacks them:

```rawhtml
<div class="diagram">
  <div class="vflow">
    <span class="node">distill<span class="nsub">smaller architecture — a fundamental size cut</span></span>
    <span class="varw"></span>
    <span class="node">prune <span class="nsub">2:4 structured — fewer effective weights, hardware-accelerated</span></span>
    <span class="varw"></span>
    <span class="node">quantize <span class="nsub">INT8 / FP8 — cheaper per-op</span></span>
    <span class="varw"></span>
    <span class="node out">compile <span class="nsub">TensorRT — fuse + pick kernels for the target GPU</span></span>
  </div>
  <div class="diagram-cap">Stack them: each stage compounds the last for a smaller, faster model.</div>
</div>
```

The instinct to voice: *"Quantization first — cheapest big win. Distillation when I need a
genuinely smaller model, not just cheaper ops. Structured/2:4 pruning when I want hardware
speedup and can fine-tune. Always re-measure accuracy after each step, and compile last."*

## 🔗 Connecting the dots: the real stack

**PyTorch** `torch.nn.utils.prune`, NVIDIA **ASP / apex** for 2:4, **TensorRT** to run
sparse+INT8 engines; **HuggingFace** for distillation (DistilBERT). NVIDIA
**TensorRT-Model-Optimizer** bundles quantization + sparsity + distillation in one toolkit —
worth naming as "the NVIDIA way to combine all of these."

**How you'd say it:** *"Beyond the quantization in my project, the next levers are structured
2:4 sparsity for a real hardware 2× on Ampere+, and distillation if I need a smaller
architecture rather than a cheaper one — all stackable, all followed by an accuracy re-check
and a TensorRT compile."*

## Self-check

- Why doesn't unstructured pruning speed up a normal GPU? *(scattered zeros still go through
  dense kernels; you need sparse kernels/hardware or structured pruning.)*
- What is 2:4 sparsity and what does it buy? *(≤2 non-zeros per group of 4 → sparse tensor
  cores skip the zeros for up to 2× matmul, after a fine-tune.)*
- Why do soft targets beat hard labels in distillation? *("dark knowledge" — the teacher's
  probability spread across classes is richer supervision than one-hot.)*
- What order would you stack these techniques? *(distill → prune → quantize → compile,
  re-measuring accuracy each step.)*
