# Practice Problems

Do not open the solutions until you have written code, tests, and complexity for each attempt.

## 1. First non-repeating character

Write `first_unique(text)` returning the first character that occurs once, or `None`.

Examples:

```python
first_unique("swiss")   # "w"
first_unique("aabb")    # None
```

Target: `O(n)` time. Explain why a dictionary preserves enough information.

## 2. Lazy chunk reader

Write `chunks(iterable, size)` that lazily yields tuples of at most `size` items. Reject non-positive sizes.

```python
list(chunks(range(7), 3))
# [(0, 1, 2), (3, 4, 5), (6,)]
```

Do not materialise the full iterable. Test it with a generator.

## 3. Merge overlapping intervals

Given `(start, end)` pairs, merge overlaps.

```python
merge([(1, 3), (2, 6), (8, 10), (10, 12)])
# [(1, 6), (8, 12)]
```

State whether touching intervals merge and validate `start <= end`.

## 4. Retry decorator

Implement `@retry(attempts, exceptions)` that retries only the supplied exception types, preserves metadata, and re-raises the last error. Do not add sleep yet.

Discuss what production features are missing: idempotency, deadline, backoff, jitter, observability, and cancellation.

## 5. Bounded async map

Implement `async_map(func, items, limit)` that runs at most `limit` awaitable calls concurrently and returns results in input order.

Test that:

- active work never exceeds the limit;
- output order matches input order;
- one failure cancels/cleans up the remaining work.

## 6. LRU cache without `functools`

Design a fixed-capacity cache with `get` and `put` in average `O(1)`. First name the two data structures needed and the invariant connecting them.

## 7. Flatten nested values safely

Flatten arbitrarily nested lists/tuples, but treat strings and bytes as scalar values. Provide both recursive and iterative versions, and discuss cycles.

## 8. Log file pipeline

Read a large text stream, parse valid JSON lines, filter for error events, transform to `(service, message)`, and count by service. Decide which stages should be lazy and where errors should be recorded.
