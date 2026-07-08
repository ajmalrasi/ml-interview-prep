# Security, Access & PII/Face Privacy

**TL;DR:** Answer 4 questions crisply: encrypted? who sees what? who did what? how little PII can you keep? Last one is CCTV-specific = where judgement shows.

## Encryption
- **In transit** — RTSP over TLS (or isolated VLAN if cameras can't), mTLS internally. No plaintext streams.
- **At rest** — full-disk (LUKS) on edge+server, encrypt clips + events DB. Keys in KMS/TPM, not on the disk.
- **Creds** — secrets store, rotated; never in images/config.

## Access & audit
- **Least privilege / RBAC** — operators: live+alerts; supervisors: export; admins: config. No blanket footage access.
- **Auth** — SSO/LDAP, MFA for admin.
- **Audit log** — every view/export/config/model change, user+time, **tamper-evident** (append-only). Often a hard gov requirement.
- **Segmentation** — camera VLAN / inference / UI separate; no lateral path.

## PII & faces (the CV-specific part)
**Key insight: crowd/queue analytics rarely needs identity — so don't collect it.**
- **Minimise** — need counts+tracks+timestamps, NOT faces/names. Store metadata, not crops. Biggest lever.
- **Anonymise** — blur faces/plates in stored/displayed footage; blur **at edge before write** so unblurred frame never persists.
- **Biometrics special** — face **recognition** (who) ≫ heavier than face **detection** (a face) or person detection. Crowd analytics needs only the light two. If recognition not in scope → **don't collect biometric templates.**
- **ReID ≠ identity** — re-associates an *unnamed* person for counting; still sensitive, scope retention.
- **Retention** — footage/PII expire on policy (30/90d), purpose-limited, auto-delete.

## Model supply chain
- **Signed artifacts** (verify checksum before load) · vetted base images, scan CVEs, no runtime installs · **validate inputs** (malformed RTSP shouldn't crash decoder, §04).

**Say this:** *"For crowd/queue I default to counts + anonymised tracks, blur faces before write, keep raw video at edge, retention clock on everything. If face recognition isn't required + authorised, I don't collect biometric data at all."*

## Q&A
- Store faces for queue analytics? → no; counts+tracks+timestamps.
- Detection vs recognition matter? → recognition = identify a person = biometric + heavy legal.
- Blur where? → at edge, before persistence.
- Audit log captures? → every view/export/config/model change, user+time, tamper-evident.
