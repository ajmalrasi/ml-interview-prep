# Object Detection

**TL;DR:** Localize + classify. CCTV → **single-stage (YOLO)**: one forward pass, real-time. Know NMS + mAP cold.

## One-stage vs two-stage
| | Two-stage (Faster R-CNN) | One-stage (YOLO/SSD) |
|---|---|---|
| how | propose regions → classify | boxes+classes in one pass over grid |
| speed | slower | **real-time** |
| CCTV | rarely | **default** (need FPS/camera) |

**Say:** *"Need one forward pass at real-time FPS per camera → YOLO-family single-stage."*

## Anchors
- **Anchor-based** (YOLOv3–5, SSD) — predefined box priors; must tune sizes.
- **Anchor-free** (YOLOX, FCOS, YOLOv8) — predict centers directly; simpler, now standard.

**YOLO idea:** grid; each cell predicts boxes + objectness + classes, one pass. + CSPDarknet + FPN/PAN neck + mosaic aug.

## NMS (guaranteed question)
```
1 sort by score  2 keep top  3 drop boxes with IoU>thr vs it (dupes)  4 repeat
IoU = intersection/union (0..1)
```
- **Crowd trap:** low IoU thr suppresses **real nearby people** → under-count. → **Soft-NMS** (decay scores, not delete).

## Loss
localization (IoU/GIoU/CIoU) + objectness + classification (**focal loss** for fg/bg imbalance).

## mAP (must explain)
```rawhtml
<div class="formula">
  <div class="frow"><span class="fexpr"><span class="fv">IoU ≥ thr</span> → True Positive</span></div>
  <div class="frow"><span class="fexpr">precision = TP/(TP+FP)</span><span class="fexpr" style="margin-left:12px">recall = TP/(TP+FN)</span></div>
  <div class="frow"><span class="fexpr"><span class="fv">AP</span> = area under PR curve (per class)</span><span class="fexpr" style="margin-left:12px"><span class="fv">mAP</span> = mean AP over classes</span></div>
  <div class="frow"><span class="fnote">mAP@0.5 = loose · mAP@[0.5:0.95] = COCO strict (averaged over IoU thresholds)</span></div>
</div>
```
- PR trade-off = the **confidence threshold**. Always state the IoU thr.
- **Counting → recall** (miss = under-count). **Security alert → precision**.

## CCTV challenges
small/far (↑res, FPN, tile) · occlusion (head detect, Soft-NMS, density §11) · imbalance (focal) · domain shift (§14 train, §13 drift).

## Q&A
- Single-stage why? → one pass, real-time FPS/camera.
- NMS + low-IoU hurts counting? → suppresses true nearby → under-count; Soft-NMS.
- mAP@[0.5:0.95]? → AP avg over IoU 0.5–0.95, mean over classes.
- Counting → precision or recall? → recall.
