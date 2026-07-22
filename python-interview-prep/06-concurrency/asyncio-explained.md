# `asyncio` Explained

An `async def` call creates a coroutine object. It does not run automatically.

```python
async def fetch(client, url):
    response = await client.get(url)
    return response.text
```

`await` suspends this coroutine when the awaited operation is not ready, letting the event loop run another task.

## Coroutines and tasks

```python
coro = fetch(client, url)        # not scheduled
task = asyncio.create_task(coro) # scheduled concurrently
text = await task
```

Structured tools such as `asyncio.TaskGroup` make ownership clearer:

```python
async with asyncio.TaskGroup() as group:
    tasks = [group.create_task(fetch(client, u)) for u in urls]
```

If a child fails, the group cancels siblings and waits for cleanup before leaving.

## Blocking inside async blocks everyone

```python
async def bad():
    time.sleep(2)  # blocks event-loop thread
```

Use `await asyncio.sleep(2)` for a timer. For a blocking I/O call you cannot replace, consider `await asyncio.to_thread(call)`.

## Cancellation is cooperative

`task.cancel()` requests cancellation. `CancelledError` appears at an await point. Always clean up in `finally` and normally re-raise cancellation.

```python
try:
    await work()
finally:
    await close_resource()
```

## Timeouts

A network client needs connect, read, and overall deadlines. A timeout should cancel the operation and release its resources; it should not merely stop waiting while work leaks in the background.

## Interview answer

> `asyncio` uses cooperative scheduling: coroutines yield control at `await` points while one event-loop thread coordinates many I/O waits. Creating a coroutine does not schedule it, blocking calls freeze the loop, and production code must bound concurrency and handle cancellation.
