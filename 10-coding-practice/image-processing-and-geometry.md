# Image Processing & Geometry

**TL;DR:** This is the heart of the test. Master the **preprocessing chain**
(gray → blur → threshold → morphology) and the **4-point perspective transform**
(detect a document/label quad and warp it flat). Everything here runs on a single
image and saves an output image — exactly what the test asks for.

Every solution is complete and runnable. Practice typing each from a blank file.

---

## Problem 1 — Preprocess for OCR (gray → blur → Otsu → save)

**Tests:** the fundamental chain, color conversion, thresholding, saving output.

```python
import cv2

def preprocess(path, out="p1_out.png"):
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)     # denoise before threshold
    # Otsu auto-picks the threshold; THRESH_BINARY_INV makes text white on black
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cv2.imwrite(out, binary)
    return binary

if __name__ == "__main__":
    preprocess("input.jpg")
```

**Watch out:** Otsu needs a *single-channel* image and `thresh=0`. Blur first or
threshold gets speckly.

---

## Problem 2 — Clean a noisy scanned document (adaptive threshold + morphology)

**Tests:** adaptive thresholding (uneven lighting) and morphology to remove specks.

```python
import cv2
import numpy as np

def clean_scan(path, out="p2_out.png"):
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise FileNotFoundError(path)
    # adaptive: threshold computed per-region → robust to shadows/gradients
    binary = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, blockSize=31, C=10)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)   # remove small noise
    cv2.imwrite(out, opened)
    return opened
```

**Watch out:** `blockSize` must be **odd**. Opening removes specks; closing fills
holes — pick by whether your noise is dots (open) or gaps (close).

---

## Problem 3 — Deskew a rotated document

**Tests:** geometry from foreground pixels, rotation matrix, warpAffine.

```python
import cv2
import numpy as np

def deskew(path, out="p3_out.png"):
    img = cv2.imread(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    foreground_pixels = np.column_stack(np.where(binary > 0))  # (row, col) of text
    angle = cv2.minAreaRect(foreground_pixels)[-1]  # angle of tightest box
    if angle < -45:            # OpenCV reports angle in a 90-deg range;
        angle = 90 + angle     # flip so we rotate the SHORT way, not 90-deg off
    (height, width) = img.shape[:2]
    rotation_matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1.0)
    rotated = cv2.warpAffine(img, rotation_matrix, (width, height),
                             flags=cv2.INTER_CUBIC,          # smooth resample
                             borderMode=cv2.BORDER_REPLICATE)  # no black corners
    cv2.imwrite(out, rotated)
    return rotated
```

**Watch out:** `minAreaRect` angle conventions changed across OpenCV versions —
know the `< -45` correction and be ready to explain it.

---

## Problem 4 — 4-point perspective transform ("scan this label") ⭐

**Tests:** the single most likely task. Detect the document's 4 corners and warp
it to a flat top-down view. Memorize the `order_points` + `four_point_transform`
pair cold.

```python
import cv2
import numpy as np

def order_points(points):
    """Return corners as [top-left, top-right, bottom-right, bottom-left]."""
    ordered = np.zeros((4, 2), dtype="float32")
    coord_sum = points.sum(axis=1)
    ordered[0] = points[np.argmin(coord_sum)]    # top-left has smallest x+y
    ordered[2] = points[np.argmax(coord_sum)]    # bottom-right has largest x+y
    coord_diff = np.diff(points, axis=1)
    ordered[1] = points[np.argmin(coord_diff)]   # top-right has smallest y-x
    ordered[3] = points[np.argmax(coord_diff)]   # bottom-left has largest y-x
    return ordered

def four_point_transform(image, points):
    ordered = order_points(points)
    (top_left, top_right, bottom_right, bottom_left) = ordered
    width_bottom = np.linalg.norm(bottom_right - bottom_left)
    width_top = np.linalg.norm(top_right - top_left)
    out_width = int(max(width_bottom, width_top))    # output = longest measured side
    height_right = np.linalg.norm(top_right - bottom_right)
    height_left = np.linalg.norm(top_left - bottom_left)
    out_height = int(max(height_right, height_left))
    # destination corners of a flat, axis-aligned rectangle (same order!)
    destination = np.array([[0, 0], [out_width - 1, 0],
                            [out_width - 1, out_height - 1], [0, out_height - 1]],
                           dtype="float32")
    perspective_matrix = cv2.getPerspectiveTransform(ordered, destination)
    return cv2.warpPerspective(image, perspective_matrix, (out_width, out_height))

def scan(path, out="p4_out.png"):
    img = cv2.imread(path)
    ratio = img.shape[0] / 500.0
    resized = cv2.resize(img, (int(img.shape[1] / ratio), 500))
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 75, 200)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
    document_corners = None
    for contour in contours:
        perimeter = cv2.arcLength(contour, True)
        corners = cv2.approxPolyDP(contour, 0.02 * perimeter, True)  # simplify
        if len(corners) == 4:                              # found a quadrilateral
            document_corners = corners.reshape(4, 2) * ratio  # scale to full res
            break
    if document_corners is None:
        raise RuntimeError("no 4-corner document found")
    warped = four_point_transform(img, document_corners.astype("float32"))
    cv2.imwrite(out, warped)
    return warped
```

**Watch out:** `getPerspectiveTransform` needs **float32** points in a consistent
order — that's why `order_points` exists. Scale corners back up if you detected on
a resized copy.

---

## Problem 5 — Find and crop the largest rectangle (document boundary)

**Tests:** Canny + contours + `approxPolyDP` + bounding-box crop.

```python
import cv2

def crop_largest_rect(path, out="p5_out.png"):
    img = cv2.imread(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 50, 150)  # low:high ~ 1:3
    # RETR_EXTERNAL = outermost contours only (ignore holes/children)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise RuntimeError("no contours")
    largest = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest)
    crop = img[y:y + h, x:x + w]
    cv2.imwrite(out, crop)
    return crop
```

**Watch out:** `img[y:y+h, x:x+w]` — rows first (y), then cols (x). A frequent slip.

---

## Problem 6 — Resize keeping aspect ratio, pad to square (letterbox)

**Tests:** the standard model-input preprocessing; aspect-ratio math, padding.

```python
import cv2
import numpy as np

def letterbox(path, size=640, out="p6_out.png"):
    img = cv2.imread(path)
    h, w = img.shape[:2]
    scale = size / max(h, w)                         # fit the LONG side
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)  # 114 = YOLO pad-gray
    top, left = (size - new_h) // 2, (size - new_w) // 2
    canvas[top:top + new_h, left:left + new_w] = resized
    cv2.imwrite(out, canvas)
    return canvas
```

**Watch out:** `INTER_AREA` for shrinking, `INTER_LINEAR/CUBIC` for enlarging.
Keep the scale + padding offsets if you later need to map detections back.

---

## Problem 7 — Boost contrast on a dark image (CLAHE)

**Tests:** histogram equalization done right (local, on luminance only).

```python
import cv2

def enhance(path, out="p7_out.png"):
    img = cv2.imread(path)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)       # equalize L, keep color
    lightness, green_red, blue_yellow = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    equalized_lightness = clahe.apply(lightness)
    merged = cv2.merge((equalized_lightness, green_red, blue_yellow))
    out_img = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
    cv2.imwrite(out, out_img)
    return out_img
```

**Watch out:** equalize the **L** channel in LAB (or V in HSV), never the raw BGR
channels — that wrecks color. CLAHE (local) beats global `equalizeHist` for uneven
lighting.

---

# More practice — classic CV interview problems

Eight more exercises in the same style: short functions, one idea each.
The setup assets include `color.jpg`, `barcode.jpg`, and `lines.jpg` for these.

| # | Topic | Core API |
|---|-------|----------|
| E1 | Find object by color | `cvtColor(HSV)` + `inRange` |
| E2 | Template matching | `matchTemplate` + `minMaxLoc` |
| E3 | Rotate without cropping | rotation matrix math |
| E4 | Blur/mask a region | ROI slicing + `bitwise_and` |
| E5 | Locate a barcode | Sobel gradient + morphology |
| E6 | Detect table lines | `Canny` + `HoughLinesP` |
| E7 | Convolution from scratch | NumPy only |
| E8 | Filter contours by shape | area / aspect / extent |

---

## Problem E1 — Find an object by color (HSV + inRange)

**Tests:** color spaces. HSV separates *what color* (H) from *how bright* (V),
so a single hue range survives lighting changes that would break BGR thresholds.

```python
import cv2
import numpy as np

def find_color_object(path, lower_hsv, upper_hsv, out="e1_out.png"):
    img = cv2.imread(path)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)          # hue is lighting-robust
    mask = cv2.inRange(hsv, np.array(lower_hsv), np.array(upper_hsv))  # 255 inside range
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))  # kill specks
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return img, None
    x, y, w, h = cv2.boundingRect(max(contours, key=cv2.contourArea))  # biggest blob
    cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 255), 2)
    cv2.imwrite(out, img)
    return img, (x, y, w, h)
```

**Watch out:** OpenCV hue runs **0–179** (not 0–359). Red wraps around 0, so red
needs **two** ranges (`0-10` and `170-179`) OR-ed together with `cv2.bitwise_or`.

---

## Problem E2 — Template matching (find a logo / stamp)

**Tests:** `matchTemplate` slides the template over the image and scores every
position; `minMaxLoc` finds the best one.

```python
import cv2

def find_template(image_path, template, threshold=0.8, out="e2_out.png"):
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # TM_CCOEFF_NORMED gives scores in [-1, 1]; 1.0 = perfect match
    scores = cv2.matchTemplate(gray, template, cv2.TM_CCOEFF_NORMED)
    _, best_score, _, best_loc = cv2.minMaxLoc(scores)   # (min, max, minLoc, maxLoc)
    h, w = template.shape
    if best_score >= threshold:
        cv2.rectangle(img, best_loc, (best_loc[0] + w, best_loc[1] + h), (0, 255, 0), 2)
    cv2.imwrite(out, img)
    return img, best_score
```

**Watch out:** template matching is **not** scale- or rotation-invariant — say this
in the interview. For *all* matches above the threshold use
`ys, xs = np.where(scores >= threshold)` instead of `minMaxLoc`.

---

## Problem E3 — Rotate by any angle *without* cropping corners

**Tests:** the classic gotcha — `warpAffine` to the original size clips the
corners. Grow the canvas and shift the rotation center.

```python
import cv2
import numpy as np

def rotate_bound(path, angle, out="e3_out.png"):
    img = cv2.imread(path)
    h, w = img.shape[:2]
    center = (w / 2, h / 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    cos, sin = abs(M[0, 0]), abs(M[0, 1])     # matrix already holds cos/sin
    new_w = int(h * sin + w * cos)            # bounding box of the rotated image
    new_h = int(h * cos + w * sin)
    M[0, 2] += new_w / 2 - center[0]          # shift translation so the result
    M[1, 2] += new_h / 2 - center[1]          # stays centered in the new canvas
    rotated = cv2.warpAffine(img, M, (new_w, new_h))
    cv2.imwrite(out, rotated)
    return rotated
```

**Watch out:** positive angle = **counter-clockwise** in OpenCV. If you only ever
need 90/180/270, use `cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)` — it's exact and fast.

---

## Problem E4 — Blur a region + apply a mask (privacy blur)

**Tests:** ROI slicing (views write back in place!) and `bitwise_and` masking —
the two building blocks of every "redact this part" task.

```python
import cv2
import numpy as np

def blur_region(path, rect, out="e4_out.png"):
    img = cv2.imread(path)
    x, y, w, h = rect
    roi = img[y:y + h, x:x + w]               # a VIEW into img, not a copy
    img[y:y + h, x:x + w] = cv2.GaussianBlur(roi, (31, 31), 0)  # write blur back
    cv2.imwrite(out, img)
    return img

def keep_masked(img, mask):
    # keep pixels where mask > 0, zero elsewhere (mask must be uint8, 1-channel)
    return cv2.bitwise_and(img, img, mask=mask)
```

**Watch out:** blur kernel sizes must be **odd**. Slices are views — mutating `roi`
mutates `img`; call `.copy()` when you *don't* want that.

---

## Problem E5 — Locate a barcode (gradient + morphology) ⭐

**Tests:** a logistics classic. Barcodes have strong **horizontal** gradient and
weak vertical gradient; morphological closing glues the bars into one blob.

```python
import cv2
import numpy as np

def find_barcode(path, out="e5_out.png"):
    img = cv2.imread(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0)     # d/dx: bars fire strongly
    grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1)     # d/dy: bars barely fire
    gradient = cv2.convertScaleAbs(grad_x - grad_y)  # keep x-heavy regions
    blurred = cv2.blur(gradient, (9, 9))
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # wide flat kernel: close the GAPS between bars into one solid rectangle
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 7))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    closed = cv2.erode(closed, None, iterations=4)   # drop small leftovers
    closed = cv2.dilate(closed, None, iterations=4)  # restore the big blob
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise RuntimeError("no barcode found")
    rect = cv2.minAreaRect(max(contours, key=cv2.contourArea))  # rotated rect
    box = cv2.boxPoints(rect).astype(int)                       # its 4 corners
    cv2.drawContours(img, [box], -1, (0, 255, 0), 2)
    cv2.imwrite(out, img)
    return img
```

**Watch out:** this only *localizes* — decoding needs `cv2.barcode_BarcodeDetector`
or `pyzbar`. If the barcode may be rotated, run on both `grad_x - grad_y` and
`grad_y - grad_x`, keep the stronger response.

---

## Problem E6 — Detect table / document lines (Hough transform)

**Tests:** `HoughLinesP` — the go-to for finding straight structure (table grids,
form fields, document edges).

```python
import cv2
import numpy as np

def find_lines(path, out="e6_out.png"):
    img = cv2.imread(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    # probabilistic Hough: returns finite SEGMENTS (x1,y1,x2,y2), not infinite lines
    lines = cv2.HoughLinesP(edges, rho=1, theta=np.pi / 180, threshold=80,
                            minLineLength=100, maxLineGap=10)
    for line in (lines if lines is not None else []):   # lines is None if none found
        x1, y1, x2, y2 = line[0]
        cv2.line(img, (x1, y1), (x2, y2), (0, 0, 255), 2)
    cv2.imwrite(out, img)
    return img, 0 if lines is None else len(lines)
```

**Watch out:** `rho=1, theta=np.pi/180` are resolutions, not limits. To split a
table into horizontal/vertical lines, morphology is often cleaner: erode+dilate
with a long thin kernel like `(40, 1)` keeps only horizontal strokes.

---

## Problem E7 — 2D convolution from scratch (NumPy only)

**Tests:** do you understand what `filter2D` actually does? Loop over the small
**kernel**, never over pixels — that keeps it vectorized *and* short.

```python
import numpy as np

def convolve2d(img, kernel):
    kh, kw = kernel.shape
    pad_h, pad_w = kh // 2, kw // 2
    # pad edges so output size == input size ('same' convolution)
    padded = np.pad(img.astype(np.float32), ((pad_h, pad_h), (pad_w, pad_w)), mode="edge")
    out = np.zeros(img.shape, np.float32)
    for i in range(kh):                     # 3x3 kernel = 9 iterations total,
        for j in range(kw):                 # each one a whole-image NumPy op
            out += kernel[i, j] * padded[i:i + img.shape[0], j:j + img.shape[1]]
    return np.clip(out, 0, 255).astype(np.uint8)   # clip BEFORE uint8 or it wraps
```

**Watch out:** true convolution flips the kernel; this (and `filter2D`) computes
**correlation** — identical for symmetric kernels. Casting negatives straight to
uint8 silently wraps (-1 → 255): always `np.clip` first.

---

## Problem E8 — Filter contours by shape (find label-like rectangles)

**Tests:** turning raw contours into decisions with cheap shape stats:
area, aspect ratio, and *extent* (how much of its bounding box the shape fills).

```python
import cv2

def find_rectangles(path, min_area=1000, out="e8_out.png"):
    img = cv2.imread(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    kept = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:                 # 1. drop noise
            continue
        x, y, w, h = cv2.boundingRect(contour)
        aspect = w / h                      # 2. drop long thin strips
        extent = area / (w * h)             # 3. rect fills ~1.0, circle ~0.79
        if 0.3 < aspect < 3.0 and extent > 0.85:
            kept.append((x, y, w, h))
            cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
    cv2.imwrite(out, img)
    return img, kept
```

**Watch out:** `contourArea` ≠ pixel count — it's the polygon area (Green's
theorem). Another handy stat: **circularity** `4*pi*area / perimeter**2` is 1.0 for
a circle, ~0.785 for a square. Combine 2–3 cheap stats instead of one magic number.

→ Next: **[detection-logic.md](detection-logic.md)**
