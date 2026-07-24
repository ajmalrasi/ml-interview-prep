# Interview Prep

Seven self-contained interview-prep tracks. Each is a static site — edit the
`.md` files, run `node build.js`, and open the generated `index.html`.

## Tracks

- **[computer-vision-prep/](computer-vision-prep/)** — Computer Vision / video
  intelligence. CCTV-based live video: GStreamer/DeepStream, low-latency inference
  on NVIDIA edge, computer vision, crowd/queue analytics, event & anomaly detection,
  secure on-prem deployment.

- **[ml-engineer-prep/](ml-engineer-prep/)** — AI / ML Engineer. The full ML
  lifecycle: data pipelines, model development, experimentation, MLOps & serving,
  monitoring, cloud infra, optimization, generative AI, and ML system design.

- **[rag-llm-prep/](rag-llm-prep/)** — RAG & LLM systems. The retrieval pipeline
  (chunking, embeddings, FAISS/Qdrant, hybrid retrieval, reranking) plus LLM
  serving internals, fine-tuning, security, evaluation and production monitoring.

- **[agentic-ai-prep/](agentic-ai-prep/)** — Agentic AI from first principles:
  tool calling, MCP, single- and multi-agent architectures, supervisor patterns,
  LangGraph state, nodes, edges, branches and bounded control loops.

- **[automotive-soc-prep/](automotive-soc-prep/)** — AI Application Engineer
  (Automotive SoC). Deploying CV/BEV models on embedded NPU/DSP/CNNIP: the ONNX
  toolchain (graph surgery, QDQ, partitioning), quantization for embedded
  (PTQ/QAT, accuracy mitigation), detection/segmentation/BEV models, SoC
  architecture (memory/DMA/IPMMU, multi-core scheduling), and Linux/QNX runtime,
  SIL/HIL validation, ISO 26262 functional safety.

- **[jumio-biometrics-prep/](jumio-biometrics-prep/)** — Staff / Senior ML
  Engineer for face recognition and biometrics. Face capture quality, embeddings
  and angular-margin losses, verification/identification metrics, fairness,
  liveness/PAD and deepfake defense, balanced/synthetic data, AWS production
  architecture, TensorRT/ONNX, ANN search, privacy and staff-level system design.

- **[python-interview-prep/](python-interview-prep/)** — Python fundamentals,
  object model, iterators, concurrency, production patterns, coding drills and
  mock-interview practice.

## Build a track

```
cd ml-engineer-prep        # or computer-vision-prep
node build.js              # regenerates index.html
open index.html            # works offline by double-click
```

See each track's own `README.md` for the study order and its `RUN*.md` for serving/deploy.
