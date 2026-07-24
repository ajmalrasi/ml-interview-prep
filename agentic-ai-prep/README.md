# Agentic AI Interview Prep: From Tool Call to Reliable Agent

Learn agentic AI in the order the control flow is built. Start with the model
requesting one tool, standardize tool access with MCP, choose the smallest
architecture that fits the problem, and then make the workflow explicit with
LangGraph.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">user goal</span><span class="arw"></span>
    <span class="node">model decides</span><span class="arw"></span>
    <span class="node">tool call</span><span class="arw"></span>
    <span class="node">execute safely</span><span class="arw"></span>
    <span class="node">observe result</span><span class="arw"></span>
    <span class="node out">answer or continue</span>
  </div>
</div>
```

## The learning path

| Stage | Topic | What you learn |
|---|---|---|
| 1 | [Tool calling](12-tool-calling/README.md) | The request → execute → observe loop and its safety boundaries |
| 2 | [MCP](13-mcp/README.md) | How a protocol separates agent clients from reusable tool servers |
| 3 | [Agent architectures](14-agent-architectures/README.md) | When to use one agent, multiple agents or a supervisor |
| 4 | [LangGraph](22-langgraph/README.md) | State, nodes, edges, branches and bounded loops |

## Scope

This site covers agent control flow, tools, protocols and orchestration. RAG
remains a useful example—retrieval can be one agent tool—but ingestion,
chunking, embeddings, vector search and grounded generation belong in the
separate RAG learning site.

→ Begin with **[Tool Calling](12-tool-calling/README.md)**.
