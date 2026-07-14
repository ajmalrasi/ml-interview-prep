# Detection & Segmentation for AD

**TL;DR:** Perception models share a **backbone → neck → head** skeleton. Detection heads
predict boxes + classes; segmentation heads predict per-pixel labels. For deployment, the
**backbone is NPU-friendly** (conv-heavy, static) and the **head is where the trouble is**
(NMS, dynamic outputs, upsampling). Know the metrics (mAP, IoU) and the deploy gotchas.

## The universal skeleton

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">image(s)</span>
    <span class="arw labeled"><span class="al">backbone</span></span>
    <span class="node">features<span class="nsub">ResNet / RegNet / ViT</span></span>
    <span class="arw labeled"><span class="al">neck</span></span>
    <span class="node">multi-scale<span class="nsub">FPN / BiFPN</span></span>
    <span class="arw labeled"><span class="al">head</span></span>
    <span class="node out">boxes / masks / classes</span>
  </div>
</div>
```

- **Backbone** — a CNN (ResNet, RegNet, EfficientNet) or a vision transformer; extracts
  features. **Conv-heavy, static shapes → maps well to NPU/CNNIP.**
- **Neck (FPN)** — fuses features across scales so small and large objects both get
  represented. Mostly conv + upsample.
- **Head** — task-specific prediction.

## Object detection

- **Two-stage** (Faster R-CNN) — propose regions, then classify/refine. Accurate, heavier,
  more control flow → harder to deploy.
- **One-stage** (YOLO, SSD, RetinaNet) — predict boxes directly on a grid. Faster, the
  **default for automotive edge**.
- **Anchor-based vs anchor-free** — anchors are predefined box priors; anchor-free (FCOS,
  CenterNet) predicts centers/offsets, fewer hyperparameters.
- **DETR-style** (transformer, set prediction) — no NMS, but attention + bipartite matching;
  heavier for NPUs.

**Metric — mAP (mean Average Precision):** for each class, sweep the confidence threshold,
compute precision/recall, take the area under the PR curve (AP), average over classes. **mAP@0.5**
uses IoU≥0.5 to count a hit; **mAP@[.5:.95]** averages over IoU thresholds (COCO). IoU =
intersection/union of predicted and ground-truth boxes.

**Deploy gotchas:**
- **NMS** (non-max suppression) — removes duplicate boxes. Control-flow + dynamic output
  count → **runs on CPU/DSP at the graph tail**, not the NPU. Keep it out of the NPU
  subgraph.
- **Decode** — converting raw head outputs to boxes (sigmoid, exp, anchor math) is cheap but
  fiddly; often folded into post-processing on CPU/DSP.
- **Dynamic #detections** — pad to a max count so downstream shapes stay static.

## Segmentation

- **Semantic** — every pixel gets a class (road, car, pedestrian). No instance separation.
  Heads: FCN, U-Net (encoder-decoder + skips), DeepLab (atrous/dilated conv + ASPP).
- **Instance** — separate each object (Mask R-CNN = detection + per-box mask).
- **Panoptic** — semantic + instance unified (stuff + things).

**Metric — IoU / mIoU:** per-class intersection-over-union of predicted vs true pixel masks,
averaged over classes (**mean IoU**). For instance/panoptic: mask AP, PQ (panoptic quality).

**Deploy gotchas:**
- **Upsampling / `Resize`** in the decoder — mode/align_corners mismatches between framework
  and NPU cause both fallbacks and subtle accuracy drift. Pin the mode; prefer
  transpose-conv or fixed-scale resize the NPU supports.
- **Full-resolution output** — large activation tensors stress DRAM bandwidth (memory-bound
  — see [roofline](../01-embedded-accelerators/npu-dsp-cnnip.md)). Segmentation is often the
  bandwidth hog in a multi-task model.
- **Atrous/dilated conv** — check the NPU supports the dilation rates you use.

## Classification

The simplest head — global pool + linear + softmax. Rarely the deployment problem, but shows
up as the **backbone** of everything and as auxiliary heads (traffic-sign type, light state).
Metric: top-1 / top-5 accuracy.

## The deployment summary table

| Component | NPU-friendliness | Watch for |
|---|---|---|
| CNN backbone | High | Nothing unusual — this is the happy path |
| FPN neck | High | Upsample mode |
| Detection head (dense) | Medium | Decode math |
| NMS / post-processing | **Low** | Keep off NPU, at graph tail |
| Segmentation decoder | Medium | `Resize` modes, big activations (bandwidth) |
| Transformer/DETR head | **Low** | Attention, dynamic shapes, LayerNorm precision |

## Interview soundbite

> "Backbone-neck-head. The backbone and neck are conv-heavy and map straight onto the NPU;
> the action is in the head. For detection I keep NMS and decode off the accelerator at the
> graph tail and pad detections to a static max. For segmentation I watch the `Resize` modes
> and the full-res activation bandwidth. mAP with IoU thresholds for detection, mIoU for
> segmentation."
