# Decorators and Callables

A decorator receives a function or class and returns a replacement.

```python
from functools import wraps
from time import perf_counter

def timed(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        start = perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            print(fn.__name__, perf_counter() - start)
    return wrapper
```

Decoration syntax is assignment:

```python
@timed
def load_data(path):
    ...

# equivalent to:
load_data = timed(load_data)
```

## Why `wraps` matters

Without it, the decorated function appears to be named `wrapper`, loses its documentation, and becomes harder for introspection and frameworks to understand. `wraps` preserves important metadata and sets `__wrapped__`.

## Decorators with configuration

An extra outer function captures configuration:

```python
def retry(attempts):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            ...
        return wrapper
    return decorate

@retry(attempts=3)
def fetch():
    ...
```

This has three levels: create decorator, decorate function, call wrapped function.

## Callable objects

Any object implementing `__call__` can be used like a function:

```python
class Threshold:
    def __init__(self, minimum):
        self.minimum = minimum

    def __call__(self, value):
        return value >= self.minimum
```

`filter(Threshold(10), values)` now uses a stateful predicate.

## Interview answer

> A decorator transforms a function or class at definition time. A wrapper should normally accept and forward arbitrary arguments and use `functools.wraps` so metadata and introspection remain useful.
