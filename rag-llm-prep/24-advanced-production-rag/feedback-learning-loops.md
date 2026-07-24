# Feedback and Learning Loops — Improve the Right Layer

**TL;DR:** User feedback is a diagnostic signal, not automatic training data.
Redact and review it, locate the failing pipeline stage, add an adjudicated
example to a future evaluation set, fix the cheapest responsible layer, and
release only after offline and canary checks pass.

## The safe improvement loop

```rawhtml
<div class="diagram">
  <div class="flow"><span class="node data">feedback + traces</span><span class="arw"></span><span class="node">redact & review</span><span class="arw"></span><span class="node">label failure stage</span><span class="arw"></span><span class="node">offline eval</span><span class="arw"></span><span class="node">canary</span><span class="arw"></span><span class="node out">monitor</span></div>
</div>
```

The system should **learn through controlled engineering changes**, not update
itself immediately after every thumbs-down.

## Three kinds of signal

### Explicit feedback

- thumbs up/down
- “this citation is wrong”
- corrected answer supplied by a domain expert
- a selected failure reason

Explicit does not mean correct. Users misunderstand questions, disagree, make
mistakes, and sometimes attack systems.

### Implicit behavior

- reformulating the same question
- opening a cited source
- abandoning the session
- copying or accepting an answer

These signals are ambiguous. A source click might mean trust—or suspicion.
Never turn one behavior directly into a label without validation.

### Operational evidence

- low retrieval margin
- empty or repeated retrieval
- abstention
- invalid citations
- high latency or token usage
- policy or authorization rejection

Operational signals are excellent for sampling cases that deserve review.

## Localize the failure first

| Observed failure | Likely layer | First fix to test |
|---|---|---|
| Correct source was never indexed | Ingestion | Parser, normalization, metadata |
| Correct source exists but was not retrieved | Retrieval | Chunking, filters, embedding, hybrid search |
| Correct chunk ranked too low | Ranking | Fusion weights, reranker, top-k |
| Evidence is correct but answer is unsupported | Generation | Prompt, context layout, citation validation |
| Answer is good but too slow | Serving | Budgets, cache, batching, smaller model |
| One cohort repeatedly fails | Data/evaluation | Coverage audit and cohort-specific diagnosis |

Fine-tuning is near the end of this decision order. Do not train a model to
compensate for a broken parser or an authorization filter.

## Build trustworthy examples

For every selected case:

1. Remove or tokenize PII and secrets.
2. Retain safe trace identifiers, versions, query, retrieved chunk IDs, scores,
   citations, latency, and user signal.
3. Have qualified reviewers label the expected evidence and answer behavior.
4. Resolve reviewer disagreement or record it explicitly.
5. Tag the failure stage and important cohort.
6. Put the example into a **future** evaluation version.

Do not repeatedly tune against the current held-out test set. That silently
turns the test set into a training set and makes progress look better than it
is.

## Evaluation set, tuning set, and training set

| Set | Purpose | Rule |
|---|---|---|
| Training/tuning | Adjust models or configurations | May contain reviewed historical failures |
| Validation | Choose among candidate changes | Separate from final evaluation |
| Held-out regression | Estimate generalization | Do not tune repeatedly against it |
| Safety/red-team | Test abuse, leakage, and policy failures | Keep critical cases stable across releases |

Split related documents and near-duplicate questions together. Otherwise a
paraphrase of the same feedback case can leak across training and evaluation.

## “Continuous” does not mean uncontrolled

A sensible cadence is:

```text
collect → review → version dataset → propose change
        → offline regression → shadow/canary → promote or roll back
```

Automate the pipeline, but retain promotion gates. Online learning that changes
retrieval or model weights immediately from raw user behavior is vulnerable to
feedback poisoning, popularity bias, catastrophic forgetting, and sudden
regressions.

Record these versions for every experiment:

- corpus and index generation
- chunker and parser
- embedding model
- retriever/fusion/reranker configuration
- prompt and generation model
- evaluation dataset

Without versions, a feedback loop produces anecdotes rather than reproducible
improvement.

## Metrics for the loop itself

- reviewed cases per failure stage and cohort
- reviewer agreement
- time from detection to adjudication
- held-out quality change
- critical regression count
- canary rollback rate
- repeat-failure rate after release
- privacy and deletion compliance

## 🎯 Interview answer

> “I treat feedback as untrusted diagnostic input. I sample explicit,
> behavioral, and operational signals; redact them; and have qualified
> reviewers label the expected evidence and failure stage. I fix the earliest
> broken layer, add the case to a versioned future evaluation set, and run
> offline, security, and canary gates. Raw thumbs-down events never fine-tune a
> production model directly.”

→ Next: **[Responsible RAG and Bias](responsible-rag-bias.md)**
