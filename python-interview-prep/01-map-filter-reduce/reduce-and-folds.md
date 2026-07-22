# `reduce` and Folds

`functools.reduce` repeatedly combines an accumulator with the next item.

```python
from functools import reduce

numbers = [2, 3, 4]
product = reduce(lambda acc, x: acc * x, numbers, 1)
```

Trace it rather than memorising it:

| Step | accumulator | item | new accumulator |
|---|---:|---:|---:|
| start | 1 | — | 1 |
| 1 | 1 | 2 | 2 |
| 2 | 2 | 3 | 6 |
| 3 | 6 | 4 | 24 |

The result is `24`.

## The initializer has two jobs

The third argument is the initial accumulator and the answer for an empty iterable:

```python
reduce(lambda a, b: a + b, [], 0)  # 0
```

Without it, the first item becomes the accumulator. An empty iterable then raises `TypeError` because there is no first item.

```python
reduce(lambda a, b: a + b, [10, 20])  # 30
reduce(lambda a, b: a + b, [])        # TypeError
```

## Why `reduce` is often not the best answer

Specialised operations communicate intent:

| Generic reduction | Clearer Python |
|---|---|
| sum numbers | `sum(values)` |
| multiply numbers | `math.prod(values)` |
| find smallest | `min(values)` |
| any truthy item | `any(values)` |
| all truthy items | `all(values)` |

For a complex accumulator, an explicit loop is often easier to debug and type-check:

```python
counts = {}
for word in words:
    counts[word] = counts.get(word, 0) + 1
```

## Associativity and order

`reduce` is left-to-right. Operations such as subtraction expose the order:

```python
reduce(lambda a, b: a - b, [10, 3, 2])
# (10 - 3) - 2 = 5
```

## Interview answer

> `reduce` folds an iterable into one value by repeatedly applying a two-argument function to an accumulator and the next item. An initializer defines the first accumulator and the empty-input result. I prefer specialised built-ins or a clear loop when they express the operation better.
