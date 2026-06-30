# GIL, Threads, Async, Processes

**TL;DR:** Three concurrency tools, three jobs. **Threads** → I/O-bound and native
code that releases the GIL (decode, inference, network). **Async** → managing many
network connections/streams with low overhead. **Processes** → CPU-bound pure-Python
work and hard isolation. The GIL is the reason this choice matters.

## The GIL in one paragraph

CPython's **Global Interpreter Lock** lets only one thread execute Python bytecode
at a time. So two threads doing pure-Python math don't run in parallel — they
take turns. **But** when a thread enters C code that releases the GIL — OpenCV
decode, numpy ops, TensorRT/CUDA calls, socket reads — other Python threads run
meanwhile. That's why a video pipeline (mostly native + I/O) parallelizes well on
threads despite the GIL.

> (Note for currency: Python 3.13 introduced an experimental *free-threaded*
> no-GIL build. Mention it as awareness, but reason about the standard GIL build
> unless told otherwise.)

## When to use each

| Tool | Best for | In a video pipeline |
|---|---|---|
| **Threading** | I/O-bound; native code that releases GIL | decode threads, frame-grab per camera, inference calls — **the default for streaming** |
| **asyncio** | thousands of concurrent I/O waits, low overhead | managing many RTSP/WebRTC connections, async network serving (FastAPI), signaling |
| **multiprocessing** | CPU-bound pure-Python; isolation | heavy per-frame Python logic, per-camera process isolation, sidestepping GIL entirely |

## Threads vs async (the nuance)

- **Threads**: pre-emptive (OS switches them), simple to write, but each has stack
  overhead; thousands of threads = heavy.
- **Async**: cooperative (tasks yield at `await`), one thread, tiny overhead per
  task — great for *many* concurrent connections. But **one blocking call freezes
  the whole loop**, so CPU-heavy or blocking-native work must go to an executor
  (`run_in_executor`) or a process.
- For a handful of cameras with native decode → threads are simplest. For hundreds
  of lightweight connections / a web-facing service → async.

## The producer/consumer skeleton (threads)

```python
import threading, queue
frames = queue.Queue(maxsize=2)        # bounded — backpressure

def producer(url):                     # GIL released during decode
    cap = open_stream(url)
    while running:
        ok, f = cap.read()
        try: frames.put_nowait(f)
        except queue.Full:
            frames.get_nowait(); frames.put_nowait(f)   # drop oldest

def consumer():                        # GIL released during TRT inference
    while running:
        f = frames.get()
        run_inference(f)

threading.Thread(target=producer, args=(url,), daemon=True).start()
threading.Thread(target=consumer, daemon=True).start()
```

## Why processes for CPU-bound Python

If per-camera logic is heavy *Python* (complex geometry, lots of small ops not in
numpy), threads serialize on the GIL and you get no speedup. Move to
`multiprocessing` (or `ProcessPoolExecutor`) so each runs on its own core — at the
cost of IPC (pickling frames between processes is expensive; prefer shared memory
or keep frames on GPU).

## Why X over Y

**Threads vs multiprocessing for a video decode + infer pipeline?**
Decode (OpenCV/NVDEC) and inference (TensorRT/CUDA) release the GIL, so threads
give real parallelism with shared memory and no IPC cost — the right default. Use
multiprocessing only when the bottleneck is *pure-Python* CPU work or you need
crash isolation.

**asyncio vs threads for many RTSP connections?**
Async scales to many concurrent I/O waits with minimal overhead and no thread-count
explosion — good for the *connection management* layer. But blocking/native decode
must be offloaded to threads/processes. Common design: async for orchestration +
threads for decode/infer.

**Why does the GIL not kill video performance?**
Because the heavy lifting is in C extensions (cv2, numpy, CUDA) that release the
GIL during execution. The GIL only bites on pure-Python hot loops — keep those out
of the per-frame path (vectorize, push to GPU).

**multiprocessing frame passing — what's the catch?**
Sending full frames between processes pickles/copies them (slow, memory-heavy).
Mitigate with `shared_memory`, memory-mapped buffers, or keeping pixels on the GPU
and passing only handles/metadata.

→ Next: **[memory-and-resources.md](memory-and-resources.md)**
