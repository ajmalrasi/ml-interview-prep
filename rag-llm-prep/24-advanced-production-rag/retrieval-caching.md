# Retrieval Caching — Fast Without Stale or Leaked Answers

**TL;DR:** Cache deterministic, reusable work before caching final answers.
Every key must include the authorization scope and the versions that affect the
result. Versioned keys make invalidation understandable; shared unscoped keys
make data leaks fast.

## What can RAG cache?

RAG has several possible cache layers:

| Cache | Key idea | Benefit | Main danger |
|---|---|---|---|
| Query embedding | Normalized query + embedding model version | Avoid repeated embedding calls | Wrong vector after a model change |
| Retrieval result | Query + filters + permission scope + index/retriever versions | Avoid repeated search/reranking | Stale or unauthorized chunks |
| LLM response | Exact evidence + prompt/model versions | Avoid generation | Serving an old answer as current |

Start with query embeddings or retrieval results because their inputs and
outputs are easier to validate. Cache final answers only when freshness,
privacy, and audit requirements allow it.

## The cache key is the security boundary

A safe retrieval key needs everything that can change which documents the user
may see or how results are ranked:

```python
cache_key = hash_key({
    "tenant_id": auth.tenant_id,
    "principal_scope": auth.cache_scope,
    "query": normalize_for_cache(question),
    "filters": canonicalize(filters),
    "index_generation": index.generation,
    "embedding_version": embedding.version,
    "retriever_version": retriever.config_hash,
    "reranker_version": reranker.version,
    "top_k": top_k,
})
```

Do not trust a client-supplied tenant or role in this key. Derive permission
scope on the server from authenticated identity.

Two users may type the same question and still require different results. If
the cache key omits their access boundary, the second user can receive the
first user's private evidence.

## Invalidation without panic

“How do we delete every affected cache entry?” is difficult. Prefer versioned
keys:

1. Publish a new immutable index generation.
2. Put the generation identifier in the cache key.
3. New requests naturally miss old entries.
4. Let old entries expire by TTL.

This turns broad deletion into namespace rotation. Use the same idea for
embedding models, retriever configuration, rerankers, prompts, and generation
models.

A TTL is still useful, but it is not the only freshness strategy. Choose it
from the product's tolerance:

- Frequently changing operational data → short TTL or no final-answer cache.
- Versioned manuals and policies → longer TTL tied to document version.
- Deletion or permission revocation → explicit purge or permission-version
  rotation; never wait casually for a long TTL.

## Exact versus semantic caching

**Exact cache:** only the same normalized query matches. It is predictable and
the safest starting point.

**Semantic cache:** a similar embedding may reuse an older result. It improves
hit rate, but “similar wording” does not guarantee “same intent.” Negation,
dates, product IDs, and permission-sensitive entities can turn a near match
into a wrong answer.

If semantic caching is used:

- set a high threshold validated on real queries
- exclude exact identifiers, dates, negation, and high-risk intents
- scope by authorization and versions
- store the original question and similarity score for audit
- fall back to normal retrieval when uncertain

## Cache-aside flow

```text
request
  → derive authorization and canonical filters
  → build versioned key
  → cache hit? return permission-safe result
  → cache miss? retrieve + rerank
  → write result with TTL
  → generate answer
```

The authorization decision occurs before a cached result is returned. A cache
is an optimization around retrieval, not a bypass around it.

## Metrics and tests

Track:

- hit rate by cache layer and query cohort
- p50/p95 latency saved
- embedding, reranker, and LLM cost saved
- stale-result rate
- semantic false-hit rate
- eviction and memory pressure
- purge completion after permission or deletion events

Add negative security tests: the same question from two tenants, a revoked
user, changed filters, an index rollout, and a model-version change must not
reuse the wrong entry.

## 🎯 Interview answer

> “I cache in layers and begin with deterministic work such as query embeddings
> or authorized retrieval results. A retrieval key includes server-derived
> permission scope, canonical filters, index generation, model and retriever
> versions, and top-k. New versions rotate the namespace, while TTL removes old
> entries. I test cross-tenant isolation, revocation, freshness, and semantic
> false hits—not only cache hit rate.”

→ Next: **[Feedback and Learning Loops](feedback-learning-loops.md)**
