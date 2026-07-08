# Memory & Resource Hygiene in Long-Running Processes

**TL;DR:** A video service runs for weeks. Anything that grows even slightly per
frame will eventually OOM. The job is **flat memory forever**: bound every buffer,
release every GPU surface, close every handle, and *test it over 24h+*. This is the
JD's "without memory leaks" / "manage resources in long-running processes," and it
echoes your petabyte-pipeline reliability work.

## Where video memory leaks come from

1. **Unbounded queues** — consumer slower than producer (covered in 01). #1 cause.
2. **Unreleased GPU surfaces** — decoded NVMM buffers / CUDA tensors not freed each
   iteration → GPU OOM, often before host OOM.
3. **Un-`unmap`ped GStreamer buffers** — mapping a buffer and not unmapping (02).
4. **Accumulating references** — appending detections/frames to a list "for later,"
   growing tracker state without eviction, caches without limits.
5. **C-extension leaks** — some native ops leak; only visible as steady RSS growth.
6. **Fragmentation** — long runs fragment the allocator; RSS creeps even without a
   true leak.

## How to find them (your evidence-driven method)

- **Watch the trend, not the snapshot.** Plot RSS and GPU memory (`nvidia-smi`,
  `tegrastats`) over hours. A leak is a slope; healthy is flat/sawtooth.
- **Python heap:** `tracemalloc`, `objgraph`, `memory_profiler` to find growing
  object counts.
- **GPU:** `torch.cuda.memory_summary()` / TensorRT workspace accounting; confirm
  per-iteration free.
- **Bisect by stage:** disable inference, then tracking, then DB — see which stage's
  removal flattens the curve. (Same isolate-a-variable approach as your NVMe-vs-NAS
  diagnosis.)

## Hygiene checklist

- Bound **every** queue; choose drop policy per stage.
- Release GPU buffers / `del` tensors / `unmap` buffers each iteration; use context
  managers (`with`) so cleanup happens even on exception.
- Cap tracker/state dicts; evict stale track IDs.
- Reuse pre-allocated buffers instead of allocating per frame (steady-state, less
  fragmentation).
- Set explicit limits: max detections, max queue depth, max in-flight batches.
- Pin a periodic health log: RSS, GPU mem, per-camera fps, queue depths.
- **Soak test:** run the full pipeline 24–72h under realistic load before shipping.

## GPU memory specifics

- GPU RAM is small and shared (decode + inference + overlay). OOM here crashes the
  process. Budget it: `decode buffers + model workspace + batch tensors + headroom`.
- TensorRT engines hold a workspace; multiple model instances multiply it.
- Prefer **streaming/zero-copy** so you don't hold N full frames in GPU memory at
  once.

## Why X over Y

**Why bound buffers instead of "just add more RAM"?**
More RAM delays the OOM; it doesn't fix it. An unbounded queue under sustained
overload grows without limit — bounding + dropping is the only stable steady state.

**Pre-allocate buffers vs allocate per frame?**
Per-frame allocation churns the allocator (fragmentation, GC pressure, latency
jitter). Pre-allocating and reusing gives flat, predictable memory and steadier
latency in a long-running loop.

**Why soak-test instead of trusting a clean 5-minute run?**
Leaks and fragmentation are *slopes* — invisible in minutes, fatal in days. A 24h+
soak with memory trending is the only way to prove "no leaks in a long-running
process," which is exactly what they're asking for.

→ Back to [section README](README.md) · Next section: **[06-system-design/](../06-system-design/README.md)**
