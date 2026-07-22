# Identity, Equality and Hashing

## `is` asks “the same object?”

`is` compares identity. `==` asks objects whether their values are equal, normally through `__eq__`.

```python
a = [1, 2]
b = [1, 2]
c = a

print(a == b)  # True: equal values
print(a is b)  # False: different lists
print(a is c)  # True: same list
```

Use `is` for singletons and deliberate sentinels:

```python
if value is None:
    ...
```

Do not use `is` for strings or numbers. CPython may reuse some objects, but interning is not a language promise you should depend on.

## Hashing supports fast lookup

Dictionaries and sets use a hash to choose where to search for a key. The central rule is:

> If `a == b`, then `hash(a) == hash(b)` must be true.

The reverse is not required. Different objects may collide.

## Why mutable values are usually unhashable

If a key's hash changed after insertion, the dictionary would search the wrong location. Lists and dictionaries therefore reject hashing.

A tuple is hashable only if all its elements are hashable:

```python
hash((1, "a"))   # works
hash((1, []))    # TypeError: list is unhashable
```

## Equal keys of different types

```python
d = {True: "yes", 1: "one", 1.0: "float"}
print(len(d), d[True])  # 1 float
```

`True == 1 == 1.0`, and their hashes agree, so they occupy one logical key slot. Each later assignment replaces the value.

## Custom value objects

If you define equality based on mutable fields, do not give the object a value-based hash. A frozen dataclass can safely generate one when its fields are themselves hashable.

## Interview answer

> Identity means two references point to the same object; equality is a value relation defined by the objects. Hash-based collections require equal keys to have equal, stable hashes, which is why mutable value containers are normally unhashable.
