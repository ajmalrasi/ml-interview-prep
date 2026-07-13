# 2 — Data Pipelines

**TL;DR:** Models are only as good as the data feeding them, so a huge part of ML
Engineering is building reliable pipelines that ingest, clean, and shape data — in
batches or in real time — and serve consistent features to both training and
production. This is the "Data Pipeline Engineering" bullet in the JD, and it's where
a lot of the actual work lives.

## Why this matters more than beginners expect

You can have a brilliant model and still fail because the data arrives late, dirty,
or in a different shape than training expected. Most production ML bugs are *data*
bugs, not model bugs. Interviewers probe this because it separates people who've only
done Kaggle (clean CSV handed to them) from people who've shipped (data that's messy,
streaming, and always changing).

## The four pages

- **Ingestion & storage** — where data comes from and where it lands (lakes,
  warehouses, lakehouses).
- **Batch vs streaming** — the two processing modes and how to choose.
- **Preprocessing & data quality** — cleaning, validation, and stopping bad data
  early.
- **Feature engineering & feature stores** — turning raw data into model inputs, and
  the train/serve consistency problem a feature store solves.

## The mental model

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">sources<span class="nsub">APIs · DBs · logs</span></span>
    <span class="arw"></span>
    <span class="node">ingest<span class="nsub">batch · stream</span></span>
    <span class="arw"></span>
    <span class="node">store<span class="nsub">S3 / BigQuery / Snowflake</span></span>
    <span class="arw"></span>
    <span class="node">transform / clean<span class="nsub">Spark / SQL / dbt</span></span>
    <span class="arw"></span>
    <span class="node">features<span class="nsub">feature store</span></span>
    <span class="arw"></span>
    <span class="node out">model<span class="nsub">train + serve</span></span>
  </div>
</div>
```

→ Start: **[ingestion-and-storage.md](ingestion-and-storage.md)**
