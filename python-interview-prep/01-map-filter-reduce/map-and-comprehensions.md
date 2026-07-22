# `map` and Comprehensions

## What `map` actually does

`map(function, iterable)` asks an iterable for one item at a time, calls the function with that item, and yields the return value.

```python
def normalize(name: str) -> str:
    return name.strip().lower()

raw = ["  Ada", "GRACE  ", " Linus "]
clean = map(normalize, raw)

print(clean)        # <map object ...>
print(list(clean))  # ['ada', 'grace', 'linus']
```

The function is passed **without calling it**. `map(normalize(), raw)` would call `normalize` immediately and pass its result, which is wrong.

## Why it is lazy

Creating `clean` does not call `normalize`. Calls happen only as values are requested:

```python
def noisy(x):
    print("processing", x)
    return x * 10

result = map(noisy, [1, 2, 3])  # prints nothing
first = next(result)             # prints: processing 1
```

This saves memory and supports streaming or infinite inputs. The cost is that the iterator is single-pass.

## Multiple iterables

`map` can call a function with aligned values from several iterables:

```python
bases = [2, 3, 4]
exponents = [3, 2]
print(list(map(pow, bases, exponents)))  # [8, 9]
```

It stops at the **shortest** iterable. `4` is never used.

## When a comprehension is clearer

```python
# map
labels = map(lambda row: row["name"].strip().title(), rows)

# comprehension: the operation is visible
labels = [row["name"].strip().title() for row in rows]
```

Prefer `map` when you already have a meaningful function (`map(str.strip, lines)`) or when multiple iterables make the call elegant. Prefer a comprehension when the transformation is inline or needs a condition.

## Interview answer

> `map` lazily applies a callable to each item and yields the returned values. It can accept multiple iterables and stops at the shortest. I use it when I already have a named function; for inline logic, a comprehension is normally clearer.

## Common traps

- Expecting a list instead of an iterator.
- Reusing the same exhausted `map` object.
- Calling the function while passing it.
- Assuming it consumes the longest iterable.
