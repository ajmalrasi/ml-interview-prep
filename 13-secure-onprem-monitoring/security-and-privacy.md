# Security, Access Control & PII / Face Privacy

**TL;DR:** A CCTV system handles some of the most sensitive data there is — people's
faces and their movements — so in a secure government deployment you have to be able to
answer four questions crisply: is it encrypted, who can see what, who did what, and how
little personal data can you get away with keeping? The first three are standard
security hygiene applied carefully. The fourth is the CCTV-specific one, and it's where
thoughtful judgement shows.

## Encryption, at both ends of the pipe

Think of the data in two states and cover each. **In transit**, the camera-to-edge RTSP
stream should run over TLS, or over a physically isolated VLAN if the cameras are too
old to do TLS, and every internal service call should be mutually authenticated — no
plaintext video crossing a shared network. **At rest**, the edge boxes and the server
run full-disk encryption, the clip store and the events database are encrypted, and the
keys live in a local key manager or a TPM rather than sitting on the very disk they're
meant to protect. Camera and database credentials belong in that secrets store too,
rotated, and never committed into an image or a config file.

## Who can see what, and who did what

Two ideas carry most of the weight. **Least privilege** means access is scoped by role
— operators see live video and alerts, supervisors can export, admins configure — and
nobody gets blanket access to all raw footage by default. And **auditability** means
every consequential action — every time footage is viewed or exported, every config
change, every model update — is logged with the user and timestamp in an append-only,
tamper-evident form. In a government context that audit trail is frequently a hard
contractual requirement, not a nice-to-have. Underneath both, you segment the network so
the cameras, the inference tier, and the operator UI sit on separate segments with no
lateral path from a compromised camera through to the database.

## The CCTV-specific part: faces and PII

Here's the insight that reframes the whole privacy question: for crowd and queue
analytics, you almost never actually *need* anyone's identity — so the best privacy
control is simply not to collect it. Let that principle drive the design.

**Minimise the data.** To count people, time queues, and measure flow, you need counts,
tracks, and timestamps — not faces, not names. So you store metadata, not raw crops,
wherever the use case allows; this one decision removes most of your privacy exposure
before you've added a single safeguard.

**Anonymise what remains.** Where footage is stored or displayed, blur or pixelate faces
(and licence plates) unless there's an explicit, authorised need to see them. The strong
version does this at the edge — detect, then blur *before* anything is written — so an
unblurred frame never persists on disk at all.

**Understand that biometrics are a different animal.** Face *recognition* — working out
*who* someone is — is legally and ethically far heavier than face *detection* (noticing
there's a face) or person detection (noticing there's a person), and the good news is
that crowd analytics almost always needs only the lighter two. So if recognition isn't
explicitly in scope and authorised, the mature answer is that you wouldn't collect
biometric templates at all. It's worth saying plainly, because it signals you understand
the stakes rather than reaching for the most powerful tool available.

**Know where ReID sits in this.** The tracking and re-identification embeddings from
section 14 re-associate the *same unnamed person* across frames and cameras so you can
count them — they are emphatically not a name or an identity. But they're still derived
from a real person, so you treat them as sensitive and put a retention limit on them
like everything else.

**Put a clock on everything.** Footage and any personal data expire on a policy — thirty
or ninety days — and are used only for the stated purpose. You auto-delete; you don't
hoard, because hoarded data is pure liability.

## Don't forget the model supply chain

The models themselves are an attack surface. Verify a signature or checksum on every
model artifact before loading it, so a tampered engine can't slip in. Use vetted base
images, scan them for known vulnerabilities before import, and don't install anything
from the public internet at runtime. And validate inputs — a malformed RTSP stream
shouldn't be able to crash or exploit your decoder — which ties back to the
fault-tolerance work in section 04.

## How to say all this in an interview

Frame privacy as designed-in rather than bolted-on: *"For crowd and queue analytics I
default to storing counts and anonymised tracks, I blur faces before anything is
written, I keep raw video at the edge, and I put a retention clock on everything. If
face recognition isn't explicitly required and authorised, I don't collect biometric
data at all."* That answer does more to signal senior judgement in a sensitive domain
than any list of encryption acronyms.

**Self-check.** For queue-time analytics, do you need to store faces? *(no — counts,
tracks, and timestamps are enough, so minimise.)* Why does the face-detection versus
face-recognition distinction matter here? *(recognition identifies a specific person,
which means heavy legal and ethical weight and biometric data; detection merely
localises a face.)* Where do you blur faces, and why there? *(at the edge, before
anything is written, so an unredacted frame never reaches disk.)* And what must the
audit log capture in a government deployment? *(every view, export, config change and
model update, with user and time, in a tamper-evident form.)*
