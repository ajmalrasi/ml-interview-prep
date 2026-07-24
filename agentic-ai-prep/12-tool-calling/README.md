# 1: Tool Calling: The LLM Asks, Your Code Answers

**The big idea:** today, Generate is one LLM call — `RAGPipeline.query()`
retrieves once, generates once, done. Tool calling turns that one call into a
**loop**: the model can request a function by name and arguments, your code
runs it, and the model reads the result before continuing. The model never
executes anything itself. Not built in DocsMind yet — it's the core mechanic
Phase 5's agent needs.

**Where in the pipeline:** at the **Generate** stage.

```rawhtml
<div class="diagram">
  <div class="flow" style="margin-bottom:12px"><span class="flow-lbl">today:</span><span class="node data">question</span><span class="arw"></span><span class="node">retrieve(top_k)</span><span class="arw"></span><span class="node">ONE generate call</span><span class="arw"></span><span class="node out">answer</span></div>
  <div class="loopwrap"><span class="loop-top">tool calling — loop until the model is done</span>
    <div class="flow"><span class="node data">question</span><span class="arw"></span><span class="node">generate call</span><span class="arw"></span><span class="node soft">model: "call retrieve('x')"</span><span class="arw"></span><span class="node">your code runs it</span><span class="arw"></span><span class="node out">final answer</span></div>
    <span class="loop-back"><span class="lb-arw"></span> result feeds back into the next <b>generate call</b></span>
  </div>
</div>
```

## Files in this folder

| File | What it covers |
|------|----------------|
| [the-loop.md](the-loop.md) | Why one-shot retrieval isn't enough, and how the request/execute loop works |
| [code-seam.md](code-seam.md) | The two exact places DocsMind changes: the LLM client contract and the control loop |
| [reliability-and-security.md](reliability-and-security.md) | The part interviews actually probe: malformed calls, open-model regressions, the tool-call success metric |

## 🎯 Interview Q&A

**Q: What is tool calling, in one line?**
The model requests a function by name and arguments; your code runs it and
hands the result back. The model never executes anything itself.

**Q: Why can't the model just call the function directly?**
It has no execution environment. It only emits text (structured as JSON
here). Every "action" an LLM takes in the world is actually your code,
triggered by a message it wrote.

**Q: What's the failure mode that actually shows up in production?**
Not "the model refuses to use a tool." It's **malformed or wrong-tool calls**
— especially after swapping to a smaller or open-weight model. The fix path,
in cost order: prompting first, then structured-output constraints
(Outlines/XGrammar), then fine-tuning as a last resort.

**Q: How do you measure whether tool calling works?**
Track tool-call success rate as its own metric, separate from answer quality:
right tool, valid arguments, first try. That metric is the one that breaks
first when you swap models.

## Code

[docsmind/llm/cloud_client.py](../../docsmind/llm/cloud_client.py) — the
one-shot `generate()` that would grow a `tools=` parameter.
[docsmind/agent/__init__.py](../../docsmind/agent/__init__.py) — today a
docstring; the placeholder for the loop.

→ Next: **[13-mcp/README.md](../13-mcp/README.md)**
