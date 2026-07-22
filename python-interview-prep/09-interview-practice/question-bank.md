# Hard Python Question Bank

Hide the answers, speak first, then grade yourself: **Again** if the mechanism was missing, **Hard** if you needed hints, **Good** if the answer was clear, and **Easy** only if you handled the follow-up too.

## Map, filter and reduce

**Q: What are `map`, `filter`, and `reduce`?**

`map` transforms every item through a callable, `filter` yields original items whose predicate is truthy, and `reduce` repeatedly combines an accumulator with the next item into one result. In Python 3, `map` and `filter` are lazy iterators. Comprehensions and specialised reductions are often clearer.

**Q: What does `list(map(pow, [2, 3, 4], [3, 2]))` return, and why?**

`[8, 9]`. `map` calls `pow(2, 3)` and `pow(3, 2)`, then stops at the shortest iterable. The `4` is not consumed.

**Q: What does `filter(None, values)` do?**

It lazily yields items whose own truth value is true. It removes all falsy values—not only `None`.

**Q: Why can `reduce(fn, [])` fail?**

Without an initializer, `reduce` needs the first item as its accumulator. Empty input has none, so it raises `TypeError`. An initializer also defines the empty-input result.

## Names, objects and scope

**Q: Explain Python's parameter-passing model.**

Call by sharing: parameters are local names bound to the same passed objects. Mutating a passed mutable object is visible to the caller; rebinding the local parameter is not.

**Q: Why does `[[0]] * 3` cause surprising mutation?**

Repetition copies the same inner-list reference into three positions. There is one nested list, not three. Use a comprehension to create each inner list separately.

**Q: What is the difference between `is` and `==`?**

`is` compares object identity; `==` invokes value equality. Use `is` for `None` and deliberate sentinels, not for ordinary numbers or strings.

**Q: What makes an object hashable?**

It has a stable hash and equality semantics obeying: equal objects have equal hashes. Mutable value objects generally should not be hashable because a changing hash would break dictionary/set lookup.

**Q: Why can a tuple be unhashable?**

A tuple's hash depends on its elements. If it contains an unhashable item such as a list, the tuple is also unhashable.

**Q: Explain late binding in closures.**

Free variables are looked up when the inner function is called. Functions created in a loop can therefore all see the loop's final value. Freeze the current value with a default argument or `functools.partial`.

**Q: Why are mutable defaults dangerous?**

Default expressions are evaluated once when the `def` executes. The same object is reused across calls. Use `None` or a private sentinel and allocate inside.

## Functions and errors

**Q: What do `/` and `*` mean in a function signature?**

Parameters before `/` are positional-only. Parameters after bare `*` are keyword-only. Between them, parameters accept either form.

**Q: Why use `functools.wraps`?**

It preserves metadata such as name and documentation and sets `__wrapped__`, helping introspection, signature tools, frameworks, and debugging.

**Q: What is EAFP, and what is its main risk?**

Try the operation and handle the expected exception. It avoids duplicated checks and races, but a broad `try` or broad exception type can hide unrelated programming errors.

## Iteration

**Q: Iterable versus iterator?**

An iterable can create an iterator with `iter`. An iterator is single-pass, returns itself from `__iter__`, and its `__next__` yields values or raises `StopIteration`.

**Q: Generator expression versus list comprehension?**

A generator expression is lazy, single-pass, and memory-efficient. A list comprehension eagerly creates a reusable list and is often simpler/faster for small results needing repeated access.

**Q: What does `yield from` add beyond a nested loop?**

It delegates iteration plus `send`, `throw`, and `close`, and captures the subgenerator's return value from `StopIteration.value`.

**Q: What is subtle about `itertools.groupby`?**

It groups consecutive runs, not equal values globally, and group iterators share the source. Sort by the same key first for global grouping and consume each group before advancing.

## Object model

**Q: What does `super()` really do?**

It continues attribute lookup after the defining class in the runtime instance's MRO. It supports cooperative multiple inheritance; it does not simply mean “call my parent.”

**Q: What is a descriptor?**

A class attribute defining `__get__`, `__set__`, or `__delete__` to control attribute access. Functions, properties, class methods, and ORM fields use descriptors.

**Q: Data versus non-data descriptor?**

A data descriptor defines `__set__` or `__delete__` and wins over the instance dictionary. A non-data descriptor defines only `__get__` and can be shadowed by an instance attribute.

**Q: Does `frozen=True` make a dataclass deeply immutable?**

No. It blocks normal field rebinding, but referenced mutable objects can still mutate. Hash safety also depends on stable, hashable fields.

**Q: What does `__slots__` do?**

It declares fixed attribute storage and commonly removes per-instance `__dict__`, reducing memory. It affects inheritance, weak references, and tooling; it is not security.

## Concurrency and production

**Q: Give a practical GIL decision rule.**

Threads or async for I/O waits, processes for CPU-bound pure Python, and measure threads for native extensions that release the GIL. The GIL does not remove logical races.

**Q: Coroutine versus task?**

Calling `async def` creates a coroutine object. A task schedules a coroutine on the event loop and tracks its result, failure, and cancellation.

**Q: Why is `time.sleep` wrong inside async code?**

It blocks the event-loop thread and prevents every other task from running. Use `await asyncio.sleep` or move unavoidable blocking I/O to a thread.

**Q: What does a bounded queue provide?**

Backpressure. Producers slow or fail when consumers lag, limiting memory and stale work. The overload policy still must be chosen deliberately.

**Q: What does returning `True` from `__exit__` do?**

It suppresses the exception from the `with` block. Cleanup should normally return false unless suppression is intentional.

**Q: What are limitations of `lru_cache` in a service?**

It is process-local, retains keys/values until eviction, needs hashable arguments, does not coordinate invalidation across workers, and concurrent calls can duplicate computation.

**Q: Why use a monotonic clock for durations?**

It cannot move backward because of wall-clock adjustments. `perf_counter` or `monotonic` measures elapsed time; `time.time` is for timestamps.
