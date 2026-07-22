# Exceptions and EAFP

Python often prefers **EAFP**: easier to ask forgiveness than permission. Try the operation and catch the specific expected failure.

```python
try:
    value = config["timeout"]
except KeyError:
    value = 5
```

This avoids a separate membership lookup and a check-then-use race.

## Keep the `try` block narrow

Bad:

```python
try:
    config = load_config()
    timeout = config["timeout"]
    client = Client(timeout)
except Exception:
    timeout = 5
```

Any programming error is hidden. Better:

```python
config = load_config()
try:
    timeout = config["timeout"]
except KeyError:
    timeout = 5
client = Client(timeout)
```

## Exception structure

```python
try:
    result = risky_operation()
except ExpectedError as exc:
    recover(exc)
else:
    use(result)       # runs only when no exception occurred
finally:
    cleanup()         # runs either way
```

The `else` block keeps unrelated code outside the protected region. `finally` is for unconditional cleanup.

## Add context without losing the cause

```python
try:
    return parse(payload)
except ValueError as exc:
    raise InvalidMessage("bad customer event") from exc
```

Exception chaining preserves the original failure.

## What not to catch casually

`BaseException` includes `KeyboardInterrupt`, `SystemExit`, and cancellation-related control flow. Application code normally catches `Exception` or, better, a narrower type.

## Interview answer

> EAFP means attempting the operation and handling a narrow expected exception. It avoids duplicated checks and check-then-act races, but the `try` block and exception type must be narrow so unrelated bugs still surface.
