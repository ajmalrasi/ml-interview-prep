# Deploy the ML Eng Prep site on a Raspberry Pi (port 9002)

This is a **self-contained static site** — after `node build.js`, everything lives in
`index.html`. Deploying = copy the folder to the Pi and keep a server running on 9002.

---

## Copy-paste agent prompt

> Deploy my static site to my Raspberry Pi and keep it running on port 9002.
>
> **Facts**
> - Pi host: `192.168.3.20`, SSH user: `pi` (change if different).
> - Site source is the `ml-engineer-prep/` folder. It's a static site: `index.html`
>   is fully self-contained (built from Markdown via `node build.js`).
> - Target URL after deploy: `http://192.168.3.20:9002/`
>
> **Do this**
> 1. On my machine, run `node build.js` in `ml-engineer-prep/` to regenerate
>    `index.html`, then `rsync` the folder to the Pi at `/home/pi/ml-engineer-prep`.
> 2. On the Pi, set up a persistent server on port 9002 that survives reboots and
>    crashes. Prefer a `systemd` service running `python3 -m http.server 9002` from
>    the site directory (no extra dependencies). Enable and start it.
> 3. Verify `curl -sI http://192.168.3.20:9002/` returns `200 OK` and that the page
>    loads after a reboot.
> 4. Report the service name and how to redeploy after I edit content.

---

## Manual steps

### 1. Build + copy (run on your machine)
```bash
cd ml-engineer-prep
node build.js                       # regenerate index.html from the .md files
rsync -av --delete ./ pi@192.168.3.20:/home/pi/ml-engineer-prep/
```

### 2. Persistent server via systemd (run on the Pi)
```bash
sudo tee /etc/systemd/system/mlprep.service >/dev/null <<'UNIT'
[Unit]
Description=ML Eng Prep static site (port 9002)
After=network.target

[Service]
User=pi
WorkingDirectory=/home/pi/ml-engineer-prep
ExecStart=/usr/bin/python3 -m http.server 9002 --bind 0.0.0.0
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now mlprep.service
sudo systemctl status mlprep.service --no-pager
```

Now `http://192.168.3.20:9002/` stays up across reboots and crashes.

### 3. Verify
```bash
curl -sI http://192.168.3.20:9002/ | head -1     # expect: HTTP/1.0 200 OK
```

---

## Redeploy after editing content
Edit any `.md`, then from your machine:
```bash
cd ml-engineer-prep && node build.js
rsync -av --delete ./ pi@192.168.3.20:/home/pi/ml-engineer-prep/
```
No Pi restart needed — the static file is re-served immediately. (Restart only if you
ever change the systemd unit: `sudo systemctl restart mlprep.service`.)

---

## Notes
- **No Node needed on the Pi** — `node build.js` runs on your machine; the Pi only
  serves the built `index.html`. Only Python 3 (preinstalled on Raspberry Pi OS) is
  required there.
- **Nginx alternative** (if you want gzip / port 80 / TLS): point a server block at
  `root /home/pi/ml-engineer-prep; index index.html;` and drop the systemd unit.
- **Firewall**: if `ufw` is on, `sudo ufw allow 9002/tcp`.
