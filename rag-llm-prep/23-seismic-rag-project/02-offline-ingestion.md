# Offline Ingestion & Reliability

**TL;DR:** Airflow coordinates immutable object versions. Workers use range reads to extract only compact evidence, normalize it into a versioned schema, quarantine bad records, and publish deterministic documents. Every step is safe to retry.

## 1. Discover new or updated objects

Two common discovery paths can coexist:

- Object events provide low-latency notifications.
- Scheduled inventory/listing reconciles missed events and supports backfills.

The ingestion manifest records cloud, bucket, key, object version/generation, ETag or checksum, size, modification time, discovery time, processing state, parser version, and last error. An object key alone is not identity because content can be overwritten.

## 2. Create a deterministic work identity

```text
work_id = hash(cloud | bucket | key | immutable_object_version | parser_version | schema_version)
```

Airflow can retry the same work item without changing its identity. A successful record is skipped or safely upserted. A parser/schema upgrade intentionally creates a new processing generation.

## 3. Range-read the SEG-Y structure

Use `fsspec`, `s3fs`, or `gcsfs` to seek/read required ranges:

1. textual header bytes (normally 3,200 bytes)
2. binary header bytes (normally 400 bytes)
3. extended textual headers when declared or detected
4. sampled or streamed trace headers when geometry/coverage fields are required

Do not download the entire object. Keep memory bounded by a buffer or trace-header batch. `segyio` or MDIO-aware logic handles domain structure, while object-store clients own retries and range access.

## 4. Decode and extract defensively

Headers may be EBCDIC, ASCII, mixed, malformed, or vendor-specific.

- preserve raw header bytes and decoding decision for audit/debug
- attempt controlled encodings and score plausibility
- parse deterministic standard fields first
- use hosted LLM extraction only for inconsistent free-form vendor fields
- require structured output, allowed field names/types, and validation
- attach extraction confidence and provenance per field

An LLM extraction result is a candidate record, not trusted truth. It passes the same schema and semantic checks as deterministic parsing.

## 5. Normalize and validate

Map aliases such as inline/crossline, CDP, shot point, FFID, offset, angle, azimuth, survey type, coordinate units, SEG-Y revision, and MDIO version into a canonical schema.

Validation has multiple levels:

| Level | Example |
|---|---|
| Decode | bytes could not produce plausible text |
| Schema | required field missing or wrong type |
| Semantic | minimum inline greater than maximum |
| Cross-source | header product ID conflicts with ingestion metadata |
| Compatibility | SEG-Y/MDIO version unsupported by this parser |

Invalid records go to quarantine with reason codes, source version, parser version, raw evidence pointer, and retry disposition. Never silently drop them.

## 6. Retry, dead-letter, and backfill

- transient throttling/429/5xx: jittered exponential backoff and reduced concurrency
- spot eviction or pod loss: resume from manifest/checkpoint
- deterministic parser bug: bounded retries, then dead-letter until a new parser version
- partial downstream write: rerun the same deterministic document set
- historical backfill: partition by project/date/product, throttle separately from fresh ingestion

Airflow owns dependencies and task state; workers remain replaceable. Backfills and fresh work use separate pools/queues so a large replay cannot starve current data.

## 7. CPU, memory, GPU

- Header I/O and decoding are network/CPU workloads with bounded memory.
- Schema validation and most normalization are CPU work.
- Embedding can use batched CPU or GPU workers depending on measured throughput/cost.
- Hosted embeddings remove local GPU needs but add quotas, network latency, and data-policy review.
- The always-on FastAPI tier does not require GPU when generation is hosted.

## Re-ingestion state machine

```text
DISCOVERED → EXTRACTING → VALIDATED → EMBEDDED → INDEXED → PUBLISHED
                    ↘ QUARANTINED
any transient stage → RETRY_WAIT → same deterministic stage
```

Publish only after the complete document generation passes validation. The prior published generation stays queryable until the replacement is ready.
