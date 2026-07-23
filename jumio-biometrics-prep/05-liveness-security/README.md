# 5 · Liveness, PAD & Biometric Security

**TL;DR:** Face matching answers “same identity?” Liveness/PAD answers “is this a bona
fide live presentation through the trusted capture path?” A secure product needs both,
plus protection against digital injection.

## Threat layers

| Layer | Threat examples | Defense family |
|---|---|---|
| Presentation | print, screen replay, mask | passive/active presentation attack detection |
| Media | deepfake, face swap, morph, synthetic identity | artifact/consistency models, provenance and risk signals |
| Capture channel | virtual camera, API replay, frame injection | device integrity, signed session/challenge, anti-replay |
| Account/workflow | stolen ID, mule, repeated attempts | graph/device/velocity signals and manual review |
| Model/service | extraction, poisoning, adversarial inputs | access control, validation, monitoring and signed artifacts |

The strongest design is layered. A high face-match score does not prove liveness, and a
live person can still present a stolen identity.

## Passive versus active

- **Passive PAD:** analyzes ordinary captured images/video. Lower friction, but must
  generalize to new attacks and devices.
- **Active challenge:** asks for motion, pose, speech or uses randomized illumination.
  Adds evidence and replay resistance but may increase friction and accessibility issues.

Jumio publicly describes active illumination and defenses against presentation,
synthetic/morphing, replay and injection attacks. Understand these categories without
claiming knowledge of proprietary implementation.

## PAD metrics

ISO/IEC 30107 terminology commonly includes:

- **APCER:** proportion of attack presentations incorrectly accepted as bona fide.
- **BPCER:** proportion of bona fide presentations incorrectly classified as attacks.

Report by attack instrument, device and subgroup. Averages can hide complete failure on a
new mask, display or injection method.

→ Next: **[Presentation Attack Detection](presentation-attack-detection.md)**.
