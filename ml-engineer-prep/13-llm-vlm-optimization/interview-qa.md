# Interview Q&A — LLM & VLM Rapid Fire

**TL;DR:** Last-mile drill for applying the optimization loop to LLMs and VLMs. Cover the
answer, say the 30-second version out loud, then check. Grouped: bridge → LLM quant → serving →
VLM → the story.

## The CNN bridge

**Q: Your experiment was a CNN — does the same optimization loop apply to LLMs?**
Yes — baseline → quantize → serve → compare is identical, and so is the method/format/engine
framing. What flips: LLM decode is memory-bound (so weight-only INT4 wins, not INT8 compute),
activations have outliers (need SmoothQuant/AWQ), models are too big to QAT (use PTQ/QLoRA), and
quality is perplexity + benchmarks, not top-1.

**Q: Why is weight-only INT4 the big lever for LLMs but wasn't obvious for your CNN?**
LLM decode re-reads every weight from memory per token with little math — it's
bandwidth-bound, so cutting weight bytes speeds it up directly. Your CNN was compute-bound, so
INT8 helped the math, not memory.

**Q: Why does plain per-tensor INT8 PTQ that worked on your CNN fail on an LLM?**
Transformer activations have a few huge outlier channels; a per-tensor scale must cover them,
crushing normal values into a few codes. SmoothQuant (shift difficulty into weights) or AWQ
(protect salient channels) fix it.

**Q: You can't afford QAT on a 7B model — what do you do instead?**
PTQ/weight-only methods that need only a small calibration set, and QLoRA — train small LoRA
adapters on a frozen 4-bit (NF4) base — for cheap task-specific recovery.

## LLM quantization

**Q: Weight-only vs weight+activation — pick one, when?**
Weight-only (INT4, AWQ/GPTQ) when memory- or VRAM-bound, which decode usually is.
Weight+activation (INT8/FP8) when prefill/throughput dominates and you can handle outliers —
FP8 on Hopper is the sweet spot.

**Q: GPTQ vs AWQ in a sentence each.**
GPTQ: second-order, Hessian-based layer-wise rounding that compensates remaining weights for
quantization error. AWQ: scale up the ~1% of weight channels that matter most (by activation
magnitude) before INT4 so they aren't crushed — no backprop, fast.

**Q: What is group-wise quantization and why do LLMs use it?**
A separate scale per group of N weights (e.g. 128) instead of per whole channel — finer
granularity that keeps INT4 accurate. GGUF k-quants are group-wise.

**Q: Why and how would you quantize the KV cache?**
At long context/large batch it can exceed the weights. INT8/FP8 KV roughly halves it → longer
context or bigger batches. Keys are sometimes kept higher-precision than values.

**Q: How do you measure LLM quality after quantizing — and the trap?**
Perplexity on held-out text (fast) plus task benchmarks (MMLU, GSM8K, HumanEval) via
lm-eval-harness. Trap: a 4-bit model can hold perplexity but drop on reasoning/long-context, so
test the tasks you care about.

**Q: What's QLoRA, concretely?**
Freeze the base model in 4-bit NF4, add trainable LoRA adapters in higher precision, fine-tune
only those. QAT-like recovery at a fraction of the cost; serve the base once and swap adapters.

## Serving & performance

**Q: Why does an LLM report two latencies?**
Prefill (TTFT) processes the whole prompt in parallel — compute-bound. Decode (TPOT) generates
one token at a time — memory-bound. Different optimizations, so you measure and report both.

**Q: Name the LLM serving runtimes and when each.**
TensorRT-LLM (best on NVIDIA — fused kernels, FP8, in-flight batching, served via Triton);
vLLM (PagedAttention + continuous batching, easy high throughput); llama.cpp (GGUF on
CPU/edge/Apple Silicon).

**Q: What is continuous / in-flight batching and why does it matter?**
Schedule at the token level so finished sequences are replaced immediately and new requests join
mid-flight — keeps the GPU saturated instead of waiting for a batch's slowest sequence. Biggest
throughput lever for real traffic.

**Q: How would you correctly benchmark an LLM's speed?**
Warm up, separate TTFT from per-token, sweep batch size and sequence length (throughput is
meaningless without them), report p50/p99. Tools: genai-perf / trtllm-bench / vLLM benchmarks.

## VLM

**Q: What are a VLM's parts and where's the cost?**
Vision encoder (ViT/CNN) → projector (small MLP) → LLM decoder. Cost: images become
hundreds–thousands of tokens, so prefill and the KV cache dominate; the encoder is a one-time
per-image cost.

**Q: How would you optimize a VLM?**
Quantize the vision encoder like a CNN (INT8, per-channel, TensorRT), treat the decoder as an
LLM (INT4/FP8 + KV-quant), and — first — reduce visual tokens (pool/prune/merge), because image
tokens drive prefill and KV.

**Q: Which part of a VLM maps to your CNN experience?**
The vision encoder — a ViT/CNN I'd quantize with the exact PTQ/TensorRT playbook from my
FashionMNIST project.

**Q: What's the VLM-specific optimization with no LLM or CNN analog?**
Visual token reduction — compress the image-token count with pooling, pruning, merging, or a
resampler, shrinking prefill and KV together.

**Q: Why are VLMs often prefill-heavy while text LLMs are decode-heavy?**
A single image expands to many tokens processed up front, so time-to-first-token is dominated by
prefilling that long visual sequence, not by generating a short answer.

## The story

**Q: Walk me through applying your CNN project to our LLMs/VLMs.**
Same loop and same method-vs-engine framing. For an LLM: FP16 baseline → AWQ/GPTQ INT4
(memory-bound decode) and FP8 (prefill throughput) and KV-quant → served on TensorRT-LLM or
vLLM → judged on perplexity, MMLU, TTFT, tokens/sec. For a VLM: quantize the vision tower with
my CNN toolchain, the decoder as an LLM, and reduce visual tokens first. One loop, three model
families, and I can name why each variant wins.

**Q: Which finding from your CNN project transfers word-for-word?**
"Speed comes from the kernels and architecture, not the weight values." Two INT4 methods
compiled to the same TensorRT-LLM engine run identical kernels — quality differs, latency
doesn't. Exactly my TRT-PTQ vs TRT-QAT result.

**Q: How do you know an LLM optimization actually worked?**
Measure before and after — perplexity + the task benchmarks I care about for quality; TTFT,
tokens/sec, and VRAM swept over batch/seq for speed; profile to confirm the new bottleneck.
Never claim a speedup I didn't measure or ship a quality drop I didn't quantify.
