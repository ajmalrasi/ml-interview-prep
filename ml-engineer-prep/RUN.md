# Run this site (port 9002)

This is a self-contained static site — `index.html` has everything inlined, so you can
just open it, or serve it.

## Quickest: open directly
Double-click `index.html`, or:
```bash
open index.html      # macOS
```

## Serve on port 9002 (to match the CV site on 9000)
```bash
cd ml-engineer-prep
python3 -m http.server 9002
# then open http://localhost:9002
```

## Edit content, then rebuild
Content lives in the numbered folders as Markdown. After editing any `.md`:
```bash
node build.js        # regenerates index.html
```

## Run both prep sites side by side
```bash
# terminal 1 — Computer Vision site
cd ../computer-vision-prep && python3 -m http.server 9000
# terminal 2 — this ML/Cloud Engineer site
cd ml-engineer-prep && python3 -m http.server 9002
```
Open http://localhost:9000 and http://localhost:9002.
