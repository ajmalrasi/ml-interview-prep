# Recovery Patterns

**TL;DR:** Five patterns cover almost everything: **isolate** each stream,
**watchdog** for freshness, **reconnect with exponential backoff**, **bound every
buffer**, and **degrade gracefully** instead of crashing. Supervise the whole thing
so a dead worker auto-restarts.

## 1. Per-stream isolation (limit blast radius)

Run each camera in its own **worker** — a thread, an asyncio task, or (safest) a
separate **process**. A crash or stall in one is contained.

- **Process per camera** — strongest isolation; a native decoder segfault kills
  one process, a supervisor respawns it. Costs more memory.
- **Thread/task per camera** — lighter, but a native crash can take the process
  down; fine when decoders are stable and you watchdog well.
- DeepStream alternative: many streams in one pipeline, but then you need
  `nvstreammux` to tolerate a source dropping (it can, with proper config) so one
  bad source doesn't stall the batch.

## 2. Watchdog on frame freshness (catch silent freezes)

The freeze that throws no error is the dangerous one. Track the timestamp of the
last frame per camera; if `now - last_frame > threshold`, declare it dead and
trigger reconnect — even though no exception fired.

```python
if time.monotonic() - last_frame_ts > STALE_SECONDS:
    log.warning("camera %s stale, restarting", cam_id)
    restart_stream(cam_id)
```

## 3. Reconnect with exponential backoff + jitter

Don't hammer a down camera every 100ms (you'll DoS it and flood logs). Back off:
1s, 2s, 4s, 8s… capped (e.g., 30s), with a little random **jitter** so 40 cameras
don't all retry in lockstep after a network blip.

```python
delay = min(base * 2 ** attempt, max_delay) + random.uniform(0, jitter)
```

Reset the counter on a successful reconnect. Remember: after reconnect you wait for
the next **keyframe** before clean frames resume.

## 4. Bound every buffer (no leaks)

From section 01: every queue bounded, drop-oldest for live. Explicitly release GPU
surfaces / `unmap` GStreamer buffers each iteration. A long-running process must
have **flat memory** over days — test it: run 24h, watch RSS/GPU mem. (Tie to your
resume: long-running petabyte pipelines.)

## 5. Graceful degradation (don't crash, shed load)

When overloaded, *reduce service* instead of dying:
- GPU OOM risk → drop to a smaller batch or skip frames (process every Nth).
- One model too slow → lower inference resolution or framerate.
- Downstream DB slow → buffer results briefly, then drop non-critical writes, keep
  the video loop alive.
- Always **fail open or fail safe by design**, never by accident.

## 6. Supervision (auto-restart the recoverer)

Wrap workers in a supervisor that restarts crashed ones (like Erlang/OTP
supervision trees, or just a monitoring loop / k8s liveness probe). The recovery
code itself can fail — something must watch the watcher.

- **Process level:** systemd, supervisord, or **Kubernetes liveness/readiness
  probes** (your GKE experience) restart unhealthy pods.
- **Health endpoint:** expose `/healthz` reporting per-camera freshness so the
  orchestrator and dashboards see truth.

## Putting it together (the worker loop)

```python
def camera_worker(cam_id, url):
    attempt = 0
    while not shutdown.is_set():
        try:
            cap = open_stream(url)             # GStreamer/NVDEC pipeline
            attempt = 0                        # reset backoff on success
            while not shutdown.is_set():
                ok, frame = cap.read()
                if not ok or stale(cam_id):    # EOS or watchdog
                    raise StreamError("dead")
                latest[cam_id] = frame         # bounded: overwrite, never grow
                mark_fresh(cam_id)
        except Exception as e:
            log.warning("cam %s down: %s", cam_id, e)
            release(cap)                       # free buffers/GPU surfaces!
            time.sleep(backoff(attempt)); attempt += 1
        finally:
            release(cap)
```

This single loop demonstrates isolation, watchdog, backoff, bounded buffer, and
cleanup — a great thing to whiteboard.

## Why X over Y

**Process-per-camera vs thread-per-camera?**
Process = strongest isolation (native crash contained, true parallelism, no GIL)
at higher memory cost. Thread = lighter and shares memory, but a native segfault or
GIL contention can hurt all of them. Choose process isolation when decoders are
flaky or streams are many and independent.

**Fixed retry interval vs exponential backoff?**
Fixed interval hammers a down resource and floods logs; exponential backoff (with
jitter and a cap) is gentle, avoids thundering-herd reconnects, and recovers fast
when the camera returns. Always backoff + jitter.

**Crash-and-restart vs in-process recovery?**
Sometimes the cleanest recovery is to let a worker die and have the supervisor
respawn it (fresh state, no leaked resources) — "crash-only" design. In-process
recovery is faster but risks accumulating subtle corruption. For native video
stacks, supervised restart is often more robust.

→ Back to [section README](README.md) · Next section: **[05-production-python/](../05-production-python/README.md)**
