#!/usr/bin/env python3
"""Serve one prep site plus its small, server-backed study-state API."""

import argparse
import http.server
import json
import os
import tempfile
import threading
import time
from urllib.parse import urlsplit


MAX_STATE_BYTES = 2 * 1024 * 1024
ROOT = os.getcwd()
TRACK = os.path.basename(ROOT)
STATE_DIR = os.path.join(os.path.dirname(ROOT), ".progress")
STATE_FILE = os.path.join(STATE_DIR, TRACK + ".json")
STATE_LOCK = threading.Lock()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if urlsplit(self.path).path == "/api/progress":
            with STATE_LOCK:
                exists = os.path.exists(STATE_FILE)
                try:
                    with open(STATE_FILE, encoding="utf-8") as handle:
                        state = json.load(handle)
                except FileNotFoundError:
                    state = {}
                except (OSError, json.JSONDecodeError):
                    self._send_json(500, {"error": "Could not read progress"})
                    return
            self._send_json(200, {"exists": exists, "state": state})
            return
        super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path != "/api/progress":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_STATE_BYTES:
                raise ValueError("Invalid state size")
            payload = json.loads(self.rfile.read(length))
            os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
            with STATE_LOCK:
                state = self._apply_change(payload)
                fd, tmp_path = tempfile.mkstemp(prefix=TRACK + "-", suffix=".tmp", dir=STATE_DIR)
                try:
                    with os.fdopen(fd, "w", encoding="utf-8") as handle:
                        json.dump(state, handle, ensure_ascii=False, separators=(",", ":"))
                        handle.flush()
                        os.fsync(handle.fileno())
                    os.chmod(tmp_path, 0o600)
                    os.replace(tmp_path, STATE_FILE)
                finally:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
            self._send_json(200, {"ok": True, "state": state})
        except (ValueError, json.JSONDecodeError, OSError) as exc:
            self._send_json(400, {"error": str(exc)})

    @staticmethod
    def _validate_state(state):
        if not isinstance(state, dict):
            raise ValueError("State must be an object")
        for key in ("done", "cards", "pins", "analytics"):
            if key in state and not isinstance(state[key], dict):
                raise ValueError(key + " must be an object")
        if "_deleted" in state and not isinstance(state["_deleted"], dict):
            raise ValueError("_deleted must be an object")
        for key, value in state.get("_deleted", {}).items():
            if key not in ("done", "cards", "pins", "analytics") or not isinstance(value, dict):
                raise ValueError("Invalid deletion history")
        if state.get("last") is not None and not isinstance(state.get("last"), str):
            raise ValueError("last must be a string or null")

    @classmethod
    def _apply_change(cls, payload):
        if not isinstance(payload, dict):
            raise ValueError("Payload must be an object")
        operation = payload.get("op")
        if operation in (None, "replace"):
            state = payload if operation is None else payload.get("state")
            cls._validate_state(state)
            return state
        if operation != "set":
            raise ValueError("Unknown operation")
        try:
            with open(STATE_FILE, encoding="utf-8") as handle:
                state = json.load(handle)
        except FileNotFoundError:
            state = {}
        cls._validate_state(state)
        state.setdefault("done", {})
        state.setdefault("cards", {})
        state.setdefault("pins", {})
        state.setdefault("analytics", {})
        deleted = state.setdefault("_deleted", {})
        field = payload.get("field")
        value = payload.get("value")
        if field == "last":
            if not isinstance(value, str):
                raise ValueError("last must be a string")
            state["last"] = value
        elif field in ("done", "cards", "pins", "analytics"):
            key = payload.get("key")
            if not isinstance(key, str) or not key or len(key) > 1000:
                raise ValueError("Invalid state key")
            tombstones = deleted.setdefault(field, {})
            if value in (False, 0, None):
                state[field].pop(key, None)
                tombstones[key] = int(time.time() * 1000)
            else:
                state[field][key] = value
                tombstones.pop(key, None)
        else:
            raise ValueError("Invalid state field")
        cls._validate_state(state)
        return state

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        if urlsplit(self.path).path != "/api/progress":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("port", type=int)
    args = parser.parse_args()
    server = http.server.ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    print(f"Serving {TRACK} on :{args.port}; progress -> {STATE_FILE}", flush=True)
    server.serve_forever()
