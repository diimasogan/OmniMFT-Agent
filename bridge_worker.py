"""OmniMFT outbound-only bridge worker.

Runs next to SecureTransport (on the VPN) and talks to Boomi only through outbound HTTPS:
  * every SNAPSHOT_SECONDS: publish snapshots (transfers, certificates, Boomi inbound history, health)
  * every POLL_SECONDS:     fetch queued Agentstudio requests, execute allow-listed actions, publish results
No inbound connection to this host is ever needed. Credentials stay in .env on this host.
Run: .venv/bin/python bridge_worker.py   (or ./start-bridge.sh)
"""
from __future__ import annotations

import json
import logging
import os
import signal
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

import server as omni  # loads .env + the tested OmniMFT tool implementations

ROOT = Path(__file__).resolve().parent
STATE_F = ROOT / "logs" / "bridge_state.json"
POLL_SECONDS = float(os.getenv("BRIDGE_POLL_SECONDS", "5"))
SNAPSHOT_SECONDS = float(os.getenv("BRIDGE_SNAPSHOT_SECONDS", "60"))
REQUEST_TTL_MIN = float(os.getenv("BRIDGE_REQUEST_TTL_MINUTES", "15"))
BOOMI_ENDPOINT = os.getenv("OMNIMFT_BOOMI_ENDPOINT",
                           "https://c01-sg.integrate-test.boomi.com/ws/simple/executeStInboundFile")
VERSION = "1.0"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                    handlers=[logging.FileHandler(ROOT / "logs" / "bridge.log"), logging.StreamHandler()], force=True)
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("bridge")

CA = "/etc/ssl/certs/ca-certificates.crt"
WS = httpx.Client(base_url=os.environ["SERVER_BASE_URL"].rstrip("/") + "/ws/simple",
                  auth=(os.environ["SERVER_USERNAME"], os.environ["SERVER_TOKEN"]),
                  verify=CA if os.path.exists(CA) else True, timeout=60)


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


# ---------------------------------------------------------------- Boomi store calls
def put_doc(kind: str, name: str, payload: dict) -> None:
    r = WS.post("/upsertOmnimftDoc", params={"kind": kind, "name": name},
                content=json.dumps(payload, default=str).encode(), headers={"Content-Type": "application/json"})
    r.raise_for_status()
    if not r.json().get("ok"):
        raise RuntimeError(f"store rejected {kind}/{name}: {r.text[:200]}")


def get_doc(kind: str, name: str) -> dict | None:
    r = WS.get("/getOmnimftDoc", params={"kind": kind, "name": name})
    r.raise_for_status()
    data = r.json() if r.content else None
    if isinstance(data, dict) and data.get("status") == "NOT_FOUND":
        return None
    return data


def list_requests() -> list[dict]:
    r = WS.get("/queryOmnimftRequests")
    r.raise_for_status()
    rows, dec, text, i = [], json.JSONDecoder(), r.text, 0
    while i < len(text):  # body = JSON objects separated by newlines
        while i < len(text) and text[i].isspace():
            i += 1
        if i >= len(text):
            break
        obj, i = dec.raw_decode(text, i)
        rows.append(obj)
    return rows


# ---------------------------------------------------------------- snapshots
def publish_snapshots(reason: str = "scheduled") -> None:
    t0 = time.monotonic()
    synced = iso(now())
    recent = omni.check_secure_transport_status(since_hours=24, limit=50)
    failed = omni.check_secure_transport_status(status="Failed", since_hours=24 * 7, limit=30)
    put_doc("snapshots", "transfers", {"syncedAt": synced, "window": "last 24h (max 50) + failed last 7 days (max 30)",
                                       "recent": recent, "failed_7d": failed})
    put_doc("snapshots", "certificates", {"syncedAt": synced, **omni.check_security_certificates(within_days=30)})
    put_doc("snapshots", "boomi_inbound", {"syncedAt": synced, **omni.get_boomi_inbound_history(since_hours=24, limit=30)})
    put_doc("snapshots", "health", {"syncedAt": synced, "worker": f"omnimft-bridge {VERSION}", "pollSeconds": POLL_SECONDS,
                                    "snapshotSeconds": SNAPSHOT_SECONDS, **omni.omnimft_health()})
    log.info("snapshots published (%s) in %.1fs", reason, time.monotonic() - t0)


# ---------------------------------------------------------------- actions (allow-list)
def _f(v):
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _i(v, d):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return d


def _s(v):
    return None if v in (None, "") or (isinstance(v, str) and v.strip().startswith("{{")) else str(v)


def _b(v, d):
    if isinstance(v, bool):
        return v
    return d if v in (None, "") else str(v).strip().lower() in ("true", "1", "yes", "y")


ACTIONS = {
    "health": lambda p: omni.omnimft_health(),
    "track_transfers": lambda p: omni.check_secure_transport_status(
        tracking_id=_s(p.get("tracking_id")), filename=_s(p.get("filename")), account=_s(p.get("account")),
        status=_s(p.get("status")), since_hours=_f(p.get("since_hours")), limit=_i(p.get("limit"), 10)),
    "check_certificates": lambda p: omni.check_security_certificates(
        within_days=_i(p.get("within_days"), 30), cert_type=_s(p.get("cert_type"))),
    "boomi_inbound_history": lambda p: omni.get_boomi_inbound_history(
        since_hours=_f(p.get("since_hours")) or 24, status=_s(p.get("status")), limit=_i(p.get("limit"), 20)),
    "resubmit_transfer": lambda p: omni.resubmit_transfer(ref=_s(p.get("ref")) or ""),
    "onboard_partner": lambda p: omni.create_secure_transport_usecase(
        partner_name=_s(p.get("partner_name")) or "", inbound_folder=_s(p.get("inbound_folder")) or "inbound",
        route=(_s(p.get("route")) or "boomi").lower(), ssh_profile=_s(p.get("ssh_profile")) or "inbox_lab",
        boomi_endpoint_url=BOOMI_ENDPOINT, dry_run=_b(p.get("dry_run"), True)),
    "check_partner": lambda p: omni.check_partner_setup(partner_name=_s(p.get("partner_name"))),
    "list_route_profiles": lambda p: {"ok": True, "profiles": {k: {kk: vv for kk, vv in v.items() if kk != "password_env"}
                                                                for k, v in omni._profiles().items()}},
}


def handle(req_name: str) -> None:
    # Never re-run a request that already has a result (e.g. local state lost after an abrupt shutdown).
    if get_doc("results", req_name) is not None:
        log.info("request %s already has a result; skipping", req_name)
        return
    doc = get_doc("requests", req_name)
    if not doc:
        return
    rid = doc.get("requestId", req_name)
    body = doc.get("request") if isinstance(doc.get("request"), dict) else {}
    action = str(body.get("action", ""))
    out = {"requestId": rid, "action": action, "requestedAt": doc.get("createdAt")}
    created = doc.get("createdAt")
    try:
        age = now() - datetime.fromisoformat(created.replace("Z", "+00:00")) if created else timedelta(0)
    except ValueError:
        age = timedelta(0)
    if age > timedelta(minutes=REQUEST_TTL_MIN):
        out.update(status="EXPIRED", result={"ok": False, "error": f"request older than {REQUEST_TTL_MIN:g} min; ask again"})
    elif action == "refresh_snapshots":
        publish_snapshots("on request")  # synchronous: the agent waits for fresh data
        out.update(status="DONE", result={"ok": True, "message": "snapshots refreshed"})
    elif action not in ACTIONS:
        out.update(status="REJECTED", result={"ok": False, "error": f"unknown action '{action}'",
                                              "allowed": sorted([*ACTIONS, "refresh_snapshots"])})
    else:
        try:
            res = ACTIONS[action](body)
            out.update(status="DONE" if res.get("ok", True) else "FAILED", result=res)
        except Exception as exc:  # never leak internals
            log.exception("action %s failed", action)
            out.update(status="FAILED", result={"ok": False, "error": f"worker error: {type(exc).__name__}"})
    out["completedAt"] = iso(now())
    put_doc("results", rid, out)
    log.info("request %s action=%s -> %s", rid, action, out["status"])
    if action in ("onboard_partner", "resubmit_transfer") and out["status"] == "DONE" and not body.get("dry_run") in (True, "true"):
        threading.Thread(target=publish_snapshots, args=("after change",), daemon=True).start()


# ---------------------------------------------------------------- main loop
def load_state() -> dict:
    try:
        return json.loads(STATE_F.read_text())
    except (OSError, ValueError):
        return {"processed": []}


def main() -> None:
    state = load_state()
    done = set(state.get("processed", []))
    running = {"on": True}
    signal.signal(signal.SIGTERM, lambda *_: running.update(on=False))
    signal.signal(signal.SIGINT, lambda *_: running.update(on=False))
    log.info("bridge worker %s started (poll %ss, snapshots %ss)", VERSION, POLL_SECONDS, SNAPSHOT_SECONDS)

    def snapshot_loop():  # separate thread so slow snapshots never delay queued requests
        while running["on"]:
            try:
                publish_snapshots()
            except Exception as exc:
                log.warning("snapshot cycle failed: %s", type(exc).__name__)
            for _ in range(int(SNAPSHOT_SECONDS)):
                if not running["on"]:
                    return
                time.sleep(1)

    threading.Thread(target=snapshot_loop, daemon=True, name="snapshots").start()
    while running["on"]:
        try:
            for row in sorted(list_requests(), key=lambda r: r.get("fileName", "")):
                fn = row.get("fileName", "")
                if not fn.endswith(".json"):
                    continue
                name = fn[:-5]
                if name in done:
                    continue
                handle(name)
                done.add(name)
                tmp = STATE_F.with_suffix(".tmp")  # atomic write: safe against power loss mid-write
                tmp.write_text(json.dumps({"processed": sorted(done)[-2000:]}))
                os.replace(tmp, STATE_F)
        except httpx.HTTPError as exc:
            log.warning("Boomi store unreachable: %s", type(exc).__name__)
        except Exception:
            log.exception("loop error")
        time.sleep(POLL_SECONDS)
    log.info("bridge worker stopped")


if __name__ == "__main__":
    main()
