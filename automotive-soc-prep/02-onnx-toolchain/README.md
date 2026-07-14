# 2 · ONNX Toolchain

**TL;DR:** ONNX is the **interchange format** between training frameworks and the
embedded compiler. In this role you don't just export ONNX — you **inspect, modify, split,
and quantize** ONNX graphs to get them through the toolchain cleanly. This section is the
ONNX-native workflow the JD calls out: graph inspection/modification, QDQ models, and the
compiler/runtime that turns ONNX into an on-target engine.

## Why ONNX is the center of gravity here

- It's the **contract**: training happens in PyTorch, deployment on a vendor NPU compiler,
  and ONNX is the neutral thing both sides agree on.
- The compiler consumes ONNX and produces the partitioned, quantized engine — so **the
  shape of your ONNX graph directly determines** what runs on the NPU vs falls back.
- Customers hand you ONNX models; you inspect and fix them without the original training
  code. **Graph surgery is a core skill**, not a niche one.

## Pages

- **[ONNX Format & Graph Surgery](onnx-graph-surgery.md)** — the protobuf model, how to
  inspect it, and how to modify/segment it with `onnx`, `onnx-graphsurgeon`, `onnxruntime`.
- **[QDQ Quantized ONNX Models](qdq-models.md)** — how quantization is represented in ONNX
  (QuantizeLinear/DequantizeLinear), and how the compiler reads it.
- **[Compiler, Runtime & Partitioning](compiler-runtime-partitioning.md)** — how ONNX becomes
  an engine: graph optimization, execution providers, partitioning, execution control.

## The one-liner to have ready

> "I treat the ONNX graph as the thing I optimize. Before I touch training, I inspect the
> exported graph, clean it up (fold constants, fix dynamic shapes, simplify), insert or
> verify the QDQ nodes for INT8, and check the compiler's partition report — most 'the NPU
> won't take my model' problems are solved at the ONNX-graph level."
