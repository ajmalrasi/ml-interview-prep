# Object Detection

**TL;DR:** Detection is two jobs at once — draw a box around each object and say what it
is — and for live CCTV the architecture choice is dictated by one hard requirement:
real-time speed on every camera. That's why you reach for a single-stage detector like
YOLO rather than a more accurate but slower two-stage one. Beyond that choice, there are
three things you'll certainly be asked to explain: how the detector cleans up its own
duplicate boxes (NMS), and what its accuracy number (mAP) actually means, and why crowds
break both.

## The fork in the road: one stage or two

There are two lineages of detector, and the difference is a speed-accuracy trade. A
**two-stage** detector like Faster R-CNN first proposes candidate regions, then classifies
each one — historically more accurate, especially on small objects, but slower because
it's doing two passes of work. A **single-stage** detector like YOLO predicts boxes and
classes in one forward pass over a grid — fast enough for real time, and modern versions
have closed most of the old accuracy gap. For CCTV the decision makes itself: with a dozen
cameras each needing many frames per second, you cannot afford two passes, so you say
plainly, *"I need one forward pass at real-time FPS per camera, so I use a YOLO-family
single-stage detector."*

## Anchors, and the move away from them

Within single-stage detectors there's one more distinction worth holding. Older YOLOs and
SSD are **anchor-based**: they start from a set of predefined box shapes at each grid
location and predict adjustments to them, which means you have to tune those anchor
sizes to match your objects. Newer detectors — YOLOX, FCOS, YOLOv8 — are **anchor-free**:
they predict object centres and sizes directly, with no anchor hyperparameters to fuss
over. The trend is toward anchor-free because it's simpler, and it's a fine thing to note
as showing you've kept current.

The YOLO idea itself is worth being able to sketch in a sentence: divide the image into a
grid, and have each cell predict a few boxes, an "is there an object here" score, and class
probabilities — all in one pass. Modern versions bolt on a CSPDarknet backbone, an FPN-style
neck for multi-scale (straight from the last page), and mosaic augmentation, but the "one
pass over a grid" mental model is what interviewers actually want, not a recital of version
numbers.

## NMS: the question you *will* get

A detector doesn't emit one clean box per object — it emits a messy pile of overlapping
boxes, several firing on the same person. Non-max suppression is how it picks the winners:

```
1. sort all boxes by score
2. keep the highest-scoring one
3. delete any remaining box that overlaps it too much (IoU above a threshold) — a duplicate
4. repeat with the next-highest survivor
```

The measure of overlap is **IoU**, intersection over union — the shared area divided by the
combined area, from 0 to 1. And here's the crowd trap that makes this more than trivia: set
the IoU threshold too low and NMS will delete *real* people, because two genuinely separate
heads standing close together overlap enough to look like duplicates of one object. So in
dense scenes you reach for **Soft-NMS**, which *decays* the score of overlapping boxes
rather than deleting them outright — a specific, crowd-aware answer that shows you've
thought past the textbook.

## mAP: the metric you must be able to explain

If there's one number an interviewer will make you define, it's mAP, so build it up from the
bottom. IoU decides whether a predicted box counts as correct — if it overlaps the true box
by at least some threshold, say 0.5, it's a true positive. From true and false positives you
get precision and recall, and sweeping the confidence threshold traces out a
precision-recall curve. The area under that curve, for one class, is the **average
precision**; average that over all classes and you have **mean average precision**, mAP.

```
IoU ≥ threshold ⇒ a prediction is a True Positive
precision = TP / (TP + FP),  recall = TP / (TP + FN)
AP  = area under the precision-recall curve, per class
mAP = mean of AP across classes
mAP@0.5 is the loose version; mAP@[0.5:0.95] averages over IoU thresholds — COCO's strict one
```

Two things to say so you sound precise rather than vague. The precision-recall trade-off
*is* the confidence threshold — moving it slides you along that curve. And always state the
IoU threshold, because "mAP" alone is ambiguous between the loose 0.5 and the strict
0.5-to-0.95 average. Then connect it to the job: for *counting*, recall matters most, since
every missed person is an undercount; for a *security alert*, precision may matter more.
Tie the metric to the use case and you've shown you understand why it exists.

## The detection problems specific to CCTV

A few challenges are near-guaranteed to come up because they're endemic to surveillance.
Small, distant objects push you toward higher input resolution, FPN, and sometimes tiling
the frame into pieces. Occlusion in crowds pushes you toward detecting heads rather than
bodies, toward Soft-NMS, and — when it's truly hopeless — toward the density estimation from
section 11. Class imbalance, since almost everything is "person," is handled with focal loss
or balanced sampling. And domain shift, where the training scene doesn't match the deployed
camera's angle and lighting, is exactly what the training page and the drift monitoring in
section 13 are there to address.

**Self-check.** Why single-stage for live CCTV? *(one forward pass, so real-time FPS on
every camera.)* Walk through NMS — and why does too low an IoU threshold hurt crowd
counting? *(it suppresses true nearby detections as if they were duplicates, causing an
undercount; use Soft-NMS.)* What is mAP@[0.5:0.95]? *(average precision averaged over IoU
thresholds from 0.5 to 0.95, then meaned across classes — COCO's strict metric.)* And for
people-counting, precision or recall? *(recall — a miss is an undercount.)*
