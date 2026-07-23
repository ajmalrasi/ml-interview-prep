# 1 · Face Pipeline

**TL;DR:** Recognition quality is bounded by capture quality. A strong encoder cannot
recover an absent, badly blurred or severely misaligned face, so production systems use
an explicit capture gate before embedding.

## The pipeline

1. **Detect** every face and decide whether the expected number is present.
2. **Landmark** stable points such as eyes, nose and mouth corners.
3. **Align** the crop to a canonical coordinate frame with a similarity transform.
4. **Assess quality** for pose, blur, resolution, illumination, occlusion and artifacts.
5. **Check liveness/security** before accepting biometric evidence.
6. **Normalize** color, size and pixel range exactly as the encoder expects.
7. **Embed** only accepted captures, while logging non-sensitive reason codes.

Quality is not one universal aesthetic score. It is **utility for a target matcher**:
would this sample produce a reliable comparison under the deployed encoder and operating
point?

## Failure taxonomy

| Layer | Example failure | Correct response |
|---|---|---|
| Capture | motion blur, glare, tiny face | recapture with actionable guidance |
| Detection | missed profile, multiple faces | reject or route; never silently choose |
| Alignment | unstable landmark under occlusion | lower quality or use robust alignment |
| Encoding | wrong normalization or model version | contract test and fail closed |
| Policy | low score near threshold | risk-based fallback or manual review |

## Interview instinct

Do not answer “use a better backbone” first. Start with a slice analysis:

- Which devices, document types, regions and capture conditions regressed?
- Is the failure in capture, detection, quality, liveness or matching?
- Did preprocessing change between training, offline evaluation and serving?
- Are both faces equally usable, or is one side of the pair driving the error?

→ Next: **[Detection, Alignment & Quality](detection-alignment-quality.md)**.
