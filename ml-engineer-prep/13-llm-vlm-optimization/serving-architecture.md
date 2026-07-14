# Serving the Optimized Model (Internal Deployment)

**TL;DR:** Optimizing the model is only half the job — *where the inference engine sits* is the
other half. For an **internal, intermittent** workload (e.g. SEG-Y metadata extraction), never
expose TensorRT-LLM directly: it's a **GPU-backed microservice behind your application layer**.
The app does the domain work (parse, decode, auth, validate, build prompt); the engine only sees
text. Then decide the runtime shape — **always-on Deployment vs scale-to-zero vs batch Job vs
serverless GPU** — by one question: *can the request wait through a cold start?* If yes, scale to
zero; if no, keep one warm replica. This page is the deployment counterpart to
[The Loop in Practice](llm-opt-in-practice.md).

## The layering — the engine is not your application

TensorRT-LLM (or Triton / vLLM) **only performs inference**. It knows nothing about SEG-Y,
EBCDIC, auth, business rules, logging, validation, or database writes. Those live in the app
layer. Keep them separate so each side scales, secures, and evolves independently.

```rawhtml
<div class="diagram">
  <div class="vflow">
    <div class="flow">
      <span class="node data">SEG-Y file</span>
      <span class="arw"></span>
      <span class="node">App / Parser Service<span class="nsub">FastAPI · EBCDIC · headers · prompt · auth</span></span>
      <span class="arw labeled"><span class="al">internal HTTP/gRPC</span></span>
      <span class="node out">TRT-LLM Service<span class="nsub">text in → JSON out</span></span>
    </div>
  </div>
  <div class="flow-foot"><b>The engine sees only text.</b> It never opens a SEG-Y file. Everything domain-specific stays in the application layer.</div>
</div>
```

**Why the split matters:** one GPU inference server can be shared by many internal services
(Service A/B/C all POST to it). TensorRT-LLM handles batching, scheduling, KV cache, and GPU
utilization — your app never manages any of that.

## Keep it internal — no public endpoint

Since usage is internal-only, nothing is exposed to the internet. In Kubernetes the parser
simply calls a **ClusterIP** service, e.g. `http://trtllm-service:8000/v1/chat/completions`.
Lock it down with:

- **NetworkPolicies** — only the parser namespace can reach the engine
- **Internal load balancer** (never an external LB / public IP)
- **Service mesh** (Istio / Linkerd) with **mTLS** between services
- **IAM / service accounts** for identity

## The runtime-shape decision

The trap: an idle inference pod still costs you the **GPU node**. So the real question isn't
"Kubernetes vs serverless" — it's *how long can the caller wait?*

```rawhtml
<div class="diagram">
  <table class="maptable">
    <thead><tr><th>Option</th><th class="marw"></th><th>Use when · trade-off</th></tr></thead>
    <tbody>
      <tr><td class="mfrom">Always-on <b>Deployment</b><br>minReplicas 1</td><td class="marw"></td><td class="mto">continuous/unpredictable requests, low latency, shared by teams — <b>no cold start</b>, but GPU burns money while idle</td></tr>
      <tr><td class="mfrom">Scale-to-zero <b>Deployment</b><br>KEDA, minReplicas 0</td><td class="marw"></td><td class="mto">work can wait; KEDA scales 0→1 on queue depth — <b>cheap</b>, but pays a <b>cold start</b></td></tr>
      <tr><td class="mfrom">Batch <b>Job</b> / CronJob</td><td class="marw"></td><td class="mto">event-driven, asynchronous ingestion — load engine once, drain the queue, exit. <b>Best fit for SEG-Y.</b></td></tr>
      <tr><td class="mfrom"><b>Serverless GPU</b><br>Cloud Run GPU</td><td class="marw"></td><td class="mto">very low/unpredictable usage, minimal infra to manage — scales to zero, but cold starts + GPU/region/duration limits</td></tr>
    </tbody>
  </table>
</div>
```

Do **not** use a naked Pod (no lifecycle management). Deployment = persistent service; Job = one
batch; CronJob = scheduled batch.

## The scale-to-zero gotcha: pod ≠ node

Scaling the **pod** to zero is not enough. If the GPU **VM** stays up, you keep paying.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node soft">GPU pod = 0</span>
    <span class="arw labeled"><span class="al">but</span></span>
    <span class="node data">GPU node still running</span>
    <span class="arw labeled"><span class="al">= </span></span>
    <span class="node out">still billed</span>
  </div>
  <div class="flow-foot">For real savings <b>both</b> must scale to zero: inference pods <b>and</b> the GPU node pool (cluster autoscaler must be allowed to remove the empty GPU node, min size 0).</div>
</div>
```

## Recommended architecture for the SEG-Y case

SEG-Y ingestion is naturally **event-driven, asynchronous, and internal** — a batch worker beats
a permanently running REST server.

```rawhtml
<div class="diagram">
  <div class="vflow">
    <div class="flow">
      <span class="node data">SEG-Y upload</span>
      <span class="arw"></span>
      <span class="node">Ingestion DAG<span class="nsub">extract EBCDIC + headers + stats</span></span>
      <span class="arw"></span>
      <span class="node soft">Pub/Sub · SQS · Kafka<span class="nsub">compact request</span></span>
    </div>
    <div class="flow">
      <span class="node">KEDA<span class="nsub">watches queue depth</span></span>
      <span class="arw labeled"><span class="al">0 → 1</span></span>
      <span class="node">GPU worker / Job<span class="nsub">loads AWQ engine once</span></span>
      <span class="arw"></span>
      <span class="node">TRT-LLM<span class="nsub">batched extraction</span></span>
      <span class="arw"></span>
      <span class="node out">JSON → Postgres/GCS</span>
    </div>
    <div class="flow">
      <span class="node data">queue drains</span>
      <span class="arw"></span>
      <span class="node soft">worker exits · GPU node → 0</span>
    </div>
  </div>
  <div class="flow-foot">No public endpoint · no idle GPU · good batch utilization · internal security · predictable retries.</div>
</div>
```

**The one efficiency rule:** load the model **once** per run, then process 100–1,000 headers.
*Never* start one GPU Job per file — you'd re-pay the model-load cost every time.

```rawhtml
<div class="diagram">
  <table class="maptable">
    <thead><tr><th>❌ one Job per file</th><th class="marw"></th><th>✅ one Job per batch</th></tr></thead>
    <tbody>
      <tr><td class="mfrom">load → infer 1 → exit &nbsp;(×N)</td><td class="marw"></td><td class="mto">load once → infer 100–1,000 → exit</td></tr>
    </tbody>
  </table>
</div>
```

## Cold start — what you actually pay for

When scaling from zero, the first request eats: GPU **node provisioning** → container **image
pull** → **TensorRT engine** download → **CUDA init** → engine **deserialization** → **KV-cache**
allocation. That can be substantial (especially a fresh GPU VM), which is exactly why scale-to-zero
suits *batchable* work and why a **hybrid** (warm during business hours / active ingestion, scale
down after 15–30 min idle) is often the pragmatic middle ground.

## QAT recap (when PTQ isn't enough)

The conversation also revisited **QAT for LLMs** — supported, but far more expensive than PTQ, so
reserved for when PTQ's accuracy loss is unacceptable. Full treatment lives in
[LLM Quantization](llm-quantization.md); the one-liner:

> Weights stay FP16/BF16 during training, but **fake quantization** is inserted into the forward
> pass so the model *learns to compensate* for INT4/INT8 noise. Most teams try **AWQ (PTQ)** first
> — excellent accuracy/speed for far less effort — and only reach for QAT if, say, a 97%→93% drop
> is unacceptable.

## 🔗 How you'd say it

*"Since the LLM is only used internally, I wouldn't expose TensorRT-LLM publicly. I'd run it as a
GPU-backed inference microservice behind our application layer — the app handles SEG-Y parsing,
EBCDIC decoding, auth, validation, and prompt construction, then makes an internal gRPC/HTTP call.
Because ingestion is event-driven and intermittent, I'd drive a KEDA-scaled GPU worker off a
queue, batch many headers per model load, and scale both the pod and the GPU node pool to zero
when the queue drains. If callers needed instant answers I'd instead keep one warm replica — the
decision comes down to whether the request can tolerate a cold start."*

## Self-check

- Why not let the parser call TensorRT-LLM's file logic directly? *(the engine only does
  inference — it sees text, never a SEG-Y file; domain logic stays in the app layer.)*
- Pod scaled to zero but still billed — why? *(the GPU **node** is still running; the node pool
  must also scale to zero.)*
- Why one Job per batch, not per file? *(model-load cost is paid once per run; per-file Jobs
  re-pay it every time.)*
- When would you keep an always-warm replica instead of scaling to zero? *(when requests are
  interactive/frequent and can't tolerate cold-start latency.)*
- Deployment vs Job vs serverless — the deciding question? *(can the request wait through a cold
  start?)*
