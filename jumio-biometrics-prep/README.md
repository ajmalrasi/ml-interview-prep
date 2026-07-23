# Jumio Staff / Senior ML Engineer: Learning Path

This pack is for the **face recognition and biometrics** role described in the Jumio
job description. It focuses on what is special about this interview rather than
repeating generic ML material you already have.

The role in one line: **build a trustworthy face system from capture to decision** —
detect and align the face, reject poor captures, produce a discriminative embedding,
verify or search it at the required operating point, measure fairness, resist spoofing,
and deploy the complete pipeline with production latency and reliability on AWS.

```rawhtml
<div class="diagram">
  <div class="flow">
    <span class="node data">selfie + ID portrait<span class="nsub">device · document · consent</span></span>
    <span class="arw"></span>
    <span class="node">capture gate<span class="nsub">detect · align · quality · liveness</span></span>
    <span class="arw"></span>
    <span class="node">face encoder<span class="nsub">normalized embedding</span></span>
    <span class="arw"></span>
    <span class="node">match / search<span class="nsub">1:1 threshold · 1:N ANN</span></span>
    <span class="arw"></span>
    <span class="node out">risk decision<span class="nsub">fairness · policy · monitoring</span></span>
  </div>
</div>
```

## Why this is not another generic ML page

The existing ML and CV tracks cover PyTorch, distributed training, MLOps, AWS,
TensorRT, ONNX and general image models. The high-risk gaps for this role are the
**biometric decision layer**:

| JD theme | Interview-ready meaning |
|---|---|
| Face recognition | Detection and alignment, embeddings, angular-margin losses, verification and open-set identification |
| Rigorous benchmarking | Subject-disjoint protocols, genuine/impostor trials, FMR/FNMR, TAR@FAR, EER, confidence intervals |
| Fairness | Per-group error rates at the same operating point, intersections, uncertainty, root-cause analysis and mitigation |
| Data curation | Identity-safe deduplication, balanced coverage of demographics and operating conditions, lineage and consent |
| Synthetic data | Fill measured coverage gaps without identity leakage, memorization or unrealistic shortcuts |
| Production ownership | Reproducible Airflow pipelines, multi-GPU training, registry, optimized serving, monitoring and rollback |
| Security and privacy | Liveness/PAD, deepfake and injection defense, template protection, retention and auditability |

## The product context to understand

Jumio’s public product flow combines an ID document, a selfie, **1:1 face matching**
and **liveness** to make a risk-based decision. Its current innovation material calls
out presentation attacks, synthetic/morphed faces, replay and digital injection. That
makes liveness and adversarial thinking central product context, even though the JD
describes them only indirectly.

- [Jumio Selfie Verification](https://www.jumio.com/products/selfie-verification/)
- [Jumio Biometrics](https://www.jumio.com/biometrics/)
- [Jumio Innovation and attack categories](https://www.jumio.com/innovation/)
- [Jumio Authentication](https://www.jumio.com/products/authentication/)

## Study order

| Priority | Sections | Why |
|---|---|---|
| **Must be fluent** | `01`–`05` | These distinguish a biometric engineer from a general CV/ML engineer |
| **Must design** | `06`, `07` | Staff-level ownership means data-to-production architecture and trade-offs |
| **Must rehearse aloud** | `08` | Convert knowledge into concise decisions, failure analysis and leadership signals |

### If you have two days

**Day 1:** Face pipeline → recognition → biometric metrics → fairness. End by explaining
why “99.8% accuracy” is an unusable biometric claim without a protocol and operating point.

**Day 2:** Liveness/security → data/training → AWS production design. Finish with the
worked system-design answer and rapid-fire Q&A.

### If you have four hours

1. `02-face-recognition/verification-identification.md`
2. `03-biometric-evaluation/metrics-thresholds.md`
3. `04-fairness/measurement.md`
4. `05-liveness-security/README.md`
5. `07-production-scale/aws-architecture.md`
6. `08-interview-practice/cheat-sheet.md`

## The five answers you should be able to give

1. **Design:** “Design a global selfie-to-ID face-verification service with a p99
   latency SLO, fraud-loss target and fairness guardrails.”
2. **Metrics:** “Why report TAR at a fixed low FMR instead of accuracy or EER alone?”
3. **Fairness:** “One subgroup has 3× the FNMR. How do you verify, diagnose and mitigate
   it without hiding the trade-off?”
4. **Security:** “How do you defend against printed photos, replay, deepfakes and
   injected camera streams?”
5. **Production:** “How does a data snapshot become a reproducible multi-GPU training
   run, a signed TensorRT artifact and a safely rolled-out AWS service?”

## Staff-level answer shape

Use this order for any open question:

> **requirements → threat model → data/protocol → model → operating point → fairness →
> serving → monitoring/rollback → privacy → trade-offs**

Name tools only after the requirement. “SageMaker + EKS” is not an architecture until
you explain the data contract, evaluation gates, latency target, failure behavior and
decision ownership.

→ Start with **[Face Pipeline](01-face-pipeline/README.md)**.
