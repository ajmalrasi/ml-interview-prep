# Quantization, Pruning, Distillation

**TL;DR:** Three ways to make a model smaller and faster with minimal accuracy loss.
**Quantization** uses lower-precision numbers; **pruning** removes unimportant weights;
**distillation** trains a small model to mimic a big one. All trade a little accuracy for
a lot of speed and cost savings.

## Quantization

Models train in 32-bit floats (FP32), but you often don't need that precision to run
them. **Quantization** converts weights (and activations) to lower precision — FP16, or
INT8 — which **shrinks the model ~2–4×, speeds up inference, and cuts memory**.

- **FP16 / BF16** — half precision; ~2× faster, negligible accuracy loss; the easy win.
- **INT8** — 8-bit integers; bigger speedup but needs **calibration** and can cost some
  accuracy, so you measure it.
- **PTQ (post-training quantization)** — quantize an already-trained model; fast, no
  retraining, small accuracy hit.
- **QAT (quantization-aware training)** — simulate low precision *during* training so the
  model adapts; recovers accuracy when PTQ drops too much.

This is the most common inference optimization — cheap, broadly applicable, big payoff.

## Pruning

Neural nets are over-parameterized — many weights barely matter. **Pruning** removes the
low-importance weights or whole channels, making the model smaller and (with structured
pruning) faster, then you fine-tune to recover any lost accuracy. Think of it as trimming
dead weight the network doesn't really use.

## Knowledge distillation

Train a **large, accurate "teacher"** model, then train a **small "student"** model to
mimic the teacher's outputs (its soft probabilities carry more information than hard
labels). The student ends up much smaller and faster while keeping most of the teacher's
accuracy. This is how many production and on-device models are made — and how smaller,
cheaper LLMs are derived from big ones (e.g. DistilBERT).

## Choosing / combining

They're complementary and often stacked: distill to a smaller architecture, prune it,
then quantize for deployment. The one-line instinct: *"Quantization first — it's the
cheapest big win. Distillation when I need a fundamentally smaller model. Then compile
with something like TensorRT/ONNX Runtime for the target hardware, always re-measuring
accuracy after."*

## 🔗 Connecting the dots — the real stack

Compilers/runtimes: **TensorRT** and **ONNX Runtime** (fuse ops + quantize for the target hardware), **HuggingFace Optimum** as the bridge, native **PyTorch quantization**. For LLMs specifically: **bitsandbytes** (8/4-bit), **GPTQ / AWQ**, and **llama.cpp / GGUF** for CPU/edge. Distillation uses **HuggingFace** (e.g. DistilBERT).

**How you'd say it:** *"A CV model I'd quantize to INT8 and compile with TensorRT; an LLM I'd 4-bit quantize with bitsandbytes or serve a GGUF build — always re-measuring accuracy after."*

## Self-check

- Quantization in one line, and its cheapest form? *(use lower-precision numbers; FP16 is
  the easy ~2× win.)*
- PTQ vs QAT? *(quantize after training vs simulate low precision during training to
  recover accuracy.)*
- What is knowledge distillation? *(train a small student to mimic a big teacher —
  smaller/faster, keeps most accuracy.)*
