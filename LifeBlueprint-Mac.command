#!/usr/bin/env bash
# 北歐森林・人生規劃藍圖 — MacBook (macOS) 免安裝獨立視窗啟動器
cd "$(dirname "$0")" || exit 1

exec python3 - << 'EOF'
import os
import sys
import json
import time
import shutil
import socket
import threading
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

BASE_DIR = os.getcwd()
APP_DIR = os.path.join(BASE_DIR, "app")
DATA_DIR = os.path.join(BASE_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "life_blueprint.json")
BACKUP_FILE = os.path.join(DATA_DIR, "life_blueprint.backup.json")
APIKEY_FILE = os.path.join(DATA_DIR, "apikey.local")
GHSYNC_FILE = os.path.join(DATA_DIR, "github_sync.local")

os.makedirs(DATA_DIR, exist_ok=True)

last_heartbeat = time.time()
client_connected = False
is_running = True

MIME_MAP = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".png": "image/png",
}

class BlueprintHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Keep terminal quiet

    def _send_bytes(self, status, content_type, data_bytes):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data_bytes)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data_bytes)

    def _send_json(self, status, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self._send_bytes(status, "application/json; charset=utf-8", raw)

    def do_GET(self):
        global last_heartbeat, client_connected
        client_connected = True
        last_heartbeat = time.time()
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/heartbeat":
            self._send_json(200, {"ok": True, "platform": "macOS"})
            return

        if path == "/api/apikey":
            key_val = ""
            if os.path.exists(APIKEY_FILE):
                with open(APIKEY_FILE, "r", encoding="utf-8") as f:
                    key_val = f.read().strip()
            self._send_json(200, {"apiKey": key_val})
            return

        if path == "/api/github-sync-config":
            cfg = {}
            if os.path.exists(GHSYNC_FILE):
                try:
                    with open(GHSYNC_FILE, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                except Exception:
                    cfg = {}
            self._send_json(200, cfg)
            return

        if path == "/api/data":
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, "rb") as f:
                    self._send_bytes(200, "application/json; charset=utf-8", f.read())
            else:
                self._send_bytes(200, "application/json; charset=utf-8", b"null")
            return

        if path == "/" or path == "":
            path = "/index.html"

        rel = path.lstrip("/")
        if ".." in rel:
            self._send_json(403, {"error": "Forbidden"})
            return

        full_path = os.path.join(APP_DIR, rel)
        if os.path.isfile(full_path):
            ext = os.path.splitext(full_path)[1].lower()
            mime = MIME_MAP.get(ext, "application/octet-stream")
            with open(full_path, "rb") as f:
                self._send_bytes(200, mime, f.read())
        else:
            self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        global last_heartbeat, client_connected, is_running
        client_connected = True
        last_heartbeat = time.time()
        parsed = urlparse(self.path)
        path = parsed.path

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length > 0 else b""

        if path == "/api/shutdown":
            self._send_json(200, {"shuttingDown": True})
            def delayed_check():
                global is_running
                time.sleep(0.5)
                if time.time() - last_heartbeat >= 0.45:
                    is_running = False
            threading.Thread(target=delayed_check, daemon=True).start()
            return

        if path == "/api/apikey":
            with open(APIKEY_FILE, "w", encoding="utf-8") as f:
                f.write(body.decode("utf-8", errors="ignore").strip())
            self._send_json(200, {"saved": True})
            return

        if path == "/api/github-sync-config":
            with open(GHSYNC_FILE, "wb") as f:
                f.write(body)
            self._send_json(200, {"saved": True})
            return

        if path == "/api/data":
            text = body.decode("utf-8", errors="ignore").strip()
            if text:
                if os.path.exists(DATA_FILE):
                    try:
                        shutil.copy2(DATA_FILE, BACKUP_FILE)
                    except Exception:
                        pass
                with open(DATA_FILE, "w", encoding="utf-8") as f:
                    f.write(text)
                self._send_json(200, {"saved": True, "path": "data/life_blueprint.json"})
            else:
                self._send_json(400, {"error": "Empty body"})
            return

        if path == "/api/open-folder":
            try:
                subprocess.Popen(["open", DATA_DIR])
            except Exception:
                pass
            self._send_json(200, {"ok": True})
            return

        self._send_json(404, {"error": "Not found"})

def launch_mac_window(url):
    profile_dir = os.path.join(DATA_DIR, "window_profile_mac")
    os.makedirs(profile_dir, exist_ok=True)
    browsers = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        os.path.expanduser("~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    ]
    for b in browsers:
        if os.path.exists(b):
            try:
                return subprocess.Popen([
                    b,
                    f"--app={url}",
                    f"--user-data-dir={profile_dir}",
                    "--window-size=1400,880",
                    "--no-first-run",
                    "--no-default-browser-check"
                ])
            except Exception:
                pass
    try:
        return subprocess.Popen(["open", url])
    except Exception:
        return None

def main():
    port = 17890
    server = None
    try:
        server = HTTPServer(("127.0.0.1", port), BlueprintHandler)
    except OSError:
        # Port 17890 already active; open window against existing server
        launch_mac_window(f"http://127.0.0.1:{port}/")
        return

    url = f"http://127.0.0.1:{port}/"
    print(f"🦌 北歐森林人生藍圖 (macOS 版) 已啟動於 {url}")
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()

    launch_mac_window(url)

    start_ts = time.time()
    while is_running:
        time.sleep(1)
        if not client_connected and (time.time() - start_ts > 60):
            break

    server.shutdown()

if __name__ == "__main__":
    main()
EOF
