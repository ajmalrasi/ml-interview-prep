# Accuracy Degradation & Mitigation

**TL;DR:** When INT8 tanks accuracy, it's almost never uniform — a **handful of sensitive
layers** or **one operator limitation** does the damage. The skill is a **diagnosis loop**:
localize the bad layer, understand the cause (outliers? per-tensor on a wide range? an op the
NPU approximates?), then apply the cheapest fix that hits the target. This is the exact task
the JD calls "analyze accuracy degradation and propose mitigation strategies."

## Two sources of degradation

1. **Quantization error** — 256 levels can't represent a tensor's range; rounding + clipping
   introduce noise that compounds through the network.
2. **Operator limitation** — the NPU implements an op **approximately** or **not at all**:
   a lower-precision Softmax/LayerNorm, a `Resize` with a different rounding mode, a fused
   activation that isn't bit-exact. The math the hardware runs ≠ the math you trained.

Distinguishing these matters because the fixes differ.

## The diagnosis loop

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node">INT8 misses target</span>
    <span class="arw labeled"><span class="al">localize</span></span>
    <span class="node">per-layer error<span class="nsub">SQNR / cosine</span></span>
    <span class="arw labeled"><span class="al">explain</span></span>
    <span class="node data">why is this layer bad?</span>
    <span class="arw labeled"><span class="al">fix cheapest</span></span>
    <span class="node out">re-measure</span>
  </div>
</div>
```

### 1. Localize: which layer?

Compare FP32 vs INT8 **per layer**, don't just look at the final metric:

- **SQNR** (signal-to-quantization-noise ratio) or **cosine similarity** between the FP32
  activation and the dequantized INT8 activation, layer by layer. A cliff in SQNR points to
  the culprit.
- **Segment the model** at that tensor (see
  [graph surgery](../02-onnx-toolchain/onnx-graph-surgery.md)) and confirm error accumulates
  there.

### 2. Explain: why is that layer bad?

| Symptom | Likely cause |
|---|---|
| Wide dynamic range / heavy outliers | Min-max calibration coarsened the whole tensor |
| Big cross-channel weight spread | Per-tensor weights instead of per-channel |
| Depthwise conv layers hit hardest | Depthwise has few weights per channel → less redundancy, quantizes poorly |
| First/last layers sensitive | Input/logit layers carry high info density |
| Error appears exactly at one op | Operator limitation (approximate HW implementation), not quantization |
| Attention/LayerNorm/Softmax in BEV head | Reductions + division are precision-sensitive |

### 3. Fix: the mitigation ladder (cheapest first)

1. **Better calibration** — switch min-max → entropy/percentile; use a more representative
   calibration set. Free, often enough.
2. **Per-channel weights** — if you were per-tensor. Big win, cheap on hardware.
3. **Mixed precision** — keep the sensitive layers in **INT16/FP16** (or on the DSP in higher
   precision) while the rest stays INT8. The standard "keep first/last layer higher
   precision" trick lives here.
4. **Cross-layer equalization / bias correction** — PTQ-time tricks that rebalance ranges
   across adjacent layers and correct the mean shift quantization introduces. No retraining.
5. **QAT** — if PTQ tricks still miss, hand the training team a QAT spec so the weights learn
   to tolerate INT8. Most expensive, most effective.
6. **Graph change** — if it's an *operator limitation*, rewrite the op into supported ops, or
   move it to the DSP/CPU where full precision is available (accept the boundary cost).

### 4. Re-measure: both halves

Every fix must be re-checked on **accuracy** *and* **latency** — pushing a layer to FP16/DSP
recovers accuracy but adds a partition boundary and DMA cost. It's a **Pareto trade**, not a
free lunch.

## Worked framing (use your own project)

> "On my project, PTQ dropped mAP by ~4 points. Per-layer SQNR showed the loss concentrated
> in the depthwise blocks and the detection head. I moved the head to INT16 and switched
> activations to entropy calibration — recovered ~3 of the 4 points with a small latency
> cost. The last point I got back with a short QAT fine-tune the training team ran against my
> quantization spec."

(If your real numbers differ, use them — the *shape* of the story is what lands: localize →
explain → cheapest fix → re-measure.)

## Interview soundbite

> "Accuracy loss is almost always a few layers, not the whole network. I localize it with
> per-layer SQNR/cosine, explain it (outliers, per-tensor on a wide range, a depthwise block,
> or an approximate NPU op), then climb a mitigation ladder — recalibrate, per-channel
> weights, mixed precision on the sensitive layers, bias correction, and only then QAT.
> Every fix I re-check against both accuracy and latency."
