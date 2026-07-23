# Embeddings — Interview Questions

## Q: Why self-hosted bge-small over OpenAI embeddings?

Embedding is a **bulk operation** — you encode your entire corpus at ingest.
100k chunks on a paid API costs real money and hits rate limits. Self-hosted
runs locally, is free after download, and your documents never leave your
infrastructure. bge-small is MIT-licensed (no lock-in) and achieves strong
quality on English technical text. If you needed multilingual support or
top-tier quality, you'd evaluate a larger or cloud model — it's a one-line
swap in the `Embedder` class.

---

## Q: Why do the query and documents have to use the same embedding model?

Each model learns its own vector space. A vector from model A and a vector
from model B live in completely different coordinate systems. Comparing them
with cosine similarity is like measuring the distance between a GPS
coordinate in WGS84 and one in a local grid — meaningless. Same model at
ingest and query is non-negotiable.

---

## Q: What is your production embedding strategy for text and tables?

Use a versioned, testable pipeline:

1. **Parse and normalize:** preserve the title, section hierarchy, paragraphs,
   lists, table titles, column headers, units, and stable source coordinates.
2. **Serialize tables as text:** turn each logical row or small row group into
   a readable statement containing the table title, column labels, values, and
   units. Never embed isolated numbers without their labels.
3. **Chunk before embedding:** create self-contained answerable units and keep
   document, section, table, row, parent, and chunk IDs as metadata.
4. **Encode consistently:** apply the model's expected query/passage prefixes,
   token limit, vector normalization, and similarity metric.
5. **Batch and validate:** batch offline work, retry idempotently, reject wrong
   vector dimensions or non-finite values, and record failures.
6. **Version everything:** store the model name/revision, preprocessing,
   dimension, distance metric, and chunker version beside each vector.

This strategy is deliberately scoped to **text and tables**.

---

## Q: How do you choose an embedding model?

Do not choose by vector dimension or a public leaderboard alone. Build a domain
golden set containing exact terms, paraphrases, abbreviations, hard negatives,
and representative table questions. Compare:

- Recall@K, MRR, and NDCG by query cohort
- technical vocabulary and multilingual quality, if required
- maximum input length and truncation behavior
- vector dimension and index memory
- batch throughput, query latency, price, privacy, and deployment constraints

Choose the smallest model that meets the product's measured retrieval target.
A cheaper bi-encoder plus a top-N reranker can outperform a much larger
embedding model at lower total cost.

---

## Q: What are query and passage prefixes, and why do they matter?

Some embedding models are asymmetric: they were trained with different
instructions for search queries and documents, such as `query:` and `passage:`.
Using the passage mode for both may still return vectors, but silently reduce
retrieval quality.

Centralize those instructions in the embedder, not in calling code, and test
the exact production query/document path. The query and documents use the same
model and revision, but not necessarily the same input prefix.

---

## Q: Should metadata be embedded into the text or kept as filters?

Use structured fields for exact constraints and authorization: tenant, project,
document type, product ID, date, language, and access policy. Apply those
filters before or during retrieval.

Include only metadata that changes semantic meaning—such as a section title or
product name—in the embedded text. Repeating every metadata field in every
chunk adds noise, token cost, and possible information leakage.

---

## Q: Dense embeddings vs BM25 — which is better?

Neither alone. Dense captures semantic meaning ("car" ≈ "automobile") but
misses exact tokens, IDs, rare terms. BM25 nails exact matches but is blind
to meaning. Hybrid (dense + BM25, ranks fused, then optionally reranked) is a
strong default for mixed enterprise search.

But it is not automatic: exact structured lookups may need only filters/BM25,
and clean paraphrase-heavy corpora may do well with dense retrieval alone.
Keep hybrid only when the golden set shows enough quality gain to justify its
extra latency and infrastructure.

---

## Q: Bi-encoder vs cross-encoder?

**Bi-encoder** (what bge-small is): encodes query and document independently.
You precompute document vectors once. Fast, scalable to millions of docs.

**Cross-encoder**: takes (query, document) together as input, much more
accurate. But you must run it for every query-doc pair — can't precompute.
Used as a **reranker** on the top-k results from bi-encoder retrieval. That's
Phase 3.

---

## Q: Why 384 dimensions and not 1024 or 3072?

Smaller vectors = faster inner product math + less memory. 384 is enough
for English technical prose with bge-small. Larger dimensions help on harder,
more diverse, or multilingual content. It's a quality-vs-cost knob you tune
with a retrieval eval set.

---

## Q: What is semantic drift?

If your corpus updates frequently and you want to update your embedding model
(e.g. retrain or upgrade), all existing vectors become stale — they were
produced by a different model and now live in a different space. You'd have to
re-embed and re-index the entire corpus. This is a real ops concern in
production, especially for large corpora.

---

## Q: How do you migrate to a new embedding model safely?

Treat the model, revision, preprocessing, dimension, normalization, and
distance metric as one versioned search space. Build a parallel index, backfill
it idempotently, evaluate it offline and in shadow traffic, then switch a stable
read alias only after it passes quality, latency, and cost gates.

Never mix incompatible model versions in one vector field. Keep the old index
for a rollback window.

---

## Q: Can you fine-tune an embedding model?

Yes. If your domain is very specialized (legal, medical, code), a
general-purpose embedding model may not capture domain-specific meaning well.
Fine-tuning on domain (query, positive_passage, negative_passage) triplets
can significantly improve retrieval quality. Mentioned as a future improvement,
not Phase 1 scope.
