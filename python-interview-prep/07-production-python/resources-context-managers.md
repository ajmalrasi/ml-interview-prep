# Resources and Context Managers

Resources have lifecycles: acquire, use, release. A context manager makes the lifetime visible.

```python
with open(path) as handle:
    data = handle.read()
```

`__enter__` acquires or returns the resource. `__exit__` receives exception information and performs cleanup even when the block fails.

## Protocol

```python
class Transaction:
    def __enter__(self):
        self.begin()
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self.commit()
        else:
            self.rollback()
        return False  # do not suppress exceptions
```

Returning a truthy value from `__exit__` suppresses the active exception. Do that only deliberately.

## Generator-based managers

```python
from contextlib import contextmanager

@contextmanager
def temporary_setting(config, value):
    old = config.value
    config.value = value
    try:
        yield
    finally:
        config.value = old
```

Code before `yield` is entry; `finally` is exit.

## Multiple dynamic resources

`contextlib.ExitStack` manages a runtime-determined number of context managers and releases them in reverse order.

## Why not rely on `__del__`

Finalisation timing differs across implementations and becomes complex with cycles and interpreter shutdown. Use context managers or explicit `close` methods for important resources.

## Interview answer

> A context manager gives a resource a deterministic lexical lifetime. `__enter__` acquires it and `__exit__` always handles cleanup; a truthy `__exit__` return suppresses an exception. I avoid relying on finalisers for critical cleanup.
