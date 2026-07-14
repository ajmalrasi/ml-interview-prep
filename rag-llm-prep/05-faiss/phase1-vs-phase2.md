# Flat vs IVF vs HNSW vs PQ — The Full Comparison

**TL;DR:** Four index types, four different tradeoffs between speed, memory,
recall, and complexity. Phase 1 uses Flat. Phase 2 benchmarks the rest.

## The four index types

### 1. IndexFlatIP (Phase 1)

- **How:** Stores all vectors. Compares query to every single one.
- **Recall:** 100% — exact, no approximation
- **Speed:** O(N) — gets slower as N grows linearly
- **Memory:** N × 384 × 4 bytes (raw float32 vectors)
- **Training:** None
- **Good for:** Small corpora, ground-truth benchmarking

```rawhtml
<div class="diagram"><div class="flow">
  <span class="node data">Query</span><span class="arw"></span>
  <span class="node">compare to <b>all N</b> vectors</span><span class="arw"></span>
  <span class="node out">top-k</span>
</div></div>
```

### 2. IndexIVF (Inverted File)

- **How:** Clusters vectors into `nlist` groups using k-means at build time.
  At query time, only searches the `nprobe` closest groups.
- **Recall:** ~90–99% (depending on `nprobe`)
- **Speed:** Much faster than Flat at large N — only searches a fraction of vectors
- **Memory:** Similar to Flat (stores raw vectors + cluster assignments)
- **Training:** Requires running k-means on a representative sample first
- **Good for:** 100k–10M vectors where exact search is too slow

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">Query</span><span class="arw"></span>
    <span class="node">find closest <b>nprobe</b> groups</span><span class="arw"></span>
    <span class="node">compare within those only</span><span class="arw"></span>
    <span class="node out">top-k</span>
  </div>
  <div class="flow-foot"><b>Build:</b> cluster all vectors into groups (k-means).</div>
</div>
```

### 3. IndexHNSW (Hierarchical Navigable Small World)

- **How:** Builds a multi-layer graph at ingest time. At query time, starts
  at the top layer and navigates greedily to the closest nodes.
- **Recall:** ~95–99% with good parameters
- **Speed:** Very fast — milliseconds even at millions of vectors
- **Memory:** Higher than Flat — stores graph edges in addition to vectors
  (~1.5–2× more memory)
- **Training:** None — graph is built incrementally as vectors are added
- **Good for:** Up to ~5–10M vectors in RAM where latency is critical

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">Query</span><span class="arw"></span>
    <span class="node">start at top layer, <b>greedy graph walk</b></span><span class="arw"></span>
    <span class="node out">top-k <span class="nsub">approximate</span></span>
  </div>
  <div class="flow-foot"><b>Build:</b> link each vector to its M nearest neighbors at each layer.</div>
</div>
```

Key parameters:
- `M` — number of edges per node (higher = better recall, more memory)
- `efSearch` — search breadth (higher = better recall, slower)

### 4. IndexPQ / IndexIVFPQ (Product Quantization)

- **How:** Compresses each vector by splitting it into sub-vectors and
  replacing each with a code (quantization). Stores codes instead of raw floats.
- **Recall:** Lower than other methods — lossy compression
- **Speed:** Fast — smaller data fits in CPU cache better
- **Memory:** Dramatically lower — can be 8–32× smaller than raw vectors
- **Training:** Requires training the quantizer
- **Good for:** Billion-scale corpora where you can't fit raw vectors in RAM

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">Query</span><span class="arw"></span>
    <span class="node">compare <b>codes</b>, not full floats</span><span class="arw"></span>
    <span class="node out">top-k <span class="nsub">approximate, lossy</span></span>
  </div>
  <div class="flow-foot"><b>Compress:</b> [0.267, 0.535, 0.802, … 384 floats] → [42, 17, 8] (3 codes).</div>
</div>
```

---

## Side-by-side comparison

| Index | Recall | Speed at 1M | Memory | Training | Best for |
|-------|--------|-------------|--------|----------|----------|
| **Flat** | 100% | Slow (~100ms) | 1× | None | < 100k, baseline |
| **IVF** | ~95% | Fast (~5ms) | 1× | Yes | 100k–10M |
| **HNSW** | ~98% | Very fast (~1ms) | 1.5–2× | None | < 10M, low latency |
| **IVFPQ** | ~85% | Very fast (~1ms) | 0.03–0.1× | Yes | Billions, memory-limited |

---

## What Phase 2 will do

Run all four on the same corpus and measure:
- Recall@k (did we find the true top-k?)
- Query latency (ms per query)
- Index build time
- Memory usage

Then decide which index type to use based on those numbers — not theory.
That's the "benchmark notebook" deliverable of Phase 2.

**✅ Done.** The benchmark is built (`scripts/benchmark.py`) and the real
measured numbers — recall@k, latency, build time, and memory for all four index
types at 50k and 500k vectors — are in
**[benchmark-results.md](benchmark-results.md)**.

→ Next: **[benchmark-results.md](benchmark-results.md)**
