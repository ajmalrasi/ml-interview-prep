# Iterators and Generators

Iteration is a protocol, not only a `for` loop. Once you understand the protocol, `map`, `filter`, generator expressions, `yield`, `itertools`, file iteration, and streaming pipelines become one connected idea.

```python
for item in source:
    process(item)
```

Conceptually, Python does this:

```python
iterator = iter(source)
while True:
    try:
        item = next(iterator)
    except StopIteration:
        break
    process(item)
```

The real bytecode is optimised, but this is the correct mental model.

→ Continue with **[The Iterator Protocol](iterator-protocol.md)**.
