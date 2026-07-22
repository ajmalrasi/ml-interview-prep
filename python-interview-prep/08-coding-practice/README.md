# How to Approach Python Coding Rounds

A good coding-round solution is not the shortest code. It is a correct solution whose reasoning an interviewer can follow.

## The six-step loop

1. Restate the input, output, and constraints.
2. Work one small example by hand.
3. Name a simple solution and its complexity.
4. Identify the data structure or invariant that improves it.
5. Implement in small, readable steps.
6. Test normal, boundary, and failure cases aloud.

## Speak in invariants

For a sliding window:

> “The window contains no duplicate characters. When the right side creates a duplicate, I move the left side past the previous occurrence. Each pointer moves only forward, so the total work is linear.”

That explanation is stronger than silently typing a familiar template.

## Python choices interviewers notice

- `enumerate` instead of manual index bookkeeping.
- `zip(..., strict=True)` when unequal lengths are an error.
- a `set` for membership, `dict`/`Counter` for counts, `deque` for both-ended operations.
- comprehensions only when they remain readable.
- generators when streaming is a real requirement.
- explicit error behaviour rather than broad exception swallowing.

## Complexity checklist

State time and auxiliary space. Mention important hidden costs:

- `x in list` is `O(n)`; in a set/dict it is average `O(1)`.
- slicing a list or string copies `O(k)` data.
- sorting is `O(n log n)` and usually materialises/changes order.
- repeated string concatenation in a loop can copy repeatedly; collect parts and `"".join`.

→ Try **[Practice Problems](problems.md)** before opening the solutions.
