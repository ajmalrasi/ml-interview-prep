# Production Python

Production quality is mostly explicit ownership and observable behaviour:

- Who closes the file, session, task, or process?
- What happens on timeout, cancellation, and partial failure?
- Can tests replace external dependencies?
- Can logs explain one request without leaking secrets?
- Was performance measured before optimisation?

This chapter connects language mechanisms to those operational questions.

## The reliability hierarchy

1. Correctness and clear invariants.
2. Deterministic cleanup.
3. Bounded resource use.
4. Useful tests and observability.
5. Measured optimisation.

Fast code that leaks resources or hides failures is not production-ready.

→ Continue with **[Resources and Context Managers](resources-context-managers.md)**.
