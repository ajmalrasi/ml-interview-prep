# LLMOps & Evaluation

**TL;DR:** Running LLMs in production adds new problems on top of normal MLOps: they're
**expensive** (pay per token), **slow** (generate token by token), **non-deterministic**,
and can **hallucinate** or be misused. LLMOps is how you serve them affordably and safely,
and **evaluation** is uniquely hard because there's rarely one "correct" output.

## What's different about serving LLMs

- **Cost per token** — you pay for input + output tokens (API) or big GPUs (self-hosted),
  so cost scales with prompt and response length. Long RAG contexts get expensive fast.
- **Latency** — generation is sequential (token by token), so responses stream; you
  optimize with techniques like **KV caching**, batching, and smaller/quantized models
  (section 8).
- **Non-determinism** — the same prompt can give different answers, which complicates
  testing and caching.

## Cost & latency levers (name a few)

Prompt-caching and **semantic caching** (reuse answers for similar questions), routing easy
queries to a **smaller/cheaper model** and hard ones to a big one, trimming prompt/context
length, quantization and optimized runtimes (vLLM, TGI, TensorRT-LLM) for self-hosting, and
capping max output tokens. The instinct is the same as any serving optimization: cut tokens
and compute without hurting quality.

## Guardrails & safety

Because LLMs generate open-ended text, production apps wrap them in guardrails: **input
filtering** (block prompt-injection and abuse), **output filtering** (toxicity, PII,
format validation), grounding via RAG to reduce hallucination, and **human-in-the-loop**
for high-stakes actions. "The model is one component inside a system with guardrails" is
the mature framing.

## The evaluation problem

For a classifier you have accuracy; for generated text there's usually **no single correct
answer**, which makes evaluation the hardest part. Approaches, combined in practice:

- **Human evaluation** — people rate outputs; the gold standard but slow and costly.
- **LLM-as-a-judge** — use a strong model to score outputs against a rubric; scalable,
  increasingly common, but must itself be validated.
- **Reference-based metrics** — BLEU/ROUGE (overlap with a reference) for summarization/
  translation; limited but cheap.
- **Task-specific checks** — for structured output, just validate it (does the JSON parse?
  is the answer in the retrieved docs?); for RAG, measure **groundedness** (is the answer
  supported by sources?) and retrieval quality.

The honest answer to "how do you evaluate an LLM app?": *"a mix — automated checks and
LLM-as-judge for scale on every change, plus periodic human review, and for RAG I
specifically measure groundedness and retrieval relevance, not just fluency."*

## 🔗 Connecting the dots — the real stack

**Serving:** **vLLM** / **TGI**. **Evaluation:** **Ragas** (RAG groundedness/retrieval), **DeepEval**, **TruLens**, **LangSmith** / **Langfuse** / **Arize Phoenix** (tracing + eval). **Guardrails:** **Guardrails AI**, **NeMo Guardrails**. **Observability:** LangSmith / Langfuse trace every prompt, token, and cost.

**How you'd say it:** *"Every LLM call was traced in Langfuse for cost and latency; RAG quality was scored with Ragas on each change; Guardrails validated output format and blocked injection."*

## Self-check

- Three things that make LLM serving harder than normal model serving? *(cost per token,
  token-by-token latency, non-determinism, hallucination — any three.)*
- Two ways to cut LLM cost? *(caching, route to smaller models, trim context, cap output,
  quantize/optimized runtime — any two.)*
- Why is evaluating generated text hard, and one approach? *(no single correct answer;
  human eval, LLM-as-judge, or task-specific checks like groundedness.)*
