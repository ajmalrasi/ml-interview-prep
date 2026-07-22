# Signatures and Arguments

## The three zones

```python
def connect(host, /, port=443, *, timeout=5, verify=True):
    ...
```

- Before `/`: positional-only (`host`).
- Between `/` and `*`: positional or keyword (`port`).
- After `*`: keyword-only (`timeout`, `verify`).

Valid call:

```python
connect("api.example.com", port=8443, timeout=10)
```

Positional-only parameters let an implementation change an internal parameter name without breaking callers. Keyword-only parameters make important options visible at the call site.

## Packing arguments

```python
def report(title, *values, scale=1, **metadata):
    ...
```

- `values` is a tuple of extra positional arguments.
- `metadata` is a dictionary of extra keyword arguments.
- `scale` remains keyword-only.

## Unpacking at the call site

```python
args = ("example.com", 443)
options = {"timeout": 2, "verify": True}
connect(*args, **options)
```

Duplicate values are errors. `connect("x", timeout=2, **{"timeout": 5})` raises `TypeError`.

## Defaults are part of the API

Prefer immutable defaults. Use `None` or a private sentinel when “not supplied” must differ from a legitimate `None`:

```python
_MISSING = object()

def lookup(key, default=_MISSING):
    if default is _MISSING:
        ...
```

## Interview answer

> `/` marks positional-only parameters and `*` marks the start of keyword-only parameters. They let an API control how callers express intent and preserve compatibility. `*args` and `**kwargs` collect extra positional and keyword arguments.
