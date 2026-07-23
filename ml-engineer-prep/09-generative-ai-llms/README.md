# 9: Generative AI & LLMs

**TL;DR:** The JD's "staying up to date, including Generative AI." Every team asks about
this now, even non-LLM roles. You need: how transformers/LLMs work at a high level, the
practical ways to *use* them (prompting, **RAG**, fine-tuning), and how you run them in
production (LLMOps and evaluation). This is the newest, most-asked section.

## Why it matters even if the role isn't "LLM"

Generative AI has become table stakes — interviewers want to see you understand it well
enough to make sound build decisions, not just that you've heard the buzzwords. The most
valuable thing you can show is **judgment**: when to prompt, when to add retrieval, when
to fine-tune, and how to keep an LLM app reliable and affordable.

## The four pages

- **Transformers & how LLMs work** — attention, tokens, and what "predict the next token"
  really means.
- **Prompting & RAG** — the two most common ways to get an LLM to do your task without
  training it.
- **Fine-tuning & PEFT (LoRA)** — when and how to actually adapt a model's weights.
- **LLMOps & evaluation** — serving, cost, guardrails, and the hard problem of evaluating
  generated text.

## The decision spine (hold this in your head)

```rawhtml
<div class="diagram">
  <table class="maptable">
    <thead><tr><th>Need the LLM to do X?</th><th class="marw"></th><th>Reach for…</th></tr></thead>
    <tbody>
      <tr><td class="mfrom">start here</td><td class="marw"></td><td class="mto"><b>PROMPTING</b> — cheapest, fastest</td></tr>
      <tr><td class="mfrom">needs your private / fresh knowledge</td><td class="marw"></td><td class="mto">add <b>RAG</b> (retrieval)</td></tr>
      <tr><td class="mfrom">needs a style / behavior prompting can't get</td><td class="marw"></td><td class="mto"><b>FINE-TUNE</b></td></tr>
    </tbody>
  </table>
</div>
```

→ Start: **[transformers-and-llms.md](transformers-and-llms.md)**
