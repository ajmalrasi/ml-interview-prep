# Balanced Datasets & Airflow Pipelines

**TL;DR:** Use Airflow for orchestration, not transformation logic. Each task should
consume and produce versioned manifests, be idempotent, and stop when consent, identity
or quality contracts fail.

## Pipeline DAG

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">governed sources<span class="nsub">consent · purpose · retention</span></span>
    <span class="arw"></span>
    <span class="node">validate + quarantine<span class="nsub">schema · decode · metadata</span></span>
    <span class="arw"></span>
    <span class="node">identity resolution<span class="nsub">dedupe · conflicts · lineage</span></span>
    <span class="arw"></span>
    <span class="node">slice + split<span class="nsub">subject-disjoint · balanced</span></span>
    <span class="arw"></span>
    <span class="node out">immutable manifest<span class="nsub">train · dev · test</span></span>
  </div>
</div>
```

## Airflow task design

- Pass S3 manifest URIs through the DAG, not large image arrays through XCom.
- Make tasks idempotent with deterministic output paths keyed by dataset version.
- Separate quarantine from deletion so investigators can review bad records safely.
- Use bounded retries for transient I/O, not for deterministic validation failures.
- Record row/image/identity counts and subgroup/condition distributions at every stage.
- Backfill into a new dataset version; never mutate the manifest behind a completed run.

## Quality gates

Fail the pipeline when:

- source authorization or required consent metadata is missing;
- decoder failures exceed a bound;
- identity overlap appears across partitions;
- near-duplicate rate or label conflicts spike;
- a required subgroup/condition falls below minimum power;
- feature/preprocessing output drifts unexpectedly;
- deleted/expired subjects remain in the materialized dataset.

## Split strategy

1. Resolve identities and duplicates globally.
2. Hold out identities for final test.
3. Add time/device/geography challenge sets as separate axes.
4. Fit augmentation, calibration and quality thresholds without final test data.
5. Freeze the test protocol before candidate comparison.

## Staff-level reliability

Plan for late deletion requests, partial upstream reprocessing and schema evolution.
Dataset lineage must answer: “Which model artifacts contain this subject’s data?” This
requires manifest-level provenance, not a folder named `final_v3`.

Reuse the general pipeline material in the
[ML Engineer track](http://192.168.3.20:9002/#02-data-pipelines/README.md).
