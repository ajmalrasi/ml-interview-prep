# Multi-Hop Retrieval — Search, Learn, Search Again

**TL;DR:** Multi-hop retrieval is useful when answering a question requires
facts that are connected but not stored in the same chunk. The system retrieves
one fact, uses it to form the next search, and stops after it has enough cited
evidence—or after a strict hop limit.

## The simplest example

Suppose the user asks:

> Which safety procedure applies to the sensor used by Project Aurora?

No chunk contains the complete answer:

1. A project record says **Project Aurora uses sensor AX-14**.
2. A separate equipment manual says **AX-14 requires procedure SP-9**.

A single search may retrieve only the project record. Multi-hop RAG uses the
first result to ask a narrower second question:

```text
Hop 1: "Which sensor does Project Aurora use?"
       → AX-14

Hop 2: "Which safety procedure applies to AX-14?"
       → SP-9

Answer: Project Aurora uses AX-14, which requires SP-9.
        Cite the project record and the equipment manual.
```

The word **hop** means one evidence-gathering step. It does not mean one LLM
token, one vector, or one document.

## Single-hop versus multi-hop

| | Single-hop RAG | Multi-hop RAG |
|---|---|---|
| Retrieval calls | Usually one | Two or more |
| Best for | Direct factual questions | Questions joining connected facts |
| Latency and cost | Lower | Higher |
| Main risk | Missing the best passage | Early mistakes poison later searches |
| Evidence | One result set | A traceable chain of result sets |

Use single-hop by default. Multi-hop is an escalation path for a measured class
of questions, not a replacement for ordinary retrieval.

## Three common patterns

### 1. Query decomposition

Split a complex question into independent subquestions, retrieve them in
parallel, and combine their evidence.

```text
"Compare the retention and encryption rules for Product A"
       ├── What is Product A's retention rule?
       └── What is Product A's encryption rule?
```

This works when the subquestions are visible from the original question.

### 2. Iterative retrieval

The next query depends on an entity discovered in the previous result. The
Aurora → AX-14 → SP-9 example needs this pattern.

### 3. Graph retrieval

Use explicit relationships from a knowledge graph or metadata store to follow
edges such as `project → equipment → procedure`, then retrieve text evidence
for the final explanation. This is often safer than asking an LLM to invent the
relationship path.

## A bounded control loop

```python
def multi_hop_answer(question, retriever, llm, max_hops=3):
    query = question
    evidence = []
    seen_queries = set()

    for _ in range(max_hops):
        if query in seen_queries:
            break
        seen_queries.add(query)

        new_chunks = retriever.retrieve(query, top_k=5)
        evidence.extend(deduplicate(new_chunks))

        decision = llm.decide(question, evidence)
        if decision.enough_evidence:
            return llm.answer_with_citations(question, evidence)
        query = decision.next_query

    return "INSUFFICIENT_CONTEXT"
```

The important parts are not the framework names. They are the guards:

- a small `max_hops`
- deduplicated evidence and repeated-query detection
- an explicit “enough evidence” decision
- abstention when the chain is incomplete
- citations that identify which hop supplied each claim

LangGraph conditional edges, covered in the separate Agentic AI Prep site, are one way
to express this loop visibly.

## Security applies at every hop

Authorization is not a one-time check at the beginning. Every retrieval call
must apply server-derived tenant, project, and document filters. A fact found
in hop 1 must never be allowed to broaden hop 2 into a corpus the user cannot
access.

Also treat retrieved text as evidence, not instructions. A malicious chunk
saying “search the administrator index next” must not control tools, filters,
or authorization.

## Evaluation: test the chain, not only the final sentence

| Metric | What it catches |
|---|---|
| Hop recall | Did each hop retrieve the required evidence? |
| Chain completeness | Were all facts needed for the answer present? |
| Citation correctness | Does each claim point to its actual supporting chunk? |
| Answer faithfulness | Did the answer stay inside collected evidence? |
| Average hops and p95 latency | Is the extra quality worth the cost? |
| Loop/duplicate rate | Is the planner getting stuck? |

Create a separate multi-hop evaluation cohort. Mixing these questions into one
overall average can hide the exact weakness multi-hop is supposed to fix.

## Failure modes and fixes

| Failure | Fix |
|---|---|
| First hop finds the wrong entity | Require a confidence threshold or multiple supporting results |
| Planner repeats the same search | Track normalized queries and stop repeats |
| Context grows without bound | Deduplicate and keep a token/evidence budget |
| Second hop crosses permissions | Reapply authorization filters on every retrieval |
| The system forces an answer | Require chain completeness; otherwise abstain |
| Latency explodes | Route only true multi-hop questions and cap the hop count |

## 🎯 Interview answer

> “I use single-hop RAG by default. For a measured cohort where answers require
> connected facts, I decompose the question or run bounded iterative retrieval.
> Every hop reapplies authorization, records its query and evidence, avoids
> loops, and contributes claim-level citations. I validate hop recall, chain
> completeness, faithfulness, and p95 latency. If the chain remains incomplete,
> the system abstains.”

→ Next: **[Retrieval Caching](retrieval-caching.md)**
