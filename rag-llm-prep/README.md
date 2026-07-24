# DocsMind: Learning Path

Everything you need to understand the DocsMind RAG system. This site now stays
focused on retrieval-augmented generation. Python concurrency lives in the
Python Interview Prep site, while tool calling, MCP, agent architectures and
LangGraph live in the Agentic AI Prep site.

Preparing for the DigitalOcean Senior Engineer: LLM Benchmarking & Performance role? Use
the focused **[DigitalOcean two-day path](digitalocean-llm-benchmarking-path.md)**. It adds
benchmark automation, regression gates, multi-engine/NVIDIA/AMD qualification, capacity and
COGS, observability, HM stories, and a coding rehearsal.

For the IDFC LLM Inference & AI Infrastructure role, use the focused
**[IDFC AI Infrastructure path](idfc-ai-infra-path.md)**.

```rawhtml
<div class="diagram">
  <div class="vflow">
    <div class="flow">
      <span class="node data">documents</span><span class="arw"></span>
      <span class="node">chunk</span><span class="arw"></span>
      <span class="node">embed</span><span class="arw"></span>
      <span class="node">normalize</span><span class="arw"></span>
      <span class="node soft">store in FAISS</span>
    </div>
    <span class="varw" title="index is queried"></span>
    <div class="flow">
      <span class="node data">question</span><span class="arw"></span>
      <span class="node">embed</span><span class="arw"></span>
      <span class="node">search FAISS</span><span class="arw"></span>
      <span class="node">top-k chunks</span><span class="arw"></span>
      <span class="node">Claude</span><span class="arw"></span>
      <span class="node out">answer + citations</span>
    </div>
  </div>
</div>
```

## The core pipeline (Phase 1)

| # | Folder | What you learn |
|---|--------|----------------|
| 1 ✂️ | [01-chunks-and-overlap/](01-chunks-and-overlap/) | Why we split documents, what a chunk is, what overlap does |
| 2 🔢 | [02-embeddings/](02-embeddings/) | How text becomes numbers that capture meaning |
| 3 📐 | [03-normalization/](03-normalization/) | The vector math that makes search fair and fast |
| 4 🎯 | [04-vector-similarity/](04-vector-similarity/) | How we measure "closeness" between two vectors |
| 5 🗄️ | [05-faiss/](05-faiss/) | The engine that stores vectors and finds the closest ones |
| 6 💬 | [06-generation/](06-generation/) | Building context, prompting Claude, citations, guardrail |
| 7 🔗 | [07-full-pipeline/](07-full-pipeline/) | Every piece wired together, a real query end to end |
| 8 🎤 | [08-interview-prep/](08-interview-prep/) | Every "why X over Y" question an interviewer will ask |

## Better retrieval (Phases 2–3, built and measured)

| # | Folder | What you learn |
|---|--------|----------------|
| 9 ⚖️ | [09-hybrid-retrieval/](09-hybrid-retrieval/) | Dense + BM25 + RRF fusion + cross-encoder reranking, with real eval numbers |
| 10 🧩 | [10-qdrant/](10-qdrant/) | A second vector store behind the same interface |

## The advanced map (concepts for Phases 5–8 and the serving roadmap)

| # | Folder | What you learn |
|---|--------|----------------|
| 11 🔮 | [11-hyde/](11-hyde/) | Search with a fake answer — query transformations |
| 15 ⚙️ | [15-llm-serving-internals/](15-llm-serving-internals/) | Prefill/decode, KV cache, batching, benchmark CI, engine/hardware qualification, capacity/COGS, vLLM |
| 17 🌐 | [17-fastapi-http-semantics/](17-fastapi-http-semantics/) | GET vs POST, and contracts that enforce themselves |
| 18 🛡️ | [18-llm-security/](18-llm-security/) | PII, injection, jailbreaks, RBAC, moderation — five problems, five fixes |
| 19 🎛️ | [19-fine-tuning/](19-fine-tuning/) | When RAG isn't the right tool — LoRA/QLoRA/PEFT/RLHF untangled |
| 20 📈 | [20-production-monitoring/](20-production-monitoring/) | Cost, latency, quality, drift — four signals, not one dashboard |
| 21 📄 | [21-multimodal-document-rag/](21-multimodal-document-rag/) | PDFs, tables, scans, charts — why it's an ingest problem |
| 23 🌊 | [23-seismic-rag-project/](23-seismic-rag-project/) | Turn the seismic RAG prototype into an honest, production-ready AWS interview story |
| 24 🧭 | [24-advanced-production-rag/](24-advanced-production-rag/) | Multi-hop retrieval, safe caching, feedback loops, and responsible RAG/bias checks |

## How to use this

- **First time:** follow the numbers, 1 → 24. The pipeline (1–7) is the
  skeleton everything else hangs on.
- **Stuck on a concept:** each folder has a `README.md` overview that links
  to every file inside.
- **Interview prep:** go straight to `08-interview-prep/` — and note every
  section 9–22 ends its overview with a 🎯 Interview Q&A of its own.
- **See the real code:** every file links to the actual source file it's
  explaining, or names the exact seam where a not-yet-built feature lands.

→ Start here: **[01-chunks-and-overlap/README.md](01-chunks-and-overlap/README.md)**
