# 10 — Coding Practice (Proctored Round)

**TL;DR:** Your KoiReader round on **4 July** is a *proctored, hands-on coding
test* — camera on, screen shared, **no AI, no copying full solutions** (syntax
Googling only). So the goal isn't to read these — it's to be able to **type them
from memory**. KoiReader's product reads labels/barcodes/packages in supply-chain
video, so expect **practical OpenCV + image-processing + geometry + detection-logic**
tasks that **produce output images**, not LeetCode puzzles.

> **Play with the code live.** Every problem below is also a runnable Jupyter
> notebook. **[▶ Open the live notebooks ↗](JUPYTER)** (or use the *Open live
> notebooks* button, top-left). That opens JupyterLab running on this same device —
> start it first with `bash run.sh`, or as the `koi-jupyter` service (see
> [Live Playground](../RUN-PLAYGROUND.md)). Reading builds memory; running builds
> intuition. Use both.

## What to anticipate (ranked by likelihood)

1. **Image preprocessing for OCR/label reading** — grayscale, blur, Otsu/adaptive
   threshold, morphology, denoise, CLAHE. → [image-processing-and-geometry.md](image-processing-and-geometry.md)
2. **Geometry / perspective** — the classic "scan a receipt/label": detect the
   document quadrilateral and warp it flat (4-point perspective transform),
   deskew, resize-with-padding. → same file. **Very likely — practice this most.**
3. **Contours & shape detection** — Canny → findContours → bounding boxes, largest
   rectangle, crop. → same file.
4. **Logic on detections** — IoU, NMS, point-in-polygon (zones), line-crossing
   counting, sorting OCR boxes into reading order. → [detection-logic.md](detection-logic.md)
5. **Video / stream processing** — open a video (or RTSP), read frames robustly,
   motion/frame-differencing, sample every Nth frame, annotate, save output.
   → [video-and-streaming.md](video-and-streaming.md)
6. **Python + NumPy engineering** — vectorization (no Python pixel loops), a
   fault-tolerant batch processor, basic algorithm. → [python-and-numpy.md](python-and-numpy.md)
7. **Quick reference to memorize** — [opencv-cheat-sheet.md](opencv-cheat-sheet.md).

## How to practice this week (4 days)

- **Type, don't read.** Turn off Copilot/autocomplete and rewrite each solution
  from a blank file until it flows. That's exactly the test condition.
- **Run everything.** `pip install opencv-python numpy`. Test each script on a
  sample image (any photo / `cv2` works on jpg/png). Confirm it saves the output.
- **Day 1:** image-processing-and-geometry (preprocessing + perspective).
- **Day 2:** detection-logic + reading order.
- **Day 3:** video-and-streaming + python-and-numpy.
- **Day 4 (test morning):** re-type the 4-point transform, IoU, NMS, and a robust
  `cv2.VideoCapture` loop from memory; skim the cheat sheet.

## Submission rules baked into muscle memory

One file **per problem** · `.py` as-is, **`.ipynb` → export `.html`** · **no zip**
· **upload required output images** to the OneDrive folder · email a confirmation
when done · single attempt. Losing marks for submission format is the easiest way
to fail — practice *saving named output files* as part of every solution.

## Minimal boilerplate to start any problem

```python
import cv2
import numpy as np

img = cv2.imread("input.jpg")          # BGR, shape (H, W, 3), dtype uint8
if img is None:
    raise FileNotFoundError("input.jpg")  # always guard reads (fault tolerance)

# ... process ...

cv2.imwrite("output.jpg", result)      # save the deliverable image
print("saved output.jpg", result.shape)
```

→ Start: **[image-processing-and-geometry.md](image-processing-and-geometry.md)**
