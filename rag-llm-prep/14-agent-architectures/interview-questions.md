# Agent Architectures — Interview Questions

## Q: How does Agentic AI differ from a traditional workflow?

A traditional workflow has the control flow fixed in code: step 1 → step 2 →
step 3, with the branches written by you ahead of time. An agent moves that
decision *into the model*. The LLM sits in a loop — it plans, calls a tool,
sees the result, and decides what to do next — until it decides it's done.

The dividing line is **who chooses the next step**. In a workflow, the
developer chose it at write time. In an agent, the model chooses it at run
time. That's the whole difference, and it's also the whole trade: an agent
handles cases you didn't enumerate, but the control flow is now non-deterministic
and has to be bounded (a max-iterations guard) so it can't loop forever.

A useful tell: if you can draw the full flowchart before any request arrives,
it's a workflow. If the path depends on what the model decides mid-run, it's
an agent.

---

## Q: Single agent vs multi-agent vs supervisor — what's the difference and when do you use each?

All three live at the same place: the loop wrapping the pipeline. The
difference is how many LLM loops exist and who decides what runs next.

- **Single agent** — one LLM, one loop, a set of tools. It switches "hats"
  itself. One trace to read when it breaks.
- **Peer multi-agent** — several agents with narrower toolsets passing
  messages directly to each other, nobody globally in charge. Easy to create
  failure loops (two agents endlessly deferring), hard to debug.
- **Supervisor** — one routing LLM whose only job is deciding which specialist
  sub-agent handles each step; sub-agents report back up, never sideways to
  each other. Most production multi-agent systems converge here because it
  gives one point of control and one place to look when something goes wrong.

Default to a single agent. Reach for a supervisor only when you have genuinely
distinct specialties with different tools, prompts, or context windows.

---

## Q: Multi-agent sounds more powerful — why not always use it?

Because multi-agent's real cost is **coordination, not compute**. Every hop
between agents is a full LLM call reinterpreting another LLM's natural-language
output — a lossy channel, and each extra agent is a place meaning can drift.
You also multiply the hiding places: a single agent is one trace, one loop;
multi-agent is traces × agents when the answer comes out wrong.

Reaching for multi-agent before you have more than one distinct role is adding
graph complexity with no matching problem. The tell that you've actually
outgrown a single agent: its system prompt turning into a pile of "if this
kind of question act like X, if that kind act like Y" — a disguised router.
That's when you promote it to a real supervisor.

---

## Q: LlamaIndex vs LangChain vs LangGraph vs CrewAI — compare them.

It's a trick prompt: they solve **different layers**, so a head-to-head is a
category error, and interviewers use it to check whether you know the stack or
just the brand names.

- **LlamaIndex** — ingestion/indexing: loaders, chunkers, index abstractions.
  "How do I get documents into an index."
- **LangChain** — general LLM app toolkit: prompt templates, chains,
  integrations. "How do I compose LLM calls quickly."
- **LangGraph** — a graph execution engine for stateful, cyclic control flow.
  "How do I model a loop or branch as an explicit graph with state."
- **CrewAI** — a multi-agent framework: pre-built roles, a crew delegating
  tasks. "How do I get role-playing agents cooperating out of the box."

The strong answer names which you'd use together and which you'd skip *for
stated reasons*. DocsMind uses LlamaIndex (ingestion) + LangGraph (the loop),
skips LangChain (its LLM usage is one well-understood call, better as a direct
SDK call) and CrewAI (no multi-agent problem exists yet).

---

## Q: How would you validate that a single agent is enough, rather than assuming?

Run an end-to-end eval against both shapes on the same task set — the same
discipline as a retrieval eval or an answer-faithfulness eval:

| Metric | Single agent | Multi-agent |
|---|---|---|
| Task success rate | baseline | must *beat* it, not tie |
| Tokens per task | fewer (no coordination hops) | more — every hop is an LLM call |
| Latency per task | lower | higher and more variable |
| Debuggability | one trace | traces × agents |

If multi-agent doesn't measurably beat a well-scoped single agent, the extra
complexity isn't earning its cost. In an interview, having *run* that
comparison — even on a toy task set — beats any amount of architecture
vocabulary.
