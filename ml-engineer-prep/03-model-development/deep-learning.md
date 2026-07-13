# Deep Learning Essentials

**TL;DR:** Neural networks stack layers of simple units that learn features
automatically — which is why they dominate on unstructured data (images, text, audio).
Know the training loop (forward pass, loss, backprop, gradient descent) and the main
architecture families at a level you can talk about.

## How a neural net learns

A network is layers of "neurons," each computing a weighted sum of its inputs passed
through a non-linear **activation** (ReLU). Training is a loop:

```rawhtml
<div class="diagram">
  <div class="loopwrap">
    <div class="vflow">
      <span class="node">forward pass<span class="nsub">inputs → layers → prediction</span></span>
      <span class="varw"></span>
      <span class="node">loss<span class="nsub">how wrong is the prediction?</span></span>
      <span class="varw"></span>
      <span class="node">backprop<span class="nsub">how each weight contributed to the error (gradients)</span></span>
      <span class="varw"></span>
      <span class="node out">update<span class="nsub">nudge weights down the gradient</span></span>
    </div>
    <span class="loop-back"><span class="lb-arw"></span> repeat over many batches (epochs)</span>
  </div>
</div>
```

The magic is that with enough layers and data, the network **learns its own features**
— early layers pick up edges or word patterns, deep layers combine them into concepts —
instead of you hand-engineering them. That's exactly why deep learning wins where
features are hard to design by hand (pixels, raw text) and is overkill where good
features are easy (small tabular data).

## Key training knobs

- **Learning rate** — step size; the single most important hyperparameter (too high
  diverges, too low crawls).
- **Batch size** — how many examples per update.
- **Epochs + early stopping** — passes over the data; stop when validation stops
  improving.
- **Regularization** — **dropout** (randomly drop neurons) and weight decay to fight
  overfitting.

## The architecture families

| Family | For | One-liner |
|---|---|---|
| **MLP / feed-forward** | tabular, simple | fully connected layers |
| **CNN** | images | convolutions detect local patterns at every position |
| **RNN / LSTM** | sequences (older) | process step by step, carry state |
| **Transformer** | text, and now everything | **attention** weighs all positions at once — scales, parallelizes; basis of LLMs |

The headline: **Transformers** replaced RNNs for most sequence work and underpin modern
LLMs (section 9), because **attention** lets the model relate any two positions directly
and trains in parallel rather than step by step.

## 🔗 Connecting the dots — the real stack

**PyTorch** is the research/industry default (often via **PyTorch Lightning** to remove boilerplate); **TensorFlow / Keras** is still common in production; **HuggingFace Transformers** is where you get pretrained models to fine-tune. Data loading uses framework `DataLoader`s, and training runs on GPU instances in the cloud.

**How you'd say it:** *"I build in PyTorch (Lightning for the training loop), start from a pretrained backbone on HuggingFace, and track runs in W&B."*

## Self-check

- What are the four steps of the training loop? *(forward pass, loss, backprop,
  weight update.)*
- Why deep learning for images/text but not small tabular data? *(it learns features
  from unstructured data; on small tabular, boosted trees win.)*
- Why did Transformers replace RNNs? *(attention relates all positions directly and
  trains in parallel; better at long-range and scale.)*
