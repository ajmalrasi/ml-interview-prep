# DEPLOY — the only file Claude Code needs

**This single file deploys BOTH the website and the live Jupyter playground on the
Raspberry Pi.** Paste the whole block below into Claude Code running on the Pi.
Ignore every other `.md` in this repo for deployment — they are human study notes,
not instructions. This prompt is idempotent: run it again any time to ship updates.

---

You are operating on my Raspberry Pi (Raspberry Pi OS / Debian, user `ajmalrasi`).
Deploy my interview-prep project so that **two services run on boot**:

1. **`koi-prep`** — the static study website on port **9000**.
2. **`koi-jupyter`** — JupyterLab (the live notebooks) on port **8888**, with the
   fixed token `koireader` (the website's "Open live notebooks" button links to it).

Do all of the following, in order, and stop to show me each systemd unit file
before you enable it.

### Facts
- Repo: `https://github.com/ajmalrasi/koireader-interview-prep`
  (if private, use SSH: `git@github.com:ajmalrasi/koireader-interview-prep.git`)
- Directory: `/home/ajmalrasi/koireader-interview-prep`
- User: `ajmalrasi`
- Website port: `9000` · Jupyter port: `8888` · Jupyter token: `koireader`
- The website is a self-contained `index.html` + markdown — **no build needed to
  serve it**. Jupyter needs a Python venv.

### Step 1 — Get the code
- If the directory doesn't exist, `git clone` the repo into it. Otherwise `cd` in
  and `git pull --ff-only`.
- Print `git log -1 --oneline`.

### Step 2 — Python venv + dependencies (for Jupyter)
```bash
cd /home/ajmalrasi/koireader-interview-prep
sudo apt-get update && sudo apt-get install -y python3-venv
[ -d .venv ] || python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python build_notebooks.py     # (re)generate notebooks from the .md
```

### Step 3 — Website service (`koi-prep`, port 9000)
Show me this unit, then write it to `/etc/systemd/system/koi-prep.service`:
```ini
[Unit]
Description=KoiReader study website
After=network.target

[Service]
WorkingDirectory=/home/ajmalrasi/koireader-interview-prep
ExecStart=/usr/bin/python3 -m http.server 9000
Restart=always
User=ajmalrasi

[Install]
WantedBy=multi-user.target
```

### Step 4 — Jupyter service (`koi-jupyter`, port 8888)
Launch Jupyter **directly** (do NOT run `run.sh` from the service — `run.sh` also
starts its own web server on 9000 and would clash). Show me this unit, then write
it to `/etc/systemd/system/koi-jupyter.service`:
```ini
[Unit]
Description=KoiReader live Jupyter notebooks
After=network.target

[Service]
WorkingDirectory=/home/ajmalrasi/koireader-interview-prep
ExecStart=/home/ajmalrasi/koireader-interview-prep/.venv/bin/jupyter lab \
  --no-browser --ip=0.0.0.0 --port=8888 \
  --IdentityProvider.token=koireader \
  --ServerApp.root_dir=/home/ajmalrasi/koireader-interview-prep/notebooks
Restart=always
User=ajmalrasi

[Install]
WantedBy=multi-user.target
```

### Step 5 — Enable + start both
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now koi-prep koi-jupyter
# if they already existed, restart to pick up the new code:
sudo systemctl restart koi-prep koi-jupyter
```

### Step 6 — Verify and report
- `systemctl is-active koi-prep koi-jupyter` (both must be `active`)
- `curl -fsS http://localhost:9000/ | head -c 200` (must return HTML)
- `curl -fsS "http://localhost:8888/lab?token=koireader" | head -c 200` (must return HTML, not 403)
- Get the Pi's LAN IP (`hostname -I`) and print, exactly:
  - Website:  `http://<ip>:9000`
  - Jupyter:  `http://<ip>:8888/lab?token=koireader`
- On the website, the **"Open live notebooks"** button (top-left) and the link in
  the *Coding Practice* section will now open Jupyter automatically.

### Constraints
- Idempotent — safe to re-run to deploy updates (`git pull` + restart both).
- Use `sudo` only for `apt` and for writing/enabling the two unit files.
- Show me each unit file before enabling it.
- **LAN only** — do not open ports to the public internet. Jupyter is token-
  protected; the `koireader` token is fine on a home network. If you later expose
  it beyond the LAN, change the token here and in `_app.js` (`JUPYTER_TOKEN`), then
  rebuild with `node build.js`.

### To update later (one shot)
```bash
cd /home/ajmalrasi/koireader-interview-prep && git pull --ff-only \
  && ./.venv/bin/python build_notebooks.py \
  && sudo systemctl restart koi-prep koi-jupyter
```

---

## Quick human cheat-sheet (not for Claude Code)

- Local try-out (no systemd): `cd koireader-interview-prep && bash run.sh` — serves
  the site on :9000 and Jupyter on :8888 with token `koireader`.
- After deploy, open `http://<pi-ip>:9000`, click **Open live notebooks** → it
  takes you to `http://<pi-ip>:8888/lab?token=koireader`.
