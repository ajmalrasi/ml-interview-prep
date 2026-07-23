# Serving Patterns

**TL;DR:** There are three ways to run a model in production, chosen by *when* you need
the prediction. **Batch** scores a big set on a schedule; **online (real-time)** scores
one request on demand behind an API; **streaming** scores events continuously. Match the
pattern to the latency the use case demands.

## Batch (offline) serving

Run predictions on a schedule over a large dataset and store the results for later use —
e.g. nightly, score every user's churn risk and write it to a table the app reads. It's
**simple and cheap** (no always-on service, no latency pressure) and perfect when
predictions don't need to be instant. The limit is freshness: predictions are as old as
the last run.

## Online (real-time) serving

The model sits behind an **API endpoint**; a request comes in, the model scores it, and
the answer returns in milliseconds — a fraud check at checkout, a recommendation as a
page loads. This is what most people mean by "deploying a model." It needs an
always-running, **low-latency, scalable** service, which brings concerns like autoscaling,
p99 latency, and load balancing (sections 7–8).

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">request</span>
    <span class="arw"></span>
    <span class="node">API<span class="nsub">load balancer</span></span>
    <span class="arw"></span>
    <span class="node">model service<span class="nsub">N replicas</span></span>
    <span class="arw"></span>
    <span class="node">prediction</span>
    <span class="arw"></span>
    <span class="node out">response</span>
  </div>
</div>
```

## Streaming serving

The model scores events as they flow through a stream (Kafka → processor → model),
continuously and without an explicit request — e.g. tagging every transaction in a live
feed. It sits between batch and online: continuous like streaming data, but you're
reacting to events rather than answering user requests.

## Choosing

| Need the prediction… | Pattern |
|---|---|
| later, in bulk, on a schedule | **Batch** |
| right now, per user request | **Online / real-time** |
| continuously, as events arrive | **Streaming** |

Say it simply: *"I pick the serving pattern from the latency requirement. If a nightly
batch table satisfies the product, I don't stand up a real-time service — it's cheaper
and simpler. I only build online serving when predictions must be fresh per request."*

## How the model is wrapped

In all cases the model is loaded inside a small service — often a REST/gRPC server (e.g.
FastAPI, or a dedicated server like TensorFlow Serving / TorchServe / Triton /
KServe) — packaged in a container so it runs identically everywhere (next page).

## 🔗 Connecting the dots: the real stack

**Online:** wrap the model in **FastAPI** or **BentoML**, or use a dedicated server — **Triton**, **TorchServe**, **TF Serving**, or **KServe / Seldon** on Kubernetes, or a managed **SageMaker / Vertex** endpoint. **Batch:** a **Spark** / **Airflow** job writing predictions to a table. **Streaming:** a **Kafka** consumer that scores each event.

**How you'd say it:** *"A real-time CV model I'd serve on Triton for GPU batching; an LLM on vLLM; a nightly churn score is just a Spark job on Airflow writing to a table the app reads."*

## Self-check

- Three serving patterns and the question that picks them? *(batch / online / streaming;
  chosen by required freshness/latency.)*
- Why prefer batch when it's enough? *(cheaper and simpler — no always-on low-latency
  service.)*
- What does online serving add operationally? *(an always-on, autoscaling, low-latency
  API with p99 and load-balancing concerns.)*
