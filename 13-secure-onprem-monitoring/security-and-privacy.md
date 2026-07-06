# Security, Access Control & PII/Face Privacy

**TL;DR:** A CCTV system processes some of the most sensitive data there is —
people's faces and movements. In a secure government deployment you must be able to
say, concretely: it's **encrypted** (rest + transit), **least-privilege**
(who can see what), **auditable** (who did what), and **privacy-preserving** (PII
minimized, faces protected). These are checklist items an interviewer can probe.

## Encryption

- **In transit** — camera→edge RTSP over TLS (or an isolated VLAN if the cameras
  can't do TLS), and all internal service traffic over mTLS. No plaintext streams
  on a shared network.
- **At rest** — full-disk encryption (LUKS) on edge and server; encrypt the clip
  store and the events DB. Keys in a local KMS/Vault or TPM, not on the disk they
  protect.
- **Credentials** — camera and DB creds in a secrets store, rotated; never in
  images, code, or config committed anywhere.

## Access control & audit

- **RBAC / least privilege** — operators see live + alerts; supervisors can export;
  admins configure. Nobody gets blanket access to all raw footage by default.
- **Authentication** — SSO/LDAP against the org directory, MFA for admin.
- **Audit log** — every footage view, export, config change, and model update is
  logged with user + timestamp, tamper-evident (append-only / hash-chained). In a
  government context this audit trail is often a hard requirement.
- **Segmentation** — the camera VLAN, the inference tier, and the operator UI are
  separate network segments; no lateral path from a compromised camera to the DB.

## PII & face privacy (the CV-specific part)

You rarely *need* to store identities to deliver crowd/queue analytics — so don't.

- **Data minimization** — for counting/queue/flow you need **counts, tracks,
  timestamps**, not faces or identities. Store metadata, not raw crops, wherever
  the use-case allows. This is the single biggest privacy lever.
- **Anonymization / redaction** — blur or pixelate faces (and license plates) in
  any stored or displayed footage unless there's an explicit, authorized need.
  Detect → blur before write. Some deployments blur at the edge so an unblurred
  frame never persists.
- **Edge-only raw video** — process on the Jetson and never persist raw frames
  centrally; only events + optional redacted keyframes leave the edge.
- **Biometrics are special** — face **recognition** (identifying *who*) is legally
  and ethically far heavier than face **detection** (there's *a* face) or person
  detection (there's *a* person). Most crowd analytics needs only the latter two.
  If recognition isn't in scope, say clearly you wouldn't collect biometric
  templates — a mature, responsible answer.
- **ReID ≠ identity** — tracking/ReID embeddings re-associate the *same unnamed
  person* across frames/cameras for counting; they aren't a name. Still treat the
  embeddings as sensitive (they're derived from a person) and scope their retention.
- **Retention & purpose limitation** — footage and any personal data expire on a
  policy (e.g. 30/90 days) and are used only for the stated purpose. Auto-delete;
  don't hoard.

## Model & supply-chain security

- **Signed model artifacts** — verify checksum/signature before loading (prevents a
  tampered engine).
- **Vetted base images**, no runtime installs from the public internet, scan images
  for CVEs before import.
- **Input validation** — a malformed RTSP stream shouldn't crash or exploit the
  decoder; sandbox/limit the decode path (ties to §04 fault tolerance).

## How to talk about it

Frame privacy as **built-in, not bolted-on**: "For crowd and queue analytics I
default to storing counts and anonymized tracks, blur faces before anything is
written, keep raw video at the edge, and put a retention clock on everything. If
face recognition isn't explicitly required and authorized, I don't collect
biometric data at all." That answer signals senior judgment for a sensitive domain.

## Quick self-check

- For queue-time analytics, do you need to store faces? *(no — counts, tracks,
  timestamps; minimize)*
- Face detection vs face recognition — why does the distinction matter here?
  *(recognition = identifying a person = heavy legal/ethical + biometric data;
  detection just localizes)*
- Where do you blur faces and why there? *(at the edge, before persistence, so an
  unredacted frame never hits disk)*
- What must the audit log capture in a government deployment? *(every view, export,
  config + model change, with user/time, tamper-evident)*
