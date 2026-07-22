# Scope, Closures and Default Arguments

## LEGB lookup

Python resolves an unqualified name through **Local, Enclosing, Global, Builtins** scopes.

```python
rate = 2  # global

def outer():
    rate = 3  # enclosing
    def inner(value):
        return value * rate
    return inner
```

`inner` is a closure: it carries access to the enclosing `rate` binding after `outer` returns.

## Late binding

Closures look up a captured variable when called, not when the function is created:

```python
funcs = [lambda: i for i in range(3)]
print([f() for f in funcs])  # [2, 2, 2]
```

All functions share the same `i` cell. Freeze the current value with a default:

```python
funcs = [lambda i=i: i for i in range(3)]
```

## Defaults are evaluated once

```python
def add(item, bucket=[]):
    bucket.append(item)
    return bucket

print(add("a"))  # ['a']
print(add("b"))  # ['a', 'b']
```

The list is created when the `def` statement runs, not for every call.

Use a sentinel:

```python
def add(item, bucket=None):
    if bucket is None:
        bucket = []
    bucket.append(item)
    return bucket
```

Sometimes persistent state is intentional, but make it explicit rather than hiding it in a default.

## `nonlocal` and `global`

- `nonlocal name` rebinds a name in the nearest enclosing function scope.
- `global name` rebinds the module-level name.

Mutation does not require either keyword because it does not rebind the name:

```python
def outer():
    items = []
    def add(x):
        items.append(x)  # mutation, no nonlocal needed
```

## Interview answer

> Closures capture bindings, and free variables are normally resolved when the inner function runs. Defaults are different: they are evaluated once when the function is defined. That explains both late-binding loops and mutable-default bugs.
