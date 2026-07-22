# Queues, Races and Backpressure

## A queue separates rates

Producers create work; consumers process it. A queue absorbs short bursts.

```python
queue = asyncio.Queue(maxsize=100)

async def producer(item):
    await queue.put(item)  # waits when full

async def consumer():
    while True:
        item = await queue.get()
        try:
            await process(item)
        finally:
            queue.task_done()
```

The size limit is **backpressure**. When consumers fall behind, producers slow down instead of allowing memory and latency to grow without bound.

## Unbounded queues hide overload

An unbounded queue makes the system look healthy while requests become stale and memory climbs. Decide what overload means:

- wait;
- reject new work;
- drop oldest or lowest-priority work;
- spill to durable storage;
- scale consumers.

The correct policy is a product decision, not only a code choice.

## Logical races in async code

One event-loop thread does not eliminate races. Tasks interleave at awaits:

```python
value = cache[key]
await refresh()
cache[key] = value + 1
```

Another task can modify the key during `await`. Use an `asyncio.Lock` around the invariant or restructure so one task owns the state.

## Shutdown sequence

1. stop accepting new work;
2. signal producers;
3. drain or deliberately discard the queue;
4. cancel remaining workers;
5. await cleanup and close resources.

## Interview answer

> A bounded queue creates backpressure by making producers wait or fail when consumers cannot keep up. It limits memory and stale work. Even single-threaded async code can race when a read-modify-write sequence crosses an await.
