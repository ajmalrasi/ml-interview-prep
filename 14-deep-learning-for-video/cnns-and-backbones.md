# CNNs & Backbones

**TL;DR:** A convolutional network turns raw pixels into a ladder of increasingly
abstract features — edges near the bottom, whole objects near the top — and the
**backbone** is the part that does this feature extraction for everything downstream.
If you understand three things — how a convolution works and why, how far up the ladder
"seeing a whole object" happens, and why a single feature map can't cope with a CCTV
scene — you understand what the rest of this section is standing on.

## What a convolution actually does, and why it's the right tool

A convolution slides a small learnable filter across the image, computing a dot product
at each position to produce a feature map. Three properties explain why this beats a
plain dense layer for images. First, **weight sharing**: the same filter is used
everywhere, so the network needs far fewer parameters and, more importantly, an edge is
recognised as an edge wherever it appears — the response moves with the pattern. Second,
**locality**: each output looks at only a small patch of input, which matches how images
are actually structured, out of nearby pixels. Third, **composition**: stack these layers
and the abstraction climbs on its own — edges combine into textures, textures into parts,
parts into objects — without anyone hand-designing the intermediate features.

The knobs are worth knowing because they come up constantly. **Stride** is the step size,
and a stride of two halves the spatial resolution. **Padding** decides whether the output
keeps its size or shrinks. **Kernel size** is usually 3×3, and there's a neat reason:
stacking two 3×3 convolutions covers the same input area as one 5×5 but with fewer
parameters and an extra dose of nonlinearity, so modern nets prefer the stack.
**Channels** are the depth of the feature map — more channels, more kinds of feature.
And **dilation** spreads the filter out to see a wider area without adding parameters,
which is exactly the trick CSRNet uses for crowd density.

## Receptive field: the concept behind a classic question

The **receptive field** is the region of the original image that influences one
activation deep in the network, and it grows as you go deeper and as you add stride or
dilation. It matters because of a simple constraint: to recognise a large object — a
person standing near the camera — an activation has to actually "see" enough of it. If
the receptive field is too small, the network literally cannot perceive large objects;
push resolution too coarse and it loses the tiny distant ones. That tension is the whole
motivation for the multi-scale features we get to below — so if an interviewer asks about
receptive field, they're usually fishing for whether you understand *why* multi-scale
matters.

## The pieces modern backbones are built from

A few components recur everywhere. **Batch normalisation** rescales activations as they
flow through, which makes training faster and more stable. **Residual connections** — the
`y = F(x) + x` idea from ResNet — let gradients skip past layers, which is what makes it
possible to train networks dozens of layers deep without them stalling; it's the single
idea behind most backbones you'll name. **Pooling or strided convolution** downsamples to
build a bit of spatial invariance and cut compute. And **depthwise-separable convolutions**
— the MobileNet trick — factor an expensive convolution into two cheap steps, which is
precisely what lets a model run in real time on a Jetson. That last one is the one to name
when the conversation turns to the edge.

As for backbones themselves: a ResNet-50 is the dependable, well-understood baseline;
MobileNet and EfficientNet-Lite are the lightweight, edge-friendly choices you'd actually
deploy on a Jetson; CSPDarknet is the speed-tuned backbone the YOLO family is built on; and
vision transformers are strong but heavier and usually not your first pick when every
millisecond of edge latency counts.

## The scale problem, which is *the* CCTV problem

Here's where CCTV differs sharply from the tidy "one centred object" benchmark. In a single
surveillance frame, a person right under the camera can be hundreds of pixels tall while
someone at the back of the hall is a handful of pixels — an enormous range of scales in one
image. No single feature map handles both well: the deep, semantically rich maps are too
coarse to localise the tiny person, and the shallow, detailed maps don't understand what
they're looking at. The **Feature Pyramid Network** resolves this by fusing the two — taking
the deep semantic features, upsampling them, and adding them to the shallow detailed ones —
so the detector gets strong features at *every* scale.

```
deep, semantic, low-res  ─┐  (upsample and add)
                          ├─► multi-scale features → detect small AND large together
shallow, detailed, hi-res ─┘
```

This is why FPN-style "necks" are standard in detectors, and why they matter more here than
in ordinary image classification — the scale range is the defining difficulty of the
domain, and it's the reason the next page's detectors are built the way they are.

**Self-check.** Why stack two 3×3 convolutions instead of using one 5×5? *(same receptive
field, fewer parameters, and an extra nonlinearity.)* What do residual connections solve?
*(vanishing gradients, which is what lets very deep networks train at all.)* Why is FPN
especially important for CCTV crowds? *(the huge per-frame range from near to far people
demands strong features at every scale.)* And which backbone family runs well on a Jetson,
and why? *(MobileNet-style depthwise-separable convolutions, because they're cheap in
FLOPs.)*
