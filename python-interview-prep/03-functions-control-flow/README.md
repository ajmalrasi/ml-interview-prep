# Functions and Control Flow

Functions are objects with signatures. They can be passed, stored, wrapped, and called. Strong Python code also makes its calling contract and failure behaviour clear.

This chapter covers:

- positional-only and keyword-only arguments;
- `*args` and `**kwargs` without mystery;
- decorators and metadata preservation;
- EAFP, narrow exception handling, and cleanup.

## A useful distinction

```python
def greet(name):
    return f"Hello {name}"

fn = greet       # pass the function object
text = greet("Ada")  # call it and store the result
```

Higher-order tools such as `map`, decorators, callbacks, and sort keys need the callable itself, not an already computed result.

→ Continue with **[Signatures and Arguments](signatures-and-arguments.md)**.
