# Worked Example: A Data-Loading Library

**TL;DR:** *"Design a Python library that reads local **and** cloud data, with caching, lazy
loading, and prefetching so the **GPU never idles**, and is resilient to failures. Sketch the
classes, methods, and interfaces."* This is the library-design cousin of the data-pipeline
round (§2) — the archetype is **WebDataset / MosaicML StreamingDataset / NVIDIA DALI**. The
one idea it all serves: **a bounded, multi-stage, concurrent pipeline** — fetch → cache →
decode → transform → batch → pin → GPU — where each stage runs *ahead* of the next.

## Frame the requirements

- **Unified access** — same code for a local path or `s3://` / `gs://`; the user shouldn't care.
- **The GPU must never wait** — the whole library exists to hide I/O + decode latency behind
  compute. The one metric to surface above all: **GPU data-stall %**.
- **Datasets don't fit in RAM/disk** — stream lazily with bounded memory.
- **Resilient & resumable** — cloud reads fail, nodes preempt, files corrupt; a single bad
  object must not kill a multi-day run.

## Design principles for the class layout

- **Program to interfaces (`Protocol`/`ABC`)** at every seam — storage, cache, decoder all
  swappable.
- **Separate the *plan* from *execution*** — `Dataset` builds a lazy DAG of operators; a
  `Pipeline` runs it. This is what enables lazy loading + op fusion.
- **Composition over inheritance** — `Dataset` *has a* `Storage`, *has a* `Cache`, *has a*
  `Prefetcher`; it doesn't inherit them.

## The interface seams (what you'd whiteboard)

```python
class Storage(Protocol):                 # local + cloud, unified — RETRIES LIVE HERE
    def read_range(self, uri, offset, length) -> bytes: ...   # the key primitive
    def list(self, prefix) -> Iterator[str]: ...
    def stat(self, uri) -> ObjMeta: ...
# LocalFS · S3Storage · GCS — picked by URI scheme via a StorageRegistry.
# ResilientStorage(inner) decorates any backend with retry/backoff/hedged reads.

class Cache(Protocol):                   # multi-tier, content-addressed key = hash(uri+etag)
    def get(self, key) -> bytes | None: ...
    def put(self, key, value) -> None: ...
# MemoryCache (LRU) → DiskCache (NVMe) → origin, composed by TieredCache (read-through).

class Dataset:                           # lazy plan builder — every op returns a NEW Dataset
    @classmethod
    def open(cls, pattern, *, storage=None, cache=None) -> "Dataset": ...
    def decode(self, kind) -> "Dataset": ...     # all lazy: build the DAG, run nothing
    def map(self, fn) -> "Dataset": ...
    def shuffle(self, buffer, seed=0) -> "Dataset": ...
    def batch(self, n) -> "Dataset": ...
    def prefetch(self, depth) -> "Dataset": ...
    def __iter__(self): return Pipeline(self._source, self._fuse(self._ops)).run()
    def to_torch(self, **kw): ...                # framework adapter (IterableDataset)
```

## Keeping the GPU busy (the heart of it)

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node">N fetch workers<span class="nsub">threads · I/O</span></span>
    <span class="arw"></span>
    <span class="node">decode / transform<span class="nsub">processes · dodge GIL</span></span>
    <span class="arw"></span>
    <span class="node">batch + collate</span>
    <span class="arw"></span>
    <span class="node">pin<span class="nsub">CUDA stream H2D overlap</span></span>
    <span class="arw"></span>
    <span class="node out">GPU</span>
  </div>
  <div class="flow-foot">Stages linked by <b>bounded queues</b> → backpressure makes the pipeline self-regulating: if the GPU stalls, upstream workers block instead of exploding memory.</div>
</div>
```

- **Right concurrency per stage** — threads for I/O (releases GIL on network waits),
  processes (or a native DALI backend) for CPU-heavy decode/augment.
- **Bounded queues = backpressure** — a `Prefetcher(produce_fn, depth, workers)` runs the
  producer `depth` batches ahead; full queue blocks, drained queue refills. Self-tuning.
- **Overlap H2D copy with compute** — separate CUDA stream + `pin_memory` + `non_blocking=True`
  so the next batch DMAs to GPU while the current one trains. This kills the last idle bubble.
- **Autotune workers** to drive **data-stall % → 0**; expose that metric so users know if
  they're I/O-bound.

## Resilience & resumability

- **Retries with backoff + jitter** and **hedged requests** (fire a duplicate past p99) — all
  inside the `Storage` layer, so every backend inherits it.
- **Skip-and-log poison samples** — a corrupt object increments a metric and is dropped, not
  fatal.
- **Checkpointable iterator** — persist `IterState(epoch, shard_cursor, sample_offset,
  samples_seen, rng_seed)`; on spot preemption, resume **mid-epoch** deterministically.
- **Multi-tier cache** turns epoch-2 cloud reads into local-disk reads — the single biggest
  win for cloud training.

## The trade-offs to name

Streaming-shuffle quality vs. buffer size/memory; disk-cache warmup cost on epoch 1;
determinism vs. hedged-request nondeterminism; shard size (big = cheap sequential reads but
coarse shuffle; small = better shuffle but request overhead).

## 🔗 How you'd say it

*"It's a **lazy, staged, back-pressured pipeline over a pluggable `Storage` abstraction** whose
key primitive is ranged reads over sharded blobs. A content-addressed tiered cache makes
epoch-2 reads local; prefetching with bounded queues plus CUDA-stream H2D overlap keeps the
GPU saturated; retries, poison-skipping, and a checkpointable iterator make it survive spot
preemption. Every layer is a narrow interface with a default impl, **composed** into the
`Dataset` — so it's testable, swappable, and never stalls the GPU."*

## Self-check

- What's the storage layer's key primitive? *(ranged reads over sharded blobs — fetch only
  the bytes you need.)*
- How do you keep the GPU fed? *(staged concurrent pipeline + bounded-queue prefetch + CUDA-
  stream H2D overlap; drive data-stall % to zero.)*
- How does it survive a spot preemption? *(a checkpointable iterator that resumes mid-epoch
  from `IterState`, plus retries and poison-sample skipping.)*
