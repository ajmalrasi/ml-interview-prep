# Video & Streaming

**TL;DR:** Expect "process this video": open it, read frames in a loop **with a
guard for failed reads**, do something per frame (motion, sample, annotate), and
**write an output video or frames**. The robust `cv2.VideoCapture` loop is the one
to have in muscle memory — it doubles as your fault-tolerance answer.

---

## Problem 13 — Robust capture: read, sample every Nth frame, save

**Tests:** the capture loop, failure handling, frame sampling, releasing resources.

```python
import cv2
import os

def sample_frames(source, out_dir="frames", every=15):
    """source: a video path or RTSP url. Saves every Nth frame as an image."""
    os.makedirs(out_dir, exist_ok=True)
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {source}")
    i = saved = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:                       # end of file OR dropped stream
                break
            if i % every == 0:
                cv2.imwrite(os.path.join(out_dir, f"frame_{i:05d}.jpg"), frame)
                saved += 1
            i += 1
    finally:
        cap.release()                        # ALWAYS release (no leaks)
    print(f"read {i} frames, saved {saved}")
    return saved
```

**Watch out:** check `isOpened()`, handle `ok == False` (don't assume frames keep
coming), and `release()` in a `finally`. For live RTSP you'd wrap this in a
reconnect-with-backoff loop (see the fault-tolerance chapter).

---

## Problem 14 — Motion detection via frame differencing, write annotated video

**Tests:** per-frame processing, background diff, contours on a mask, `VideoWriter`.

```python
import cv2

def detect_motion(source, out="p14_out.mp4", min_area=800):
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {source}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(out, fourcc, fps, (w, h))
    prev = None
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            gray = cv2.GaussianBlur(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY),
                                    (21, 21), 0)
            if prev is not None:
                diff = cv2.absdiff(prev, gray)
                th = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)[1]
                th = cv2.dilate(th, None, iterations=2)
                cnts, _ = cv2.findContours(th, cv2.RETR_EXTERNAL,
                                           cv2.CHAIN_APPROX_SIMPLE)
                for c in cnts:
                    if cv2.contourArea(c) < min_area:
                        continue
                    x, y, bw, bh = cv2.boundingRect(c)
                    cv2.rectangle(frame, (x, y), (x + bw, y + bh), (0, 255, 0), 2)
            writer.write(frame)
            prev = gray
    finally:
        cap.release(); writer.release()
    return out
```

**Watch out:** `VideoWriter` size must match the frames you write, or you get an
empty file. Blur before diff to kill sensor noise. `fourcc` "mp4v" for `.mp4`.

---

## Problem 15 — Overlay FPS / text and count frames

**Tests:** drawing text, reading video properties, simple per-frame overlay.

```python
import cv2, time

def annotate(source, out="p15_out.mp4"):
    cap = cv2.VideoCapture(source)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    w, h = (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
    writer = cv2.VideoWriter(out, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    n, t0 = 0, time.time()
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        n += 1
        real_fps = n / (time.time() - t0 + 1e-9)
        cv2.putText(frame, f"frame {n}  {real_fps:4.1f} fps", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        writer.write(frame)
    cap.release(); writer.release()
    return n
```

**Watch out:** `putText` origin is the **bottom-left** of the text and coords are
(x, y). Colors are **BGR**.

→ Next: **[python-and-numpy.md](python-and-numpy.md)**
