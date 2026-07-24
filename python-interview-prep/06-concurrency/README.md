# Concurrency: Choose by What Is Waiting

Do not choose threads, processes, or async by fashion. Classify the work.

| Workload | Normal starting point | Why |
|---|---|---|
| many network waits | `asyncio` | one thread can coordinate many suspended tasks |
| blocking I/O libraries | threads | overlap waits without rewriting library calls |
| CPU-bound pure Python | processes | separate interpreters can use multiple cores |
| native code releasing the GIL | threads may scale | computation occurs outside protected Python bytecode |

Concurrency means tasks make progress during overlapping time. Parallelism means work executes simultaneously. You can have concurrency without parallelism.

## The production rule

Every concurrency design also needs:

- a limit on work in flight;
- timeouts and cancellation;
- clear ownership and shutdown;
- backpressure when consumers fall behind;
- measurement under realistic load.

## Applied case study: serving a RAG API

After the Python fundamentals, apply them to a real FastAPI service:

- [RAG serving concurrency](rag-serving-concurrency.md) compares sync, async,
  threads and processes around blocking model calls.
- [DocsMind's FastAPI server](docsmind-fastapi-server.md) explains why a plain
  `def` handler can be safer than an `async def` handler that calls blocking
  code.

→ Continue with **[GIL, Threads and Processes](gil-threads-processes.md)**.
