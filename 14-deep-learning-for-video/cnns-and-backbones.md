# CNNs & Backbones

**TL;DR:** A CNN turns pixels into a hierarchy of features via convolutions —
early layers see edges/textures, deep layers see objects. The **backbone** is the
feature extractor every detector/tracker sits on. Know convolution mechanics,
receptive field, why we downsample, and how a feature pyramid handles the scale
problem that dominates crowd/CCTV scenes.

## Convolution — the core operation

A small learnable kernel slides over the image, computing dot products → a feature
map. Key properties and why they matter:

- **Weight sharing** — the same kernel everywhere → translation equivariance and far
  fewer parameters than a dense layer. An edge is an edge wherever it appears.
- **Locality** — each output sees only a local patch (the receptive field), matching
  image structure.
- **Stacking grows abstraction** — edges → textures → parts → objects as depth
  increases.

Knobs to know cold:

- **Stride** — step size; stride 2 downsamples (halves spatial size).
- **Padding** — keep spatial size ("same") or shrink ("valid").
- **Kernel size** — 3×3 is the workhorse; stacking two 3×3 ≈ one 5×5 receptive field
  with fewer params + more nonlinearity.
- **Channels** — depth of the feature map; more channels = more feature types.
- **Dilation** — spreads the kernel to enlarge receptive field without more params
  (used in CSRNet, segmentation).

## Receptive field (a classic question)

The region of input that influences one output activation. It grows with depth,
stride, and dilation. **Why it matters:** to detect a big object (a person near the
camera) an activation must "see" enough of it — too small a receptive field and the
network can't perceive large objects; too coarse and it misses tiny far ones. This
is *the* motivation for multi-scale features.

## The building blocks of modern backbones

- **BatchNorm** — normalizes activations per batch → faster, more stable training.
- **Residual connections (ResNet)** — `y = F(x) + x` lets gradients flow through
  very deep nets (solves vanishing gradients). The idea behind most backbones.
- **Pooling / strided conv** — downsample to build spatial invariance and cut compute.
- **Depthwise-separable conv (MobileNet)** — factorizes conv into per-channel +
  1×1 → far cheaper. **This is what you run on a Jetson** — name it for the edge.

## Backbones you should be able to name

| Backbone | Why you'd pick it |
|---|---|
| **ResNet-50** | strong, standard baseline; good accuracy/complexity balance |
| **MobileNetV2/V3, EfficientNet-Lite** | lightweight, mobile/edge — Jetson-friendly |
| **CSPDarknet** | the YOLO-family backbone; speed-tuned for detection |
| **ViT / hybrid** | transformers; strong but heavier — usually not first choice on edge |

## The scale problem & FPN (crucial for CCTV)

In a CCTV frame, a person near the camera is huge and one at the back is a few
pixels — a **massive scale range in one frame**. A single feature map can't handle
both. **Feature Pyramid Network (FPN)** fuses deep-semantic-low-res features with
shallow-high-res features so the detector has strong features at *every* scale.
This is why FPN-style necks are standard in detectors and why they matter more here
than in a "one object, centered" classification task.

```
deep, semantic, low-res  ─┐ (upsample + add)
                          ├─► multi-scale feature maps → detect small AND large
shallow, detailed, hi-res ─┘
```

## Quick self-check

- Why stack two 3×3 convs instead of one 5×5? *(same receptive field, fewer params,
  extra nonlinearity)*
- What do residual connections solve? *(vanishing gradients → trainable deep nets)*
- Why is FPN especially important for CCTV crowd scenes? *(huge per-frame scale
  range — near vs far people — needs multi-scale features)*
- What backbone family runs well on a Jetson and why? *(MobileNet / depthwise-
  separable convs — cheap FLOPs)*
