# Chunking — Interview Questions

## Q: Why chunk at all? Why not embed the whole document?

Embedding a whole document averages all its topics into one blurry vector.
A chunk about HNSW gives a sharp, focused embedding. Retrieval precision
drops sharply when documents are too large because the embedding can't
represent multiple unrelated ideas simultaneously.

---

## Q: Big chunks vs small chunks — what's the tradeoff?

| | Small (e.g. 128 tokens) | Large (e.g. 1024 tokens) |
|---|---|---|
| Embedding focus | Sharp — one idea | Blurry — averaged meaning |
| Context per hit | May be too little | Rich surrounding context |
| Missed boundaries | More | Fewer |
| Number of vectors | More (more storage) | Fewer |

512 tokens is a common sweet spot for English technical prose. You tune it
against an eval set, not by intuition.

---

## Q: Why is chunk size tied to the embedding model?

bge-small-en-v1.5 has a max input of **512 tokens**. If a chunk is longer,
the model *silently truncates* — the tail is never embedded. Chunk size must
never exceed the embedding model's max sequence length or you lose data
without knowing it.

---

## Q: Why overlap? What does it cost?

Overlap prevents an idea at a chunk boundary from being cut in half —
the same sentence appears at the end of one chunk and the start of the next,
so at least one chunk contains it fully. Cost: ~10–20% duplicated storage
and occasional duplicate retrieval results.

---

## Q: What are the main chunking strategies, and when would you use each?

| Strategy | Use it when | Main trade-off |
|---|---|---|
| **Fixed-size** | You need a cheap, deterministic baseline or uniformly formatted text | Fast, but cuts across sentences, sections, and tables |
| **Recursive** | General text has paragraphs and sentences | Strong default: tries large natural separators, then falls back to smaller ones |
| **Sliding window** | Important facts frequently cross boundaries in transcripts, logs, or dense prose | Better boundary recall, but more vectors, cost, and duplicate hits |
| **Semantic** | Long unstructured prose changes topic without reliable headings | Meaning-aware boundaries, but slower and sensitive to similarity thresholds |
| **Structure-based** | Headings, sections, lists, records, or table rows are trustworthy | Coherent and citation-friendly, but parser quality matters |
| **Parent-child** | Small chunks retrieve precisely but the answer needs the containing section | Preserves context, but adds storage, relationships, and more prompt tokens |

For production text, start with **structure-based chunking plus recursive splitting
for oversized sections**. Keep fixed-size as the baseline. Add small measured
overlap, parent expansion, or semantic boundaries only for failure cases shown
by the eval set.

---

## Q: What is recursive chunking, exactly?

It applies an ordered list of separators. Try document sections first, then
paragraphs, sentences, words, and finally tokens until every chunk is under the
limit. That makes it almost as operationally simple as fixed-size splitting
while preserving much more natural context.

It is not automatically semantic: a paragraph can still contain two topics.
Its strength is a predictable, inexpensive baseline that respects available
text structure.

---

## Q: Sliding window vs parent-child chunking?

Both fix context lost at boundaries, but in different ways:

- **Sliding window** duplicates neighboring text inside every overlapping chunk.
  It is simple and works well when boundaries are unreliable.
- **Parent-child** searches small child chunks, then returns a bounded parent
  section around the hit. It avoids duplicating every window and is better when
  the document hierarchy is trustworthy.

Choose by measurement. Sliding windows increase index size and duplicate
retrieval; parent-child retrieval adds ID relationships and can increase
generation tokens.

---

## Q: How would you know if your chunk size is wrong?

Run an eval set: a set of (question, expected source doc) pairs. Measure
recall@k — what fraction of questions retrieved the expected chunk in top-k.
If recall is low, the chunk boundaries may be wrong. You don't guess; you
measure.

Also measure context precision, answer faithfulness, latency, vector count,
and generation-token cost. Small chunks can improve retrieval precision while
starving the answer of context; large chunks can retrieve weakly and waste the
prompt budget. The right size is the smallest self-contained unit that can
answer the typical question, not a universal token number.
