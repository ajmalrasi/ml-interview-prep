# 6 · Runtime, Safety & Validation

**TL;DR:** The model runs inside an **embedded OS** (Linux or **QNX**), gets validated on
**simulators and target boards** (SIL / HIL), and lives under **automotive functional
safety** (ISO 26262 / ASIL). You won't be the safety engineer, but you must speak this
language — it frames every deployment decision, from "why QNX" to "why we can't just ship the
fastest model."

## Why an application engineer needs this

- **Runtime** decides how deterministic your inference is — a soft-real-time Linux path vs a
  hard-real-time QNX path changes how you think about latency guarantees.
- **Validation** is how your work gets signed off — you'll produce results on SIL and HIL and
  contribute to release validation (a JD responsibility).
- **Safety** is the backdrop the whole product lives in — it explains determinism
  requirements, redundancy, and why accuracy targets are hard limits, not nice-to-haves.

## Pages

- **[Embedded Runtime: Linux & QNX](linux-qnx-runtime.md)** — the two OS worlds, real-time
  scheduling, and where your inference process sits.
- **[SIL / HIL Validation](sil-hil-validation.md)** — the X-in-the-loop ladder: what SIL,
  HIL (and MIL/PIL) each validate and where you plug in.
- **[ISO 26262 / ASIL Functional Safety](functional-safety.md)** — the standard, ASIL levels,
  and how AI/perception fits (SOTIF, redundancy, the safety case).

## The one-liner to have ready

> "I develop and quantify on Linux and desktop first, but I validate against the target: SIL
> for the software logic in simulation, HIL with the real SoC in the loop against sensor
> playback, and on target boards for the true numbers. The whole thing runs under ISO 26262,
> which is why determinism and hard accuracy targets aren't negotiable — perception is an
> ASIL-rated function."
