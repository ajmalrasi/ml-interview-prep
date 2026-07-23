# Deepfakes, Morphs, Replay & Injection

**TL;DR:** Image classifiers alone cannot secure an untrusted capture channel. Bind
fresh media to a server-issued session and combine media forensics with device,
transaction and graph signals.

## Distinguish the threats

- **Deepfake/face swap:** generated or manipulated media impersonates a target.
- **Morph:** one portrait blends multiple identities and may match more than one person.
- **Replay:** a previously valid image/video is reused.
- **Injection:** attacker bypasses the physical camera and feeds crafted frames or
  metadata directly into the pipeline.
- **Synthetic identity:** generated face is paired with fabricated or mixed identity data.

## Layered design

1. Server issues a short-lived nonce/session and optional randomized challenge.
2. Trusted SDK binds frames, timing and device evidence to the session.
3. Transport uses authenticated encryption; server rejects duplicate/expired sessions.
4. Capture service validates sequence, timestamps, frame continuity and expected camera
   path.
5. PAD/media models evaluate spatial and temporal evidence.
6. Face/document/device/velocity signals feed a risk decision.
7. High-risk or uncertain cases step up rather than force a binary model answer.

No individual signal is infallible. The goal is to increase attacker cost, reduce reusable
attacks and make anomalies observable.

## Monitoring

Watch for:

- repeated frames or hashes across accounts;
- sudden device/SDK-version attack clusters;
- score-distribution shifts by channel;
- unusually high retry or challenge-failure rates;
- new media artifacts with high face-match scores;
- coordinated identities/devices in the broader risk graph.

## Model update discipline

Security models face an adaptive distribution. Maintain a controlled attack corpus,
time-based holdouts, red-team evaluation and rapid rollback. Do not train directly on
unreviewed production attacks; they can contain privacy-sensitive data, incorrect labels
or deliberate poisoning.

> “I separate presentation attacks from digital injection. PAD protects the sensor-facing
> problem; session binding, device integrity and anti-replay protect the capture channel.
> Both feed a risk engine with step-up and monitoring.”
