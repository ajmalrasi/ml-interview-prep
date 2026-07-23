# Reliability, Security & Observability

**TL;DR:** Production readiness comes from hard boundaries and explicit failure behavior. Idempotency protects updates, authorization protects data before retrieval, and OpenTelemetry connects API, queue, Airflow, workers, search, and generation into one debuggable story.

## Reliability is designed per boundary

### Event boundary

S3/SQS delivery is at least once. Derive deterministic work identity, acknowledge only after durable submission, bound retries, and route permanent failures to a DLQ or quarantine.

### Workflow boundary

Airflow stages produce versioned artifacts and checkpoints. A replacement worker can continue without creating a second logical document generation.

### Index boundary

Build a complete candidate generation and promote atomically. Keep the previous generation until the new one is proven healthy.

### Online dependency boundary

Use request deadlines, bounded retries, circuit breakers, bulkheads, and explicit fallback behavior. A provider outage must not turn into an invented answer or an infinite retry loop.

### Deployment boundary

Pin code, container, prompt, model, and index versions. Use readiness, graceful draining, canary traffic, and rollback. Do not declare a new API replica ready until it can use the required policy and search dependencies.

## Security: hard controls before soft controls

The trust order is:

1. API Gateway validates the Okta JWT.
2. The RAG API derives project permissions from trusted claims/services.
3. Search filters enforce that scope before returning candidates.
4. Context assembly removes or masks restricted fields.
5. The prompt treats retrieved content as untrusted evidence.
6. Output validation checks schema, citations, and policy.
7. Audit data records identity, filters, sources, and version chain.

IAM, authorization filters, encryption, network policy, and schemas are hard controls. Prompt instructions are soft controls.

## Security controls by risk

| Risk | Primary control |
|---|---|
| Cross-project data leakage | Server-derived project filters inside retrieval |
| Cache leakage | Permission scope and index generation in every cache key |
| Prompt injection in a document | Delimit evidence, scan high-risk sources, never allow text to control tools or filters |
| Sensitive content in telemetry | Allowlisted attributes, redaction, and no raw headers/tokens |
| Stale/deleted data | Version-aware deletion propagation and cache/index invalidation |
| Credential exposure | Workload identity, managed secrets, least-privilege IAM |
| Malicious or malformed output | Response schema, citation validation, moderation where required |

If authorization cannot be evaluated, fail closed.

## Reusing the production observability pattern

The documented MDIO platform already propagates OpenTelemetry context through HTTP, asynchronous messaging, stored workflow handoff, Airflow, and short-lived Kubernetes workers. It exports:

- application traces through OTLP;
- structured logs to Loki;
- worker resource metrics through an OpenTelemetry collector to Mimir;
- joined views in Grafana.

The RAG adaptation keeps that pattern:

```text
offline update:
S3 event → SQS consumer → Airflow run → extraction → embedding → indexing → promotion

online query:
API Gateway → RAG API → retrieval → rerank → LLM → citation validation

shared:
W3C trace context + safe correlation IDs → traces / Loki / Mimir → Grafana
```

Continue a trace for direct child work. Use a span link when a job starts later or is independently scheduled. Persist enough trace context with durable work to reconnect the story after an asynchronous gap.

## What to instrument

### Offline spans

- event validation and deduplication;
- Airflow submission and queue wait;
- extraction by source type;
- normalization and quarantine;
- chunking and embedding batches;
- bulk index writes;
- evaluation gates and alias promotion.

### Online spans

- authentication and authorization;
- query classification/filter validation;
- lexical and vector search;
- fusion and reranking;
- context assembly;
- LLM time to first token and completion;
- citation and output validation.

### Safe correlation fields

- trace/query/update ID;
- environment and service;
- project/product identifier only when policy permits;
- source object hash or safe locator;
- workflow run;
- index, embedding, prompt, and model versions;
- stage result and error class.

Never put JWTs, secrets, raw confidential headers, full prompts, or unrestricted document content into logs or span attributes.

## Grafana views that support decisions

| View | Signals and decisions |
|---|---|
| Freshness | event age, workflow duration, latest promoted generation |
| Reliability | queue age/depth, retries, DLQ, circuit state, dependency errors |
| Resources | EKS CPU/memory, pod eviction, node pressure, search health |
| Retrieval | zero-result rate, score/source distribution, stage latency |
| Generation | provider latency/errors, tokens, citation and abstention samples |
| Quality | scheduled golden-set trends and cohort regressions |
| Cost | embedding and LLM cost per successful unit of work |
| Security | denied requests, filter anomalies, policy failures |

A dashboard without a response is decoration. Every alert needs an owner, threshold rationale, and runbook.

## Availability and degraded behavior

The system should degrade by capability:

- If reranking fails, use first-stage retrieval only when policy allows.
- If generation fails, return authorized evidence without synthesis or a clear error.
- If search fails, do not generate from memory.
- If an offline candidate fails evaluation, keep the previous index live.
- If telemetry export fails, preserve local logs and alert without stopping safe work.
- If authorization fails, return no data.

## Test the controls

- replay duplicate S3 messages;
- terminate an embedding worker mid-batch;
- throttle S3 or the embedding provider;
- inject an unauthorized project filter;
- place prompt-injection text in a test document;
- corrupt a candidate index;
- break trace propagation at one async hop;
- disable the LLM provider;
- restore the previous index and service version.

The evidence is not that a runbook exists. The evidence is that the failure was injected, detected, contained, and recovered.

## Interview summary

> “The target design uses hard controls for hard requirements: JWT validation, project filters inside retrieval, least-privilege IAM, versioned indexes, and deterministic work. I would extend the OpenTelemetry pattern I have used so it joins each asynchronous update and query across services. Grafana would bring together traces, Loki logs, Mimir resource metrics, and ML quality signals. Every dependency has an explicit degraded mode, and the production gate includes fire tests for duplicate events, worker loss, index regression, authorization failure, and provider outage.”

→ Next: **[Scaling, Performance & Cost](07-scaling-performance-cost.md)**
