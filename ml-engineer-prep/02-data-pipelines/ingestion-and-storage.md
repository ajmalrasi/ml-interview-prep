# Ingestion & Storage

**TL;DR:** Ingestion is getting data *in* from its sources; storage is where it lands
so you can process it. The main choices are data **lake** (raw, cheap, flexible),
data **warehouse** (structured, query-ready), and **lakehouse** (a blend). Knowing
when to use each is the core of this page.

## Where data comes from

Data arrives from databases (via change-data-capture or periodic dumps), application
events and logs, third-party APIs, and files. Ingestion can be **pull** (you poll a
source on a schedule) or **push** (the source streams events to you). The practical
concern is reliability: what happens when a source is down, sends duplicates, or
changes its schema — good pipelines handle all three rather than assuming happy paths.

## Lake vs warehouse vs lakehouse

This is a very common interview distinction:

| Store | Holds | Best for | Trade-off |
|---|---|---|---|
| **Data lake** (S3, GCS) | raw files, any format | cheap bulk storage, ML training data | you must impose structure later ("schema on read") |
| **Data warehouse** (BigQuery, Snowflake, Redshift) | clean, structured tables | fast SQL analytics, BI | costlier, structured data only ("schema on write") |
| **Lakehouse** (Databricks/Delta, Iceberg) | raw + table layer on top | one system for both | newer, more moving parts |

The intuition: a **lake** is a cheap dumping ground you sort out later — great for the
large, messy, unstructured data ML loves. A **warehouse** is a tidy library — great
for clean tables and analytics. A **lakehouse** tries to give you warehouse-like
tables *on top of* cheap lake storage.

## Schema-on-read vs schema-on-write

A lake is "schema on read" — you dump raw data now and interpret its structure when
you query it, which is flexible but pushes cleanup downstream. A warehouse is "schema
on write" — data must fit a defined structure to get in, which guarantees clean tables
but rejects anything malformed at the door. This trade-off — flexibility now vs
cleanliness now — explains most storage decisions.

## 🔗 Connecting the dots: the real stack

Each storage layer has a concrete implementation: a **data lake** is object storage (**S3 / GCS / ADLS**), usually with an open **table format** on top (**Delta Lake, Apache Iceberg, Hudi**); a **warehouse** is **Snowflake / BigQuery / Redshift**; a **lakehouse** is typically **Databricks** (Delta + **Unity Catalog** for governance). For ML teams the lakehouse has become the default, because it plugs straight into experiment tracking, governance, and serving — most cleanly via **MLflow** (which was created by Databricks):

| Phase | How MLflow + Databricks / Lakehouse work together |
|---|---|
| Data ingestion | MLflow logs the exact **Delta Lake snapshot version** a model trained on → strict reproducibility |
| Governance | Models are registered inside **Unity Catalog**, alongside your database tables |
| Lineage | You can trace a model's lineage all the way back to the raw unstructured files in the data lake |
| Serving | MLflow-registered models deploy in one click to **Databricks Serverless Serving** endpoints |

**How you'd say it:** *"We kept raw frames/text in S3 as the lake, curated Delta tables in Unity Catalog as the lakehouse, and MLflow pinned the exact Delta snapshot version behind every model — so any model's lineage traced straight back to the raw files, and promotion to a serving endpoint was one click."*

## Self-check

- Cheap storage for huge raw training data — lake or warehouse? *(lake.)*
- Fast SQL over clean tables for a dashboard — which? *(warehouse.)*
- Schema-on-read vs schema-on-write — one-line difference? *(interpret structure at
  query time vs enforce it at write time.)*
