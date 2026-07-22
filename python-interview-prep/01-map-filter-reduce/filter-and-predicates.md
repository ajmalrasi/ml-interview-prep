# `filter` and Predicates

A **predicate** is a function used as a yes/no test. It may return any value; Python interprets that value by truthiness.

```python
def is_even(x):
    return x % 2 == 0

result = filter(is_even, range(8))
print(list(result))  # [0, 2, 4, 6]
```

Unlike `map`, `filter` does not return the predicate's result. It returns the **original item** when the result is truthy.

## Truthiness matters

The following values are normally false: `False`, `None`, numeric zero, empty strings, and empty containers. Most other objects are true.

With `None` as the predicate, `filter` tests every item directly:

```python
values = [0, 1, "", "python", None, [], [3]]
print(list(filter(None, values)))
# [1, 'python', [3]]
```

It does **not** mean “remove only `None`.” That is a frequent interview trap.

## Comprehension equivalent

```python
active = filter(lambda user: user.enabled and not user.deleted, users)
active = [user for user in users if user.enabled and not user.deleted]
```

The comprehension reads naturally when the condition belongs near the loop. A named predicate can make `filter` clean and reusable:

```python
def is_valid_event(event):
    return event.timestamp is not None and event.payload

valid_events = filter(is_valid_event, events)
```

## Select, do not transform

If you need to both select and transform, a comprehension is usually best:

```python
names = [user.name.strip() for user in users if user.enabled]
```

A `filter` followed by `map` works, but separates one readable idea across two layers.

## Interview answer

> `filter` lazily yields the original items whose predicate result is truthy. With a `None` predicate it keeps truthy items. I often use a comprehension for an inline condition and `filter` when I have a reusable named predicate.

## Check yourself

What is returned by `filter(lambda x: x * 2, [0, 1, 2])`? The predicate results are `0`, `2`, and `4`; therefore the original items `1` and `2` are yielded.
