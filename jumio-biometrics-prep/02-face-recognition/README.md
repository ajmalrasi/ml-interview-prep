# 2 · Face Recognition

**TL;DR:** Modern face recognition learns a compact embedding where samples of the same
identity are close and different identities are separated by an angular margin. The
embedding is not the decision; the protocol, similarity score and threshold are.

## Encoder to decision

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">aligned face</span>
    <span class="arw"></span>
    <span class="node">CNN / ViT encoder<span class="nsub">d-dimensional vector</span></span>
    <span class="arw"></span>
    <span class="node">L2 normalize</span>
    <span class="arw"></span>
    <span class="node">cosine score</span>
    <span class="arw"></span>
    <span class="node out">threshold / rank</span>
  </div>
</div>
```

Training usually looks like classification over many identities, while inference removes
the classification head and uses the normalized penultimate feature as the template.
Angular-margin losses make the learned class geometry useful for unseen identities.

## Core distinctions

- **Verification (1:1):** “Does this selfie match the claimed ID portrait?”
- **Closed-set identification (1:N):** “Which enrolled identity is this, assuming it is
  in the gallery?”
- **Open-set identification:** “Is this person in the gallery, and if so who?” This adds
  an explicit reject decision.

Jumio’s selfie-to-ID flow is primarily 1:1 verification, while reusable identity or known
fraud search can introduce 1:N retrieval and gallery-scale effects.

## What makes face recognition difficult

The model must suppress nuisance variation—pose, illumination, device, compression,
expression and age—without collapsing identity signal. Training data therefore needs
many identities **and** useful within-identity variation. More images of the same easy
frontal capture add less value than cross-device, cross-age and hard-condition coverage.

→ Next: **[Embeddings, Losses & Hard Negatives](embeddings-and-losses.md)**.
