# Production Monitoring: Interview Questions

## Q: How would you evaluate an LLM beyond simple accuracy?

Accuracy assumes one right answer; generation usually doesn't have one. So you
split evaluation into signals that need different machinery:

- **Faithfulness / groundedness** — does the answer follow *only* from the
  retrieved context, with no invented claims? This is the RAG-specific one, and
  it's what a RAGAS/DeepEval-style harness scores.
- **Answer relevance** — does it actually address the question asked.
- **Retrieval quality** — Hit@k / MRR / recall@k, measured separately, because
  a bad answer from good retrieval and a bad answer from bad retrieval need
  different fixes.
- **Cost and latency** — always part of "how good is this in production," not a
  separate concern.

The structural point interviewers want: quality, unlike cost and latency,
**isn't visible in a single request's logs** — it needs a *reference*. That's
either human review (doesn't scale) or an **LLM-as-judge** (RAGAS-style). And a
judge is itself a model call with its own cost and its own ways of being wrong.
That asymmetry is why quality eval is a genuinely harder, separate phase rather
than something you bolt onto basic logging.

---

## Q: What signals do you monitor for a GenAI app in production?

Four, and treating them as one "dashboard" is how real incidents go unnoticed:

| Signal | Visible from one request? | Needs a reference? | Tooling |
|---|---|---|---|
| **Cost** | ✅ tokens × price | ❌ | Langfuse / provider dashboards |
| **Latency** | ✅ timers | ❌ (percentiles need volume) | Langfuse / APM |
| **Quality** | ❌ | ✅ golden set + judge | RAGAS / DeepEval on a schedule |
| **Drift** | ❌ | ✅ baseline over time | eval history + traffic stats |

Cost and latency fall out of any request's logs. Quality needs an eval signal.
Drift needs a baseline to compare against over time. They're four different
axes, not four tiles on the same chart.

---

## Q: Why track percentiles instead of average latency?

Because the mean hides the incident. A p50 can sit at a healthy 800ms while p99
is at 8s — 1% of users waiting 10× longer, often because they hit the reranker
or a cold model load. A flat p50 chart while p99 climbs is the single most
common way a regression goes unnoticed until users complain.

Track **p50/p95/p99**, and break latency down **by stage** — retrieval vs
generation — the same way you'd break a benchmark down by index type. "The query
took 2s" tells you nothing about *where* the 2s went, and optimizing the wrong
side is a week wasted. In a RAG pipeline the split is stark: retrieval is
sub-millisecond, the LLM call is seconds.

---

## Q: What is drift and why does monitoring depend on your eval set?

Two kinds, worth naming separately:

- **Data drift** — your *inputs* change: new question topics, different
  phrasing, a corpus that grew.
- **Model drift** — the *model's behavior* changes under you: a provider
  silently updates the model behind the API, or an on-disk model file changes.
  No code change on your side, different answers anyway.

Both are invisible unless you compare production traffic and eval scores against
a **baseline over time** — not just at launch. That's the dependency teams
discover too late: drift detection needs a stable baseline to drift *from*. The
eval set isn't a one-time validation gate, it's the reference point ongoing
monitoring compares against. Skip building eval now and monitoring later has
nothing to measure drift against.

---

## Q: How do you monitor and debug an agent specifically?

Agents raise the stakes on cost and observability. A single agent loop
multiplies LLM calls per question, so **cost-per-question and cost-per-call
diverge** — track both, or a runaway loop (retrying too many times, pulling a
huge context) looks like ordinary traffic growth inside an average. Track cost
*per request*, not just monthly totals, so the outlier is attributable to a
specific query pattern.

For debugging, the control flow has to be traceable — which node ran, what the
model decided, where it went next (this is exactly why an explicit graph like
LangGraph beats logic hidden in functions). Emit a lightweight event from the
pipeline's query call site — `{latency_ms, tokens_in/out, model,
retrieval_mode}` — to an LLM-observability tool like Langfuse that understands
tokens, cost, and prompt versions natively, rather than generic app logs.

---

## Q: How do you know your monitoring actually catches problems?

**Fire-test it** — inject a known regression and confirm the dashboards flag it.
Swap in a deliberately worse model or a corrupted/mangled index, re-run the
golden set, and verify the quality score visibly drops. If it doesn't, the
monitoring — not the pipeline — is what's broken.

It's the same logic as testing backups by restoring them: the artifact isn't
the dashboard, it's the *demonstrated detection*. Monitoring you haven't
fire-tested is a false sense of safety, and "I injected a regression and watched
the dashboard catch it" is a far stronger interview answer than "we have a
Langfuse dashboard."
