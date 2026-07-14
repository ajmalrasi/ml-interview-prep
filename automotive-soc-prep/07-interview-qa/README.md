# 7 · Interview Q&A

**TL;DR:** The last-mile drill for the Automotive SoC AI Application Engineer loop. The
**[Rapid-Fire Q&A](interview-qa.md)** is grouped the way an interviewer escalates —
accelerators → ONNX/quantization → models → SoC/perf → runtime/safety. The
**[Cheat Sheet](cheat-sheet.md)** is the one-page recall you skim the morning of.

## How to use it

- Cover the answer, say it **out loud** in 30 seconds, then check. Interviews reward the
  spoken version, not the essay.
- If an answer feels shaky, jump back to the section it came from (each answer maps to a
  page) and re-read the soundbite.
- The day before: read every soundbite. The morning of: the cheat sheet only.

## What they're really testing (keep in mind)

1. **Do you have the embedded mental model** — heterogeneous blocks, partitioning, data
   movement — or only the GPU/TensorRT one?
2. **Can you own the ONNX + quantization workflow** end to end, including *diagnosing*
   accuracy loss, not just running a tool?
3. **Do you speak automotive** — QNX, SIL/HIL, ISO 26262 — enough to work inside a safety
   program?
4. **Are you a customer-facing engineer** — can you explain a trade-off clearly and drive an
   issue to closure?
