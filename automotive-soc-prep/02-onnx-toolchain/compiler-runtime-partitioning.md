# Compiler, Runtime & Partitioning

**TL;DR:** The embedded AI toolchain has two halves. The **compiler** (offline) takes your
QDQ ONNX graph, optimizes it, **partitions** it across NPU/DSP/CPU, and produces a
deployable engine. The **runtime** (on target) loads that engine, feeds inputs, orchestrates
the subgraphs across blocks, and returns outputs. This is the embedded analogue of "TensorRT
builder + runtime" you already know — same concepts, vendor-neutral, ONNX-first.

## The two-phase pipeline

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node">QDQ ONNX</span>
    <span class="arw labeled"><span class="al">compiler (offline)</span></span>
    <span class="node">optimized + partitioned engine<span class="nsub">per-block subgraphs</span></span>
    <span class="arw labeled"><span class="al">runtime (on target)</span></span>
    <span class="node out">inference<span class="nsub">Linux / QNX</span></span>
  </div>
  <div class="flow-foot"><b>Compiler:</b> graph optimization · quantization lowering · operator fusion · partitioning · memory planning · code/engine generation. <b>Runtime:</b> load · bind buffers · schedule subgraphs · sync across blocks.</div>
</div>
```

## What the compiler does (name these)

1. **Graph optimization** — constant folding, dead-node elimination, layout assignment,
   op simplification. (Some you can also do yourself with graph surgery upfront.)
2. **Quantization lowering** — recognize QDQ patterns, fuse Q/DQ into INT8 ops, keep the
   scales.
3. **Operator fusion** — `Conv+Bias+Activation`, elementwise chains, etc., into single
   hardware passes. Fewer passes → fewer DRAM round-trips.
4. **Partitioning** — assign each subgraph to a block based on op support, then insert the
   copies/sync at boundaries. Produces the **partition report** you live by.
5. **Memory planning** — allocate on-chip SRAM / scratch, decide tensor lifetimes and
   buffer reuse (huge on a bandwidth-limited SoC).
6. **Engine generation** — serialize a target-specific artifact. Like a TensorRT plan, it's
   **hardware/version specific** — build for the exact SoC + toolchain version.

## Execution providers: the ONNX Runtime abstraction

If the toolchain is ONNX Runtime-based, backends plug in as **Execution Providers (EPs)**.
ORT partitions the graph and assigns each subgraph to the **highest-priority EP that can run
it**, falling back down the list:

```python
import onnxruntime as ort
sess = ort.InferenceSession(
    "model.qdq.onnx",
    providers=["VendorNPUExecutionProvider", "CPUExecutionProvider"],  # priority order
)
# inspect what actually got assigned where:
print(sess.get_providers())
```

The **CPUExecutionProvider is the universal fallback** — anything no accelerator EP claims
lands there. "Why is my model slow in ORT?" is very often "too much fell to the CPU EP."
This is the same **partitioning + fallback** story as the raw compiler, just via the EP API.

## Execution control (what the JD means)

You often need to control *how* the model executes, not just compile-and-run:

- **Pinning subgraphs** — force a region onto a specific block (or keep it off one) via EP
  priority or compiler hints.
- **Static shapes / optimization profiles** — declare fixed input shapes so the NPU accepts
  the graph and the compiler can plan memory.
- **Manual segmentation** — split the ONNX (see
  [graph surgery](onnx-graph-surgery.md)) and run halves as separate sessions when you want
  explicit control of the boundary and buffers.
- **I/O binding / zero-copy** — bind pre-allocated device buffers so inputs/outputs aren't
  copied each call — critical for a real-time camera pipeline.

## Hybrid compilation

The JD mentions a "hybrid compiler." The general idea: **not everything is
ahead-of-time compiled to the NPU.** A hybrid flow AOT-compiles the accelerator-friendly
subgraphs into a fixed engine and leaves the rest to run through a flexible runtime path
(DSP kernels or interpreted CPU ops). You get NPU speed on the bulk of the model plus the
flexibility to handle ops the AOT compiler can't. Your job is to **maximize the AOT-compiled
fraction** and keep the flexible-path remainder small and cheap.

## The mental checklist for "make it run well"

1. **Static shapes** everywhere the NPU touches.
2. **QDQ complete** — every accelerator op has its Q/DQ so it stays INT8.
3. **Partition report clean** — bulk on NPU, fallbacks at the boundaries or on DSP.
4. **Fusions intact** — no stray ops breaking Conv+Act chains.
5. **Memory planned** — activations fit SRAM/scratch where possible; buffers reused.
6. **I/O bound zero-copy** into the runtime.

## Interview soundbite

> "The compiler is offline — it optimizes, lowers QDQ to INT8, fuses, partitions across
> blocks, plans memory, and emits a hardware-specific engine. The runtime loads it and
> orchestrates the subgraphs. In an ONNX Runtime flow the same thing happens through
> execution providers: ORT assigns subgraphs to the NPU EP and drops the rest to the CPU EP.
> Most 'it's slow' issues are the partition putting too much on the fallback path, which I
> fix with static shapes, complete QDQ, and graph surgery."
