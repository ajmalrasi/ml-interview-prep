# Typing, Testing and Logging

## Type hints are a design tool

Python normally does not enforce annotations at each call. Static checkers, IDEs, documentation, and frameworks consume them.

```python
from collections.abc import Iterable

def average(values: Iterable[float]) -> float:
    ...
```

Accept the smallest useful interface. If you only iterate, require `Iterable`, not `list`.

Use `Protocol` for structural contracts and generics when the relationship between input and output types matters. Do not create complicated types that make code harder to understand than the bug they prevent.

## Tests should observe behaviour

Separate pure decisions from I/O:

```python
def should_retry(status: int) -> bool:
    return status in {429, 502, 503, 504}
```

This function needs simple table-driven tests. The HTTP layer can then use a fake client and injected clock rather than real sleeps or network calls.

Test:

- normal behaviour;
- boundaries and empty input;
- failure and cleanup;
- cancellation/timeouts for concurrent code;
- properties or invariants where examples are insufficient.

## Structured logging

```python
import logging
log = logging.getLogger(__name__)

log.info("job completed", extra={"job_id": job.id, "items": count})
```

Named loggers provide origin and hierarchical configuration. Libraries should not configure global handlers. Applications own output formatting and destinations.

Never log secrets, tokens, full personal data, or enormous payloads. Include stable request/job identifiers so related events can be correlated.

## Interview answer

> Type hints document and statically check contracts but are not normally runtime enforcement. I separate pure logic from side effects for deterministic tests, inject external dependencies, and use module-level structured loggers with correlation fields and safe data.
