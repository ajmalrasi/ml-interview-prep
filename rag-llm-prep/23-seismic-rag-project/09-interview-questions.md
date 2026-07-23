# Principal-Level Seismic RAG Drills

> **In simple words — what this page teaches:** Practise the hardest follow-up questions about scale, ingestion, retrieval, observability, failures, security, and cost.

Answer aloud before opening each card. A strong answer connects the constraint, decision, failure mode, and validation metric.

## Q: Why not embed all 40 PB?

The 40 PB is mainly dense numeric seismic trace data, not natural-language knowledge. Embedding it as text would be meaningless, extremely expensive, and a security risk. The RAG corpus is the compact knowledge layer: headers, normalized metadata, QC summaries, lineage, and operations. Numeric analysis remains in seismic-domain compute, with derived summaries linked into RAG.

The scaling variables for RAG are file/product count, metadata chunks, change rate, and query load—not raw stored bytes.

---

## Q: How do you read a multi-terabyte SEG-Y file without downloading it?

SEG-Y has known header regions. Use S3/GCS range reads through fsspec/s3fs/gcsfs to fetch textual and binary headers, extended headers if present, and stream selected trace-header ranges only when geometry sampling is required. Keep buffers bounded and preserve object version.

The process must tolerate incorrect declarations and encodings, so decoding/layout detection is validated and malformed inputs are quarantined rather than trusted.

---

## Q: How do you prevent duplicates and stale documents after re-ingestion?

Use immutable object versions and deterministic document IDs derived from product/file version, source type/location, and transformation versions. The same retry upserts the same documents.

For a new source or embedding/parser generation, build a complete versioned index, verify counts and retrieval, atomically move an alias, then retire the old generation. Do not delete old documents before the replacement is healthy.

---

## Q: Why hybrid retrieval instead of vector-only?

Seismic questions contain exact IDs, FFID/CDP values, error codes, vendor tokens, and rare technical vocabulary, where BM25 is strong. They also contain paraphrases and inconsistent descriptions, where dense retrieval is strong.

Run both within authorization filters and fuse ranks with RRF or calibrated weights. Validate improvement with Recall@K/NDCG by question cohort plus p95 latency/cost. Do not assume hybrid is better without measurement.

---

## Q: How do you handle structured questions such as “Which products failed L2 QC?”

Classify the intent and extract validated filters for survey type, QC stage/status, project, and time. Query exact fields/aggregations in OpenSearch. Do not ask an LLM to reconstruct counts from passages.

Use the LLM only to phrase or explain the structured result, and include authoritative source references. Mixed questions can filter the candidate set first, then run semantic retrieval inside it.

---

## Q: How do you evaluate hallucination and groundedness?

Break the problem into claim support and citation behavior. Measure faithfulness, citation validity/entailment, source coverage, answer completeness, and abstention on intentionally unanswerable/conflicting cases. Use domain experts for high-impact samples.

RAGAS or another LLM judge can accelerate offline scoring, but calibrate it against expert labels. Production proxy shifts are alerts, not perfect ground truth.

---

## Q: What happens when OpenSearch or the LLM provider is unavailable?

Use timeouts, bounded retries, circuit breakers, and dependency-specific degraded modes. With OpenSearch unavailable, fail clearly or return only a permission-safe, versioned cached result. With the LLM unavailable, use an approved fallback model or return retrieved evidence without synthesis.

Never invent an answer, retry forever, bypass authorization, or serve an unscoped shared cache.

---

## Q: Why use spot instances for ingestion but not the entire serving tier?

Extraction, embeddings, backfills, and reindexing are idempotent, checkpointable batch workloads. They can replay after interruption, so spot savings are valuable.

Online FastAPI serving has availability and tail-latency SLOs. Maintain a reliable on-demand baseline; spot can add burst capacity only with safe fallback. Critical OpenSearch state also needs deliberate durability, not opportunistic eviction.

---

## Q: How do you stop confidential project data leaking through retrieval or caches?

Derive allowed tenant/projects from authenticated server-side identity and intersect them with every query before retrieval. Use field/document restrictions where needed. Restricted text never enters model context.

Cache keys include permission context plus index/model/prompt versions. Apply least-privilege IAM, private networking, encryption, managed secrets, audit logs, redaction, retention, and deletion propagation. Prompt rules cannot replace these hard controls.

---

## Q: When would you fine-tune embeddings or the LLM?

First localize the failure. Fix extraction, schemas, filters, chunking, fusion, reranking, and prompts. Fine-tune embeddings only when the golden set shows a stable domain-semantic retrieval gap. Fine-tune the LLM only for stable behavior/formatting that prompting and retrieval cannot solve.

Track dataset, model, retriever, prompt, quality, latency, and cost; promote only with cohort-level regression and rollback gates.

---

## Q: How do you estimate capacity without inventing production numbers?

Stratify representative files by survey/vendor type. Measure header chunks, QC/ops documents, tokens, and change rate per group. Project low/base/high document counts. Benchmark embedding throughput and filtered hybrid OpenSearch queries.

Estimate vector/index bytes including ANN overhead and replicas; size API concurrency as peak RPS × p95 service time; calculate LLM tokens and provider rates by query type. Add failure/rollout headroom and identify the measured bottleneck.

---

## Q: What was the hardest engineering challenge?

Reliable metadata extraction at multi-TB file scale: range-reading enough of heterogeneous SEG-Y, decoding inconsistent EBCDIC/vendor headers, normalizing fields with provenance, and making partial failures replayable without duplicate or stale documents.

That challenge connects data engineering, domain parsing, cloud reliability, schema evolution, and search correctness. Explain one concrete failure path and how deterministic identity, quarantine, and versioned publication contained it.

---

## Q: What happens when a new SEG-Y file lands in S3?

An object-created notification is delivered through a durable queue to a small, idempotent metadata consumer. It records that the object exists using bucket, key, and immutable version/ETag; delivery is at least once, so duplicates are expected. A dead-letter queue contains messages that cannot be processed.

That event does not prove that heavy ingestion, QC, embedding, or indexing finished. The production ingestion path is separately requested and tracked: accept request, create one task per file, throttle, schedule a worker, process, update status, and only then publish trusted metadata for RAG indexing. Scheduled reconciliation catches missed events.

---

## Q: Does HTTP 200 mean every submitted file was ingested?

No. It means the service authenticated the caller, validated enough of the request to accept it, persisted a request record, and returned `request_id`. Per-file tasks are created and processed asynchronously.

The client polls request/task state or receives a completion notification. A multi-file request can end as fully successful, fully failed, or partially complete. Treating acceptance as completion would hide queue, scheduler, and worker failures.

---

## Q: Why keep request records separate from task records?

One user submission can contain many files, and each file can have a different lifecycle, retry count, workflow run, output, and failure. The request gives the user one handle; tasks give operators and schedulers the correct unit of work.

The request status is a roll-up of its tasks. This enables partial completion, per-file retry, controlled cancellation, and clear observability without pretending the batch is atomic.

---

## Q: Where should ingestion throttling happen?

After durable task creation and before launching expensive workers. The throttler reads waiting tasks, accounts for active work, and applies global capacity plus per-product concurrency and file-size limits before changing a task from `Received` to `In-queue`.

This provides backpressure without making the API slow or unreliable. It also prevents one oversized product or historical backfill from starving fresh work.

---

## Q: How do you trace one file across API, queue, Airflow, and Kubernetes?

Start with `request_id` and `task_id`. Propagate W3C trace context in the HTTP call and queue message, persist it beside task state, carry it through Airflow workflow data, and inject it into the short-lived worker. Continue the parent span for direct work; use a span link for delayed or independently scheduled work.

Export structured logs, traces, and metrics with the same safe identifiers. In Grafana, the IDs connect the accepted request, subscriber, scheduler, worker logs, resource pressure, and final index publication without logging confidential payloads.

---

## Q: How do you diagnose a file that appears stuck?

Use the last durable state to choose the next component. A request with no tasks points to queue/subscriber fan-out. `Received` points to throttling or capacity. `In-queue` points to scheduler launch or worker placement. `Processing` points to workflow spans and logs. `Failed` requires the reason code, retry classification, and cleanup result.

Do not begin by searching every log. The state machine narrows the failure domain first; trace and task IDs then find the exact evidence.
