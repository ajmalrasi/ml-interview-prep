# Cosine Similarity

**TL;DR:** Cosine similarity measures the angle between two vectors. Small
angle = similar meaning = high score (close to 1.0). Large angle = different
meaning = low score (close to 0.0).

**Rotate the vectors.** The score is purely the angle — magnitude doesn't matter. Point
them the same way → ~1.0 (near-duplicate); perpendicular → ~0 (unrelated); opposite → −1.

```rawhtml
<div id="cosine-widget" class="widget-host"></div>
```

## The geometric intuition

Think of each vector as an arrow pointing in 384-dimensional space:

```rawhtml
<div class="diagram"><div class="vflow" style="align-items:stretch;gap:8px">
  <div class="flow"><span class="node">HNSW chunk A →</span><span class="node">HNSW chunk B →</span><span class="flow-lbl">nearly same direction · small angle</span></div>
  <div class="flow"><span class="node ghost">Kubernetes ↓</span><span class="flow-lbl">very different direction · large angle</span></div>
</div></div>
```

Cosine similarity measures how much two arrows point in the same direction.
It doesn't care how long the arrows are (which is why normalization removes
length — we already don't want it to matter).

## The formula

For two vectors A and B:

```rawhtml
<div class="formula"><div class="frow"><span class="fexpr"><span class="fv">cosine_similarity(A, B)</span> = (A · B) / (‖A‖ × ‖B‖)</span></div></div>
```

Where:
- `A · B` = dot product = A₁×B₁ + A₂×B₂ + ... + Aₙ×Bₙ
- `‖A‖` = length of A
- `‖B‖` = length of B

## Worked example (tiny 3-dim vectors)

```rawhtml
<div class="formula">
  <div class="frow"><span class="fexpr">A = [0.267, 0.535, 0.802]</span><span class="fnote">normalized, length 1.0</span></div>
  <div class="frow"><span class="fexpr">B = [0.278, 0.511, 0.813]</span><span class="fnote">normalized, length 1.0</span></div>
  <div class="frow"><span class="fexpr">A · B = 0.074 + 0.273 + 0.652 = <span class="fv">0.999</span></span></div>
  <div class="frow"><span class="fexpr">cosine = 0.999 / (1.0 × 1.0) = <span class="fv">0.999</span></span><span class="fnote">very similar</span></div>
</div>
```

Because both vectors are normalized (length = 1.0), the denominator is always
1.0 × 1.0 = 1.0. So cosine similarity simplifies to just the dot product:

```rawhtml
<div class="formula"><div class="frow"><span class="fexpr"><span class="fv">cosine_similarity(A, B)</span> = A · B</span><span class="fnote">when both are L2-normalized, cosine = plain dot product</span></div></div>
```

This is exactly what FAISS's `IndexFlatIP` (inner product) computes.
Normalize → use IndexFlatIP → you get cosine similarity.

## Python

```python
import numpy as np

A = np.array([0.267, 0.535, 0.802])
B = np.array([0.278, 0.511, 0.813])

# Both are normalized, so dot product = cosine similarity
similarity = np.dot(A, B)
print(f"Similarity: {similarity:.3f}")  # → 0.999
```

→ Next: **[similarity-scores.md](similarity-scores.md)**
