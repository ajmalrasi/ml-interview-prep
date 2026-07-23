# Python & NumPy Engineering

**TL;DR:** Beyond CV, they want clean, **fault-tolerant** Python: vectorized NumPy
(no per-pixel Python loops), a batch processor that survives bad files, and basic
algorithmic thinking. The JD literally says "fault-tolerant… manage resources in
long-running processes" — show that.

---

## Problem 16: Vectorize it (no pixel loops)

**Tests:** that you reach for NumPy, not `for y: for x:`. Example: threshold +
tint without loops.

**The problem:** do a per-pixel operation (select + recolor) without writing a
per-pixel Python loop.

**The plan:**

```text
 loops:  for y: for x: if gray[y,x] > 180: img[y,x] = red
         ==> 350,000 interpreted Python iterations        (slow)

 numpy:  mask = gray > 180        one C-speed comparison  -> bool array
         img[mask] = (0, 0, 255)  one C-speed scatter     (fast)
```

**Why this way:** NumPy's entire value is that the loop happens inside compiled
C, not the Python interpreter — typically ~100-1000x faster. Boolean-mask
indexing and `axis=` reductions replace 90% of pixel loops you'd be tempted to
write. The interview tell: the moment you type `for y in range(h)`, stop and
ask "what's the array expression for this?"

```python
import numpy as np
import cv2

def red_tint_bright_areas(path, out="p16_out.png", bright_threshold=180):
    img = cv2.imread(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    bright_mask = gray > bright_threshold    # boolean array, fully vectorized
    img[bright_mask] = [0, 0, 255]           # set all bright pixels red (BGR)
    cv2.imwrite(out, img)
    return img

# Per-channel mean without loops:
def channel_means(img):
    return img.reshape(-1, 3).mean(axis=0)  # (B_mean, G_mean, R_mean)
```

**Watch out:** boolean-mask indexing (`img[mask] = ...`) and `axis=` reductions are
the whole point. If you wrote a double `for` loop over pixels, that's the wrong
answer — say "vectorize with NumPy."

---

## Problem 17: Fault-tolerant batch image processor

**Tests:** the "manage a long-running job, don't crash on one bad input" skill.
Process a folder, skip and log corrupt files, keep going.

**The problem:** process a folder of 10,000 images where file #37 is corrupt —
without the whole job dying at #37.

**The plan:**

```text
 for each file:
     try:     read -> check None -> process -> write   ok += 1
     except:  log the name and reason, fail += 1, CONTINUE

 one bad file = one warning line, not a dead 3-hour batch job
```

**Why this way:** the try/except goes *inside* the loop, per file — wrap the
whole loop instead and the first bad file still kills everything after it. The
subtle trap this problem is really testing: `cv2.imread` does NOT raise on
failure, it silently returns `None` — you must check and raise yourself.
Returning (ok, fail) counts and logging skips makes the job observable, which
is what "fault-tolerant" means in practice.

```python
import os
import cv2
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

def process_folder(in_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    exts = (".jpg", ".jpeg", ".png", ".bmp")
    ok = fail = 0
    for name in sorted(os.listdir(in_dir)):
        if not name.lower().endswith(exts):     # skip non-image files
            continue
        src = os.path.join(in_dir, name)
        try:
            img = cv2.imread(src)
            if img is None:
                raise ValueError("unreadable / corrupt")
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            cv2.imwrite(os.path.join(out_dir, name), gray)
            ok += 1
        except Exception as e:                      # one bad file can't kill the run
            logging.warning("skipped %s: %s", name, e)
            fail += 1
    logging.info("done: %d ok, %d failed", ok, fail)
    return ok, fail
```

**Watch out:** `cv2.imread` returns **None** on failure (it doesn't raise) — guard
it. Catch per-file so the batch continues; log what you skipped. That *is* fault
tolerance.

---

## Problem 18: Count connected components (blobs)

**Tests:** a small algorithm framed in CV terms; thresholding + labeling.

**The problem:** count the distinct objects (blobs) in an image — and be ready
to do it with *and* without OpenCV.

**The plan:**

```text
 grid:   1 1 . .        two components under 4-connectivity
         . 1 . 1        (up/down/left/right - diagonals do NOT connect)
         . . . 1

 OpenCV:  threshold -> connectedComponentsWithStats -> filter by area
 by hand: scan cells; each unseen 1 starts a BFS flood-fill; count fills
```

**Why this way:** `connectedComponentsWithStats` beats `findContours` for
counting — it labels every pixel and returns areas + centroids directly, with
no contour-hierarchy edge cases (nested shapes can't fool it). Remember label 0
is the background: start loops at 1. The pure-Python BFS is the same idea by
hand — it's LeetCode's "Number of Islands", and the `seen` matrix is what
prevents counting one island twice.

```python
import cv2

def count_blobs(path, min_area=50):
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary)
    # label 0 is the background; filter tiny specks by area
    blobs = [i for i in range(1, num_labels)
             if stats[i, cv2.CC_STAT_AREA] >= min_area]
    return len(blobs), centroids[blobs]
```

If asked to do it **without** OpenCV (pure algorithm), flood-fill / BFS over the
binary grid:

```python
from collections import deque

def count_islands(grid):
    """grid: 2D list of 0/1. Counts 4-connected components of 1s."""
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    seen = [[False] * cols for _ in range(rows)]
    count = 0
    for row in range(rows):
        for col in range(cols):
            if grid[row][col] == 1 and not seen[row][col]:  # new island found
                count += 1
                # BFS flood-fill: mark every 1 connected to this one as seen
                queue = deque([(row, col)]); seen[row][col] = True
                while queue:
                    r, c = queue.popleft()
                    for d_row, d_col in ((1, 0), (-1, 0), (0, 1), (0, -1)):  # 4-conn
                        next_r, next_c = r + d_row, c + d_col
                        if 0 <= next_r < rows and 0 <= next_c < cols \
                           and grid[next_r][next_c] == 1 and not seen[next_r][next_c]:
                            seen[next_r][next_c] = True
                            queue.append((next_r, next_c))
    return count
```

**Watch out:** `connectedComponentsWithStats` labels background as 0 — start your
loop at 1. The pure-Python flood fill is the classic "number of islands" if they
want a DSA flavor.

→ Next: **[opencv-cheat-sheet.md](opencv-cheat-sheet.md)**
