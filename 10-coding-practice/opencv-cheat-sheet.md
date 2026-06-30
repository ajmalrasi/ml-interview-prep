# OpenCV Cheat Sheet (Memorize)

**TL;DR:** No AI during the test, so the API has to be in your head. This is the
80% you'll actually reach for. Re-type a few of these from memory the morning of.

---

## I/O & basics

```python
import cv2, numpy as np
img = cv2.imread("in.jpg")             # BGR uint8, (H,W,3); None if missing!
img = cv2.imread("in.jpg", cv2.IMREAD_GRAYSCALE)
cv2.imwrite("out.png", img)
h, w = img.shape[:2]                    # rows, cols  (y before x)
roi = img[y1:y2, x1:x2]                 # crop = rows then cols
```

Remember: **BGR not RGB**, dtype **uint8** (0–255), shape **(H, W, C)**, `imread`
returns **None** on failure (guard it).

## Color

```python
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
hsv  = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)     # hue for color segmentation
rgb  = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)     # before feeding most models
mask = cv2.inRange(hsv, (35,80,80), (85,255,255))   # threshold a colour range
```

## Blur / denoise

```python
cv2.GaussianBlur(img, (5,5), 0)         # ksize must be odd
cv2.medianBlur(img, 5)                  # salt-and-pepper
cv2.bilateralFilter(img, 9, 75, 75)     # smooth but keep edges
```

## Threshold

```python
_, th = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
_, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)   # auto
th = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                           cv2.THRESH_BINARY, 31, 10)   # blockSize odd, then C
```

## Morphology

```python
k = cv2.getStructuringElement(cv2.MORPH_RECT, (3,3))
cv2.erode(th, k); cv2.dilate(th, k)
cv2.morphologyEx(th, cv2.MORPH_OPEN, k)    # erode→dilate: remove specks
cv2.morphologyEx(th, cv2.MORPH_CLOSE, k)   # dilate→erode: fill holes
```

## Edges & contours

```python
edges = cv2.Canny(gray, 50, 150)
cnts, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
c = max(cnts, key=cv2.contourArea)
area = cv2.contourArea(c); peri = cv2.arcLength(c, True)
approx = cv2.approxPolyDP(c, 0.02*peri, True)      # corner simplification
x, y, w, h = cv2.boundingRect(c)
rect = cv2.minAreaRect(c)                          # rotated box (center,size,angle)
```

## Geometric transforms

```python
cv2.resize(img, (w,h), interpolation=cv2.INTER_AREA)   # AREA shrink, CUBIC grow
M = cv2.getRotationMatrix2D((cx,cy), angle, 1.0)
cv2.warpAffine(img, M, (w,h))
M = cv2.getPerspectiveTransform(src4, dst4)            # both float32!
cv2.warpPerspective(img, M, (w,h))
M = cv2.findHomography(srcPts, dstPts, cv2.RANSAC)[0]  # robust, many points
```

## Drawing (BGR colors, (x,y) points)

```python
cv2.rectangle(img, (x1,y1), (x2,y2), (0,255,0), 2)
cv2.circle(img, (x,y), 5, (0,0,255), -1)            # -1 = filled
cv2.line(img, p1, p2, (255,0,0), 2)
cv2.putText(img, "hi", (x,y), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,255), 2)
cv2.polylines(img, [pts.reshape(-1,1,2)], True, (0,255,0), 2)
```

## Video

```python
cap = cv2.VideoCapture(src)             # path, index (0=webcam), or rtsp url
cap.isOpened()
ok, frame = cap.read()                  # ok=False at end / on failure
fps = cap.get(cv2.CAP_PROP_FPS)
cap.release()
vw = cv2.VideoWriter("out.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, (w,h))
vw.write(frame); vw.release()           # size MUST match written frames
```

## NumPy you'll need

```python
np.zeros((h,w,3), np.uint8); np.full((h,w,3), 114, np.uint8)
mask = gray > 180; img[mask] = (0,0,255)        # boolean indexing
img.reshape(-1,3).mean(axis=0)                  # per-channel mean
np.clip(x, 0, 255).astype(np.uint8)             # keep valid pixel range
np.linalg.norm(a - b)                           # Euclidean distance
```

## Gotchas that cost marks

- `imread` → **None** on bad path (no exception). Always check.
- Points are **(x, y)**; array indexing is **[row, col] = [y, x]**. Don't mix.
- Colors are **BGR**. `(0,0,255)` is red.
- Kernel / blockSize sizes must be **odd**.
- `getPerspectiveTransform` / `getAffineTransform` need **float32** points.
- `VideoWriter` silently makes an empty file if frame size mismatches.
- Save your **output images** with clear names — it's part of the grade.

→ Back to [chapter overview](README.md).
