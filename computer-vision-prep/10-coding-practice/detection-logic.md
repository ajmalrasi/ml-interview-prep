# Detection Logic

**TL;DR:** The JD's "complex logic layers on top of model detections." You'll get
boxes (or points) and be asked to compute something: **IoU**, **NMS**, who's
**inside a zone**, who **crossed a line**, or the **reading order** of OCR boxes.
Pure Python + NumPy — no model needed. These are classic, so know them cold.

---

## Problem 8: IoU of two boxes

**Tests:** the fundamental box metric; coordinate math; the empty-overlap edge case.

**The problem:** score how much two boxes agree, as a number in [0, 1] — the
currency of all detection logic (NMS, evaluation, tracker matching).

**The plan:**

```text
   +-------+
   |   A   |            IoU = overlap / (areaA + areaB - overlap)
   |   +---+----+
   |   |###|    |       ### intersection rectangle:
   +---+---+    |       its left  = max(A.left,  B.left)
       |    B   |       its right = min(A.right, B.right)
       +--------+       (same idea for top/bottom)
```

**Why this way:** the intersection of two ranges on ONE axis is simply
[max(starts), min(ends)] — do that for x and for y, multiply the two lengths.
The `max(0, ...)` clamp is the whole edge case: for disjoint boxes min-max goes
negative and would fabricate overlap. And union must subtract the intersection,
or the shared area is counted twice.

```python
def iou(a, b):
    """Boxes as (x1, y1, x2, y2). Returns intersection-over-union in [0,1]."""
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])     # intersection top-left
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])     # intersection bottom-right
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)   # clamp at 0 → no overlap
    inter = iw * ih
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    union = area_a + area_b - inter                 # don't double-count the overlap
    return inter / union if union > 0 else 0.0

if __name__ == "__main__":
    print(iou((0, 0, 10, 10), (5, 5, 15, 15)))   # 25 / 175 = 0.142...
```

**Watch out:** the `max(0, ...)` clamp — without it, non-overlapping boxes give a
bogus positive area.

---

## Problem 9: Non-Maximum Suppression (from scratch)

**Tests:** the dedup algorithm every detector needs. Sort by score, greedily keep
the best, drop high-IoU neighbours.

**The problem:** a detector fires several overlapping boxes on the *same*
object. Keep exactly one box per object.

**The plan:**

```text
 scores:  A=0.9   B=0.8   C=0.7
 1. take best remaining:  A  -> KEEP
 2. IoU(A,B)=0.8 (same object)  -> drop B
    IoU(A,C)=0.0 (elsewhere)    -> C survives
 3. take best remaining:  C  -> KEEP        result: [A, C]
```

**Why this way:** greedy-by-confidence works because the highest-score box is
usually the best-localized one — lock it in, delete everything that mostly
overlaps it. The plain-Python version shows the algorithm; the NumPy version
exists because the inner IoU loop is O(n²) — vectorizing "winner vs all
survivors" into one array pass is what makes thousands of boxes per frame
feasible. Name the follow-up: Soft-NMS decays scores instead of deleting, for
crowded scenes where two real objects genuinely overlap.

```python
def nms(boxes, scores, iou_thresh=0.5):
    """boxes: list of (x1,y1,x2,y2); scores: list of floats. Returns kept indices."""
    candidates = sorted(range(len(boxes)), key=lambda i: scores[i], reverse=True)  # best first
    keep = []
    while candidates:
        best = candidates.pop(0)        # highest score still in play
        keep.append(best)
        candidates = [i for i in candidates             # drop everything that
                      if iou(boxes[best], boxes[i]) < iou_thresh]  # overlaps the winner
    return keep
```

NumPy/vectorized version (worth knowing for "make it fast"):

```python
import numpy as np

def nms_np(boxes, scores, iou_thresh=0.5):
    boxes = np.asarray(boxes, dtype=float)
    x1, y1, x2, y2 = boxes.T                # columns → four 1-D arrays
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]          # indices, highest score first
    keep = []
    while order.size > 0:
        best = order[0]; keep.append(best)
        others = order[1:]
        # IoU of `best` vs ALL remaining boxes at once (no inner loop)
        inter_x1 = np.maximum(x1[best], x1[others])
        inter_y1 = np.maximum(y1[best], y1[others])
        inter_x2 = np.minimum(x2[best], x2[others])
        inter_y2 = np.minimum(y2[best], y2[others])
        inter_w = np.maximum(0, inter_x2 - inter_x1)
        inter_h = np.maximum(0, inter_y2 - inter_y1)
        intersection = inter_w * inter_h
        overlaps = intersection / (areas[best] + areas[others] - intersection)
        order = others[overlaps < iou_thresh]   # keep only low-overlap survivors
    return keep
```

**Watch out:** reuse `iou` from Problem 8 — interviewers love when you compose.
Soft-NMS (decay scores instead of dropping) is the follow-up for crowded scenes.

---

## Problem 10: Count detections inside a zone (point-in-polygon)

**Tests:** geometry on detections; using the **bottom-center** (foot) point, not
the box center.

**The problem:** given detection boxes and a zone polygon, count who is IN the
zone.

**The plan:**

```text
      zone (on the floor)          a tall object, oblique camera:
   +---------------+                 +----+
   |               |                 |    | <- box CENTER lands here
   |      x <------|---- foot        |    |    (inside the zone?!)
   +---------------+                 |    |
                                     | x  | <- foot = ((x1+x2)/2, y2)
                                     +----+    where it actually STANDS
```

**Why this way:** zones are painted on the *floor*, and objects touch the world
at their *feet* — with an angled camera, a box's geometric center can sit inside
a zone the object isn't standing in. Using the bottom-center point is the
standard fix (and a favorite interview gotcha). `cv2.pointPolygonTest` handles
arbitrary polygons; pass `False` to get just the inside/on/outside sign — we
don't need the distance, and skipping it is faster.

```python
import cv2
import numpy as np

def count_in_zone(boxes, polygon):
    """polygon: list of (x,y). Counts boxes whose foot point is inside."""
    polygon_pts = np.array(polygon, dtype=np.int32)
    count = 0
    for (x1, y1, x2, y2) in boxes:
        foot = (int((x1 + x2) / 2), int(y2))            # bottom-center point
        if cv2.pointPolygonTest(polygon_pts, foot, False) >= 0:  # >=0 = inside/on
            count += 1
    return count
```

**Watch out:** use the **foot point** (where the object meets the floor), not the
geometric center — the standard gotcha for tall objects / oblique cameras.

---

## Problem 11: Line-crossing counter (direction-aware)

**Tests:** tracking-style logic; cross-product sign to detect a crossing and its
direction between consecutive frames.

**The problem:** count objects crossing a virtual line — separately for each
direction (entering vs leaving).

**The plan:**

```text
             p_prev   (side +)
  A ------------ line ------------ B
             p_cur    (side -)

 side(p) = z of cross product (B-A) x (p-A)
 sign flips between consecutive frames  ==>  the track crossed
 which sign it ENDS on                  ==>  which direction
```

**Why this way:** comparing raw x or y coordinates only works for perfectly
vertical/horizontal lines; the cross-product sign works for a line at *any*
angle and gives direction for free. Counting per **track id** (not per frame)
is essential — one person crossing would otherwise be counted at every frame
near the line. In production you'd also debounce (require K of N frames on the
new side) to survive detector flicker.

```python
def side(line_a, line_b, p):
    """Sign of which side of line (a->b) point p is on (cross product z)."""
    return ((line_b[0] - line_a[0]) * (p[1] - line_a[1]) -
            (line_b[1] - line_a[1]) * (p[0] - line_a[0]))   # >0 / <0 / 0=on line

def count_crossings(tracks, line_a, line_b):
    """tracks: {id: [(x,y) per frame]}. Returns (in_count, out_count)."""
    entering = leaving = 0
    for path in tracks.values():
        for prev_point, cur_point in zip(path, path[1:]):   # consecutive frames
            side_prev = side(line_a, line_b, prev_point)
            side_cur = side(line_a, line_b, cur_point)
            if side_prev == 0 or side_cur == 0:   # exactly ON the line: skip
                continue
            if (side_prev > 0) != (side_cur > 0):   # sign flipped → crossed
                if side_cur > 0: entering += 1
                else: leaving += 1
    return entering, leaving
```

**Watch out:** count **per track id** so one object is counted once per crossing,
not once per frame. Debounce flicker in real systems (K-of-N frames).

---

## Problem 12: Sort OCR boxes into reading order

**Tests:** turning detections into text order — group into rows, then left-to-right.

**The problem:** OCR returns word boxes in arbitrary order; reconstruct the
order a human would read them in.

**The plan:**

```text
 naive sort by (y, x) fails:  same-line words differ by a few px in y,
                              so the sort interleaves lines:
                              word(y=10) word(y=12) word(y=11) ...

 fix: 1. sort by y      2. group into ROWS with a tolerance
      3. sort each row by x     4. concatenate rows
```

**Why this way:** the tolerance (about half the text height) is what makes row
grouping robust to slightly wavy or tilted scans; the running-average row
anchor keeps a long row from drifting. A single lexicographic sort has no such
slack — it's the bug interviewers expect you to know about. This exact "logic
on top of an OCR model" is KoiReader's bread and butter.

```python
def reading_order(boxes, row_tol=15):
    """boxes: list of (x1,y1,x2,y2). Returns indices in reading order."""
    order = list(range(len(boxes)))
    order.sort(key=lambda i: boxes[i][1])         # by top y first
    rows, current_row, current_row_y = [], [], None
    for i in order:
        box_center_y = (boxes[i][1] + boxes[i][3]) / 2
        if current_row_y is None or abs(box_center_y - current_row_y) <= row_tol:
            current_row.append(i)                 # same line of text
            current_row_y = (box_center_y if current_row_y is None
                             else (current_row_y + box_center_y) / 2)  # running avg
        else:
            rows.append(current_row)              # row finished, start a new one
            current_row, current_row_y = [i], box_center_y
    if current_row:
        rows.append(current_row)
    result = []
    for row in rows:
        row.sort(key=lambda i: boxes[i][0])       # within a row, left to right
        result.extend(row)
    return result
```

**Watch out:** `row_tol` groups boxes into the same line; tune to text height.
This is exactly the kind of "logic on top of an OCR model" KoiReader builds.

→ Next: **[video-and-streaming.md](video-and-streaming.md)**
