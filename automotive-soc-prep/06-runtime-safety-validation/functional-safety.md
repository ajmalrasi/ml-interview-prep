# ISO 26262 / ASIL Functional Safety

**TL;DR:** **ISO 26262** is the automotive functional-safety standard. It classifies each
function's risk as an **ASIL** level (A→D, D = most stringent) and dictates the process and
rigor required. AI/perception adds a twist: it's not just about *malfunction* (26262) but
about *the system doing the wrong thing while working as designed* — that's **SOTIF (ISO
21448)**. You won't own the safety case, but you must know why it constrains your model
choices.

## The vocabulary you must have

| Term | Meaning |
|---|---|
| **Functional safety** | Absence of unreasonable risk due to **malfunction** of E/E systems |
| **ISO 26262** | The automotive functional-safety standard (the "how") |
| **ASIL** | Automotive Safety Integrity Level — the risk rating that sets required rigor |
| **SOTIF / ISO 21448** | Safety Of The Intended Functionality — risk from **performance limitations**, not faults (key for AI/perception) |
| **Safety case** | The documented argument + evidence that the system is acceptably safe |
| **Redundancy / diversity** | Independent channels so one failure doesn't cause a hazard |

## ASIL levels

ASIL is derived from three factors of a hazard:

- **Severity** (how bad if it happens), **Exposure** (how often the situation occurs),
  **Controllability** (can the driver avoid harm).
- Combined into **QM** (quality-managed, no ASIL needed) → **ASIL A** → **B** → **C** →
  **ASIL D** (highest rigor).
- **Perception for AD is typically high ASIL (C/D)** — a missed pedestrian is severe, common
  enough, and hard to control → maximum rigor.

Higher ASIL ⇒ more required: redundancy, diverse implementations, stricter testing coverage,
tool qualification, and a documented safety case.

## Why AI/perception is the hard case (SOTIF)

Classic 26262 assumes hazards come from **faults** (a bit flips, a sensor dies). But a neural
network can be **working perfectly and still be wrong** — it just didn't generalize to this
scene (unusual lighting, an unseen object). That's a **performance limitation**, the domain
of **SOTIF**. So AD safety needs **both**: 26262 for the "it broke" failures and SOTIF for
the "it's confidently wrong" failures.

Implications you can speak to:

- **You cannot prove a DNN correct**, so safety leans on **redundancy and diversity** —
  independent sensors (camera + lidar + radar, hence BEVFusion), independent perception
  paths, and plausibility/monitor checks.
- **ODD (Operational Design Domain)** — define the conditions the system is validated for and
  detect when you're outside it (degrade gracefully).
- **A safety monitor / fallback** — a simpler, verifiable checker can veto or safe-stop when
  the primary perception is uncertain.

## How this constrains your model work

This is the point of the page — connect safety to your day-job decisions:

- **Determinism is mandatory** — bounded WCET, static shapes, no unpredictable fallbacks
  (ties to [linux-qnx-runtime](linux-qnx-runtime.md)). A model that's *usually* fast is not
  acceptable if its worst case is unbounded.
- **Accuracy targets are hard limits, not goals** — you can't trade 3 points of pedestrian
  recall for latency the way you might in a consumer product. This is why the
  [accuracy-mitigation](../03-quantization-embedded/accuracy-mitigation.md) work is
  non-negotiable, not best-effort.
- **Traceability & reproducibility** — quantization configs, calibration data, and
  validation results are **evidence** in the safety case; they must be versioned and
  reproducible.
- **Tool qualification** — the compiler/quantizer may need to be a qualified tool; you can't
  silently swap toolchain versions.

## What you're expected to know vs own

You are **not** the safety manager. You **are** expected to:

- Speak the vocabulary (ASIL, SOTIF, safety case, ODD, redundancy).
- Understand *why* your deliverables (accuracy reports, deterministic latency, versioned
  configs) feed the safety case.
- Not make changes that quietly break the safety argument (nondeterminism, unqualified tools,
  untracked model changes).

## Interview soundbite

> "ISO 26262 rates each function by ASIL A to D, and AD perception is usually C or D — maximum
> rigor. The AI wrinkle is SOTIF: a network can work as designed and still be wrong on an
> unseen scene, which you can't prove away, so safety relies on sensor and path redundancy,
> ODD monitoring, and a simpler safety monitor. For me that means determinism and accuracy
> are hard constraints, and my quantization and validation artifacts are versioned evidence
> in the safety case, not disposable dev outputs."
