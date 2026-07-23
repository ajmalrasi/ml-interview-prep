# Transformers & How LLMs Work

**TL;DR:** An LLM is a very large transformer trained to **predict the next token** over
huge amounts of text. Its superpower is **attention**, which lets it weigh how every word
relates to every other. That simple objective, at scale, produces the fluent, general
behavior we see.

## Tokens and next-token prediction

LLMs don't see words or letters — they see **tokens** (word pieces). The model is trained
on one deceptively simple task: given the tokens so far, **predict the next token**. Do
that over trillions of tokens of text and, to get good at it, the model has to implicitly
learn grammar, facts, reasoning patterns, and style. At generation time it predicts a
token, appends it, and repeats — that's "autoregressive" generation.

A knob to know: **temperature** controls randomness of that next-token choice — low = more
deterministic/factual, high = more creative/varied.

## Attention (the core idea)

The transformer's key mechanism is **self-attention**: for each token, the model computes
how much every *other* token should influence it, and blends them accordingly. This lets
it capture long-range relationships ("it" refers to which noun?) and, unlike older RNNs,
process the whole sequence **in parallel** — which is exactly why transformers scale to
huge models and datasets.

```rawhtml
<div class="example">
  <span class="ex-q">"The cat sat on the mat because <span class="hl">it</span> was tired"</span>
  <span class="ex-a">Attention lets <b>"it"</b> look back and weight <span class="hl">"cat"</span> strongly → resolving the reference.</span>
</div>
```

You don't need the matrix math for most interviews — you need "attention weighs the
relationship between all pairs of tokens, in parallel, which is why transformers scale."

## Context window

The **context window** is how many tokens the model can consider at once (its working
memory). Everything — your prompt, retrieved documents, the conversation — must fit. It's a
real constraint that shapes design (it's *why* RAG chunks documents, next page) and a cost
driver (more tokens = more compute).

## Why they're called "foundation models"

A single pretrained LLM can be adapted to many tasks (summarize, classify, code, chat)
without training a new model each time — via prompting or light fine-tuning. That
generality is why they're "foundation" models and why the practical skill is *adapting*
them (next pages), not training them from scratch (almost no one does that).

## 🔗 Connecting the dots: the real stack

You either call a **hosted API** (**OpenAI**, **Anthropic**, **Cohere**) or run an **open model** (**Llama**, **Mistral**, **Qwen**) via **HuggingFace Transformers**; tokenization is **tiktoken** or HF tokenizers. Self-hosting for throughput uses **vLLM** or **TGI** (see §8).

**How you'd say it:** *"For a prototype I'd call the Anthropic API; for cost or data-privacy at scale I'd self-host a Llama/Mistral model on vLLM."*

## Self-check

- What task are LLMs trained on? *(next-token prediction over massive text.)*
- What does attention do, in one line? *(weighs how every token relates to every other,
  in parallel — enabling long-range context and scale.)*
- What is the context window and why does it matter? *(the max tokens the model can
  consider at once; constrains prompts/RAG and drives cost.)*
