# `itertools` and Streaming Pipelines

`itertools` provides small, composable iterator building blocks.

## Common tools

```python
from itertools import chain, islice, takewhile

all_events = chain(events_a, events_b)
first_hundred = islice(all_events, 100)
until_error = takewhile(lambda e: e.ok, first_hundred)
```

No intermediate lists are required.

## `groupby` groups runs, not global values

```python
from itertools import groupby

values = ["a", "a", "b", "a"]
[(key, list(group)) for key, group in groupby(values)]
# [('a', ['a', 'a']), ('b', ['b']), ('a', ['a'])]
```

To group globally, sort by the same key first. Each group iterator shares the source, so consume it before advancing the outer iterator.

## `tee` uses buffers

```python
from itertools import tee
a, b = tee(source, 2)
```

This creates independent-looking iterators, but items consumed by `a` must be buffered until `b` catches up. A large gap can use large memory. `tee` is not a free copy.

## Batching without loading everything

Modern Python provides `itertools.batched`:

```python
from itertools import batched

for batch in batched(records, 100):
    write_batch(batch)
```

Each batch is a tuple. On older versions, build the same idea with `islice`.

## Pipeline ownership

A lazy pipeline may keep its source open. If the source is a file, consume the pipeline inside the `with` block:

```python
with open(path) as handle:
    clean = (line.strip() for line in handle if line.strip())
    for line in clean:
        process(line)
```

## Interview answer

> `itertools` composes lazy, memory-efficient stages. The main caveats are shared-source behaviour in `groupby` and `tee`, single-pass consumption, and making the resource lifetime cover the pipeline's consumption.
