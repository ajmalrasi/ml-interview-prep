# ONNX Format & Graph Surgery

**TL;DR:** An ONNX model is a **protobuf** describing a dataflow graph: nodes (ops), the
tensors flowing between them, initializers (weights), and value-info (shapes/types). "Graph
surgery" is reading and rewriting that structure — folding constants, fixing shapes,
removing/replacing ops, and **splitting** a model into pieces — usually without the original
training code. This is the everyday tool for getting a model through the NPU compiler.

## What's inside an ONNX file

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node">ModelProto<span class="nsub">opset, metadata</span></span>
    <span class="arw"></span>
    <span class="node">GraphProto<span class="nsub">nodes · inputs · outputs</span></span>
    <span class="arw"></span>
    <span class="node">NodeProto[]<span class="nsub">op_type · attrs · in/out names</span></span>
    <span class="arw"></span>
    <span class="node out">initializers<span class="nsub">weights as TensorProto</span></span>
  </div>
</div>
```

- **Nodes** are connected **by tensor name**, not by pointers — a node's output name is
  another node's input name. This is why surgery is mostly *string/graph bookkeeping*.
- **Initializers** are the constant tensors (weights). **value_info** carries shape/dtype
  for intermediate tensors — often missing until you run **shape inference**.
- **Opset version** matters: an op's schema (allowed attributes/behavior) is fixed per
  opset. Compilers support specific opset ranges; mismatches cause fallbacks or errors.

## Inspecting a graph

```python
import onnx
m = onnx.load("model.onnx")
onnx.checker.check_model(m)                 # structural validity
m = onnx.shape_inference.infer_shapes(m)    # fill in intermediate shapes

g = m.graph
print("inputs:",  [(i.name, [d.dim_value for d in i.type.tensor_type.shape.dim]) for i in g.input])
print("outputs:", [o.name for o in g.output])
print("opset:",   [(op.domain or "ai.onnx", op.version) for op in m.opset_import])

from collections import Counter
print(Counter(n.op_type for n in g.node))   # op histogram — spot exotic ops early
```

For a visual, **Netron** is the standard graph viewer — say you use it. The op histogram is
your first triage: an unexpected `Resize`, `NonMaxSuppression`, `ScatterND`, or a custom
domain op is a likely NPU fallback.

## The common surgeries

| Goal | What you do | Tool |
|---|---|---|
| **Constant folding** | Pre-compute subgraphs that only depend on constants | `onnxsim` / `onnx-graphsurgeon` `.fold_constants()` |
| **Simplify** | Remove redundant `Identity`, `Cast`, no-op `Reshape` | `onnxsim` |
| **Fix dynamic shapes** | Replace symbolic dims with fixed sizes so the NPU accepts them | set input dims + re-run shape inference |
| **Remove pre/post-processing** | Cut normalization or NMS out of the graph, do it in code | graphsurgeon node removal |
| **Replace an unsupported op** | Swap an exotic op for a supported equivalent subgraph | graphsurgeon node insert/replace |
| **Rename/clean I/O** | Give stable input/output names for the runtime bindings | edit `graph.input/output` |

### Graph surgery with onnx-graphsurgeon

```python
import onnx_graphsurgeon as gs
import onnx
graph = gs.import_onnx(onnx.load("model.onnx"))

# find nodes by op type
resizes = [n for n in graph.nodes if n.op == "Resize"]

# example: force static output size on a Resize by replacing its size input
# (details depend on the model) ...
graph.cleanup().toposort()                    # drop dangling nodes, re-sort
onnx.save(gs.export_onnx(graph), "model_fixed.onnx")
```

`cleanup()` (remove unused nodes/tensors) + `toposort()` (valid execution order) are the
"always run these after editing" pair.

## Model segmentation (splitting the graph)

The JD explicitly lists **model segmentation and execution control**. You split a model
when you want to run parts on different blocks, stage them, or debug a boundary:

```python
import onnx
# extract the subgraph between named tensors into a standalone model
onnx.utils.extract_model(
    "model.onnx", "part1.onnx",
    input_names=["images"],
    output_names=["backbone_features"],   # cut here
)
```

Uses for segmentation:

- **Isolate a fallback** — run the NPU-friendly backbone as one model and the fallback-heavy
  head as another, so you control the boundary explicitly.
- **Stage a pipeline** — backbone on NPU, head on DSP, with your own buffer management in
  between (see [Compiler, Runtime & Partitioning](compiler-runtime-partitioning.md)).
- **Debug accuracy** — dump the activation at the cut and compare FP32 vs INT8 up to that
  point to localize where quantization error blows up.

## Why graph surgery beats "just retrain"

You usually get a **customer's ONNX** with no training pipeline, or retraining is expensive.
Fixing the graph — fold constants, pin shapes, replace one op, move NMS out — is often a
**minutes-not-weeks** fix that turns a 40%-on-NPU model into a 95%-on-NPU model. That's the
value you add in this role.

## Interview soundbite

> "Given an ONNX model I can't build from source, I inspect it in Netron, run shape
> inference and an op histogram to find the exotic ops, then use onnx-graphsurgeon to fold
> constants, pin the dynamic dims, and replace or excise the ops that force NPU fallbacks. If
> a boundary is unavoidable I'll segment the model at that tensor and manage the two halves
> explicitly."
