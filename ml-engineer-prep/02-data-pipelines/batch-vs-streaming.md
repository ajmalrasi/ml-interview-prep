# Batch vs Streaming

**TL;DR:** Two ways to process data. **Batch** runs on a schedule over a big chunk of
data (nightly, hourly) — simple and cheap. **Streaming** processes each event as it
arrives — fresh but more complex. Choose by how *fresh* the data must be.

## Batch processing

You collect data over a window and process it all at once — a nightly job that
retrains a model or recomputes yesterday's features. It's the default because it's
**simpler, cheaper, and easier to debug**: if a run fails, you just rerun it. Tools:
Spark, SQL/dbt, orchestrated by Airflow. The downside is **latency** — features are as
stale as your last run, so a nightly batch can't power a real-time fraud check.

## Streaming processing

You process events **as they happen**, continuously — updating a feature or scoring a
transaction milliseconds after it occurs. Tools: Kafka (the event backbone), Flink or
Spark Structured Streaming (processing). It gives you **freshness** but costs you
complexity: you must handle out-of-order events, late data, exactly-once processing,
and always-on infrastructure.

## Choosing

The single question is: **how fresh does the data need to be?**

| Need | Use |
|---|---|
| Daily report, nightly model retrain, recompute features | **Batch** |
| Real-time fraud block, live recommendations, instant alerts | **Streaming** |
| Both fresh *and* historical | **Both** (the "Lambda" idea: a fast stream + a correct batch) |

Say it plainly: *"I default to batch because it's simpler and cheaper, and only move
to streaming when the use case genuinely needs sub-minute freshness — because
streaming buys freshness at a real cost in complexity."* That's the senior instinct:
don't reach for streaming to look sophisticated.

## Orchestration ties it together

Either way, pipelines are chains of steps with dependencies (ingest → clean →
feature → train), and an **orchestrator** like Airflow (or Dagster/Prefect) schedules
them, runs them in order, retries failures, and alerts you. A pipeline without
orchestration is a pile of scripts someone runs by hand — fine for a demo, not for
production.

## 🔗 Connecting the dots: the real stack

**Batch** is usually **Spark** or **dbt** transforms orchestrated by **Airflow** (or Dagster / Prefect). **Streaming** is **Kafka** as the event backbone with **Flink** or **Spark Structured Streaming** doing the processing, often writing fresh values into a feature store's online store.

**How you'd say it:** *"Real-time fraud ran on Kafka + Flink updating features in Redis; the nightly churn model was a Spark job on Airflow — same data, different freshness, different stack."*

## Self-check

- One-line difference between batch and streaming? *(process a chunk on a schedule vs
  each event as it arrives.)*
- Why default to batch? *(simpler, cheaper, easier to debug; only stream when
  freshness demands it.)*
- What does an orchestrator like Airflow do? *(schedules pipeline steps in dependency
  order, retries failures, alerts.)*
