# Python Interview Cheat Sheet — Morning Of

## The answer you need immediately

`map` transforms each item. `filter` keeps original items whose predicate is truthy. `reduce` folds items into one accumulator. `map` and `filter` are lazy iterators in Python 3. Prefer comprehensions for visible inline logic and specialised functions such as `sum`, `any`, `all`, `min`, `max`, or `math.prod` when they name the reduction.

## Semantics

| Concept | One line |
|---|---|
| assignment | binds a name to an object; does not normally copy |
| mutation | changes an object; visible through every alias |
| rebinding | makes one name refer to another object |
| `is` | identity; use for `None` and sentinels |
| `==` | value equality through object protocol |
| hash rule | equal objects must have equal, stable hashes |
| shallow copy | new outer container, shared nested references |
| closure | inner function retains access to enclosing bindings |
| default | evaluated once when the `def` runs |

## Iteration

- iterable → `iter(obj)` → iterator;
- iterator → `next(obj)` → value or `StopIteration`;
- generator: iterator that suspends at `yield`;
- `yield from`: full delegation plus subgenerator return value;
- lazy means memory-efficient and one-pass;
- `groupby` groups consecutive runs;
- `tee` may buffer heavily.

## Object model

- `super()` follows MRO, not simply direct parent.
- data descriptor → instance dictionary → non-data descriptor/class attribute → `__getattr__`.
- functions are descriptors; instance access creates a bound method.
- dataclass generates methods; `default_factory` for mutable fields.
- frozen is not deep immutability.
- slots change storage, not security.

## Concurrency

| Work | Start with |
|---|---|
| async-native high-concurrency I/O | `asyncio` |
| blocking I/O | threads |
| CPU-bound Python | processes |
| native code releasing GIL | benchmark threads |

Bound concurrency. Use timeouts. Propagate cancellation. Clean up in `finally`. Use bounded queues for backpressure. The GIL does not remove races.

## Production

- catch narrow expected exceptions around narrow operations;
- use context managers for deterministic cleanup;
- type hints are normally static metadata, not runtime enforcement;
- named module loggers; structured fields; no secrets;
- monotonic clock for duration;
- profile before optimising; complexity before micro-tuning;
- caches and queues need bounds;
- test normal, boundary, failure, cancellation, and cleanup.

## If you do not know

> “I have not used that directly, but I would reason from the protocol like this…”

State what you know, make a tiny example, and name what you would verify.
