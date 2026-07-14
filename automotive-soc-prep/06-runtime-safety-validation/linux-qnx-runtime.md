# Embedded Runtime: Linux & QNX

**TL;DR:** Your inference runs as a process inside an embedded OS. Automotive SoCs typically
run **embedded Linux** (often with the PREEMPT_RT patch) for the "performance/infotainment"
domain and **QNX** — a commercial **microkernel RTOS** — for the "safety/real-time" domain.
The difference that matters to you is **determinism**: QNX gives hard real-time guarantees
and a small, certifiable kernel; Linux gives a rich stack and soft real-time.

## Linux vs QNX

| | **Embedded Linux** | **QNX** |
|---|---|---|
| Kernel | Monolithic (drivers in kernel) | **Microkernel** (drivers/services in user space) |
| Real-time | Soft; hard-ish with PREEMPT_RT | **Hard real-time** by design |
| Fault isolation | A bad driver can panic the kernel | A crashed driver is a restartable user process |
| Safety certification | Harder (huge codebase) | **Designed for ISO 26262 / ASIL-D** certification |
| Ecosystem | Huge — full ML stack, easy dev | Smaller, commercial, POSIX-compatible |
| Typical use | Infotainment, dev, non-safety perception | Safety-critical ADAS/AD control |

**Why QNX for safety:** the microkernel keeps only the essentials in privileged mode; drivers
and services run isolated in user space, so a fault is **contained and restartable** instead
of taking down the system. A small kernel is also **feasible to certify** to ASIL-D. That
isolation story is the whole reason it's chosen — memorize it.

## Real-time scheduling (the concept to have)

"Real-time" ≠ "fast" — it means **deterministic**: a task **meets its deadline every time**,
bounded worst case. For perception feeding a planner, a late-but-correct result can be as bad
as a wrong one.

- **Priority-based preemptive scheduling** — the highest-priority ready task runs; it
  preempts lower ones.
- **Priority inversion** — a high-priority task blocks on a resource held by a low-priority
  one; fixed by **priority inheritance** (QNX does this natively). A classic RTOS gotcha.
- **Worst-Case Execution Time (WCET)** — the number safety cares about. Your inference must
  have a **bounded, measured** WCET, which is why dynamic shapes and unpredictable fallbacks
  are discouraged — they make WCET hard to bound.

## Where your inference sits

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node">camera driver</span>
    <span class="arw"></span>
    <span class="node">your inference process<span class="nsub">runtime + NPU/DSP offload</span></span>
    <span class="arw"></span>
    <span class="node out">perception output<span class="nsub">to planning/control</span></span>
  </div>
  <div class="flow-foot">On QNX these are isolated user-space processes talking via message passing; on Linux, processes/threads with IPC. Your job: keep the inference process's latency <b>bounded and deterministic</b>.</div>
</div>
```

- You link the vendor **runtime** (which drives the NPU/DSP) into a process.
- Buffers to the accelerator must be **IPMMU-mapped and cache-coherent** (see
  [memory-dma-ipmmu](../05-soc-architecture/memory-dma-ipmmu.md)).
- The OS abstraction you touch is mostly **memory (shared buffers), scheduling (priority,
  affinity), and IPC** to the rest of the stack.

## Practical implications for you

- **Determinism over peak speed** — a model with predictable latency beats a faster one with
  a fat tail. Static shapes, no surprise fallbacks, bounded post-processing.
- **C/C++ on this side** — the runtime integration is C/C++; Python is for the dev/offline
  quantization/validation tooling. (Hence the JD's "C/C++ a plus.")
- **POSIX portability** — QNX is POSIX-compatible, so much Linux-developed code ports, but
  don't assume Linux-only APIs or unbounded dynamic allocation are available/allowed.

## Interview soundbite

> "Automotive SoCs split domains: embedded Linux, often PREEMPT_RT, for the rich/non-safety
> side, and QNX — a microkernel RTOS — for the safety-critical side. QNX wins there because
> drivers run isolated in user space so faults are contained and restartable, and the small
> kernel is certifiable to ASIL-D. What that means for me is determinism first: bounded WCET,
> static shapes, no surprise fallbacks, and the buffer discipline (IPMMU-mapped, coherent)
> the accelerator needs."
