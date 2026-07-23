# Mock: Solutions (don't peek until you've tried!)

**TL;DR:** Reference solutions for the [90-minute mock](mock-test.md). Yours
doesn't need to match line-for-line — check that outputs are correct, files are
saved with the right names, and inputs are guarded. All four are tested and runnable.

---

## Problem 1: Label scanner

```python
import cv2
import numpy as np

def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]; rect[2] = pts[np.argmax(s)]
    d = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(d)]; rect[3] = pts[np.argmax(d)]
    return rect

def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    maxW = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    maxH = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
    dst = np.array([[0, 0], [maxW - 1, 0], [maxW - 1, maxH - 1], [0, maxH - 1]],
                   dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (maxW, maxH))

def solve_p1(path="label.jpg"):
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 50, 150)
    cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cnts = sorted(cnts, key=cv2.contourArea, reverse=True)[:5]
    doc = None
    for c in cnts:
        approx = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True)
        if len(approx) == 4:
            doc = approx.reshape(4, 2).astype("float32"); break
    if doc is None:
        raise RuntimeError("document not found")
    scan = four_point_transform(img, doc)
    cv2.imwrite("p1_scan.png", scan)
    g = cv2.cvtColor(scan, cv2.COLOR_BGR2GRAY)
    binary = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    cv2.imwrite("p1_binary.png", binary)
    print("saved p1_scan.png", scan.shape, "and p1_binary.png")

solve_p1()
```

**Marks:** found 4 corners, warped flat, binarized, **both files saved**.

---

## Problem 2: Detection post-processing + zone count

```python
import cv2
import numpy as np

def iou(a, b):
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    ua = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter
    return inter / ua if ua > 0 else 0.0

def nms(boxes, scores, thr=0.5):
    idxs = sorted(range(len(boxes)), key=lambda i: scores[i], reverse=True)
    keep = []
    while idxs:
        cur = idxs.pop(0); keep.append(cur)
        idxs = [i for i in idxs if iou(boxes[cur], boxes[i]) < thr]
    return keep

def solve_p2(dets, zone):
    boxes = [d[:4] for d in dets]
    scores = [d[4] for d in dets]
    keep = nms(boxes, scores, 0.5)
    poly = np.array(zone, np.int32)
    canvas = np.full((720, 720, 3), 40, np.uint8)
    cv2.polylines(canvas, [poly], True, (255, 120, 0), 2)      # zone blue (BGR)
    in_zone = 0
    for i in keep:
        x1, y1, x2, y2 = boxes[i]
        foot = (int((x1 + x2) / 2), int(y2))
        inside = cv2.pointPolygonTest(poly, foot, False) >= 0
        color = (0, 0, 255) if inside else (0, 255, 0)         # red if in zone
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 2)
        if inside:
            in_zone += 1
    cv2.imwrite("p2_annotated.png", canvas)
    print(f"kept {len(keep)}, in-zone {in_zone}")

# example inputs (the starter notebook provides these)
dets = [(100,100,200,260,0.95),(110,108,205,265,0.90),   # overlapping pair
        (430,420,520,560,0.88),(300,80,360,140,0.70)]
zone = [(80,300),(520,300),(520,640),(80,640)]
solve_p2(dets, zone)
```

**Marks:** NMS drops the overlap (4 → 3), correct in-zone count, annotated image
saved with the right colours.

---

## Problem 3: Video motion summary

```python
import cv2

def solve_p3(path="clip.avi"):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    writer = cv2.VideoWriter("p3_motion.avi",
                             cv2.VideoWriter_fourcc(*"MJPG"), fps, (w, h))
    prev = None
    total = motion_frames = saved = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            total += 1
            gray = cv2.GaussianBlur(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY),
                                    (21, 21), 0)
            moved = False
            if prev is not None:
                th = cv2.threshold(cv2.absdiff(prev, gray), 25, 255,
                                   cv2.THRESH_BINARY)[1]
                th = cv2.dilate(th, None, iterations=2)
                cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL,
                                           cv2.CHAIN_APPROX_SIMPLE)
                for c in cnts:
                    if cv2.contourArea(c) < 500:
                        continue
                    moved = True
                    x, y, bw, bh = cv2.boundingRect(c)
                    cv2.rectangle(frame, (x, y), (x+bw, y+bh), (0, 255, 0), 2)
            if moved:
                motion_frames += 1
            if saved < 3 and moved:
                cv2.imwrite(f"p3_frame_{saved}.png", frame); saved += 1
            writer.write(frame)
            prev = gray
    finally:
        cap.release(); writer.release()
    print(f"total {total} frames, {motion_frames} with motion, saved {saved} samples")

solve_p3()
```

**Marks:** robust loop with `finally` release, motion count printed, video +
3 frames saved, `VideoWriter` size matches.

---

## Problem 4: Robust batch report

```python
import cv2
import os
import csv
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

def solve_p4(in_dir="imgs", out_csv="p4_report.csv"):
    rows, ok, fail = [], 0, 0
    for name in sorted(os.listdir(in_dir)):
        path = os.path.join(in_dir, name)
        try:
            img = cv2.imread(path)
            if img is None:
                raise ValueError("unreadable / corrupt")
            mean = float(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).mean())
            rows.append((name, round(mean, 2))); ok += 1
        except Exception as e:
            logging.warning("skipped %s: %s", name, e); fail += 1
    rows.sort(key=lambda r: r[1], reverse=True)           # brightest first
    with open(out_csv, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["filename", "mean_brightness"])
        w.writerows(rows)
    print(f"processed {ok}, skipped {fail} -> {out_csv}")

solve_p4()
```

**Marks:** corrupt file skipped (not a crash), CSV sorted descending with the
right header, counts printed.

---

## Debrief

- Did you **save every required file** with the exact name? That's free marks lost
  if not.
- Did you **guard** `cv2.imread` / `VideoCapture`? Real test inputs can be messy.
- Did you bank Problem 4 (quick) early before sinking time into Problem 1?
- Re-do any you couldn't finish, then export to HTML to rehearse submission.

→ Back to [the mock paper](mock-test.md) · [chapter overview](README.md)
