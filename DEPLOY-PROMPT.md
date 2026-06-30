# Deploy prompt for Claude Code (run on the Raspberry Pi)

Paste the block below into Claude Code running on your Pi. It deploys the study
website (and optionally the Jupyter playground) and makes it auto-start on boot.

---

You are operating on my Raspberry Pi (Debian/Raspberry Pi OS, user `ajmalrasi`).
Deploy my interview-prep website from a Git repo, serve it on the LAN, and make it
start automatically on boot. Be **idempotent** — this same prompt should also work
later to pull updates and restart.

**Facts**
- Repo: `https://github.com/ajmalrasi/koireader-interview-prep`
  (if it's private, use the SSH remote `git@github.com:ajmalrasi/koireader-interview-prep.git`)
- Target directory: `/home/ajmalrasi/koireader-interview-prep`
- Static site port: `9000`
- Jupyter port (optional): `8888`
- The site is a single self-contained `index.html` + markdown — **no build step is
  needed to serve it**. Just serve the directory over HTTP.

**Do this**

1. If the target directory doesn't exist, `git clone` the repo into it. Otherwise
   `cd` in and `git pull --ff-only` to get the latest. Show me the resulting
   `git log -1 --oneline`.

2. Create or refresh a systemd service `koi-prep` that serves the repo on port 9000:
   - `ExecStart=/usr/bin/python3 -m http.server 9000`
   - `WorkingDirectory=/home/ajmalrasi/koireader-interview-prep`
   - `User=ajmalrasi`, `Restart=always`, `WantedBy=multi-user.target`
   - Show me the unit file before writing it. Then
     `sudo systemctl daemon-reload && sudo systemctl enable --now koi-prep`.
     If it already exists, just `sudo systemctl restart koi-prep` after the pull.

3. Verify and report:
   - `systemctl is-active koi-prep` (must be `active`)
   - `curl -fsS http://localhost:9000/ | head -c 200` (must return HTML)
   - print the LAN URL using `hostname -I`, e.g. `http://<pi-ip>:9000`

4. **Ask me before doing this step.** Set up the live Jupyter playground as a
   second service `koi-jupyter`:
   - Ensure `python3-venv` is installed (`sudo apt-get install -y python3-venv`).
   - In the repo dir: create `.venv`, `pip install -r requirements.txt`, then
     `python build_notebooks.py` to (re)generate the notebooks.
   - Service `ExecStart` should launch Jupyter **directly** (do NOT call `run.sh`
     in the service — `run.sh` also starts its own http.server on 9000 and would
     clash with `koi-prep`):
     `/home/ajmalrasi/koireader-interview-prep/.venv/bin/jupyter lab --no-browser --ip=0.0.0.0 --port=8888 --notebook-dir=/home/ajmalrasi/koireader-interview-prep/notebooks`
   - `WorkingDirectory` = repo dir, `User=ajmalrasi`, `Restart=always`.
   - After starting, get the token URL from `journalctl -u koi-jupyter -n 30` and
     print `http://<pi-ip>:8888/lab?token=...`.
   - Warn me that this exposes Jupyter on my LAN (token-protected). Don't expose it
     to the public internet.

**Constraints**
- Idempotent: safe to re-run any time to deploy updates.
- Use `sudo` only for `apt` installs and writing/enabling systemd unit files.
- Show me each systemd unit file before enabling it.
- Do not open firewall ports to the public internet; LAN only.
- At the end, print a summary: deployed commit, service statuses, and all URLs.

**To update later** (tell me if you want this as a one-liner): `cd` into the repo,
`git pull`, `sudo systemctl restart koi-prep` (and `koi-jupyter` if set up).

---

## Notes for you (the human)

- For local testing on the Pi itself: `python3 -m http.server 9000` in the repo
  dir, then open `http://localhost:9000`.
- If the repo is private, Claude Code will need a deploy key / SSH access on the Pi
  (`ssh -T git@github.com` should succeed first).
- The website needs **no Python** to run — only `koi-jupyter` (step 4) does.
