# ⏱ 90-Minute Mock Test

**TL;DR:** A realistic dry run of the KoiReader proctored round. Set a **90-minute
timer**, work in the blank starter notebook (`notebooks/05_mock_test.ipynb`),
**don't look at the solutions** until you're done. Solutions:
[mock-solutions.md](mock-solutions.md).

## Simulate the real conditions

- **No AI, no autocomplete.** Disable Copilot/AI suggestions. Google **syntax only**.
- One **timer, 90 minutes**, four problems. Don't get stuck — bank the easy marks
  first (Problem 4 is quick).
- **Save every required output file** with the exact name asked. Producing the
  output image/CSV is part of the score, just like the real test.
- When done, practice exporting: `jupyter nbconvert --to html notebooks/05_mock_test.ipynb`.

The starter notebook's setup cell generates all inputs (`label.jpg`, `clip.avi`,
`imgs/`, a detections list) so everything runs offline.

---

## Problem 1: Label scanner (25 min)

`label.jpg` is a photo of a label/document lying at an angle on a darker
background. Produce a clean, top-down, OCR-ready scan.

**Required:**
1. Detect the document's four corners and apply a perspective transform to get a
   straight, top-down view. Save it as **`p1_scan.png`**.
2. From that scan, produce a binarized (black-and-white) version suitable for OCR.
   Save it as **`p1_binary.png`**.

**Tests:** Canny + contours + `approxPolyDP`, `getPerspectiveTransform` /
`warpPerspective`, ordering 4 points, thresholding. *Watch the float32 point
ordering.*

---

## Problem 2: Detection post-processing + zone count (25 min)

You're given a list of detections (each `(x1, y1, x2, y2, score)`) and a polygon
**zone** (list of points). The model over-fires with overlapping boxes.

**Required:**
1. Run **NMS** (IoU threshold 0.5) to remove duplicates.
2. Count how many surviving detections have their **bottom-center point** inside
   the zone. **Print** "kept N, in-zone M".
3. Draw on a blank 720×720 canvas: the zone outline (blue), surviving boxes
   (green), and boxes inside the zone (red). Save as **`p2_annotated.png`**.

**Tests:** IoU + NMS from scratch, `cv2.pointPolygonTest`, drawing. *Use the foot
point, not the box center.*

---

## Problem 3: Video motion summary (25 min)

`clip.avi` is a short video with a moving object.

**Required:**
1. Detect motion with frame differencing; a frame "has motion" if the largest
   moving region's area exceeds a threshold you choose.
2. Draw green boxes around moving regions and write the annotated video to
   **`p3_motion.avi`**.
3. **Print** the total frame count and how many frames had motion. Save **three**
   sample annotated frames as **`p3_frame_0.png`, `p3_frame_1.png`, `p3_frame_2.png`**.

**Tests:** robust `VideoCapture` loop, `absdiff` + threshold + contours,
`VideoWriter` (size must match), saving frames. *Release everything in a `finally`.*

---

## Problem 4: Robust batch report (15 min)

Folder `imgs/` holds several images — **some are corrupt**.

**Required:**
1. For each readable image, compute its **mean brightness** (mean of the grayscale
   pixels). **Skip and log** corrupt/unreadable files without crashing.
2. Write **`p4_report.csv`** with header `filename,mean_brightness`, rows sorted by
   brightness **descending**.
3. **Print** how many files were processed and how many skipped.

**Tests:** fault-tolerant file loop (`cv2.imread` returns None!), grayscale mean,
CSV writing, sorting. *One bad file must not kill the batch.*

---

## Scoring (be honest with yourself)

| Area | Check |
|---|---|
| Correctness | Does each output file look right? Counts sensible? |
| Submission hygiene | Exact filenames? Outputs actually saved? Would convert to `.html`? |
| Robustness | Guards on `imread`/capture? No crash on bad input? |
| Speed | Finished P4 + at least two others in 90 min? |
| Clean code | Readable, no dead code, sensible names? |

When time's up, open **[mock-solutions.md](mock-solutions.md)** and compare. Re-do
anything you couldn't finish — the second pass is where it sticks.

→ Solutions: **[mock-solutions.md](mock-solutions.md)**
