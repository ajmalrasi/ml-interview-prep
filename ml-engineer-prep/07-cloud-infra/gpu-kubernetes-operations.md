# GPU Kubernetes Operations

**TL;DR:** Kubernetes schedules GPUs only after the vendor stack advertises them as extended
resources. The production path is driver/container runtime → device plugin/GPU Operator →
labels and scheduling → workload lifecycle → DCGM telemetry and autoscaling. A pod that
requests a GPU is only the beginning.

## The stack on every GPU node

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">GPU hardware</span><span class="arw"></span>
    <span class="node">driver + container toolkit</span><span class="arw"></span>
    <span class="node">device plugin</span><span class="arw"></span>
    <span class="node soft">kubelet advertises nvidia.com/gpu</span><span class="arw"></span>
    <span class="node out">scheduled pod</span>
  </div>
</div>
```

The **NVIDIA GPU Operator** automates lifecycle management for drivers, container toolkit,
device plugin, node labeling, MIG management, and DCGM components. Use the Operator when its
supported matrix fits; otherwise manage the same compatibility chain explicitly.

Pin and test the combination of node OS/kernel, driver, CUDA/runtime container, GPU Operator,
and workload image. "CUDA mismatch" is often a stack-compatibility problem, not model code.

## Request and place GPUs intentionally

A workload requests an extended GPU resource in `limits`:

```yaml
resources:
  limits:
    nvidia.com/gpu: 1
```

Kubernetes treats whole GPUs as non-overcommitted extended resources by default. Placement
then needs the correct node pool and topology:

- labels/node affinity for GPU model, memory class, interconnect, region, or compliance;
- taints/tolerations to keep ordinary pods off expensive GPU nodes;
- topology spread/anti-affinity for replica failure isolation;
- co-location of tensor-parallel ranks inside the same NVLink/NVSwitch domain;
- adequate CPU, RAM, shared memory, storage bandwidth, and network—not only the GPU count.

A scheduler can satisfy "4 GPUs" while placing them on the wrong topology for fast
collectives unless the node shape and placement constraints express the requirement.

## Helm and Operators are different abstractions

- **Helm** templates and versions a collection of Kubernetes manifests. Values configure a
  release; rollback selects a previous release revision.
- An **Operator** runs a controller/reconciliation loop for a domain-specific resource. It
  continuously drives actual state toward desired state and can automate lifecycle actions.

Use Helm to package your inference deployment. Use GPU Operator for the node GPU software
stack. A model-serving Operator may manage model/runtime rollouts, but it does not replace
understanding Deployment, Service, probes, storage, and autoscaling behavior.

## Whole GPU, MIG, or time sharing

| Mode | Isolation/performance | Best fit |
|---|---|---|
| Whole GPU | strongest predictable ownership | large training/inference workloads |
| MIG | hardware-partitioned slices on supported GPUs | smaller predictable services, stronger isolation |
| Time sharing | multiple processes multiplex one GPU | dev/light workloads; weaker predictability |

MIG improves packing but fixes each slice's compute and memory shape. A model that barely
fits may leave no KV headroom. Benchmark the real slice and expose the correct MIG resource
type; do not assume it behaves like a fraction of a full GPU in every workload.

## Workload lifecycle for model servers

- Use a **startup probe** for long model initialization.
- Mark **readiness** only after the model can serve; remove it before draining.
- Keep **liveness** independent of queue saturation.
- Allow enough termination grace for streams/checkpoints.
- Use a PodDisruptionBudget and staged node maintenance.
- Cache images/weights and verify model revision/integrity.
- Separate secrets and credentials from the image; use workload identity where available.

For multi-rank training, all ranks should fail/restart coherently rather than leaving a job
half alive. For inference, replica failure should affect a bounded traffic share.

## GPU observability with DCGM

DCGM Exporter exposes GPU telemetry to Prometheus and can attach Kubernetes pod identity.
Monitor:

- framebuffer memory used/free and OOM events;
- SM activity and tensor activity where available;
- memory-copy activity and PCIe/NVLink traffic;
- power, clocks, temperature, throttling;
- ECC/XID/health events;
- per-pod request latency, queue, throughput, and errors from the application.

GPU utilization alone cannot tell compute-bound from memory-bound or stalled input. Correlate
DCGM with engine metrics and an Nsight/profile trace during investigation.

## Autoscaling and cost

Inference pods can scale on queue depth, request/token rate, SLO burn, or engine metrics.
Node autoscaling must also provide GPU nodes, which may take minutes to provision and load.
Plan headroom, warm pools, image pre-pull, weight caches, and scale-down drain.

Scaling a pod to zero does not save money if its GPU node remains running. Conversely,
interactive SLOs may require a warm minimum. Batch jobs can tolerate node/model cold start
and are better candidates for scale-to-zero or spot/preemptible capacity with checkpoints.

## Failure drill

**Pod Pending:** check extended-resource availability, labels/affinity, taints/tolerations,
quota, and node autoscaler constraints.

**GPU invisible in container:** check node driver, container toolkit/runtime class, device
plugin registration, and pod resource request.

**Low utilization:** correlate data/input, CPU throttling, storage/network, batch size,
kernel gaps, and communication; do not immediately add GPUs.

**XID/ECC errors:** drain/cordon the affected node according to policy, preserve evidence,
reschedule workload, and escalate hardware health.

## Interview answer

> I would use a dedicated tainted GPU node pool managed by GPU Operator, request GPUs as
> extended resources, and constrain model/topology with labels and affinity. Helm would
> package the serving release; startup/readiness/drain would protect model load and streams.
> Prometheus would combine application SLOs with DCGM metrics, and scaling would use queue
> and latency pressure while accounting for slow GPU-node cold starts. For TP, I would keep
> ranks inside the fast-link domain and verify NCCL topology.

## Primary references

- [Kubernetes: Schedule GPUs](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/)
- [NVIDIA GPU Operator](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/)
- [NVIDIA DCGM Exporter](https://docs.nvidia.com/datacenter/dcgm/latest/gpu-telemetry/dcgm-exporter.html)

→ Next: **[IaC, GPUs & Cost Control](iac-and-cost.md)**
