# Advanced Production RAG — Interview Questions

## Q: When should you use multi-hop instead of increasing top-k?

Increase top-k when the right evidence exists for the original query but ranks
just below the cutoff. Use multi-hop when the next evidence query depends on a
fact discovered in the first result—for example, project → equipment →
procedure. A larger top-k cannot reliably invent that missing relationship and
also increases context noise.

I would prove the need with a labeled multi-hop cohort. Then I would cap hops,
deduplicate queries and evidence, reapply authorization on every hop, require
chain-complete citations, and compare the quality gain with p95 latency.

---

## Q: What must be included in a retrieval cache key?

The normalized query, canonical filters, server-derived authorization scope,
index generation, embedding model version, retriever and reranker versions,
and parameters such as top-k. If any of those change the allowed or ranked
result, they belong in the key.

The most serious omission is permission scope: two users asking the same
question may be allowed to see different documents. A shared key without that
boundary is a cross-user data leak.

---

## Q: How do you invalidate a RAG cache after reindexing?

Prefer immutable index generations in the cache key. Publishing a new
generation creates a new key namespace, so new requests miss old entries and
old entries expire by TTL. For urgent deletion or permission revocation, rotate
a permission/content version or explicitly purge affected keys rather than
waiting for a long TTL.

---

## Q: Would you fine-tune continuously from thumbs-down feedback?

No. A thumbs-down is an untrusted, ambiguous signal. I would preserve a
privacy-safe trace, sample the case for qualified review, label the expected
evidence and the failing pipeline stage, and add it to a versioned future
evaluation or tuning set.

I would first fix ingestion, filters, chunking, retrieval, ranking, or prompting
as appropriate. Fine-tuning is justified only for a stable, measured model
behavior gap. Every change passes held-out regression, safety testing, and a
shadow or canary release.

---

## Q: How can RAG be biased if it only answers from documents?

The documents and retrieval pipeline can be biased. One group may have fewer
authoritative sources, OCR may fail more often on one script, metadata filters
may exclude a cohort, embeddings may retrieve one language less accurately,
or feedback may overrepresent high-volume users. The LLM can then faithfully
summarize an already skewed evidence set.

I measure coverage and extraction first, retrieval metrics by relevant cohort
second, and generation faithfulness and harmful output third. That ordering
locates the first broken layer.

---

## Q: Should fairness checks ever bypass access controls to equalize results?

No. Authorization is a hard deterministic boundary. Evaluate and improve
quality within the evidence each user is legitimately allowed to access.
Weakening permissions to raise recall converts a quality problem into a
security incident.

---

## Q: What is the common design principle across these advanced features?

Add them in response to measured failure modes and bound their risk. Multi-hop
gets a hop limit and evidence trace. Caching gets permission-scoped versioned
keys. Feedback gets human adjudication and promotion gates. Bias checks get
cohort-aware evaluation, privacy controls, and accountable review. “Advanced”
means controlled and measurable, not more components.
