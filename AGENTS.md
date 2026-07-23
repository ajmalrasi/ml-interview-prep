# AGENTS.md — `ml-interview-prep`

This repository is the source for the interview-prep websites deployed on the
Raspberry Pi.

## Canonical locations

- Local source: `/Users/ajmalrasi/ml_test/ml-interview-prep`
- Pi deployment/checkout: `/home/ajmalrasi/ml-interview-prep`
- Never deploy these track websites under `/opt/mlprep`; that is a separate legacy
  quiz/flashcard app.

## Tracks and ports

| Track | Port |
|---|---:|
| `computer-vision-prep` | 9000 |
| `rag-llm-prep` | 9001 |
| `ml-engineer-prep` | 9002 |
| `automotive-soc-prep` | 9003 |
| `python-interview-prep` | 9004 |
| `jumio-biometrics-prep` | 9005 |

Each track contains Markdown source, `build.js`, `_app.js`, `_site.css`,
`_diagrams.js`, and generated `index.html`. Build on the Mac with
`node build.js`. The Pi serves each track through `prep_server.py`, which also
provides `/api/progress`.

## Commit and push

When the user asks to commit/push, use plain Git. Do not require `gh` unless the
user explicitly requests a pull request.

```bash
git add -A
git commit -m "<terse description>"
git push github-ssh main
```

The expected target is normally direct `main`. Verify the working tree and
remote SHA afterward.

## Safe Pi synchronization

The Pi checkout may contain uncommitted deployed work.

1. Run `git status -sb` and fetch `origin/main`.
2. Compare the Pi worktree with the remote before pulling.
3. Preserve Pi-only work on a recovery branch before changing its checkout.
4. Do not resurrect files superseded by newer committed content.
5. Rebuild all affected `index.html` files on the Mac.
6. Deploy the exact built artifacts and restart only affected services.
7. Finish with clean Mac and Pi checkouts at the same GitHub SHA.

Never use `git reset --hard` or overwrite a dirty Pi checkout without first
preserving and reviewing its unique changes.
