# Interview Prep

Two self-contained interview-prep tracks. Each is a static site — edit the
`.md` files, run `node build.js`, and open the generated `index.html`.

## Tracks

- **[computer-vision-prep/](computer-vision-prep/)** — Computer Vision / video
  intelligence. CCTV-based live video: GStreamer/DeepStream, low-latency inference
  on NVIDIA edge, computer vision, crowd/queue analytics, event & anomaly detection,
  secure on-prem deployment.

- **[ml-engineer-prep/](ml-engineer-prep/)** — AI / ML Engineer. The full ML
  lifecycle: data pipelines, model development, experimentation, MLOps & serving,
  monitoring, cloud infra, optimization, generative AI, and ML system design.

## Build a track

```
cd ml-engineer-prep        # or computer-vision-prep
node build.js              # regenerates index.html
open index.html            # works offline by double-click
```

See each track's own `README.md` for the study order and its `RUN*.md` for serving/deploy.
