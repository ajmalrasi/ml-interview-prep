# QDQ Quantized ONNX Models

**TL;DR:** ONNX represents quantization with **QuantizeLinear (Q)** and **DequantizeLinear
(DQ)** node pairs sprinkled through the graph. A "**QDQ model**" is an FP32 graph annotated
with these Q/DQ pairs that encode *where* and *how* tensors are quantized (scale +
zero-point). The compiler reads the QDQ pairs as instructions — "run this region in INT8" —
and folds them into real integer ops. This is the standard way quantization travels from
training/PTQ into the embedded compiler.

## The two operators

```rawhtml
<div class="formula">
  <div class="frow"><span class="fexpr">QuantizeLinear:  q = round(r / <span class="fv">scale</span>) + <span class="fv">zero_point</span></span><span class="fnote">float → int8</span></div>
  <div class="frow"><span class="fexpr">DequantizeLinear:  r = <span class="fv">scale</span> · (q − <span class="fv">zero_point</span>)</span><span class="fnote">int8 → float</span></div>
</div>
```

- **scale** (float) and **zero_point** (int) are stored as the Q/DQ node's inputs — this is
  literally the affine quantization mapping (see
  [PTQ, QAT & Calibration](../03-quantization-embedded/ptq-qat-calibration.md) for the
  numerics).
- **Per-tensor** = one scale for the whole tensor; **per-channel** = a scale vector along
  the output-channel axis (weights use this — much better accuracy).

## What a QDQ pattern looks like

A quantized `Conv` in a QDQ graph is surrounded by Q/DQ pairs:

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node">activation (fp32)</span>
    <span class="arw labeled"><span class="al">Q</span></span>
    <span class="node data">int8</span>
    <span class="arw labeled"><span class="al">DQ</span></span>
    <span class="node">Conv (fp32 math)</span>
    <span class="arw labeled"><span class="al">Q</span></span>
    <span class="node out">int8 out</span>
  </div>
  <div class="flow-foot">Weights carry their own DQ. The compiler <b>fuses Q→DQ→Conv→Q</b> into a single INT8 convolution — the fp32 in the middle is just the <i>reference semantics</i>, never actually run.</div>
</div>
```

The crucial idea: **QDQ is a portable, framework-neutral description of a quantized model.**
The FP32 ops between Q and DQ define the *mathematical intent*; the compiler's job is to
recognize the pattern and emit the equivalent INT8 hardware op.

## QDQ vs the older "QOperator" format

- **QDQ format** — insert Q/DQ around normal ops (`Conv`, `MatMul`). Portable, the ops stay
  standard, the compiler does the fusion. **This is the modern default** and what embedded
  toolchains expect.
- **QOperator format** — replace ops with pre-quantized variants (`QLinearConv`,
  `QLinearMatMul`). More explicit but less flexible; less common for NPU flows.

Know that QDQ is preferred because it keeps the graph in standard ops and lets each backend
fuse in the way that suits its hardware.

## How QDQ models get created

1. **PTQ (static)** — run calibration data through the FP32 model, collect activation
   ranges, compute scales, and **insert Q/DQ** nodes. Tools:
   `onnxruntime.quantization.quantize_static`, vendor PTQ tools.
2. **QAT export** — train with fake-quant nodes in PyTorch, then export; the fake-quant
   ops become Q/DQ in the ONNX graph, carrying the *learned* scales.

```python
from onnxruntime.quantization import quantize_static, CalibrationDataReader, QuantType, QuantFormat
quantize_static(
    "model.onnx", "model.qdq.onnx",
    calibration_data_reader=my_reader,       # yields representative inputs
    quant_format=QuantFormat.QDQ,
    activation_type=QuantType.QInt8,
    weight_type=QuantType.QInt8,
    per_channel=True,                        # per-channel weights
)
```

## Things that go wrong (and get asked)

- **Missing Q/DQ around an op** → that op stays FP32 → it may fall back off the NPU, or
  break an INT8 fusion chain and force dequant/requant round-trips.
- **Wrong granularity** — per-tensor weights on a layer with wide per-channel range → big
  accuracy loss. Fix: per-channel weight quantization.
- **Q/DQ the compiler can't fuse** — a stray op between Q and the consumer prevents fusion;
  the region silently runs in FP32/DSP. Inspect the graph, move or remove the intruding op.
- **Zero-point/dtype mismatch** — signed vs unsigned INT8 mismatch between activation and
  weight expectations; some NPUs want symmetric (zero-point 0) weights specifically.

## Interview soundbite

> "A QDQ model is an FP32 ONNX graph annotated with QuantizeLinear/DequantizeLinear pairs
> that carry the scale and zero-point. The FP32 ops between them are just reference
> semantics — the compiler pattern-matches Q→op→Q and emits a fused INT8 hardware op. When a
> layer unexpectedly runs in FP32, I look for a missing or unfusible Q/DQ pair around it."
