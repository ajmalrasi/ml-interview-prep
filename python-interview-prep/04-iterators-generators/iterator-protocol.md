# The Iterator Protocol

## Iterable versus iterator

An **iterable** implements `__iter__` and can produce an iterator. An **iterator** implements `__next__` and returns itself from `__iter__`.

```python
values = [10, 20, 30]  # iterable
it = iter(values)       # iterator
print(next(it))         # 10
```

At exhaustion, `__next__` must raise `StopIteration`. Returning `None` would mean that `None` is another legitimate item.

## A custom iterator

```python
class Countdown:
    def __init__(self, start):
        self.current = start

    def __iter__(self):
        return self

    def __next__(self):
        if self.current <= 0:
            raise StopIteration
        value = self.current
        self.current -= 1
        return value
```

The object stores traversal state, so it is one-pass.

## Prefer an iterable when reuse is expected

```python
class Countdown:
    def __init__(self, start):
        self.start = start

    def __iter__(self):
        return iter(range(self.start, 0, -1))
```

Each call to `iter(countdown)` creates a fresh range iterator.

## The two-argument `iter`

`iter(callable, sentinel)` repeatedly calls a zero-argument callable until the returned value equals the sentinel:

```python
from functools import partial

for chunk in iter(partial(file.read, 8192), b""):
    process(chunk)
```

This cleanly expresses “read until EOF.”

## Interview answer

> An iterable can create iterators. An iterator is a stateful, single-pass object whose `__next__` returns a value or raises `StopIteration`. A `for` loop obtains an iterator and repeatedly calls `next` until exhaustion.
