# Image Processing & Geometry

**TL;DR:** This is the heart of the test. Master the **preprocessing chain**
(gray → blur → threshold → morphology) and the **4-point perspective transform**
(detect a document/label quad and warp it flat). Everything here runs on a single
image and saves an output image — exactly what the test asks for.

Every solution is complete and runnable. Practice typing each from a blank file.

---

## Problem 1 — Preprocess for OCR (gray → blur → Otsu → save)

**Tests:** the fundamental chain, color conversion, thresholding, saving output.

**The problem:** an OCR engine can't read a color photo — it wants crisp
black-and-white where ink is cleanly separated from paper. Turn a messy photo
into exactly that.

**The plan:**

```text
photo (3 channels)
   |  cvtColor        drop color, keep brightness (1 channel)
   v
gray
   |  GaussianBlur    smooth away sensor noise BEFORE deciding
   v
smooth gray
   |  Otsu threshold  every pixel becomes pure 0 or 255
   v
black/white  --imwrite-->  saved
```

**Why this way:** a fixed cutoff like `127` breaks the moment lighting changes.
Otsu instead looks at the image's brightness histogram and picks the split point
that best separates "dark pixels" from "bright pixels" — zero tuning. And blur
comes *first* because thresholding is a hard yes/no decision: one speck of noise
near the cutoff flips into a black dot. Smooth before deciding, never after.

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

**The problem:** real scans are unevenly lit — one corner sits in shadow. Any
single global cutoff (even Otsu's) is then wrong *somewhere*: right for the
bright side, hopeless for the dark side.

**The plan:**

```text
uneven scan            ONE global cutoff           cutoff PER 31x31 window
+------------+         +------------+              +------------+
| text  #####| shadow  | text  #####|  shadow      | text  text |
| text  #####| side    | text  #####|  swallowed   | text  text |
+------------+         +------------+              +------------+
                        global threshold            adaptiveThreshold
```

**Why this way:** `adaptiveThreshold` recomputes the cutoff inside every small
window, so each region is judged against its *own* lighting. The leftover salt
noise is erased with morphological **opening** (erode → dilate): erosion deletes
anything smaller than the kernel, dilation regrows the surviving text to full
size. Flip to **closing** when the defect is holes inside strokes, not specks.

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

**The problem:** the page was scanned slightly rotated, so text lines are tilted
and OCR row-grouping falls apart. Find the tilt angle, rotate it back.

**The plan:**

```text
 tilted ink pixels        fit ONE rotated box          rotate by -angle
   \  \  \  \            .----------.                 __________
    \  \  \  \    ==>     | all text | angle=-12   ==> |__________|
     \  \  \  \           '----------'                  (upright)
                          cv2.minAreaRect
```

**Why this way:** you *could* detect individual lines (Hough) and average their
angles, but `minAreaRect` answers in one call: collect every ink pixel, fit the
tightest rotated rectangle around all of them, read its angle. The `< -45` fix
exists because OpenCV only reports angles within a 90° window — without the
correction you'd sometimes "deskew" the page sideways. `BORDER_REPLICATE` fills
the corners uncovered by rotation with edge colors instead of black wedges.

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

**The problem:** a label photographed at an angle appears as a *trapezoid*. To
read or measure it you need the flat, top-down rectangle — like a scanner sees.

**The plan:**

```text
   detected corners                          warped output
   TL._________.TR                          TL __________ TR
     /         \          3x3 perspective    |           |
    /  LABEL    \         matrix (getPersp   |  LABEL    |
   /             \        + warpPerspective) |           |
  BL._____________.BR         ==>            BL __________ BR
  find quad: Canny -> contours -> approxPolyDP == 4 points
```

**Why this way:** an affine warp (2×3 matrix: rotate/scale/shear) can *never*
fix this — affine preserves parallelism, and perspective distortion is exactly
parallel lines converging. You need the 3×3 homography, which is fully
determined by 4 point pairs — hence "4-point transform". `order_points` exists
because `getPerspectiveTransform` pairs source and destination corners *by array
position*: hand it corners in a random order and the output comes out mirrored
or rotated. The sum/diff trick identifies each corner without if-else chains.

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

**The problem:** isolate just the document/label from the photo background —
the "crop out the interesting part" task.

**The plan:**

```text
photo --blur+Canny--> edge map --findContours--> [c1, c2, c3, ...]
                                                  |  max(key=contourArea)
                                                  v
                                            page outline
                                                  |  boundingRect
                                                  v
                                       img[y:y+h, x:x+w]  (pure slicing)
```

**Why this way:** thresholding works only if the page is clearly brighter than
the background; *edges* survive even when brightnesses are similar. `RETR_EXTERNAL`
keeps only outermost contours, so "largest" means the page outline — not a logo
or text block inside it. `boundingRect` returns an axis-aligned box, croppable
with a slice; if the document is tilted, this crop keeps background wedges —
that's when you upgrade to Problem 4's perspective warp.

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

**The problem:** detection models want a fixed square input (e.g. 640×640) but
photos come in any shape. Naive `resize` to a square squashes objects.

**The plan:**

```text
   stretch (bad)             letterbox (good)
  +-----------+             +-----------+
  | oO -> oOO |             |###########|  <- gray pad (114)
  | distorted!|             |   image   |
  +-----------+             | untouched |
                            |###########|
                     scale by LONG side, pad the rest
```

**Why this way:** three options exist. Stretching distorts geometry — a square
carton becomes a rectangle and the model's learned shapes break. Center-cropping
keeps shapes but throws away edge pixels (where detections might be).
Letterboxing keeps *every pixel and every shape*, paying only some wasted pad.
Keep the scale and offsets — you need them to map detections back to the
original image coordinates.

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

**The problem:** a dark, low-contrast image has all its pixel values bunched
into a narrow band — details exist but are invisible.

**The plan:**

```text
 histogram before              after CLAHE
 |#                            |   #   #
 |##                           |  ##  ## #
 |###._____________            |.##.####.##._____
 0              255            0              255
 values crammed left           spread out - per tile, clip-limited
```

**Why this way:** plain `equalizeHist` uses ONE histogram for the whole image —
it blows out regions that were already bright and massively amplifies noise in
flat areas. CLAHE fixes both failure modes: it equalizes per **tile** (adapts to
local lighting) and **clips** each histogram (caps noise amplification). Doing
it on the L channel of LAB is what preserves color — equalizing B, G, R
separately changes their *ratios*, which literally changes the colors.

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

**The problem:** find "the green object" reliably — even when the lighting makes
its RGB values completely different from yesterday's photo.

**The plan:**

```text
 In BGR, "green" = (30,90,20)? (80,200,90)? (40,140,60)?  moves with lighting!
 In HSV, hue stays ~60 whether the scene is dim or bright.

 cvtColor(HSV) -> inRange(lo, hi) -> binary mask -> open (despeckle)
              -> largest contour -> boundingRect
```

**Why this way:** in BGR all three numbers change together when light dims, so
no fixed BGR box captures "green". HSV factors a pixel into hue (*which* color),
saturation (how vivid), value (how bright) — lighting mostly moves V, so a
stable H range does the job. A learned segmentation model could too, but when
the target color is known, two thresholds beat a neural net.

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

**The problem:** find where a known patch — a logo, stamp, or icon — appears
inside a larger image.

**The plan:**

```text
 template slides across the image; every position gets a similarity score
      +----------------+
      | .1 .2 .1 .0 .1 |      the brightest cell of the
      | .2 .9 .3 .1 .0 | <--  score map is the best match:
      | .1 .3 .2 .1 .1 |      minMaxLoc finds it
      +----------------+
```

**Why this way:** when the target's scale and rotation are fixed (same camera,
same layout — typical for documents), template matching is exact, tiny, and
needs zero training. Know its failure mode out loud: any scale or rotation
change kills the score — *that's* when you reach for feature matching
(ORB/SIFT + homography) or a trained detector. `TM_CCOEFF_NORMED` is the mode
to memorize: scores normalized to [-1, 1] mean one threshold works everywhere.

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

**The problem:** rotate an image by 30° and the corners vanish — because
`warpAffine` renders into a canvas of the *original* size.

**The plan:**

```text
 same-size canvas (clips)          grown canvas (fits)
 +------------+                +--------------------+
 |  /\ lost   |                |        /\          |
 | /  \       |      ==>       |       /  \         |
 | \  /       |                |       \  /         |
 |  \/ lost   |                |        \/          |
 +------------+                +--------------------+
                               new_w = h|sin| + w|cos|
                               new_h = h|cos| + w|sin|
                               then shift M's translation to recenter
```

**Why this way:** the rotated image's bounding box comes straight from
projecting w and h through |cos| and |sin| — and the rotation matrix already
*contains* those values, so no extra trig. The naive alternative — pad the image
heavily, rotate, crop — works but wastes memory and adds a step. Bonus answer:
for exact 90/180/270 use `cv2.rotate`, which is lossless and instant.

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

**The problem:** redact part of an image — blur an address, hide a face, or
keep only a region of interest.

**The plan:**

```text
 roi = img[y:y+h, x:x+w]     <- this is a VIEW (a window into img), not a copy
 img[y:y+h, x:x+w] = blur(roi)  <- writing back mutates the original in place

 non-rectangular?  build a mask  ->  bitwise_and(img, img, mask=mask)
```

**Why this way:** NumPy slices share memory with the parent array — that's what
makes redaction a two-liner with no copying. It's also the classic bug source:
mutate a slice you thought was independent. Say both sides of that coin. And for
*real* privacy prefer solid fill or heavy pixelation over Gaussian blur — mild
blurs have been reversed in practice.

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

**The problem:** find WHERE the barcode sits on a shipping label — any barcode,
any content, no training data.

**The plan:**

```text
 barcode = || ||| | || |||    a patch of DENSE VERTICAL EDGES
 d/dx  -> fires on every bar edge (HIGH)
 d/dy  -> bars are vertical, nothing changes vertically (~0)

 grad_x - grad_y  ->  bright exactly where "vertical-edge-ness" is high
       |  blur + Otsu       speckled blob over the bars
       |  close (21x7)      wide flat kernel bridges the GAPS between bars
       v                    ==> one solid rectangle
 minAreaRect of biggest contour = barcode box
```

**Why this way:** the *content* of barcodes varies but their texture signature —
many parallel vertical edges — never does, so a gradient filter finds them with
zero training. The closing kernel's shape is the insight: wide and flat, because
the gaps to bridge are horizontal. A neural detector also works, but this runs
in milliseconds on a CPU — the classic logistics-pipeline answer.

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

**The problem:** find the straight lines in a document — table grids, form
boxes, underlines.

**The plan:**

```text
 Canny edge pixels ==> each edge pixel VOTES for every line that
                       could pass through it (Hough accumulator)
                       lines collecting >= threshold votes win
 HoughLinesP returns real SEGMENTS: (x1, y1, x2, y2) with endpoints
```

**Why this way:** voting makes Hough robust to broken edges — a line missing a
third of its pixels still wins the vote. Choose `HoughLinesP` (probabilistic)
over `HoughLines`: it hands you finite segments you can draw and measure, not
infinite (rho, theta) pairs you'd have to convert. Alternative worth naming: to
*separate* horizontal from vertical table lines, morphological opening with a
long thin kernel (e.g. `(40, 1)`) is even simpler than Hough.

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

**The problem:** implement image filtering yourself — the "do you actually know
what `filter2D` does?" question.

**The plan:**

```text
 kernel   0 -1  0      each output pixel = weighted sum of its
         -1  5 -1      3x3 neighborhood (here: sharpen)
          0 -1  0

 naive:  loop over 350,000 pixels x 9 weights  ->  millions of Python steps
 smart:  loop over the 9 WEIGHTS; each step shifts the whole image and
         adds it, weighted  ->  9 vectorized array ops, same math
```

**Why this way:** both loop orders compute the identical sum — but flipping them
moves the heavy loop from the Python interpreter into NumPy's C code, a ~1000x
speedup for the same line count. This "make the big loop the vectorized one"
trick generalizes far beyond convolution. Edge-padding by half the kernel keeps
output size equal to input ('same' convolution, like filter2D's default).

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

**The problem:** contour detection found twenty shapes — which ones are actually
labels (rectangles), and which are circles, blobs, and junk?

**The plan:**

```text
 candidate     area    aspect(w/h)   extent(area/bbox area)
 rectangle     big       ~1.0          ~1.00   ==> KEEP
 circle        big       ~1.0          ~0.79   ==> reject (doesn't fill box)
 noise speck   tiny        -             -     ==> reject first (cheapest test)
```

**Why this way:** three one-line statistics do what would otherwise need a
trained classifier — and every rejection is explainable ("dropped: extent
0.62"), which matters in production debugging. Order the tests cheapest-first
so expensive checks run on fewer candidates. If rectangles may be *rotated*,
compute extent against `minAreaRect` area instead of the axis-aligned box.

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
