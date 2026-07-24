# Responsible RAG and Bias — Check Who the System Fails

**TL;DR:** RAG can be biased even when the LLM is unchanged. The corpus may
underrepresent a group, metadata may be missing, retrieval may rank majority
language higher, or a feedback loop may amplify popular answers. Evaluate each
pipeline stage by relevant cohorts, investigate gaps, and keep hard security
and human-review boundaries.

## Where bias enters RAG

RAG does not remove bias; it changes where bias can appear.

| Layer | Example risk |
|---|---|
| Corpus | Some regions, languages, products, or historical periods have fewer documents |
| Extraction | OCR performs worse on a script, scan type, or document template |
| Metadata | Missing or inconsistent tags exclude one cohort during filtering |
| Embeddings | Equivalent queries in one language retrieve weaker matches |
| Ranking | Frequently cited or majority sources repeatedly outrank alternatives |
| Generation | The LLM generalizes beyond evidence or uses harmful stereotypes |
| Feedback | Popular users or high-volume teams dominate improvement data |

The first question is therefore not “Is the model biased?” It is:

> **At which pipeline stage does the quality gap first appear?**

## A concrete example

Imagine a support RAG system with excellent overall Recall@5. Most evaluation
questions are English, while a small but important user group asks equivalent
questions in Malayalam.

An overall score can look healthy while Malayalam retrieval regularly misses
the correct policy. Improving the generation prompt will not repair missing
evidence. The correct investigation starts with corpus coverage, extraction,
language metadata, embeddings, hybrid retrieval, and ranking by language
cohort.

## Build a cohort-aware evaluation

Choose cohorts from the real domain and risk assessment, not because a metric
dashboard happens to support them. Examples include language, geography,
document format, product type, time period, source organization, accessibility
need, or legally protected groups when collection and use are appropriate.

Compare pipeline metrics:

### Ingestion and coverage

- document and field coverage
- extraction/OCR error rate
- freshness and deletion compliance
- missing-metadata rate

### Retrieval

- Recall@K, MRR, and NDCG by cohort
- zero-result and abstention rate
- relevant-source diversity
- performance on equivalent or counterfactual queries

### Generation

- faithfulness and citation correctness
- unsupported-claim rate
- harmful-stereotype or policy-violation rate
- expert-rated usefulness

### Operations

- p95 latency and error rate
- human-escalation access and resolution quality
- feedback collection rate

A gap is a signal to investigate, not automatic proof of discrimination.
Different cohorts can have different source coverage, question difficulty, or
legitimate policy rules. Examine the cause and involve domain, legal, privacy,
and affected stakeholders where appropriate.

## Counterfactual testing

Create paired questions that preserve intent while changing only a relevant
attribute:

```text
"What parental leave applies to employee A in region X?"
"What parental leave applies to employee B in region X?"
```

The expected answer may be equal—or legitimately different because policy
eligibility differs. Define that expectation before scoring. Counterfactual
testing is useful only when the comparison respects real policy and context.

For multilingual retrieval, use meaning-equivalent queries and check whether
they reach the same authoritative evidence, not whether the final wording is
identical.

## Controls by pipeline stage

- Audit whether authoritative sources are present and fresh.
- Measure parsers and OCR across formats and languages.
- Preserve provenance, dates, and source authority in metadata.
- Use hybrid retrieval when exact terms and semantic language both matter.
- Calibrate ranking and abstention thresholds by validated risk cohort where
  appropriate.
- Require claim-level citations and allow users to inspect evidence.
- Route high-impact or low-confidence decisions to qualified humans.
- Redact sensitive data and restrict who may view fairness audit datasets.
- Document intended use, excluded use, known limitations, and rollback owners.

A prompt saying “be fair” is not a control for corpus gaps, broken OCR, or
unequal retrieval.

## Fairness does not override authorization

Never broaden a user's search permissions to improve a fairness metric.
Security filters remain deterministic and apply before retrieval. Evaluate
quality **within content each cohort is legitimately allowed to access**.

Likewise, avoid logging protected or sensitive attributes casually. Collect
only what is justified, protect it, define retention, and prefer privacy-safe
aggregation where individual data is unnecessary.

## Feedback bias and popularity loops

If frequently active users produce most feedback, their vocabulary and needs
can dominate the next evaluation or training set. Then the system improves for
the already well-served group and falls further behind elsewhere.

Control this by:

- sampling feedback across defined cohorts and failure modes
- tracking whose feedback is missing
- using reviewed quality labels rather than raw engagement
- preserving a balanced held-out regression suite
- monitoring cohort metrics after canary release

## Release checklist

Before promotion:

1. Define intended users, decisions, and prohibited use.
2. Audit source coverage and authority.
3. Run retrieval and generation metrics by important cohort.
4. Review the largest and highest-impact gaps.
5. Pass privacy, authorization, injection, and leakage tests.
6. Provide citations, abstention, human escalation, and rollback.
7. Record dataset, index, retriever, prompt, and model versions.
8. Monitor both overall and cohort regressions after release.

## 🎯 Interview answer

> “I evaluate responsible RAG stage by stage. I first measure corpus and
> extraction coverage, then Recall@K and ranking by relevant cohort, and only
> then generation faithfulness and harmful-output checks. I investigate gaps
> with domain stakeholders, use counterfactual tests where expectations are
> well defined, and keep authorization fixed. Controls include authoritative
> provenance, citations, abstention, human escalation, privacy-safe audit data,
> canary gates, and rollback.”

→ Next: **[Advanced Production RAG Interview Questions](interview-questions.md)**
