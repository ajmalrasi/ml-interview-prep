# 45-Minute Python Mock Interview

Use the sidebar timer. Speak every explanation aloud and write runnable code for the coding section.

## Part 1: Foundations (10 minutes)

1. Explain `map`, `filter`, and `reduce`. Include laziness and alternatives.
2. Predict and explain:

```python
def f(x=[]):
    x.append(len(x))
    return x

print(f(), f())
```

3. Explain `is`, `==`, and the hash/equality contract.
4. Explain why `[[0]] * 3` shares state.

## Part 2: Protocols (10 minutes)

1. Iterable versus iterator.
2. Write a reusable iterable `Countdown`.
3. Explain generator suspension and `yield from` return values.
4. Explain how a function becomes a bound method.

## Part 3: Production reasoning (10 minutes)

1. Choose threads, processes, or async for:
   - 5,000 HTTP requests;
   - image transforms in pure Python;
   - NumPy work that releases the GIL;
   - a blocking database client.
2. Design a bounded producer-consumer system.
3. Explain cancellation and cleanup in `asyncio`.
4. Describe how you would investigate memory growth.

## Part 4: Coding (12 minutes)

Implement a lazy function that reads records, discards invalid ones, normalises a key, and yields unique records while preserving first-seen order.

State:

- input and output contract;
- what “invalid” means;
- time and space complexity;
- whether an infinite stream can have bounded memory while enforcing global uniqueness.

## Part 5: Your questions (3 minutes)

Ask about Python version, concurrency model, testing strategy, type-checking, deployment, observability, and the hardest current reliability problem.

## Self-scoring

| Area | 0 | 1 | 2 |
|---|---|---|---|
| Correctness | wrong/guess | mostly right | precise |
| Mechanism | missing | partial | explains what Python does |
| Trade-off | none | one-sided | compares alternatives |
| Communication | rambling | understandable | structured and concise |
| Code | incomplete | works | readable, tested, complexity stated |

Target at least 8/10 per spoken answer and 8/10 for coding.
