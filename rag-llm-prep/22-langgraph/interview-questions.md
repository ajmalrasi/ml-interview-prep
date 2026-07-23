# LangGraph: Interview Questions

## Q: What is the role of LangGraph in a multi-agent system?

LangGraph is the **control-flow engine** — it models the loop or branching
between steps as an explicit graph with shared state, instead of hiding that
logic inside code. In a multi-agent system that means the supervisor's routing,
each sub-agent's loop, and the edges between them are all *visible, inspectable
nodes and edges* rather than nested function calls.

That visibility is the point. When (not if) a multi-agent system misbehaves,
the difference between reading a trace and guessing is whether the control flow
is an explicit graph. LangGraph gives you which node ran, what the model
decided, and where it went next — plus the seams that checkpointing (memory)
and streaming hook into.

Note the scope: LangGraph is the loop-builder, not the multi-agent framework
itself (that's more CrewAI's territory). You can build a supervisor *in*
LangGraph, but its core job is one thing — turning stateful, cyclic control
flow into a graph you can see.

---

## Q: What are the three parts of LangGraph's model?

State, nodes, edges. Learn these and everything else is detail.

- **State** — one `TypedDict` that travels through the graph; the shared
  notebook. Every node reads it and writes back. There's no other global
  memory — if a node needs a value, it must be in the state.
- **Node** — just a function. It takes the whole state and returns a dict of
  *only the keys it wants to change*; LangGraph merges that back in.
- **Edge** — the arrow saying "go here next." `START` and `END` are the entry
  and exit. Unconditional edges give you a straight line.

The one-paragraph version to say out loud: "State is a `TypedDict` — the shared
memory. A node takes state and returns a dict merged into it. Edges wire nodes
from `START` to `END`. Conditional edges are the only thing that makes it more
than a function chain."

---

## Q: Why does a node return a partial dict instead of mutating the state?

So LangGraph controls the merge. That control is what lets it snapshot state
for checkpointing (memory across turns) and run nodes in parallel safely.
Direct mutation would break both. A node reads `state["question"]` and *returns*
`{"chunks": ...}` — it patches the form, it doesn't recopy or mutate it.

Follow-up they like: **what if two nodes write the same key?** Last write wins
by default. If you actually want to accumulate (append messages rather than
overwrite), you attach a **reducer** to that key with
`Annotated[list, add_messages]`. Knowing reducers exist is the senior signal.

---

## Q: If the graph is just retrieve → generate, why not use plain function calls?

For two nodes, you could. The graph earns its keep the moment you need a
**branch or a loop** — because turning a sequence into a decision is one
`add_conditional_edges` call, and the decision becomes a thing you can see,
test, and trace instead of an `if` buried inside a function.

DocsMind's `INSUFFICIENT_CONTEXT` guardrail is the concrete example: in a plain
function it's an `if` in the middle of the code; as a graph it's a visible
branch — `retrieve → (chunks found?) → generate | refuse`. Same logic, now a
testable router function and a traceable path.

---

## Q: How do you keep an agent loop from running forever in LangGraph?

The router is the guard. You keep an iteration count in the state and check it
on every back-edge, routing to `END` past the cap:

```python
def should_continue(state) -> str:
    if state["iterations"] >= 5:      # the max-iterations guard, as an edge
        return "stop"
    return "use_tool" if state["tool_calls"] else "stop"
```

The loop itself is a **back-edge** — `model → run_tool → model → …` — and that
back-edge is the entire difference between a one-shot call and an agent. The key
framing for an interview: the iteration guard isn't a `while` counter you might
forget, it's an edge condition — impossible to forget and easy to see in the
trace. And you validate the branch the same way you validate the guardrail:
feed a question with no matching context, assert the graph reaches `refuse` and
returns `INSUFFICIENT_CONTEXT`.
