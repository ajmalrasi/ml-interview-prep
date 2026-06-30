# Run on a Raspberry Pi (or any edge device)

**TL;DR:** This site is just static files — one `index.html` plus the markdown.
No build, no database, no internet. Serve the folder with any tiny web server and
open it in a browser. Below: the 30-second way, plus an auto-start service so it's
always on.

## Why it needs a server (not just double-click)

The page *reads* the `.md` files at runtime with `fetch()`. Browsers block reading
local files over `file://` for security, so opening `index.html` directly shows a
"needs a web server" notice. Any HTTP server fixes it — that's all a Pi needs.

## Option 1 — Python (already on every Pi), 30 seconds

```bash
cd /path/to/koireader-interview-prep
python3 -m http.server 8000
```

Then open **http://localhost:8000** on the Pi, or **http://<pi-ip>:8000** from your
laptop/phone on the same network (find the IP with `hostname -I`).

## Option 2 — Always-on with systemd (survives reboot)

Create the service:

```bash
sudo tee /etc/systemd/system/koi-prep.service >/dev/null <<'EOF'
[Unit]
Description=KoiReader Interview Prep site
After=network.target

[Service]
WorkingDirectory=/home/pi/koireader-interview-prep
ExecStart=/usr/bin/python3 -m http.server 8000
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now koi-prep
```

Now it starts on boot and restarts if it crashes. Check it: `systemctl status
koi-prep`. Logs: `journalctl -u koi-prep -f`.

> Adjust `WorkingDirectory` and `User` to where you copied the folder.

## Option 3 — nginx (if you already run it)

```nginx
server {
    listen 80;
    root /home/pi/koireader-interview-prep;
    index index.html;
    location / { try_files $uri $uri/ =404; }
}
```

Drop that in `/etc/nginx/sites-available/koi-prep`, symlink to `sites-enabled`,
`sudo nginx -t && sudo systemctl reload nginx`. Then browse to the Pi's IP on port
80.

## Copying the folder to the Pi

From your computer:

```bash
scp -r koireader-interview-prep pi@<pi-ip>:/home/pi/
```

Or put it on a USB stick / clone it from git — the whole site is plain text, a few
hundred KB.

## Notes

- **Fully offline:** no CDN, no external fonts or scripts. Works on an air-gapped
  device.
- **Resource use:** `python3 -m http.server` idles at near-zero CPU/RAM — fine on a
  Pi Zero.
- **Editing content:** just edit the `.md` files; refresh the browser. No rebuild.
- **Dark/light:** toggle with the ◐ button (top-left); preference is remembered.
- **Search:** the box filters by title and full text across all pages.

→ Back to the [Overview](README.md).
