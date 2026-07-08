# 04 — Fault Tolerance ("Crash-Proof" Systems)

**TL;DR:** The JD is blunt: *"Build Crash-Proof systems. If a camera goes offline
or a frame is dropped, the system recovers gracefully without manual
intervention."* The mindset: **assume everything fails — cameras, networks, the
GPU, your own process — and design so each failure is isolated, detected, and
auto-recovered.**

This is a *mindset* section more than a tools section. Interviewers probe it
because it separates demo code from production code.

Files:
1. [failure-modes.md](failure-modes.md) — everything that breaks in a video system
2. [recovery-patterns.md](recovery-patterns.md) — reconnect, watchdog, isolation, graceful degradation

## The one-liner to lead with

*"In a 24/7 multi-camera system, the question isn't if a camera drops but when. I
isolate each camera into its own supervised worker, watchdog it on frame
freshness, reconnect with exponential backoff, and make sure one dead stream can
never take down the other 39 or leak memory while it's gone."*

That sentence alone shows you've run this in production.

→ Start: **[failure-modes.md](failure-modes.md)**
