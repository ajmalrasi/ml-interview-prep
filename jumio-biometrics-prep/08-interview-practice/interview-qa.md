# Rapid-Fire Interview Q&A

**TL;DR:** Say each answer aloud before opening it. Strong answers define the concept,
name the decision it changes, and acknowledge the main failure mode.

**Q: Face verification versus identification?**
Verification compares a probe with one claimed identity (1:1). Identification searches
a gallery (1:N); open-set identification must also reject people not enrolled. Gallery
size adds impostor opportunities, so 1:1 FMR cannot be copied directly into 1:N risk.

**Q: Why embeddings instead of a binary same/different classifier?**
An encoder creates reusable templates for unseen identities, supports fast comparison and
ANN search, and separates representation learning from operating policy. The threshold
still needs task-specific calibration and evaluation.

**Q: ArcFace in one sentence?**
It trains normalized face features with an additive angular margin on the target class,
creating compact identity clusters and explicit angular separation that matches cosine
scoring at inference.

**Q: What is the most dangerous split error?**
The same identity—or near-duplicate captures of that identity—in train and test. Split by
resolved subject before pair generation and audit cross-source duplicates.

**Q: FMR and FNMR?**
FMR is the fraction of impostor comparisons accepted; FNMR is the fraction of genuine
comparisons rejected at a stated threshold. Lowering the threshold usually lowers FNMR
and raises FMR.

**Q: Why TAR at fixed FMR?**
Identity products operate at a security-defined false-match budget, often in the extreme
tail. TAR@FMR tells how many genuine users succeed while honoring that budget; EER may
rank models differently and is rarely the deployed point.

**Q: How many impostor pairs are enough for FMR 10⁻⁶?**
Far more than a million are needed for a precise tail estimate, and trials must not be
treated as independent when they reuse a small subject pool. Report confidence bounds
and identity/session sampling structure; zero observations is not zero risk.

**Q: How do you measure fairness?**
At the same frozen product threshold, report acquisition, PAD, FMR/FNMR, completion and
uncertainty for governed groups and intersections. Bootstrap by identity and diagnose
which pipeline stage creates the disparity.

**Q: Would you use a threshold per demographic group?**
Not as a hidden default. It requires sensitive-group knowledge, moves harm between error
types and raises policy/legal issues. First fix data, capture, quality and model causes;
any group-aware policy needs explicit review and transparent evaluation.

**Q: Passive versus active liveness?**
Passive PAD reduces friction but must generalize to unseen attacks/devices. Active
challenge or illumination provides stronger freshness/replay evidence but adds UX and
accessibility cost. Use risk-based step-up.

**Q: APCER and BPCER?**
APCER measures attack presentations misclassified as bona fide; BPCER measures bona fide
presentations rejected as attacks. Report per attack instrument/device and worst-case,
not only a pooled average.

**Q: Why is injection different from presentation attack?**
A presentation attack shows an artifact to a real sensor. Injection bypasses or tampers
with the capture path and feeds digital media directly. PAD alone is insufficient;
session binding, device integrity and anti-replay controls are needed.

**Q: How do you validate synthetic faces?**
Tie them to a measured gap, audit identity leakage and generator bias, run real-only
versus real+synthetic ablations, and require improvement on untouched real identities at
the production operating point and subgroup slices.

**Q: DDP versus FSDP?**
DDP replicates the model and averages gradients; use it when the model/classifier fits
per GPU. FSDP shards parameters, gradients and optimizer state when memory is the limit.
Measure dataloader and all-reduce bottlenecks before adding nodes.

**Q: What do you validate after INT8 quantization?**
Not only top-line accuracy: embedding agreement, genuine/impostor tails, TAR at target
FMR, subgroup and quality slices, PAD/detector metrics, plus target p99 and memory.

**Q: FAISS versus Milvus?**
FAISS is a high-performance vector-index library suitable in-process or as a building
block. Milvus is a distributed vector database/service with persistence, sharding and
operations. Choose from gallery size, updates, availability, filtering and team ownership.

**Q: How do you migrate encoder versions?**
Embeddings from different spaces are incompatible. Re-enroll, re-embed lawfully retained
captures, or dual-read old/new indexes during migration. Version templates and index with
the encoder and make deletion work across both.

**Q: What do you monitor without immediate labels?**
Acquisition/quality reasons, retry and completion, score distributions, threshold margin,
manual review, device/SDK slices, p99, errors and ANN canaries. Join delayed fraud/appeal
labels later through a governed evaluation pipeline.

**Q: First response to subgroup FNMR tripling?**
Freeze rollout, confirm sample size/labels/threshold, slice acquisition through matching,
compare quality and device conditions, reproduce the failure, then target the responsible
stage. Report security and completion effects of the mitigation.

**Q: What makes this a Staff-level answer?**
It connects product risk, protocol, data, model, platform and team process; assigns
owners and gates; makes uncertainty visible; and leaves a rollback and learning loop
rather than only proposing a new network.
