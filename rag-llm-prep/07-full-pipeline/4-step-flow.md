# The 4-Step Flow

**TL;DR:** Two phases: **ingest** (run once, builds the index) and **query**
(runs on every request). Everything we've learned lives in these two phases.

## Phase A: Ingest (run once)

```
make ingest
```

```rawhtml
<div class="diagram"><div class="vflow" style="align-items:stretch">
  <span class="node data">1 · LOAD<span class="nsub">SimpleDirectoryReader reads data/sample_docs/ → list of Document objects (raw text + filename)</span></span>
  <span class="varw"></span>
  <span class="node">2 · CHUNK<span class="nsub">SentenceSplitter (size 512, overlap 64) → Chunk objects: id, text ~380 words, source, metadata</span></span>
  <span class="varw"></span>
  <span class="node">3 · EMBED<span class="nsub">bge-small-en-v1.5 → 384-float vector per chunk, L2-normalized → array (N, 384)</span></span>
  <span class="varw"></span>
  <span class="node out">4 · INDEX<span class="nsub">FAISS IndexFlatIP stores all N vectors, saves index.faiss + meta.json → searchable index</span></span>
</div></div>
```

## Phase B: Query (every request)

```
POST /query  {"question": "How do black holes form?"}
```

```
Step 1: EMBED QUESTION
  same bge-small model
  → "How do black holes form?" → 384-float vector, normalized
  → MUST use same model as ingest (same vector space)

         ↓

Step 2: RETRIEVE
  FAISS.search(query_vector, top_k=4)
  → computes inner product (= cosine similarity) vs all stored vectors
  → returns top-4 by score
  → looks up text/source for each position
  → produces: [SearchResult(chunk, score), ...]
              0.8141 black_holes.md, 0.6333 stellar_lifecycle.md, ...

         ↓

Step 3: BUILD CONTEXT
  RAGPipeline._build_context(results)
  → formats chunks as numbered passages:
      [1] (source: black_holes.md)
      A black hole is a region of spacetime where gravity...

      [2] (source: stellar_lifecycle.md)
      A star much more massive than the Sun... supernova...
  → produces: a single string for the LLM

         ↓

Step 4: GENERATE + CITE
  the LLM (local Ollama model, or cloud Claude)
  → receives: system prompt + context passages + question
  → system prompt enforces: cite with [1][2][3], reply INSUFFICIENT_CONTEXT
    if context is not enough
  → produces: answer string with inline citations

         ↓

Step 5: EXTRACT CITATIONS
  RAGPipeline._extract_citations(answer, results)
  → finds [1], [2], [3] markers in the answer text
  → maps each marker back to the chunk's source filename and score
  → produces: list of Citation objects

         ↓

RESPONSE
  QueryResponse {
    answer: "Black holes form when matter collapses past its event horizon [1].
             Stellar-mass black holes form from collapsing massive stars [1][2].",
    citations: [
      {marker: 1, source: "black_holes.md", score: 0.8141, snippet: "..."},
      {marker: 2, source: "stellar_lifecycle.md", score: 0.6333, snippet: "..."}
    ],
    model: "deepseek-coder-v2:16b-lite-instruct-q4_K_M",
    grounded: true,
    latency_ms: 14637.0
  }
```

## The guardrail

If the LLM returns `INSUFFICIENT_CONTEXT` anywhere in the answer:
- `grounded = false`
- `citations = []`
- The raw `INSUFFICIENT_CONTEXT` string is returned as the answer

This is a soft guardrail: it relies on Claude following the system prompt.
Phase 5 (LangGraph agent) adds a harder structural guardrail.

→ Next: **[real-query-example.md](real-query-example.md)**
