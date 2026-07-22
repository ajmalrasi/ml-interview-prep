# How to Answer Python Questions Out Loud

A correct answer can still sound weak if it is unstructured. Use four moves:

1. **Definition:** answer the exact question immediately.
2. **Mechanism:** explain what Python does.
3. **Trade-off:** show judgement, not only recall.
4. **Example:** prove the idea with tiny code.

## Example: generators

Weak:

> “Generators use yield and save memory.”

Strong:

> “A generator is an iterator whose function suspends at `yield`, preserving its local execution state. It computes values on demand, so it is useful for large or streaming inputs. The trade-off is that it is one-pass and failures happen during consumption. For example, `(parse(line) for line in file)` processes lines lazily.”

## Handling follow-ups

Pause and identify the dimension being tested:

- semantics: what does Python guarantee?
- implementation: what does CPython usually do?
- trade-off: when would you choose the alternative?
- failure: what happens for empty, invalid, cancelled, or overloaded input?
- production: how is it bounded, observed, and cleaned up?

Do not guess implementation details as language guarantees. Say “In standard CPython…” when discussing the GIL, reference counting, or object interning.

## Practise in the right order

1. Use the hard question bank with answers visible.
2. Hide answers and speak for 30–60 seconds.
3. Filter to misses.
4. Run the 45-minute mock without notes.
5. Use the cheat sheet only the morning of the interview.
