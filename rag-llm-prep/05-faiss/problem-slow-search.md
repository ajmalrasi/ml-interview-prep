# The Problem: Brute-Force Search Doesn't Scale

**TL;DR:** For a small corpus, comparing the query to every vector is fine.
For millions of vectors it becomes too slow. FAISS solves this.

## The naive approach

You have 50 chunks, each a 384-dimensional vector. A question comes in.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">embed question<span class="nsub">384 numbers</span></span>
    <span class="arw"></span>
    <span class="node soft">compare to <b>every</b> chunk<span class="nsub">50 similarity scores — O(N)</span></span>
    <span class="arw"></span>
    <span class="node">sort scores</span>
    <span class="arw"></span>
    <span class="node out">top-4</span>
  </div>
  <div class="flow-foot">The middle step scales linearly — 50 chunks is nothing, but 50M means 50M comparisons per query. That's the problem an index solves.</div>
</div>
```

Total comparisons: **50**. Time: **< 1ms**. No problem.

## Why this breaks at scale

| Corpus size | Comparisons per query | Approx time (CPU) |
|---|---|---|
| 50 chunks (Phase 1) | 50 | < 1ms |
| 100,000 chunks | 100,000 | ~10ms |
| 1,000,000 chunks | 1,000,000 | ~100ms |
| 1,000,000,000 chunks | 1 billion | ~100 seconds |

At millions of vectors, even with highly optimized C++ code, brute-force
becomes too slow for real-time queries. You need indexes that let you
**skip most vectors** and only look at the promising ones.

## What FAISS provides

FAISS is a library of index structures that organize vectors so you can:

1. **Exact search** (`IndexFlatIP`) — compare to everything, 100% recall.
   Right for small corpora.
2. **Approximate search** (`IndexIVF`, `IndexHNSW`) — skip most vectors,
   very fast, ~95–99% recall at scale. Right for large corpora.
3. **Compressed search** (`IndexPQ`, `IndexIVFPQ`) — compress vectors to
   save memory, trade some recall. Right for billion-scale.

Phase 1 uses **#1** because the corpus is small. Phase 2 benchmarks **#2 and #3**.

## The trade-off at the core of all this

```rawhtml
<div class="compare">
  <div class="cmp-col">
    <div class="cmp-h">Exact (flat)</div>
    <p><b>100% recall</b> — checks every vector.</p>
    <span class="cmp-tag">slower as scale grows</span>
  </div>
  <div class="cmp-col green">
    <div class="cmp-h">Approximate (IVF / HNSW)</div>
    <p><b>~95–99% recall</b> — checks a smart subset.</p>
    <span class="cmp-tag">fast even at millions of vectors</span>
  </div>
</div>
```

For most RAG applications, losing 1–5% of relevant results is acceptable
if it means 100× faster queries.

→ Next: **[indexflatip-explained.md](indexflatip-explained.md)**
