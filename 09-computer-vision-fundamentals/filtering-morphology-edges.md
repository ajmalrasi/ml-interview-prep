# Filtering, Morphology & Edges

**TL;DR:** Most classical image processing is **convolution** — slide a small kernel
over the image and compute a weighted sum per pixel. Blur kernels smooth, derivative
kernels (Sobel) find edges, Canny chains it into clean edges, and morphology
(erode/dilate) cleans up binary masks. You used all of this in surround-view and
image-quality work.

## Convolution = a sliding window

A **kernel** (e.g., 3×3 weights) slides over every pixel; the output pixel is the
weighted sum of its neighborhood. Change the weights, change the effect. This is
*also* what a CNN's conv layer does — classical kernels are hand-designed, CNN
kernels are learned.

## Blurring / smoothing (and why)

| Filter | What | Use |
|---|---|---|
| **Gaussian blur** | weighted average, center-heavy | denoise, pre-smooth before edge detection |
| **Median blur** | replace pixel with neighborhood median | kills salt-and-pepper noise, preserves edges |
| **Bilateral** | blur but **preserve edges** (weights by intensity similarity) | smooth skin/surfaces without losing boundaries |
| **Box/average** | plain mean | fast, crude |

Why blur before edges? Derivatives amplify noise. A little Gaussian first → far
cleaner edges. (Canny does this internally.)

## Thresholding (image → binary)

Turn grayscale into black/white (a mask):
- **Global threshold:** one cutoff. Simple, fails under uneven lighting.
- **Otsu:** auto-picks the threshold from the histogram (bimodal images).
- **Adaptive:** threshold varies per region → handles shadows/gradients. The right
  choice for real-world lighting.

## Morphology (clean up binary masks)

Operate on the *shape* of white regions with a structuring element:
- **Erosion** — shrinks white regions (removes small specks, thins).
- **Dilation** — grows white regions (fills small holes, thickens).
- **Opening** = erode→dilate — removes small noise blobs.
- **Closing** = dilate→erode — fills small holes/gaps inside objects.

You reach for these to clean a segmentation mask before contour/blob analysis.

## Edge detection

- **Sobel / Scharr** — directional first derivatives (gradient in x or y). Magnitude
  = edge strength, direction = edge orientation.
- **Laplacian** — second derivative; zero-crossings = edges (also a focus/blur
  measure — variance of Laplacian is a classic sharpness metric, relevant to your
  IR image-quality work).
- **Canny** — the gold standard: Gaussian blur → gradients (Sobel) → non-max
  suppression (thin edges to 1px) → double-threshold + hysteresis (link strong/weak
  edges). Output: clean, thin, connected edges.

## Contours & connected components (after a mask)

- **Contours** (`findContours`) — outlines of white regions → area, perimeter,
  bounding box, shape. Used for blob counting, shape filtering.
- **Connected components** — label each separate white blob with an ID. Good for
  counting/measuring distinct regions.

## Why X over Y

**Gaussian vs median vs bilateral blur?**
Gaussian = general denoise/smoothing (but blurs edges). Median = best for salt-and-
pepper noise, keeps edges. Bilateral = smooth flat areas *and* keep edges, but
slower. Pick by noise type and whether edges must survive.

**Global vs adaptive threshold?**
Global is fast but assumes uniform lighting; it fails on shadows/gradients. Adaptive
computes a local threshold per region → robust to uneven lighting. Real scenes →
adaptive (or Otsu if the histogram is cleanly bimodal).

**Opening vs closing?**
Opening removes small *external* noise (specks outside objects); closing fills small
*internal* holes/gaps. Choose by whether your mask has stray dots (opening) or holes
(closing).

**Why is Canny better than raw Sobel?**
Sobel gives thick, noisy gradient magnitudes. Canny adds blur, non-max suppression
(1px-thin edges), and hysteresis thresholding (connect real edges, drop noise) → far
cleaner, the production default.

→ Next: **[geometry-and-transforms.md](geometry-and-transforms.md)**
