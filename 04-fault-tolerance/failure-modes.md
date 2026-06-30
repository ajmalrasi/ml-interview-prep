# Failure Modes: What Actually Breaks

**TL;DR:** Name the failures before the fixes. An interviewer asking "how do you
make it crash-proof?" wants to hear that you've *catalogued* the ways it dies. Here
is that catalogue.

## Camera / network failures

- **Camera offline** — power loss, reboot, unplugged. RTSP connect fails or stream
  ends (EOS).
- **Network drop / flaky WiFi** — packets lost, stream stalls then resumes, or
  silently freezes (last frame repeats forever — sneaky).
- **RTSP session timeout** — no keepalive → camera tears down.
- **Credential/URL change** — auth fails on reconnect.
- **Bandwidth saturation** — too many cameras for the link → dropped packets, GOP
  corruption.

## Stream / data failures

- **Corrupted frame / lost keyframe** — gray/garbled until next I-frame.
- **Resolution or codec change mid-stream** — caps renegotiation, decoder reset.
- **Clock drift / timestamp jumps** — PTS goes backwards, jitter buffer confused.
- **Frame freeze** — decoder outputs nothing but no error fires (the silent
  killer; only a watchdog catches it).

## Compute / process failures

- **GPU OOM** — too many streams/too big a batch → CUDA out of memory.
- **Memory leak** — unbounded queue, unreleased GPU surfaces, un-`unmap`ped
  buffers → slow OOM over hours/days.
- **Decoder/plugin crash** — a bad stream segfaults a native element, taking the
  process down if not isolated.
- **Inference exception** — malformed input, NaN, model load failure.
- **Thread deadlock / GIL starvation** — one stuck thread freezes others.
- **Downstream backpressure** — DB/analytics slow → backs up the whole pipeline.

## The big principle: blast radius

The question for every failure: **how many cameras does it take down?** A
crash-proof design keeps the blast radius at **one** — one camera's failure must
never touch the others. That pushes you toward **per-stream isolation** (separate
worker/process per camera or supervised pipeline), which is the heart of the next
file.

## Why this framing wins points

When asked "how do you handle a camera going offline," weak answers jump straight
to `try/except`. Strong answers say: *"First, which failure? A clean EOS, a silent
freeze, and a network stall need different detection — EOS via the bus, freeze via
a frame-timestamp watchdog, stall via a read timeout. Then a uniform recovery:
isolate, backoff-reconnect, and degrade gracefully."* You've **enumerated** before
you **solved** — exactly your resume's hypothesis-isolate-validate method.

→ Next: **[recovery-patterns.md](recovery-patterns.md)**
