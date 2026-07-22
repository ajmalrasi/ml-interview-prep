# How to Learn with This Site

Reading creates familiarity; interviews require **retrieval**. The goal is to practise pulling an explanation from memory and applying it to new code.

## A 45-minute study session

| Time | Activity |
|---|---|
| 0–5 min | Recall yesterday's ideas without notes |
| 5–25 min | Read one detailed lesson and run its examples mentally |
| 25–35 min | Rewrite one example or change its inputs |
| 35–42 min | Explain the concept aloud using the four-line framework |
| 42–45 min | Mark the page complete and note one weak point |

Use the built-in timer in the sidebar. One page learned deeply is more valuable than five pages skimmed.

## The four-line answer framework

For almost any concept, answer in this order:

1. **Definition:** one plain sentence.
2. **Mechanism:** what Python actually does.
3. **Trade-off:** when it is useful and when another tool is clearer.
4. **Example:** the smallest correct example you can give.

For `filter`:

> `filter` selects original items using a predicate. Python calls the predicate for each item and lazily yields those with a truthy result. It is useful with a reusable predicate, while a comprehension is often clearer for an inline condition. For example, `filter(str.isdigit, values)` keeps digit strings.

## Predict, then run

Never begin by executing an example. Write down what you expect first:

```python
items = [[0]] * 3
items[0].append(1)
print(items)
```

Then explain *why*. The important lesson is not the output; it is that sequence repetition copies references to the same nested list.

## When to use the question bank

Use it after Chapters 1–4, then again after Chapter 7. A wrong answer is not failure—it identifies the exact lesson to revisit. Filter the cards to “misses,” study the relevant chapter, and retry the next day.

## A useful sentence when you do not know

> “I have not used that directly, but I would reason from the protocol like this…”

Then state what you know, make a small example, and name what you would verify. Honest reasoning is much stronger than confident guessing.
