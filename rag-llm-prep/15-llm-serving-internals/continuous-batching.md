# Continuous Batching — Don't Let One Slow Request Block the Queue

**TL;DR:** naive batching waits for the whole batch to finish before starting
the next one, so one long answer stalls everyone. Continuous batching swaps
requests in and out *mid-batch*, at the token level. It's the core trick
behind vLLM and TGI.

## Beginner mental model

> **ML bridge:** ordinary static batching resembles padding variable-length sequences to
> the longest item. Once a short sequence finishes, its lane does no useful work. Continuous
> batching replaces that finished sequence with a queued one between decode iterations.

The bus analogy: a static bus waits until every passenger reaches the final stop before
accepting anyone new. A continuous bus drops off and picks up passengers at every stop.
The **GPU batch membership changes**, while each request's token order remains autoregressive.

What it improves is **system throughput and queue time under concurrency**. It does not make
the transformer mathematically faster, and it may do nothing for a single request.

## The problem with static batches

Naive batching groups N requests and waits for **all of them** to finish
before starting the next batch. One long request stalls everyone behind it.
The GPU sits idle waiting for the straggler.

```rawhtml
<div class="compare">
  <div class="cmp-col">
    <div class="cmp-h">Static batching</div>
    <p>A runs long; B and C <b>finish early but their slots sit idle</b> until the whole batch ends. D waits for A.</p>
    <span class="cmp-tag">wasted GPU slots</span>
  </div>
  <div class="cmp-col green">
    <div class="cmp-h">Continuous batching</div>
    <p>As B and C finish, <b>D and E slot into the freed slots mid-batch</b> — the GPU never idles.</p>
    <span class="cmp-tag">slots refill immediately</span>
  </div>
</div>
```

## Try it: watch freed GPU slots

Move through decode iterations and switch the batch policy. Requests A–C enter first;
D–F wait in the queue. In a static batch, an early finisher leaves a hole. With continuous
batching, the scheduler admits a waiting request into that slot at the next token boundary.

```rawhtml
<div id="continuous-batching-widget"></div>
```

## Why continuous over static batching?

| Workload | Better choice | Why |
|---|---|---|
| Offline jobs with similar fixed lengths | Static can be sufficient | Simple, predictable batches have little straggler waste |
| Online chat with mixed answer lengths | Continuous | Finished slots are useful immediately instead of waiting for the longest answer |
| One request at a time | Neither has a throughput advantage | There is no second request to fill a slot |

This is a scheduler optimization, not free capacity. Very aggressive batching can improve
total tokens/second while worsening one user's ITL, so the scheduler still needs latency
budgets and admission control.

## How continuous batching works

**Continuous batching** — the core trick behind vLLM, TGI, and friends —
tracks each request independently, at the token level. The moment one
request finishes (hits its stop token), a new request from the queue slots
into the freed spot. Mid-batch, immediately.

The GPU stays busy. Throughput goes up. Short requests stop paying for long
ones.

Plain version: not a bus that waits for every passenger to reach their stop
before picking up new riders. A bus that drops people off and picks new ones
up at every stop, never idling.

This is also why it pairs with PagedAttention
(see [kv-cache.md](kv-cache.md)): requests joining and leaving mid-batch
need cache memory that can be allocated and freed in small blocks, not one
big contiguous slab per request.

## The trade-off: it only helps under load

Continuous batching only helps under **concurrent** load. A dev box serving
one request at a time — today's Ollama setup — gets nothing from it. It's a
production-multi-user optimization.

Which is exactly why it matters for the "deploy at scale" interview question
and not for `make demo`:

| Load pattern | Static batching | Continuous batching |
|---|---|---|
| 1 request at a time (dev box) | fine | identical — nothing to interleave |
| Bursty, mixed-length requests | GPU idles behind stragglers | GPU stays saturated |
| Steady high concurrency | throughput = slowest request's pace | throughput ≈ hardware limit |

## How you'd validate it

Benchmark throughput (requests/sec and tok/s) vs concurrency level, same
model, Ollama vs vLLM, on the beast. The expected shape: nearly identical at
concurrency 1, vLLM pulling ahead as concurrency rises. Producing that curve
— not quoting it — is the roadmap's whole point: "I measured continuous
batching's effect on my own hardware" is an entry-gate bullet.

→ Next: **[speculative-decoding.md](speculative-decoding.md)**
