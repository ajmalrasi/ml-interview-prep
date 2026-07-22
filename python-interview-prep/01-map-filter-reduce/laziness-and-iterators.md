# Laziness and One-Pass Iterators

“Lazy” means work happens **when a value is requested**, not when the pipeline is constructed.

```python
numbers = range(1_000_000)
squares = map(lambda x: x * x, numbers)
large = filter(lambda x: x > 10_000, squares)

first = next(large)
```

Python processes only enough source values to find `first`. It does not allocate one million squares.

## The pipeline pulls values

Think from the consumer backwards:

```rawhtml
<div class="diagram"><div class="flow">
  <span class="node data">range<span class="nsub">source</span></span><span class="arw"></span>
  <span class="node">map<span class="nsub">one square</span></span><span class="arw"></span>
  <span class="node">filter<span class="nsub">accept / reject</span></span><span class="arw"></span>
  <span class="node out">next<span class="nsub">requests one result</span></span>
</div></div>
```

`next` asks `filter`, which asks `map`, which asks `range`. If the predicate rejects a value, the chain pulls again.

## The exhaustion rule

An iterator is normally single-pass:

```python
it = map(str.upper, ["a", "b"])
print(list(it))  # ['A', 'B']
print(list(it))  # []
```

The second list is empty because the same iterator has already reached `StopIteration`.

## Iterator versus iterable

- An **iterable** can produce a new iterator with `iter(obj)`. A list is iterable and reusable.
- An **iterator** produces the next value with `next(obj)` and remembers its current position.

```python
values = [1, 2, 3]
a = iter(values)
b = iter(values)
print(next(a), next(a), next(b))  # 1 2 1
```

`a` and `b` are independent iterators over one iterable.

## When laziness hurts

- Failure happens later, sometimes far from pipeline construction.
- Debugging can be less direct.
- Reusing the result produces nothing.
- Holding a source resource open may extend its lifetime.

Materialise with `list(...)` when you need repeated traversal, random access, a stable snapshot, or eager validation.

## Interview answer

> A lazy iterator defers computation until consumption and holds only enough state to produce the next item. That helps streaming and memory use, but it is one-pass and errors occur during consumption.
