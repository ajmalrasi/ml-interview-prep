# Spark & Hadoop at Scale

**TL;DR:** Hadoop provides distributed storage and cluster resource management; Spark builds
a DAG of transformations and runs partition-level tasks across executors. Most performance
failures come from the shape of the data movement: bad partitioning, wide shuffles, skew,
small files, serialization, or an accidental `collect()`—not from the ML algorithm itself.

## Place the components correctly

| Component | Responsibility | Interview shorthand |
|---|---|---|
| HDFS | replicated distributed file storage | move compute to partitioned data |
| YARN | cluster resource manager and scheduler | allocates containers to applications |
| MapReduce | disk-heavy batch execution model | durable but high intermediate-I/O cost |
| Spark | DAG execution engine with reusable executors | fast general batch/stream processing |
| Object storage | durable cloud data lake | cheap decoupled storage; not a local filesystem |

Spark can read HDFS, S3, GCS, ADLS, warehouse tables, and many other sources. "Spark vs
Hadoop" is therefore a misleading binary: Spark often runs on data and infrastructure from
the broader Hadoop/cloud ecosystem.

## The execution model

The **driver** creates the logical plan/DAG, requests resources, and schedules stages. Each
**executor** runs tasks over partitions and keeps shuffle/cache state for that application.
A task normally processes one partition.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">driver<span class="nsub">plan · stages · schedule</span></span><span class="arw"></span>
    <span class="node">executor A<span class="nsub">partition tasks</span></span>
    <span class="node">executor B<span class="nsub">partition tasks</span></span>
    <span class="node out">executor C<span class="nsub">partition tasks</span></span>
  </div>
</div>
```

Spark transformations are lazy. An action triggers planning and execution. Catalyst can
optimize DataFrame/SQL plans; prefer built-in expressions over Python UDFs because the
optimizer can see them and execution stays in the optimized JVM path.

## Narrow versus wide transformations

- **Narrow:** each output partition depends on a small number of input partitions (`map`,
  `filter`). They pipeline within a stage.
- **Wide:** data must move across the cluster (`groupBy`, many joins, repartition, distinct).
  A shuffle creates a stage boundary and consumes network, disk, serialization, and memory.

The right answer is not "never shuffle"—grouping and joins inherently need redistribution.
The goal is to shuffle less data, fewer times, into balanced partitions.

## Partitioning: the unit of parallelism

Too few partitions leave cores idle and make each task's working set huge. Too many create
scheduler overhead and tiny files. Choose partitions from data size and task time, then
measure. Keep partition keys aligned with common joins and filters where practical.

`repartition()` performs a shuffle and can increase or decrease partitions while balancing
data. `coalesce()` can reduce partitions without a full shuffle but may preserve imbalance.
Use the distinction, do not memorize one as universally faster.

## Data skew

If one key owns 40% of records, one reducer becomes the long tail while others finish. More
executors do not fix that single hot partition.

Diagnose skew from stage/task duration and input/shuffle-size distributions. Remedies:

- broadcast a genuinely small table to avoid a large join shuffle;
- pre-aggregate before the join;
- filter/project early so fewer bytes move;
- salt a hot key into subkeys, then combine;
- use adaptive query execution/skew handling when supported;
- isolate exceptional keys on a separate path.

Broadcasting a table that is not actually small can OOM every executor, so size it first.

## Memory and serialization failures

Executor OOM may mean:

- one partition or reduce-side hash table is too large;
- cached data plus execution memory exceeds the executor budget;
- Python/JVM serialization or object overhead dominates;
- a UDF retains objects unexpectedly;
- too many concurrent tasks share the same executor memory.

First inspect the Spark UI: failed stage, task input/shuffle sizes, spills, GC time, executor
loss, and skew. Increase memory only after fixing the data shape; otherwise you buy a larger
crash.

Never call `collect()` or `toPandas()` on unbounded data—the entire result lands on the
driver. Sample, aggregate, or write partitioned output instead.

## The small-files problem

Millions of tiny files create metadata/listing overhead and tiny tasks. Compact upstream or
before publishing curated features; target sensible file sizes; partition storage by useful,
not ultra-high-cardinality, columns. Do not `repartition(1)` just to get one pretty CSV—it
serializes output through one task.

## Feeding ML training

A robust offline feature pipeline should:

1. read an immutable source snapshot or versioned table;
2. validate schema, nulls, ranges, uniqueness, and freshness;
3. join using event-time-correct data to prevent leakage;
4. produce partitioned training examples in an efficient columnar format;
5. record code, parameters, input/output versions, and row/feature statistics;
6. publish the same feature definition used by online serving where required.

Spark prepares and validates large datasets; GPU training should read efficient shards in
parallel instead of making Spark executors pretend to be a high-performance GPU data loader.

## Debugging answer template

> I would find the slow stage in the Spark UI, compare task duration and shuffle/input bytes,
> and determine whether the bottleneck is skew, shuffle volume, spill/GC, serialization, or
> source/sink I/O. Then I would change one lever—join strategy, early filtering, partitioning,
> salting, compaction, or executor shape—and remeasure the stage, not just total job time.

## Self-check

- Why can one skewed key defeat a 100-node cluster?
- `repartition` versus `coalesce`—which forces redistribution and when is that desirable?
- Why is a built-in DataFrame expression usually preferable to a Python UDF?
- Which Spark UI evidence distinguishes skew from general resource starvation?

## Primary references

- [Apache Spark tuning guide](https://spark.apache.org/docs/latest/tuning.html)
- [Spark SQL performance tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html)
- [Apache Hadoop documentation](https://hadoop.apache.org/docs/stable/)

→ Next: **[Preprocessing & Data Quality](preprocessing-and-quality.md)**
