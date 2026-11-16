"""OmniMFT Relay API: exposes a safe subset of the OmniMFT tools over HTTPS for Boomi Agentstudio.

SecureTransport stays on the private network; only this relay is published (through a tunnel).
Auth: HTTP Basic with RELAY_USERNAME / RELAY_TOKEN from .env. ST/Boomi credentials never leave this host.
Run:  .venv/bin/uvicorn relay:app --host 127.0.0.1 --port 8765
"""
from __future__ import annotations

import base64
import hmac
import json
import logging
import os
from typing import Any

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

import server as omni  # loads .env and the tested tool implementations

log = logging.getLogger("omnimft.relay")
USER = os.environ.get("RELAY_USERNAME", "")
TOKEN = os.environ.get("RELAY_TOKEN", "")
if not USER or not TOKEN:
    raise SystemExit("Set RELAY_USERNAME and RELAY_TOKEN in .env")
DEFAULT_BOOMI_ENDPOINT = os.getenv(
    "OMNIMFT_BOOMI_ENDPOINT", "https://c01-sg.integrate-test.boomi.com/ws/simple/executeStInboundFile")


def _authorised(req: Request) -> bool:
    header = req.headers.get("authorization", "")
    if not header.lower().startswith("basic "):
        return False
    try:
        user, _, pwd = base64.b64decode(header[6:]).decode().partition(":")
    except Exception:
        return False
    return hmac.compare_digest(user, USER) and hmac.compare_digest(pwd, TOKEN)


def _int(v: Any, default: int) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


def _float(v: Any) -> float | None:
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _bool(v: Any, default: bool) -> bool:
    if isinstance(v, bool):
        return v
    if v in (None, ""):
        return default
    return str(v).strip().lower() in ("true", "1", "yes", "y")


def _clean(v: Any) -> Any:
    """Agent templates send unused optional params as '' or the literal placeholder; treat both as absent."""
    if isinstance(v, str) and (v.strip() == "" or v.strip().startswith("{{")):
        return None
    return v


def endpoint(handler):
    async def wrapped(req: Request):
        if not _authorised(req):
            return JSONResponse({"ok": False, "error": "unauthorised"}, status_code=401,
                                headers={"WWW-Authenticate": 'Basic realm="omnimft"'})
        params = {k: _clean(v) for k, v in req.query_params.items()}
        if req.method == "POST":
            try:
                body = await req.json()
                params.update({k: _clean(v) for k, v in (body or {}).items()})
            except json.JSONDecodeError:
                return JSONResponse({"ok": False, "error": "body must be JSON"}, status_code=400)
        try:
            result = handler(params)
        except Exception as exc:  # never leak stack traces or config to the caller
            log.exception("relay handler failed")
            result = {"ok": False, "error": f"relay error: {type(exc).__name__}"}
        return JSONResponse(result)
    return wrapped


@endpoint
def health(p):
    return omni.omnimft_health()


@endpoint
def transfers(p):
    return omni.check_secure_transport_status(
        tracking_id=p.get("tracking_id"), filename=p.get("filename"), account=p.get("account"),
        status=p.get("status"), since_hours=_float(p.get("since_hours")), limit=_int(p.get("limit"), 10))


@endpoint
def certificates(p):
    return omni.check_security_certificates(
        within_days=_int(p.get("within_days"), 30), cert_type=p.get("cert_type"),
        usage=p.get("usage"), account=p.get("account"), include_ok=False)


@endpoint
def boomi_history(p):
    return omni.get_boomi_inbound_history(
        since_hours=_float(p.get("since_hours")) or 24, status=p.get("status"), limit=_int(p.get("limit"), 20))


@endpoint
def resubmit(p):
    return omni.resubmit_transfer(ref=p.get("ref") or "")


@endpoint
def onboard(p):
    return omni.create_secure_transport_usecase(
        partner_name=p.get("partner_name") or "", inbound_folder=p.get("inbound_folder") or "inbound",
        boomi_endpoint_url=DEFAULT_BOOMI_ENDPOINT, dry_run=_bool(p.get("dry_run"), True))


app = Starlette(routes=[
    Route("/health", health, methods=["GET"]),
    Route("/transfers", transfers, methods=["GET"]),
    Route("/certificates", certificates, methods=["GET"]),
    Route("/boomi/inbound-history", boomi_history, methods=["GET"]),
    Route("/transfers/resubmit", resubmit, methods=["POST"]),
    Route("/partners/onboard", onboard, methods=["POST"]),
])
