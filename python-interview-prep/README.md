# Python Interview Prep: Learn It Before You Test It

This site is a **course**, not a question dump. Each chapter teaches one mental model, walks through code, points out the common trap, and only then asks you to recall or apply it.

**TL;DR:** Start with Chapter 1 today. Learn `map`, `filter`, and `reduce` well enough to explain them in your own words. Then continue in order. Do not open the hard question bank until the lesson pages feel familiar.

## The learning path

| Stage | Chapters | What changes in your understanding |
|---|---|---|
| Immediate fix | 1 | You can answer `map`, `filter`, `reduce`, comprehensions, and laziness clearly |
| Python foundations | 2–4 | You understand names, objects, functions, iterators, and generators |
| Senior-level depth | 5–7 | You can reason about the object model, concurrency, and production behaviour |
| Application | 8 | You solve coding problems with readable, testable Python |
| Interview rehearsal | 9 | You answer out loud, handle follow-ups, and run a timed mock |

Chapter 6 includes an applied RAG-serving case study showing how these Python
concurrency choices affect a FastAPI application with blocking model calls.

## The rule for every lesson

1. Read the mental model.
2. Predict each code example **before** reading the output.
3. Close the page and explain the idea aloud in 30–60 seconds.
4. Mark the page complete only when the explanation is yours, not memorised text.
5. Return tomorrow and use the recall cards.

## Your first interview answer

If asked again, start here:

> `map` transforms every item, `filter` keeps items that pass a condition, and `reduce` repeatedly combines items into one result. In Python 3, `map` and `filter` return lazy iterators. I often prefer a comprehension for readability and specialised functions such as `sum` instead of a generic `reduce`.

That answer is already stronger than only defining the three functions. It states their purpose, Python 3 behaviour, and the normal trade-off. Chapter 1 explains every part.

## What “hard Python” usually means

Interviewers rarely need obscure trivia. They want to see whether you can predict consequences:

- Does this name point to a new object or the same object?
- Is this operation eager or lazy?
- When is a value captured: definition time or call time?
- Does `super()` mean “parent,” or does it follow the MRO?
- Will a thread help this workload under the GIL?
- Who owns this resource, and when is it released?

When the mental models are correct, the “trick” questions stop being tricks.

→ Begin with **[Chapter 1: Map, Filter & Reduce](01-map-filter-reduce/README.md)**.
