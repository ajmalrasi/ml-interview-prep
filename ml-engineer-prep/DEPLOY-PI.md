# Deploy the ML Eng Prep site on a Raspberry Pi (port 9002)

This is a **self-contained static site** — after `node build.js`, everything the browser
needs lives in `index.html`. It ships as one track inside the **monorepo**
`github.com/ajmalrasi/ml-interview-prep` (sibling: `computer-vision-prep/`), and the Pi
**deploys by `git pull`**, not rsync.

---

## Deployed instance

Running on **http://192.168.3.20:9002** — served by the `ml-engineer-prep` systemd service
(auto-starts on boot). User: `ajmalrasi`, path:
`/home/ajmalrasi/ml-interview-prep/ml-engineer-prep`.

The Pi holds one clone of the monorepo at `/home/ajmalrasi/ml-interview-prep`. The Pi has
**no Node and doesn't need it** — `index.html` is committed, so it serves the built file
directly.

---

## First-time setup on the Pi

```bash
# clone the monorepo once (HTTPS — public repo, no key needed)
git clone https://github.com/ajmalrasi/ml-interview-prep.git /home/ajmalrasi/ml-interview-prep

# persistent server on 9002 (survives reboot + crash)
sudo tee /etc/systemd/system/ml-engineer-prep.service >/dev/null <<'UNIT'
[Unit]
Description=ML/Cloud Engineer study website
After=network.target

[Service]
User=ajmalrasi
WorkingDirectory=/home/ajmalrasi/ml-interview-prep/ml-engineer-prep
ExecStart=/usr/bin/python3 -m http.server 9002
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now ml-engineer-prep.service
sudo systemctl status ml-engineer-prep.service --no-pager
```

---

## Redeploy after editing content

Build on your laptop (the Pi has no Node), push, then pull on the Pi:

```bash
# on your laptop, in ml-interview-prep/ml-engineer-prep
node build.js                                   # regenerate index.html from the .md files
git add -A && git commit -m "…" && git push
ssh rpi 'cd ml-interview-prep && git pull'       # static re-serve, no restart
```

No Pi restart needed — the static file is re-served immediately. Restart only if you change
the systemd unit itself: `sudo systemctl restart ml-engineer-prep.service`.

---

## Verify
```bash
curl -sI http://192.168.3.20:9002/ | head -1     # expect: HTTP/1.0 200 OK
```

---

## Notes
- **No Node on the Pi** — `node build.js` runs on your machine; the Pi only serves the
  committed `index.html`. Only Python 3 (preinstalled on Raspberry Pi OS) is required.
- **Ports / services in use on this Pi** (each service is named after its track dir):
  `computer-vision-prep` :9000, `rag-llm-prep` :9001, `ml-engineer-prep` :9002,
  `automotive-soc-prep` :9003, `koi-jupyter` :8888 — don't duplicate. Check with
  `ss -ltnp` before adding a unit.
- **Firewall**: if `ufw` is on, `sudo ufw allow 9002/tcp`. LAN only — don't expose publicly.
