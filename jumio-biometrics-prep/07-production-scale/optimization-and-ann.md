# TensorRT, ONNX, Quantization & ANN Search

**TL;DR:** Optimize against the real latency/security operating point. A faster encoder
that changes the low-FMR tail or subgroup errors is not equivalent.

## Optimization ladder

1. Profile decode, preprocessing, transfer, inference and postprocessing separately.
2. Export a numerically checked ONNX graph with fixed preprocessing contract.
3. Apply FP16/BF16 and TensorRT/ONNX Runtime graph/kernel optimization.
4. Tune batching within p99 deadline.
5. Try INT8 PTQ with representative calibration.
6. Use QAT or mixed precision if sensitive layers damage biometric metrics.
7. Distill to a smaller encoder when architecture reduction is required.

Validate:

- embedding cosine agreement versus reference;
- genuine/impostor score distributions;
- TAR at target FMR, not only average cosine error;
- subgroup and quality slices;
- detector/PAD metrics;
- target-hardware p99 and memory.

## ANN for 1:N

| Index | Strength | Trade-off |
|---|---|---|
| Flat exact | exact and simple | O(N) compute and memory bandwidth |
| IVF | probes selected clusters | train/tune centroids; recall depends on probes |
| HNSW | strong latency/recall | memory-heavy graph and update complexity |
| PQ / IVF-PQ | compresses large galleries | quantization lowers retrieval accuracy |

FAISS is an in-process library; Milvus is a distributed vector database/service. For a
small gallery, exact search may be safer and fast enough. At scale, benchmark recall@k,
p99, memory, build/update time and failure recovery.

## Two-stage identification

1. ANN retrieves top-k candidates.
2. Exact cosine rerank uses original vectors.
3. Biometric threshold/policy decides match or reject.

Measure retrieval miss separately from matcher rejection. Encrypt templates and indexes,
control deletion, and version the index with the encoder. An encoder migration requires a
new index or compatible dual-read plan.

## Gallery-scale risk

Approximate retrieval recall is not the only concern. More enrolled identities create
more impostor opportunities. Re-evaluate FPIR and threshold at realistic gallery size and
traffic, including repeated queries.

Reuse the deeper [TensorRT material](http://192.168.3.20:9002/#12-nvidia-model-optimization/tensorrt-internals.md)
and [FAISS benchmarks](http://192.168.3.20:9001/#05-faiss/benchmark-results.md).
