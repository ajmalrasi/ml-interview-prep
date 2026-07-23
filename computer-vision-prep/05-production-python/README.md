# 05: Production Python for Video

**TL;DR:** The JD wants *"fault-tolerant, multi-threaded/async code… manage
resources in long-running processes."* The crux is Python's **GIL**: it stops two
threads running Python bytecode at once. The trick is knowing that video decode and
GPU inference release the GIL (so threads *do* help there), while pure-Python work
needs processes. Pick the right concurrency model per stage.

Files:
1. [gil-threads-async-processes.md](gil-threads-async-processes.md) — the concurrency decision
2. [memory-and-resources.md](memory-and-resources.md) — leaks, GPU memory, long-running hygiene

## The line that proves you get it

*"The GIL means CPU-bound Python doesn't parallelize across threads — but
`cv2`/NVDEC decode, TensorRT inference, and numpy release the GIL, so an
I/O-and-native pipeline scales fine on threads. When I have heavy *Python-side*
logic per camera, I move it to processes. I match the concurrency model to where
the time is spent."*

→ Start: **[gil-threads-async-processes.md](gil-threads-async-processes.md)**
