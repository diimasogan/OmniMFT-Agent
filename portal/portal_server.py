#!/usr/bin/env python3
"""OmniMFT Ops Copilot portal server (stdlib only).

Serves portal/index.html on http://127.0.0.1:8080 and proxies /api/<endpoint> to the Boomi OmniMFT bridge
listeners ({SERVER_BASE_URL}/ws/simple/<endpoint>) with Basic auth from ../.env. Why a proxy:
  * Boomi WSS listeners answer the browser's CORS preflight with 403, so a page cannot call them directly.
  * The Boomi credentials stay on this host; the browser never sees them.
Also exposes GET /local/bridge -> {"running": true|false} (is bridge_worker.py running on this host).

Run:  python3 -I portal/portal_server.py [--port 8080]
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENV_FILE = HERE.parent / ".env"
INDEX = HERE / "index.html"
ALLOWED = {"getOmnimftDoc": "GET", "createOmnimftRequest": "POST", "createOmnimftNotification": "POST"}
DOC_KINDS = {"snapshots", "results"}
MAX_BODY = 64 * 1024
CA = "/etc/ssl/certs/ca-certificates.crt"  # system bundle (includes the corporate TLS-inspection root)


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key, val = key.strip().removeprefix("export ").strip(), val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "'\"":
            val = val[1:-1]
        env[key] = val
    return env


class Portal(BaseHTTPRequestHandler):
    server_version = "OmniMFTPortal/1.0"
    base = ""
    auth = ""
    ctx: ssl.SSLContext
    hosts: set[str] = set()

    # ------------------------------------------------------------ helpers
    def _send(self, status: int, data: bytes, ctype: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def _json(self, status: int, obj: dict) -> None:
        self._send(status, json.dumps(obj).encode())

    def _host_ok(self) -> bool:  # blocks DNS-rebinding: only our own host names
        return (self.headers.get("Host") or "") in self.hosts

    # ------------------------------------------------------------ routes
    def do_GET(self) -> None:  # noqa: N802
        if not self._host_ok():
            return self._json(403, {"error": "unexpected Host header"})
        path = urllib.parse.urlsplit(self.path).path
        if path in ("/", "/index.html"):
            return self._send(200, INDEX.read_bytes(), "text/html; charset=utf-8")
        if path == "/local/bridge":
            running = subprocess.run(["pgrep", "-f", "python bridge_worker.py"], capture_output=True).returncode == 0
            return self._json(200, {"running": running})
        if path.startswith("/api/"):
            return self._proxy("GET")
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if not self._host_ok():
            return self._json(403, {"error": "unexpected Host header"})
        if urllib.parse.urlsplit(self.path).path.startswith("/api/"):
            return self._proxy("POST")
        self._json(404, {"error": "not found"})

    def _proxy(self, method: str) -> None:
        # Custom header forces a CORS preflight for any other origin; we never answer preflights, so other
        # websites open in the browser cannot drive this proxy.
        if self.headers.get("X-OmniMFT-Portal") != "1":
            return self._json(403, {"error": "missing X-OmniMFT-Portal header"})
        u = urllib.parse.urlsplit(self.path)
        endpoint = u.path[len("/api/"):]
        if ALLOWED.get(endpoint) != method:
            return self._json(404, {"error": f"endpoint not allowed: {method} {endpoint}"})
        if endpoint == "getOmnimftDoc" and urllib.parse.parse_qs(u.query).get("kind", [""])[0] not in DOC_KINDS:
            return self._json(400, {"error": "kind must be snapshots or results"})
        body = None
        if method == "POST":
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                return self._json(413, {"error": "body too large"})
            body = self.rfile.read(length) if length else b"{}"
        url = f"{self.base}/{endpoint}" + (f"?{u.query}" if u.query else "")
        req = urllib.request.Request(url, data=body, method=method, headers={
            "Authorization": self.auth, "Accept": "application/json", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=90, context=self.ctx) as r:
                status, data = r.status, r.read()
        except urllib.error.HTTPError as exc:
            status, data = exc.code, exc.read()
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            return self._json(502, {"error": f"Boomi unreachable: {type(exc).__name__}"})
        self._send(status, data)

    def log_message(self, fmt: str, *args) -> None:  # path only: query strings may carry message text
        path = getattr(self, "path", None)
        if path is None:  # malformed request (e.g. https:// sent to this plain-HTTP port)
            sys.stderr.write(f"{self.log_date_time_string()} rejected malformed request (use http://, not https://)\n")
            return
        sys.stderr.write(f"{self.log_date_time_string()} {getattr(self, 'command', '?')} {urllib.parse.urlsplit(path).path} "
                         f"{args[1] if len(args) > 1 else ''}\n")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--port", type=int, default=8080)
    args = ap.parse_args()
    if not ENV_FILE.exists():
        sys.exit(f"missing {ENV_FILE}")
    env = load_env(ENV_FILE)
    missing = [k for k in ("SERVER_BASE_URL", "SERVER_USERNAME", "SERVER_TOKEN") if not env.get(k)]
    if missing:
        sys.exit(f".env is missing: {', '.join(missing)}")
    Portal.base = env["SERVER_BASE_URL"].rstrip("/") + "/ws/simple"
    Portal.auth = "Basic " + base64.b64encode(f"{env['SERVER_USERNAME']}:{env['SERVER_TOKEN']}".encode()).decode()
    Portal.ctx = ssl.create_default_context(cafile=CA if os.path.exists(CA) else None)
    Portal.hosts = {f"127.0.0.1:{args.port}", f"localhost:{args.port}"}
    httpd = ThreadingHTTPServer(("127.0.0.1", args.port), Portal)
    print(f"OmniMFT Ops Copilot portal: http://localhost:{args.port}  (proxy -> {Portal.base})")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
