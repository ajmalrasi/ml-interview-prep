# Performance and Memory

## Measure before changing code

Choose a tool based on the question:

- elapsed duration: `time.perf_counter`;
- repeated microbenchmark: `timeit`;
- function-level CPU: `cProfile`;
- line-level detail: a line profiler;
- Python allocation growth: `tracemalloc`;
- process memory: OS metrics plus native-allocation tools when needed.

Use a monotonic clock for durations because wall time can jump.

## Complexity first

Replacing an `O(n²)` scan with a set-based `O(n)` pass matters more than a tiny syntax optimisation.

```python
# quadratic membership in a list
duplicates = [x for x in values if x in seen_list]

# average O(1) membership
seen = set()
```

Account for memory as well as time. A set buys fast lookup by storing additional hash-table structure.

## Common memory growth sources

- unbounded caches and queues;
- references retained by callbacks or global registries;
- finished async tasks kept in collections;
- large slices/copies;
- native libraries allocating outside Python's tracked heap;
- loading a whole dataset instead of streaming.

## `lru_cache` trade-offs

```python
from functools import lru_cache

@lru_cache(maxsize=1024)
def lookup(key):
    ...
```

Arguments must be hashable. The cache is process-local and retains keys and values until eviction. It does not provide shared invalidation across workers, and concurrent callers may still duplicate a computation.

## A diagnostic sequence

1. Confirm the metric really grows under a repeatable workload.
2. Separate Python heap, native heap, file buffers, and cache behaviour.
3. Compare `tracemalloc` snapshots.
4. Inspect queues, caches, task collections, and ownership.
5. Fix the reference/lifecycle and repeat the same load test.

## Interview answer

> I start with a representative benchmark and the right profiler, fix algorithmic complexity first, and measure again. For memory growth I inspect ownership, queues, caches, task lifetimes, and distinguish Python allocations from native process memory.
