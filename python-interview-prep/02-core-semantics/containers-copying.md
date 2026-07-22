# Containers, Aliasing and Copying

Containers hold **references to objects**. This explains two classic surprises.

## Sequence repetition repeats references

```python
rows = [[0]] * 3
rows[0].append(1)
print(rows)
# [[0, 1], [0, 1], [0, 1]]
```

The outer list has three positions, but every position points to the same inner list.

Create independent rows with a comprehension:

```python
rows = [[0] for _ in range(3)]
```

## Shallow copy

```python
import copy

original = [[1], [2]]
clone = copy.copy(original)  # same as original.copy() for a list
```

The outer lists differ, but nested objects are shared:

```python
print(original is clone)       # False
print(original[0] is clone[0]) # True
```

Mutating `clone[0]` affects `original[0]`.

## Deep copy

`copy.deepcopy` recursively copies reachable objects and uses a memo table to preserve shared structure and handle cycles.

```python
clone = copy.deepcopy(original)
print(original[0] is clone[0])  # False
```

Deep copy is not automatically correct. Resources, sockets, locks, database sessions, and intentionally shared objects should not be blindly duplicated. Prefer explicit construction when ownership matters.

## Dictionary copying

These all make shallow copies:

```python
b = a.copy()
b = dict(a)
b = {**a}
```

Nested lists or dictionaries remain shared.

## Safe defaults for nested data

Use factories rather than repeated mutable values:

```python
matrix = [[0 for _ in range(cols)] for _ in range(rows)]
groups = {key: [] for key in keys}
```

## Interview answer

> A shallow copy creates a new outer container but reuses references to its elements. A deep copy recursively duplicates reachable objects with memoisation. I choose based on ownership rather than assuming deep copy is always safer.
