# The GIL, Threads and Processes

## What the GIL means

In the standard GIL-enabled CPython build, one thread normally executes Python bytecode at a time within one interpreter. This simplifies parts of interpreter memory management; it does not make your program race-free.

Threads can still help when:

- the thread waits on network or disk I/O;
- a C extension releases the GIL during heavy work;
- responsiveness matters more than CPU throughput.

## Why CPU-bound threads disappoint

Two threads doing pure-Python number crunching compete for the GIL and add scheduling overhead. A process pool gives each worker a separate interpreter and GIL.

```python
from concurrent.futures import ProcessPoolExecutor

with ProcessPoolExecutor() as pool:
    results = list(pool.map(cpu_heavy, inputs))
```

## Process costs

- startup and memory overhead;
- arguments/results must be serialised;
- global state is not shared normally;
- platform start methods differ;
- tiny tasks may cost more to distribute than to compute.

Send coarse tasks and measure.

## Races still exist with threads

A multi-step operation can interleave even if individual bytecode operations appear atomic. Never use “the GIL makes it safe” as a design argument. Protect invariants with a lock or, better, avoid shared mutable state.

## Forking after threads

After `fork`, only the calling thread survives in the child, but locks may be copied as owned by vanished threads. This can deadlock. `spawn` is safer for complex threaded applications.

## Interview answer

> The GIL normally serialises Python bytecode in one CPython interpreter. Threads remain useful for I/O and native work that releases it; processes are the usual choice for CPU-bound pure Python. The GIL does not remove logical races around shared state.
