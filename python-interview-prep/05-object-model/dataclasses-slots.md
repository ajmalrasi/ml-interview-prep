# Dataclasses and `__slots__`

## What `@dataclass` generates

```python
from dataclasses import dataclass, field

@dataclass
class Job:
    name: str
    tags: list[str] = field(default_factory=list)
```

Based on options, a dataclass can generate `__init__`, `__repr__`, equality, ordering, and hashing behaviour. It does not make the class a plain record only; methods and validation are still allowed.

Use `default_factory` for mutable defaults so every instance gets its own list.

## `frozen=True` is not deep immutability

```python
@dataclass(frozen=True)
class Report:
    values: list[int]
```

`report.values = ...` is blocked, but `report.values.append(1)` still mutates the referenced list. Frozen controls normal field assignment, not transitive mutation.

## Hash generation

Hash behaviour depends on `eq`, `frozen`, and `unsafe_hash`. A frozen dataclass is only usefully hashable when its fields are hashable and equality remains stable.

## What slots change

```python
@dataclass(slots=True)
class Point:
    x: float
    y: float
```

Slots declare fixed attribute storage and commonly remove each instance's `__dict__`. Benefits can include lower memory and catching misspelled attributes.

Costs:

- arbitrary new attributes are unavailable;
- inheritance needs care;
- weak references require support such as `weakref_slot=True`;
- some tools expect `__dict__`.

Slots are a representation choice, not access control or a security boundary.

## Interview answer

> Dataclasses generate common data-model methods from annotated fields. `default_factory` prevents shared mutable defaults. Frozen blocks normal rebinding but is not deep immutability. Slots change instance storage and can reduce memory, with inheritance and tooling trade-offs.
