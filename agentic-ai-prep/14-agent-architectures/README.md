# 3: Agent Architectures: One Loop vs Many

**The big idea:** two separate questions hide inside "agent architecture":
which **framework** builds the loop, and whether the loop is **one agent or
several**. Keep them separate — interviewers mix them on purpose to see if
you will too. DocsMind's answer: LangGraph, single agent, explicit tools.

**Where in the pipeline:** wraps *around* the whole Retrieve → Generate →
Cite path, not inside it. Today, `RAGPipeline.query()` is the entire
"agent": one retrieve, one generate, no decisions. This section is about
what replaces that single function once Phase 5 adds a planning loop.

```rawhtml
<div class="diagram"><div class="vflow" style="align-items:stretch;gap:12px">
  <div class="flow"><span class="flow-lbl">today · Phase 1–3</span><span class="node data">question</span><span class="arw"></span><span class="node">retrieve</span><span class="arw"></span><span class="node">generate</span><span class="arw"></span><span class="node out">answer</span><span class="flow-lbl">no loop</span></div>
  <div class="flow"><span class="flow-lbl">single agent · Phase 5</span><span class="node data">question</span><span class="arw"></span><span class="node soft">plan → tool? → observe → plan → …</span><span class="arw"></span><span class="node out">answer</span><span class="flow-lbl">one LLM, one loop — DocsMind's target</span></div>
  <div class="flow"><span class="flow-lbl">multi-agent</span><span class="node data">question</span><span class="arw"></span><span class="node">supervisor</span><span class="arw"></span><span class="node soft">routes to sub-agent(s)</span><span class="arw"></span><span class="node">merge</span><span class="arw"></span><span class="node out">answer</span></div>
</div></div>
```

## Files in this folder

| File | What it covers |
|------|----------------|
| [framework-comparison.md](framework-comparison.md) | LlamaIndex vs LangChain vs LangGraph vs CrewAI — different layers, not competitors |
| [patterns.md](patterns.md) | Single agent vs peer multi-agent vs supervisor — who's in charge, and what that costs |
| [docsmind-choice.md](docsmind-choice.md) | Why `docsmind/agent/` is a single LangGraph loop, and what would change that call |

## 🎯 Interview Q&A

**Q: When do you reach for multi-agent instead of one agent with tools?**
When you have genuinely distinct roles that would otherwise collapse into
one overloaded prompt. Not by default. Not because it sounds more
sophisticated.

**Q: What does a supervisor buy you over peer agents talking directly?**
One place where decisions get made and logged. It buys debuggability, not
raw capability.

**Q: Why LangGraph over CrewAI for DocsMind specifically?**
DocsMind is one agent, one loop, explicit tools. LangGraph's job — model a
loop as a graph with state — fits exactly. CrewAI's pre-built multi-role
scaffolding solves a problem DocsMind doesn't have yet.

**Q: How would you validate single- vs multi-agent for a task?**
An end-to-end eval, run against both shapes on the same task set. If
multi-agent doesn't measurably beat a single well-scoped agent, the extra
complexity isn't earning its cost.

## Code

[docsmind/agent/\_\_init\_\_.py](../../docsmind/agent/__init__.py) — the
placeholder docstring describing the planned single-agent LangGraph loop.

→ Next: **[LangGraph Hands-On](../22-langgraph/README.md)**
