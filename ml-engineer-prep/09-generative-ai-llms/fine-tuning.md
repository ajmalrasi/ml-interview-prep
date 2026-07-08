# Fine-Tuning & PEFT (LoRA)

**TL;DR:** Fine-tuning adapts a pretrained model's *weights* to your task — use it when
prompting and RAG can't get the behavior or style you need. Full fine-tuning is expensive,
so in practice you use **PEFT** methods like **LoRA** that train a tiny fraction of the
parameters for most of the benefit.

## When to fine-tune (and when not to)

Fine-tuning is the heaviest lever, so reach for it last:

- **Prompt first** — free, instant.
- **RAG next** — when the gap is *knowledge* (your facts, fresh data).
- **Fine-tune** — when the gap is *behavior*: a consistent style/format/persona, a
  specialized task, or domain language that prompting can't reliably produce; or to make a
  smaller model match a bigger one's quality on your narrow task (cheaper serving).

A classic mistake is fine-tuning to inject facts — that's RAG's job, and fine-tuning bakes
facts in statically (they go stale and can't be cited). Fine-tune for *how* it responds,
retrieve for *what* it knows.

## Full fine-tuning vs PEFT

**Full fine-tuning** updates *all* the model's billions of weights — powerful but
expensive (lots of GPU memory) and it produces a full copy of the model per task.

**PEFT (parameter-efficient fine-tuning)** freezes the original weights and trains only a
small number of new ones. **LoRA** is the popular method: it injects tiny low-rank
"adapter" matrices into the model and trains only those — often <1% of the parameters —
getting most of full fine-tuning's benefit at a fraction of the cost and memory.
**QLoRA** goes further, fine-tuning on top of a quantized model so it fits on a single GPU.

```
Full FT:  update all N billion weights           → expensive, full copy per task
LoRA:     freeze them, train small adapters (<1%) → cheap, swap adapters per task
```

The bonus: LoRA adapters are small and **swappable** — one base model can serve many tasks
by loading different adapters, which is great for serving economics.

## What you need to fine-tune

Fine-tuning is supervised learning, so you need a **quality dataset** of example
input→output pairs in the format/behavior you want. Data quality matters more than
quantity — a few hundred clean, on-target examples often beat thousands of noisy ones. This
is the real work of fine-tuning; the training itself is largely a solved recipe.

## 🔗 Connecting the dots — the real stack

The stack is **HuggingFace PEFT** (LoRA/QLoRA), **bitsandbytes** (4-bit for QLoRA), **TRL** (SFT/RLHF trainers), and wrappers like **Axolotl** or **Unsloth** that make it a config file. Adapters register in **MLflow / HuggingFace Hub** and serve on **vLLM** (which can hot-swap LoRA adapters).

**How you'd say it:** *"To adapt a model's behavior I'd QLoRA-fine-tune with PEFT + bitsandbytes on a single GPU using Axolotl, then serve the base model with the LoRA adapter on vLLM."*

## Self-check

- When fine-tune instead of RAG? *(when you need specific behavior/style/format, not just
  facts — RAG handles knowledge.)*
- What does LoRA do? *(freezes the base model, trains tiny low-rank adapters (<1% of
  params) — cheap, swappable per task.)*
- What matters most for a fine-tuning dataset? *(quality and on-target formatting of the
  input→output examples, over sheer quantity.)*
