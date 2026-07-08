# Image Basics & Color Spaces

**TL;DR:** An image is a grid of numbers. A grayscale image is one number per pixel
(0–255); a color image is three (or four). The catch that bites everyone: **OpenCV
loads images as BGR, not RGB**, and **video decoders output YUV/NV12, not RGB**. Most
"my model is suddenly inaccurate" bugs are a color-order or color-space mismatch.

## The mental model

A photo is a spreadsheet. Each cell is a pixel. Grayscale = one value per cell
(brightness). Color = three stacked spreadsheets (channels). The *order* and
*meaning* of those channels is the whole game.

## Pixels, channels, dtype

- **Resolution:** width × height in pixels. 1080p = 1920×1080.
- **Channels:** grayscale = 1, color = 3 (BGR/RGB), with alpha = 4 (BGRA).
- **Bit depth / dtype:** usually `uint8` (0–255 per channel). Sometimes `float32`
  (0–1) after normalization for a model. A numpy frame is shape `(H, W, C)`.
- **Pixel-level manipulation** = indexing/slicing that array: `img[y, x]` is a
  pixel, `img[100:200, 50:150]` is a crop (a *view*, not a copy — careful).

## Color spaces you must name

| Space | What it is | When |
|---|---|---|
| **BGR** | OpenCV's default channel order | `cv2.imread`, most OpenCV I/O |
| **RGB** | "Normal" order | most DL models, PIL, matplotlib |
| **Grayscale** | brightness only, 1 channel | edges, thresholding, classical CV (less data, faster) |
| **HSV** | Hue, Saturation, Value | **color-based segmentation** — hue is robust to lighting/shadows |
| **YUV / YCbCr** | luma (Y) + chroma (U,V) | how video is *stored/transmitted*; Y is brightness |
| **NV12** | a YUV 4:2:0 layout | what **NVDEC/GStreamer output** — convert to BGR for OpenCV |
| **LAB** | perceptually uniform | color difference, white balance, photometric work |

## The two bugs that cost people offers

1. **BGR vs RGB:** OpenCV reads BGR; you feed it to an RGB-trained model without
   `cv2.cvtColor(img, cv2.COLOR_BGR2RGB)` → channels swapped → accuracy quietly
   tanks (reds become blues). Always confirm the order your model expects.
2. **YUV/NV12 → BGR:** decoders emit NV12; your model wants BGR/RGB. The conversion
   is per-pixel per-frame — do it **on the GPU** (`nvvidconv`), not the CPU, or you
   re-introduce the copy cost you avoided with hardware decode (see
   [../01-video-streaming/decode-encode-pipeline.md](../01-video-streaming/decode-encode-pipeline.md)).

## Why HSV for color tasks (classic question)

In RGB, a "red" object under sun vs shadow has very different R,G,B values — all
three change with brightness. In **HSV**, the *hue* stays roughly constant; only
*value* changes. So "find the red boxes" is a simple hue range in HSV but a mess in
RGB. This is the standard answer to "why HSV?"

## Why X over Y

**Grayscale vs color — when drop to gray?**
Grayscale = ⅓ the data, faster, and many classical ops (edges, thresholding,
template matching) only need brightness. Drop to gray when color carries no signal
for the task; keep color when hue/appearance matters (e.g., color classification).

**HSV vs RGB for thresholding a colored object?**
HSV separates color (hue) from brightness (value), so it's robust to lighting; RGB
mixes them, so thresholds break under shadow/sun. HSV for color segmentation.

**Why does color conversion cost real time in a video pipeline?**
It's per-pixel, per-frame, every frame. At 30fps × N cameras that's a lot of
arithmetic and, if done on CPU, a GPU↔CPU round trip. Convert on the GPU and keep
frames there.

→ Next: **[filtering-morphology-edges.md](filtering-morphology-edges.md)**
