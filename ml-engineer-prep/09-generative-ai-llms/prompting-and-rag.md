# Prompting & RAG

**TL;DR:** The two cheapest ways to make an LLM do your task without training it.
**Prompting** = carefully instructing the model. **RAG (retrieval-augmented generation)**
= fetching relevant documents and putting them in the prompt so the model answers from
*your* data instead of only its training. RAG is the default fix for "the model doesn't
know our stuff" and for hallucinations.

## Prompting

The fastest lever: get better output by writing better instructions. Useful patterns:

- **Clear instructions + examples** — showing a few input→output examples (**few-shot**)
  steers the model strongly.
- **Chain-of-thought** — asking it to "think step by step" improves reasoning on complex
  tasks.
- **Role/format constraints** — specify the persona, the output format (JSON), the length.

Prompting changes nothing about the model — it's just input — so it's instant and free to
iterate. Always the first thing to try.

## Why RAG exists

An LLM only knows what was in its training data, which is **frozen** at training time and
**doesn't include your private/internal data**. So it can't answer "what's our refund
policy?" and it may **hallucinate** (confidently make something up). RAG fixes both by
giving the model the relevant facts at query time.

## How RAG works

```
question → embed → search a vector DB for similar chunks → retrieve top-k docs
→ stuff them into the prompt → LLM answers grounded in those docs (+ cites them)
```

1. **Index (offline):** split your documents into chunks, convert each to an **embedding**
   (a vector capturing meaning), and store them in a **vector database** (Pinecone, Weaviate,
   pgvector, FAISS).
2. **Retrieve (per query):** embed the user's question, find the most similar chunks by
   vector similarity.
3. **Generate:** put those chunks in the prompt so the model answers **from them**, and can
   cite sources.

The payoff: answers grounded in *your current* data, fewer hallucinations, easy updates
(re-index, no retraining), and citations for trust.

## Prompting/RAG vs fine-tuning

The crucial judgment: **RAG adds knowledge; fine-tuning changes behavior/style.** If the
problem is "the model lacks our facts," reach for RAG. If it's "the model won't follow our
exact format/tone no matter how I prompt," consider fine-tuning (next page). A common
mistake is fine-tuning to add facts — RAG is usually the right, cheaper tool for that.

## 🔗 Connecting the dots — the real stack

This is the core LLM-app stack. **Orchestration:** **LangChain** or **LlamaIndex** glue the steps. **Embeddings:** OpenAI / Cohere / **sentence-transformers** / **BGE**. **Vector database:** **Pinecone**, **Weaviate**, **Qdrant**, **Chroma**, **pgvector**, or **FAISS** — this is where the retrieval happens. **Chunking + re-ranking** (Cohere Rerank) improve retrieval quality.

| RAG step | Typical tool |
|---|---|
| Chunk + embed docs | LlamaIndex / LangChain + an embedding model |
| Store & search vectors | Pinecone / Weaviate / pgvector / FAISS |
| Retrieve + re-rank | vector search + Cohere Rerank |
| Generate grounded answer | the LLM (API or self-hosted) |

**How you'd say it:** *"We chunked the docs with LlamaIndex, embedded with BGE into pgvector, retrieved top-k plus a Cohere re-rank, and fed that into the LLM so answers were grounded and cited."*

## Self-check

- What problem does RAG solve that prompting alone can't? *(the model lacking your private/
  fresh knowledge, and hallucination — RAG grounds answers in retrieved data.)*
- What are the three RAG steps? *(index docs as embeddings in a vector DB → retrieve
  similar chunks for the query → generate grounded in them.)*
- RAG vs fine-tuning — which for adding company facts, which for changing style? *(RAG for
  facts/knowledge; fine-tuning for behavior/style.)*
