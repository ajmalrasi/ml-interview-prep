# S3 event → SQS → metadata worker (and ML reuse)

> **TEMP** — delete when work is done or US is known (then rename to `<US>-…`).  
> **Path:** `docs/production/s3-event-metadata-worker.md`  
> **Created / updated:** 2026-07-21  
> **Context:** Amit noted a service that triggers when new files land in S3. Explored what it is, how it is wired, and whether the same architecture can drive an ML “new data arrived” system.

---

## Work item

| Field | Value |
|---|---|
| ADO US | None yet — use `00000` until a US exists |
| Title / ask | Identify S3-upload-triggered service; assess reuse for ML |
| Branch | N/A (read-only exploration) |
| Assignee | — |

---

## Problem / ask

1. What service fires when a new file is uploaded to S3 buckets in CloudDM?
2. Can that architecture be reused for an ML system triggered by new data?

---

## Answer (short)

**Service:** `s3metadata-db-update-on-event-worker`  
**Role:** Sync SDE MSSQL table `ProjectProductOnCloud` from S3 object lifecycle events.  
**Not** an MDIO ingestion trigger (ingestion is API → RequestProcessor → throttler → MWAA).  
**ML reuse:** Yes — same S3 → SQS → K8s worker pattern; swap consumer to trigger train/feature/inference jobs (worker should only trigger, not run long GPU work).

---

## Architecture (as deployed)

```
S3 bucket (seismic-load / master SEGY storage)
  events: ObjectCreated*, ObjectRemoved*, IntelligentTiering,
          LifecycleTransition, ObjectRestore*
        │
        ▼  (bucket notification → SQS)
SQS queue (+ DLQ)
  dev:  tgs-dm-dev-s3-event-queue
  prod: tgs-dm-s3-event-queue
        │
        ▼  (long poll / receive)
K8s Deployment: s3metadata-db-update
  namespace: ns-s3metadata-db-update
  SA:      ksa-s3metadata-db-update
  labels:  app.kubernetes.io/part-of = s3-events-processor
           app.kubernetes.io/instance = s3-events-processor
        │
        ▼
MSSQL SDE (secret: sde-mssql-db)
  table: ProjectProductOnCloud  (env DB_TABLE)
```

### Flow notes

- S3 is allowed to `sqs:SendMessage` via queue policy (`AllowS3Publish` / principal `s3.amazonaws.com`).
- Worker env includes `DRY_RUN`, `DB_*`, `SQS_QUEUE_URL`, `AWS_REGION` / `SQS_REGION` / `S3_REGION`.
- HPA: min 1, max 5, CPU target 70%.
- Resource requests/limits (base): 0.5–1 CPU, 0.5–1 Gi memory.

---

## Findings — wiring details

### 1. Application / repo

| Item | Value |
|---|---|
| ADO repo | [s3metadata-db-update-on-event-worker](https://dev.azure.com/TGSCloud/TGS-CloudDM/_git/s3metadata-db-update-on-event-worker) |
| ECR image name | `s3metadata-db-update-on-event-worker` |
| Listed in IaC `projects` / ECR list | `iac-tgsprod-nonprod-dm20-dev/terraform/variables.tf` |
| CI (from release notes) | [s3metadata-worker-pipeline-ci](https://dev.azure.com/TGSCloud/TGS-CloudDM/_build?definitionId=1741) |

Repo was **not** cloned on this VM during exploration. Code path (message parse → DB write) not walked in-session; infer from K8s env + release notes.

### 2. Kubernetes (Argo / kustomize)

| Env | Path | Image | SQS URL |
|---|---|---|---|
| **base** | `~/dm20-tgs-epam-aws-kubernetes/dm20/bases/s3metadata-db-update/s3metadata-db-update.yaml` | placeholder `s3metadata-db-update-image` | `<SQS_QUEUE_URL_VALUE>` |
| **dev** | `…/environments/dev/s3metadata-db-update/kustomization.yaml` | `020028129893.dkr.ecr.us-east-1.amazonaws.com/s3metadata-db-update-on-event-worker:2026.06-dev-299072` | `https://sqs.us-east-1.amazonaws.com/020028129893/tgs-dm-dev-s3-event-queue` |
| **test** | `…/environments/test/s3metadata-db-update/` | (env twin) | (env twin) |
| **prod** | `…/environments/prod/s3metadata-db-update/kustomization.yaml` | `320708867173.dkr.ecr.us-east-1.amazonaws.com/s3metadata-db-update-on-event-worker:2026.07.13` | `https://sqs.us-east-1.amazonaws.com/320708867173/tgs-dm-s3-event-queue` |

Argo app naming (from README / labels): `s3metadata-db-update` under DM applications; prod Argo link cited in release notes: `aws-dm-prod-s3metadata-db-update`.

Base Deployment env (order matters for JSON patches — SQS URL is env index **8** in the patch):

| # | Env | Source / value |
|---|---|---|
| 0–4 | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | secret `sde-mssql-db` keys host/port/dbname/login/password |
| 5 | `DRY_RUN` | `"False"` |
| 6 | `DB_TABLE` | `ProjectProductOnCloud` |
| 7 | `AWS_REGION` | `us-east-1` |
| 8 | `SQS_QUEUE_URL` | patched per env |
| 9 | `SQS_REGION` | `us-east-1` |
| 10 | `S3_REGION` | `us-east-1` |

### 3. S3 + SQS IaC

| Item | Path / value |
|---|---|
| Module | `~/iac-tgsprod-nonprod-dm20-dev/s3/` |
| Queue module | `s3/sqs.tf` → `tgs-dm-dev-s3-event-queue` (from `s3/terraform.tfvars` `sqs_queue_config`) |
| Purpose tag | `"Processing queue for seismic data workflows"` |
| DLQ | created with queue (`create_dlq`); redrive via `redrive_policy` |
| Buckets with SQS notifs | Only configs where `notifications.sqs != null` — see `s3/locals.tf` `s3_buckets_with_sqs_notifications` |
| Bucket that has notifications (dev tfvars) | key **`segy`**, `suffix = "seismic-load"` → master seismic / SEGY load bucket (e.g. inventory prefix shows `tgs-dm-seismic-load-dev-us-east-1-1`) |
| Other buckets in same tfvars | `notifications = null` (no SQS fan-out) |

**Events configured on `segy` bucket** (`s3/terraform.tfvars`):

```
s3:ObjectCreated:Put
s3:ObjectCreated:Post
s3:ObjectCreated:Copy
s3:ObjectCreated:CompleteMultipartUpload
s3:ObjectRemoved:Delete
s3:ObjectRemoved:DeleteMarkerCreated
s3:IntelligentTiering
s3:LifecycleTransition
s3:ObjectRestore:Post
s3:ObjectRestore:Completed
s3:ObjectRestore:Delete
```

Notification wiring in `s3/main.tf`: `queue_configurations` → `module.sqs_queue.queue_arn`, optional `filter_prefix` / `filter_suffix`, optional `lambda_configurations`.

### 4. Related (not this worker)

| Thing | Role |
|---|---|
| `iac-…/terraform/lambda.tf` `ec2_cw_metrics` | Scheduled EventBridge → Lambda for EC2 CW metrics — **not** S3 upload path |
| MDIO ingestion | API Gateway → RequestProcessor → throttler DAG → composer; optional FAPOC after success — see `00000-mdio-ingestion-architecture.md` |
| Seismic load bucket | Source of SEG-Y for ingest; events also feed this metadata worker |

### 5. Release-note breadcrumbs

- **2026-04-27:** Point PPOC table for S3 event handler; prod ECR + Argo kustomize image tag.
- **2026-06-01:** DB connection reuse per poll (PR#56776).
- **2026-07-13:** Product ID validation / lookup by abbreviation (PR#57586); k8s MR#727 tag `2026.07.13`.

Useful ADO / GitLab links from those notes are in `~/TGS-Releases/2026/Release-2026-*.md`.

---

## ML system reuse assessment

### Verdict

**Yes — reuse the architecture pattern** (S3 ObjectCreated → SQS → short-lived K8s consumer → kick job). Do **not** blindly reuse this worker’s DB logic; build a sibling consumer (or new env/queue) aimed at ML.

### Mapping

| Existing piece | ML use |
|---|---|
| S3 notifications | Fire when training data / features land |
| SQS + DLQ | Buffer spikes, retry failed triggers |
| K8s worker | Parse event → validate → start train / feature build / batch inference |
| `filter_prefix` / `filter_suffix` | Restrict to e.g. `features/`, `*.parquet` |
| HPA | Scale consumers with queue depth/CPU |

### When it fits

- Data arrives as discrete S3 objects.
- Trigger is async (not synchronous API).
- Job start is idempotent (same key twice is safe).
- Need backpressure and a DLQ.

### Watch-outs for ML

1. **Multipart / many small files** — debounce or batch by prefix/time; prefer `CompleteMultipartUpload` or a `_SUCCESS` marker over every Put.
2. **Worker must not train** — SQS visibility timeout vs long GPU jobs: consumer only **enqueues** SageMaker / MWAA DAG / Kubeflow / internal API.
3. **At-least-once** — dedupe on object key + version/ETag (or content hash).
4. **Separate queue** — recommend dedicated ML queue (don’t overload `tgs-dm-*-s3-event-queue` used for PPOC) unless product intentionally shares.
5. **Bucket scope** — today only `seismic-load` is wired in explored tfvars; ML data bucket needs its own `notifications.sqs` (or EventBridge) config.

### Suggested ML sketch (not implemented)

```
ML data bucket ObjectCreated (filtered)
  → SQS tgs-dm-<env>-ml-data-event-queue (+ DLQ)
  → K8s ml-data-event-worker (trigger only)
  → SageMaker TrainingJob / Airflow DAG / batch inference queue
```

Open design choices if a US is filed: train vs inference, EKS GPU vs SageMaker, debounce strategy, exactly-once semantics.

---

## What was tried

- Read pipeline-helper rules; searched pipeline-helper / ingestion-framework for ObjectCreated — little surface area there.
- Found IaC: `iac-tgsprod-nonprod-dm20-dev/s3/{sqs.tf,main.tf,terraform.tfvars,locals.tf}`.
- Found K8s: `dm20-tgs-epam-aws-kubernetes/…/s3metadata-db-update/`.
- Correlated name `s3metadata-db-update-on-event-worker` in terraform ECR/projects lists and TGS Releases.
- Did **not** clone ADO worker repo, did **not** SSO into AWS to dump live bucket notifications / queue depth, did **not** read live pod logs.

---

## Current state

| Item | Status |
|---|---|
| Identity of S3-triggered service | Confirmed: `s3metadata-db-update-on-event-worker` |
| End-to-end wiring (IaC + K8s) | Documented from repo files |
| Worker source code walkthrough | Not done (repo not on disk) |
| Live AWS verification (notifications, messages) | Not done |
| ML design / US | Discussion only; no implementation |
| Handoff | This file |

---

## Next steps (ordered)

1. Optional: clone ADO repo `s3metadata-db-update-on-event-worker` and document message schema → DB upsert path.
2. Optional: SSO (`tgs-sso` / `tgs-sso-prod`) and verify live `get-bucket-notification-configuration` + SQS attributes match tfvars.
3. If ML work becomes a US: rename this handoff to `<US>-ml-s3-event-trigger.md`; decide separate queue/bucket vs share; design debounce + trigger-only worker.
4. Do not confuse this path with MDIO ingestion submit — keep cross-link to `00000-mdio-ingestion-architecture.md`.

---

## Takeaways / links

- **Pattern name in K8s labels:** `s3-events-processor`.
- **DB target:** SDE `ProjectProductOnCloud` (PPOC) — release notes call this out explicitly.
- **Ingestion ≠ this worker.** New SEG-Y on load bucket updates cloud metadata via this path; ingest still needs API/throttler.
- **IaC README:** `~/iac-tgsprod-nonprod-dm20-dev/README.md` — S3 module owns buckets + SQS event notifications.
- **K8s README:** lists `s3metadata-db-update` among DM applications.
- **Sibling handoff:** `~/pipeline-helper/handoffs/00000-mdio-ingestion-architecture.md`.

### Key absolute paths

```
~/iac-tgsprod-nonprod-dm20-dev/s3/terraform.tfvars
~/iac-tgsprod-nonprod-dm20-dev/s3/sqs.tf
~/iac-tgsprod-nonprod-dm20-dev/s3/main.tf
~/dm20-tgs-epam-aws-kubernetes/dm20/bases/s3metadata-db-update/s3metadata-db-update.yaml
~/dm20-tgs-epam-aws-kubernetes/dm20/environments/dev/s3metadata-db-update/kustomization.yaml
~/dm20-tgs-epam-aws-kubernetes/dm20/environments/prod/s3metadata-db-update/kustomization.yaml
```

### External

- ADO: https://dev.azure.com/TGSCloud/TGS-CloudDM/_git/s3metadata-db-update-on-event-worker  
- Prod ECR (from release notes): account `320708867173`, repo `s3metadata-db-update-on-event-worker`
