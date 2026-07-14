# Operator Mapping, Offload & Fallback

**TL;DR:** The compiler walks your ONNX graph and, op by op, decides **which block runs
it**. Ops the NPU supports get **mapped** to NPU instructions (and fused where possible);
ops it doesn't support **fall back** to DSP or CPU, which forces a **subgraph boundary** —
and every boundary costs a data copy and a synchronization. The art is keeping the model on
the accelerator and making the unavoidable fallbacks cheap.

## What "operator mapping" means

Each ONNX op (e.g. `Conv`, `Add`, `Resize`, `Softmax`) must be lowered to something a
physical block can execute:

1. **Supported → mapped to NPU/CNNIP.** The compiler picks a hardware instruction/config
   and a tiling/layout for it.
2. **Fusible → fused.** Adjacent ops collapse into one hardware pass — `Conv + BiasAdd +
   ReLU` becomes a single NPU op. Fewer passes = fewer DRAM round-trips (see the roofline
   argument in [npu-dsp-cnnip.md](npu-dsp-cnnip.md)).
3. **Unsupported → fallback.** No NPU instruction matches → the op runs on DSP or CPU.

Whether an op is "supported" depends on more than its type: **datatype** (INT8 vs FP32),
**shape** (static vs dynamic), **attributes** (dilation, groups, unusual strides), and
**rank** can all push an otherwise-supported op onto the fallback path.

## Partitioning: the graph gets cut into subgraphs

Because blocks differ, the compiler partitions the graph into **subgraphs**, each assigned
to one block:

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node">Conv/ReLU ×N<span class="nsub">NPU subgraph</span></span>
    <span class="arw labeled"><span class="al">copy + sync</span></span>
    <span class="node data">custom op<span class="nsub">DSP/CPU fallback</span></span>
    <span class="arw labeled"><span class="al">copy + sync</span></span>
    <span class="node">Conv/Add ×M<span class="nsub">NPU subgraph</span></span>
  </div>
  <div class="flow-foot">Each block boundary = a tensor copy across memory + a cross-core synchronization. Minimize the number of boundaries, not just the number of fallback ops.</div>
</div>
```

**The key insight:** *one* unsupported op in the middle of the network is worse than it
looks — it splits one NPU subgraph into two and inserts **two** boundaries. Ten unsupported
ops clustered at the end (e.g. the detection post-processing) cause **one** boundary. So
**where** the fallbacks are matters as much as how many.

## The cost of a fallback (name these)

1. **Data transfer** — the tensor is copied between the NPU's working memory and the
   DSP/CPU-visible memory (often via DMA). This is why fallback of a *large* activation
   tensor hurts far more than a small one.
2. **Synchronization** — the NPU must finish and signal; the DSP/CPU waits, runs, signals
   back. Cross-core sync stalls the pipeline.
3. **Layout conversion** — the NPU likes a tiled/interleaved layout; the CPU likes NCHW.
   Reformatting is extra work that shows up as a hidden op.
4. **Loss of fusion** — the boundary breaks a fusion chain, so neighboring ops that *could*
   have fused now don't.

## The offload debug loop (this is the day-job)

When a model is slow or wrong on target, you work a loop like:

1. **Dump the partition report** — the compiler tells you which ops went to NPU vs DSP vs
   CPU. Look for surprises: an op you expected on the NPU that fell back.
2. **Find the fallback cause** — is it the datatype (needs INT8 but got FP32)? a dynamic
   shape? an unsupported attribute? an op the version of the toolchain doesn't cover yet?
3. **Remove or move the boundary** — options in rough order of preference:
   - **Rewrite the graph** so the op is expressible with supported ops (graph surgery — see
     [ONNX Format & Graph Surgery](../02-onnx-toolchain/onnx-graph-surgery.md)).
   - **Fix the shape** (make it static) or the datatype (insert QDQ so it's INT8).
   - **Push the fallback to the DSP** instead of the CPU (cheaper).
   - **Relocate the op** to the start/end of the graph so it doesn't split an NPU subgraph.
4. **Re-measure** latency *and* accuracy, and check the partition report again.

## Common fallback culprits in CV/BEV models

| Culprit | Why it falls back | Typical fix |
|---|---|---|
| Detection post-processing (NMS, decode) | Control flow, dynamic output count | Keep it on CPU/DSP **at the graph tail**, off the NPU path |
| `Resize` / grid-sample (BEV view transform) | Odd modes, dynamic scales | Static shapes; DSP kernel; precompute sampling grid |
| Dynamic shapes (variable #detections/objects) | NPU needs static shapes | Fix max sizes, pad, use static graphs |
| Exotic activations (GELU variants, custom) | Not in NPU op set | Approximate with supported ops, or DSP kernel |
| LayerNorm / Softmax in transformer BEV heads | Reduction + division precision | May stay INT16/FP16 on DSP; keep the block small |

## The interview soundbite

> "I read the compiler's partition report first. A model that's '50% on NPU' isn't
> automatically slow — what kills you is a fallback in the *middle* that splits the NPU
> subgraph and forces large-tensor DMA copies both ways. I try to push unavoidable fallbacks
> to the graph boundaries or onto the DSP, and where I can, rewrite the subgraph with
> supported ops so it stays on the accelerator."
