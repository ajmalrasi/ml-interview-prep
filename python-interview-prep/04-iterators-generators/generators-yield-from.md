# Generators and `yield from`

A function containing `yield` returns a generator object when called. Its body does not run until iteration begins.

```python
def squares(limit):
    for x in range(limit):
        yield x * x

g = squares(3)  # body has not run
print(next(g))  # 0
print(list(g))  # [1, 4]
```

The generator suspends at `yield`, preserving local variables and the instruction position. The next request resumes after that yield.

## Generator expression versus list comprehension

```python
eager = [parse(line) for line in file]
lazy = (parse(line) for line in file)
```

The list is materialised, reusable, and gives eager failures. The generator is memory-efficient and single-pass.

## Delegation with `yield from`

```python
def walk(groups):
    for group in groups:
        yield from group
```

This delegates iteration instead of writing a nested loop.

It also forwards `send`, `throw`, and `close`, and captures a subgenerator's return value:

```python
def child():
    yield 1
    return 42

def parent():
    result = yield from child()
    yield result

print(list(parent()))  # [1, 42]
```

The child's `return 42` becomes `StopIteration.value`; `yield from` assigns it to `result`.

## Cleanup

Use `try/finally` inside a generator when it owns a resource, and explicitly close or fully consume it. Better still, keep resource ownership in a context manager so lifecycle is obvious.

## Interview answer

> A generator is an iterator created by a function that suspends at `yield`, preserving execution state. `yield from` delegates the full generator protocol to a subiterator and captures the subgenerator's return value.
