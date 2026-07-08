# CNNs & Backbones

**TL;DR:** CNN = ladder of features (edges→objects). **Backbone** = feature extractor under detector/tracker. Know: convolution, receptive field, FPN (scale).

## Convolution — why it fits images
- **Weight sharing** — same kernel everywhere → few params, edge-anywhere (translation equivariance).
- **Locality** — each output sees a local patch.
- **Depth stacks abstraction** — edges → textures → parts → objects.

Knobs: **stride** (2 = downsample), **padding** (same/valid), **kernel** (3×3; two 3×3 ≈ one 5×5, fewer params + more nonlinearity), **channels** (feature types), **dilation** (bigger receptive field, no extra params — CSRNet).

## Receptive field
Input region affecting one activation; grows with depth/stride/dilation. Too small → can't see big objects; too coarse → miss tiny ones → **motivation for multi-scale (FPN)**.

## Backbone building blocks
- **BatchNorm** — faster/stable training.
- **Residual (ResNet)** `y=F(x)+x` — fixes vanishing gradients → deep nets. Core idea.
- **Pooling / strided conv** — downsample.
- **Depthwise-separable (MobileNet)** — cheap conv → **runs on Jetson**.

| Backbone | Pick when |
|---|---|
| ResNet-50 | strong standard baseline |
| **MobileNet / EfficientNet-Lite** | edge / Jetson |
| CSPDarknet | YOLO backbone, speed-tuned |
| ViT | strong but heavy, rarely edge |

## Scale problem = THE CCTV problem
Near person = 100s px, far person = few px → huge range in one frame. Single map can't do both.
**FPN** fuses deep-semantic (upsampled) + shallow-detailed → strong features at **every scale**.
```
deep semantic low-res ─┐ upsample+add
shallow detail hi-res ─┘→ detect small AND large
```

## Q&A
- Two 3×3 vs one 5×5? → same RF, fewer params, extra nonlinearity.
- Residuals solve? → vanishing gradients → deep nets train.
- FPN for CCTV why? → huge near/far scale range.
- Jetson backbone? → MobileNet (depthwise-separable, cheap FLOPs).
