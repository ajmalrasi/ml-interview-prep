# BEV: LSS, BEVFormer, BEVFusion, Occupancy

**TL;DR:** **BEV (bird's-eye-view)** perception fuses multiple cameras (and lidar/radar)
into one **top-down grid** in vehicle coordinates, which is what planning actually wants. The
hard, deploy-sensitive part is the **view transform** — lifting 2D image features into 3D/BEV
space. Three canonical approaches: **LSS** (depth-based "lift-splat"), **BEVFormer**
(transformer query-based), and **BEVFusion** (camera+lidar in a shared BEV). Occupancy
networks extend BEV to a full 3D voxel grid.

## Why BEV at all

Per-camera 2D detection forces planning to fuse six inconsistent image-space outputs. BEV
gives **one coherent, metric, top-down representation** where fusion across cameras and time
is natural, distances are real, and the output drops straight into planning. It's the
dominant automotive perception paradigm.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">6× cameras</span>
    <span class="arw labeled"><span class="al">backbone</span></span>
    <span class="node">per-view features</span>
    <span class="arw labeled"><span class="al">view transform</span></span>
    <span class="node">BEV grid<span class="nsub">top-down, ego coords</span></span>
    <span class="arw labeled"><span class="al">BEV head</span></span>
    <span class="node out">3D boxes / map / occupancy</span>
  </div>
  <div class="flow-foot">The <b>view transform</b> is the crux — it's what turns N image planes into one shared BEV, and it's the op that fights the NPU.</div>
</div>
```

## The three approaches

### LSS — Lift, Splat, Shoot (depth-based, "forward" projection)

- **Lift:** for each pixel, predict a **depth distribution**, creating a frustum of 3D points
  with feature weights.
- **Splat:** scatter those features into BEV grid cells (voxel pooling) using the camera
  calibration.
- **Shoot:** run a BEV head (detection/segmentation) on the grid.
- **Deploy view:** mostly conv + a **scatter/pool** step. The scatter (`ScatterND`-like) and
  the depth-weighted splat are the NPU-unfriendly parts; the depth net and BEV head are
  conv-friendly. Lineage: BEVDet, BEVDepth.

### BEVFormer — query-based (transformer, "backward" projection)

- Start with a fixed grid of **BEV queries** (one per BEV cell).
- **Spatial cross-attention:** each query attends to the image features at the pixels it
  **projects to** across cameras (using calibration to pick sampling points) — a
  deformable-attention `grid_sample`.
- **Temporal self-attention:** fuse the previous timestep's BEV to add motion/history.
- **Deploy view:** **transformer-heavy** — attention, `grid_sample`/deformable sampling,
  LayerNorm. These are the classic NPU fallbacks: dynamic-ish sampling, reductions,
  precision-sensitive norms. This is where your partitioning and mixed-precision work lands.

### BEVFusion — multi-modal (camera + lidar in shared BEV)

- Encode **camera** into BEV (LSS-style) **and** **lidar** into BEV (voxelization +
  sparse/3D conv), then **fuse in the BEV space** before the head.
- Robust: keeps working if one modality degrades.
- **Deploy view:** adds **sparse/3D convolution** and voxelization on the lidar branch — ops
  many NPUs don't support, often run on DSP/CPU or a specialized engine. The fusion + head
  are BEV-space conv (friendly).

### Occupancy networks (the frontier)

- Predict a dense **3D voxel occupancy** grid (occupied/free/semantic per voxel) instead of
  just boxes — captures arbitrary shapes and unknown objects.
- **Deploy view:** large 3D output → **memory/bandwidth heavy**; 3D convs and big activation
  tensors. Bandwidth is usually the limiter, not MACs.

## Comparison for a deployment engineer

| Model | View transform | NPU-friendly parts | The hard ops | Sensors |
|---|---|---|---|---|
| **LSS / BEVDet** | Forward depth splat | Depth net, BEV head (conv) | Scatter/voxel-pool | Camera |
| **BEVFormer** | Backward attention | Image backbone | Deformable attention, grid-sample, LayerNorm | Camera(+temporal) |
| **BEVFusion** | LSS + lidar voxels | BEV fusion + head (conv) | Sparse/3D conv, voxelization | Camera+lidar |
| **Occupancy** | Either + 3D decode | Conv stages | 3D conv, huge activations (bandwidth) | Camera(+lidar) |

## The deployment story you tell

1. **Backbone per camera** → NPU (happy path, the bulk of the FLOPs).
2. **View transform** → the boundary. LSS scatter or BEVFormer sampling often runs on
   **DSP/CPU** or needs graph surgery to become NPU-expressible; you **precompute the
   sampling geometry** (it's fixed by calibration) so it's a static gather.
3. **BEV head** → back on the NPU (conv again).
4. **Post-processing** (3D NMS, decode) → CPU/DSP at the tail.

The recurring theme: **push the fixed geometric parts to precomputed static tensors** so the
runtime does a cheap gather, and keep the dynamic/attention parts small and in the right
precision.

## Interview soundbite

> "BEV turns N cameras into one top-down grid planning can use. The deploy crux is the view
> transform: LSS does a forward depth-splat (a scatter that's NPU-unfriendly), BEVFormer does
> backward deformable attention (grid-sample + LayerNorm — classic fallbacks), and BEVFusion
> adds lidar sparse-conv. The trick is that the projection geometry is fixed by calibration,
> so I precompute the sampling as static tensors and keep the backbone and BEV head on the
> NPU, isolating the attention/scatter to the DSP in higher precision."
