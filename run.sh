#!/usr/bin/env bash
# One command to play with the code:
#   - creates a Python virtualenv (.venv) and installs deps
#   - serves the study website on SITE_PORT
#   - launches JupyterLab (the live notebooks) on JUPYTER_PORT
#
#   bash run.sh
#
# Override ports:  SITE_PORT=9000 JUPYTER_PORT=8888 bash run.sh
set -e
cd "$(dirname "$0")"

PYTHON="${PYTHON:-python3}"
SITE_PORT="${SITE_PORT:-9000}"
JUPYTER_PORT="${JUPYTER_PORT:-8888}"

# 1) venv + deps (only installs once; fast on later runs)
if [ ! -d .venv ]; then
  echo "Creating virtualenv (.venv)…"
  "$PYTHON" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --quiet --upgrade pip
echo "Installing dependencies (first run only)…"
python -m pip install --quiet -r requirements.txt

# 2) (re)build the notebooks from the markdown so they're always in sync
python build_notebooks.py >/dev/null && echo "Notebooks built from the .md files."

# 3) serve the static website in the background
python -m http.server "$SITE_PORT" >/tmp/koi-site.log 2>&1 &
SITE_PID=$!
cleanup() { kill "$SITE_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "============================================================"
echo "  Study website :  http://localhost:${SITE_PORT}"
[ -n "$IP" ] && echo "                   http://${IP}:${SITE_PORT}   (from your phone)"
echo "  Jupyter        :  starting on port ${JUPYTER_PORT} (URL + token printed below)"
echo "  Stop everything:  press Ctrl+C"
echo "============================================================"
echo ""

# 4) launch JupyterLab in the foreground (Ctrl+C stops both)
exec jupyter lab \
  --no-browser \
  --ip=0.0.0.0 \
  --port="$JUPYTER_PORT" \
  --notebook-dir=notebooks \
  --ServerApp.root_dir=notebooks
