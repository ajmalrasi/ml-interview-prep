# AI Application Engineer (Automotive SoC) — Learning Path

Everything for the **AI Application Engineer** interview — enabling, optimizing, and
deploying AI models (BEV, detection, segmentation, classification) on **automotive-grade
SoCs** with CNNIP / DSP / NPU hardware accelerators. Read **top to bottom the first time**;
come back to any page as a reference (or the morning of) anytime.

The role in one line: **take a trained CV model and make it run fast, accurately, and
safely on an embedded automotive accelerator** — quantize it, get it through the ONNX
compiler/runtime toolchain, map its operators onto the NPU/DSP, debug the offload, and
validate it on target boards and simulators.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">Trained model<span class="nsub">PyTorch · BEV / det / seg</span></span>
    <span class="arw labeled"><span class="al">export</span></span>
    <span class="node">ONNX + QDQ<span class="nsub">graph surgery · PTQ/QAT</span></span>
    <span class="arw labeled"><span class="al">compile</span></span>
    <span class="node">partition + map<span class="nsub">NPU / DSP / CPU</span></span>
    <span class="arw labeled"><span class="al">deploy</span></span>
    <span class="node out">on-target inference<span class="nsub">Linux / QNX · SIL / HIL</span></span>
  </div>
</div>
```

## What this role actually wants (and how you stack up)

| JD requirement | Where you build it | Gap to close |
|---|---|---|
| Enable/deploy AI models (BEV, detection, seg, cls) on Gen4/5 SoC with CNNIP/DSP/NPU | `01`, `04` | **Medium** — you know detection/seg; add BEV models and the NPU/DSP mental model. |
| Performance analysis (latency, throughput, multi-core scaling), find bottlenecks | `05` | **Strong-ish** — you profile GPUs; re-frame around memory bandwidth, DMA, scheduling on a fixed SoC. |
| PTQ / QAT collaboration, operator fusion, graph optimization, partitioning | `02`, `03` | **Strong** — quantization is home turf; add ONNX-native fusion/partitioning vocabulary. |
| Analyze quantization/operator accuracy loss and propose mitigations | `03` | **Strong** — you've done PTQ→QAT recovery; make the diagnosis checklist explicit. |
| Integrate into embedded runtimes (Linux / QNX); debug offload, IPMMU, DMA, multi-core sync | `06`, `05` | **Gap** — learn QNX vs Linux, IPMMU/DMA, and the offload debug loop. |
| Validate on target boards and simulators (SIL / HIL) | `06` | **Gap** — learn the SIL/HIL vocabulary and what each validates. |
| ONNX workflows: graph inspection/modification, segmentation, QDQ models | `02` | **Medium** — go beyond "export from PyTorch": graph surgery, QDQ, execution control. |
| PyTorch / ONNX / ONNX Runtime, strong Python, C/C++ a plus | throughout | **Strong** on Python/PyTorch/ONNX; brush up C/C++ for the runtime side. |
| Automotive SoCs / safety software (QNX, ISO 26262 / ASIL) | `06` | **Gap** — get the functional-safety framing even at a talking-point level. |

**Headline:** Your quantization + inference-optimization background is exactly what this
role is built on. The three things to add are (1) the **embedded-accelerator** mental model
(NPU/DSP/CNNIP, offload, partitioning) vs. your GPU/TensorRT experience, (2) the
**ONNX-native toolchain** as a first-class workflow, and (3) the **automotive** layer —
QNX, SIL/HIL, functional safety, and BEV perception. This pack closes exactly those.

## How this maps to what you already have

You've already studied the GPU/TensorRT version of most optimization concepts in the
**ml-engineer-prep** track (§12 NVIDIA Model Optimization, §13 LLM/VLM Optimization) and the
**computer-vision-prep** track (§03 Low-Latency Inference, §14 Deep Learning for Video).
This track is the **embedded, vendor-neutral, automotive** re-framing of that knowledge:
where TensorRT was the compiler and the GPU was the target, here the compiler is an
**ONNX-based toolchain** and the target is a fixed-function **NPU/DSP** with hard memory
and safety constraints. When a page overlaps, it says so and points back.

## Topics (in order)

| # | Folder | What you learn |
|---|--------|----------------|
| 1 | [01-embedded-accelerators/](01-embedded-accelerators/) | NPU / DSP / CNNIP HWA, operator mapping, offload, unsupported-op fallback |
| 2 | [02-onnx-toolchain/](02-onnx-toolchain/) | ONNX format, graph surgery, QDQ models, compiler/runtime, execution partitioning |
| 3 | [03-quantization-embedded/](03-quantization-embedded/) | PTQ, QAT, calibration methods, diagnosing & mitigating accuracy loss |
| 4 | [04-bev-perception/](04-bev-perception/) | Detection & segmentation for AD, BEV (LSS / BEVFormer / BEVFusion), occupancy |
| 5 | [05-soc-architecture/](05-soc-architecture/) | Memory hierarchy, DMA, IPMMU, multi-core scheduling, performance analysis |
| 6 | [06-runtime-safety-validation/](06-runtime-safety-validation/) | Linux / QNX runtime, SIL / HIL validation, ISO 26262 / ASIL functional safety |
| 7 | [07-interview-qa/](07-interview-qa/) | Rapid-fire Q&A and the one-page morning-of cheat sheet |
