# Deploy the Automotive SoC AI Prep site on a Raspberry Pi (port 9003)

This is a **self-contained static site** — after `node build.js`, everything the browser
needs lives in `index.html`. It ships as one track inside the **monorepo**
`github.com/ajmalrasi/ml-interview-prep` (siblings: `computer-vision-prep/`,
`ml-engineer-prep/`, `rag-llm-prep/`), and the Pi **deploys by `git pull`**, not rsync.

---

## Deployed instance

Runs on **http://192.168.3.20:9003** — served by the `automotive-soc-prep` systemd service
(auto-starts on boot). User: `ajmalrasi`, path:
`/home/ajmalrasi/ml-interview-prep/automotive-soc-prep`.

The Pi holds one clone of the monorepo at `/home/ajmalrasi/ml-interview-prep`. The Pi has
**no Node and doesn't need it** — `index.html` is committed, so it serves the built file
directly.

---

## First-time setup on the Pi

The monorepo is already cloned at `/home/ajmalrasi/ml-interview-prep` (the other tracks use
it). Just pull the new track and add a service on a free port:

```bash
ssh rpi
cd ml-interview-prep && git pull                 # brings in automotive-soc-prep/

# persistent server on 9003 (survives reboot + crash)
sudo tee /etc/systemd/system/automotive-soc-prep.service >/dev/null <<'UNIT'
[Unit]
Description=Automotive SoC AI Application Engineer study website
After=network.target

[Service]
User=ajmalrasi
WorkingDirectory=/home/ajmalrasi/ml-interview-prep/automotive-soc-prep
ExecStart=/usr/bin/python3 -m http.server 9003
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now automotive-soc-prep.service
sudo systemctl status automotive-soc-prep.service --no-pager
```

---

## Redeploy after editing content

Build on your laptop (the Pi has no Node), push, then pull on the Pi:

```bash
# on your laptop, in ml-interview-prep/automotive-soc-prep
node build.js                                    # regenerate index.html from the .md files
git add -A && git commit -m "…" && git push
ssh rpi 'cd ml-interview-prep && git pull'        # static re-serve, no restart
```

No Pi restart needed — the static file is re-served immediately. Restart only if you change
the systemd unit itself: `sudo systemctl restart automotive-soc-prep.service`.

---

## Verify
```bash
curl -sI http://192.168.3.20:9003/ | head -1     # expect: HTTP/1.0 200 OK
```

---

## Notes
- **No Node on the Pi** — `node build.js` runs on your machine; the Pi only serves the
  committed `index.html`. Only Python 3 (preinstalled on Raspberry Pi OS) is required.
- **Ports / services in use on this Pi** (each service is named after its track dir):
  `computer-vision-prep` :9000, `rag-llm-prep` :9001, `ml-engineer-prep` :9002,
  `automotive-soc-prep` :9003, `koi-jupyter` :8888 — don't duplicate. Check with
  `ss -ltnp` before adding a unit.
- **Firewall**: if `ufw` is on, `sudo ufw allow 9003/tcp`. LAN only — don't expose publicly.
