# Map, Filter and Reduce — One Data Flow, Three Jobs

These functions come from functional programming, but you do not need functional-programming theory to understand them. Imagine values moving through a pipeline.

```rawhtml
<div class="diagram"><div class="flow">
  <span class="node data">input values<span class="nsub">1 · 2 · 3 · 4</span></span>
  <span class="arw"></span><span class="node">map<span class="nsub">change each value</span></span>
  <span class="arw"></span><span class="node">filter<span class="nsub">keep selected values</span></span>
  <span class="arw"></span><span class="node out">reduce<span class="nsub">combine into one</span></span>
</div></div>
```

## The three verbs

| Tool | Verb | Input → output | Example question |
|---|---|---|---|
| `map` | transform | many → many | “Square every number” |
| `filter` | select | many → fewer | “Keep only even numbers” |
| `reduce` | combine | many → one | “Multiply them into a product” |

```python
from functools import reduce

numbers = [1, 2, 3, 4]

squares = map(lambda x: x * x, numbers)
evens = filter(lambda x: x % 2 == 0, numbers)
product = reduce(lambda total, x: total * x, numbers, 1)

print(list(squares))  # [1, 4, 9, 16]
print(list(evens))    # [2, 4]
print(product)        # 24
```

`map` and `filter` do not create lists in Python 3. They return iterators that produce values when consumed. `reduce` consumes the iterable and returns one final value.

## The Pythonic question

Knowing a tool does not mean using it everywhere.

```python
squares = [x * x for x in numbers]
evens = [x for x in numbers if x % 2 == 0]
product = math.prod(numbers)
```

The comprehension exposes the transformation or condition. `math.prod` names the operation. These are often easier to read than lambdas and `reduce`.

## Check your understanding

- Which tool changes values? `map`.
- Which tool preserves original values but removes some? `filter`.
- Which tool produces a single accumulated result? `reduce`.
- Which two are lazy in Python 3? `map` and `filter`.

→ Next: **[map and Comprehensions](map-and-comprehensions.md)**.
