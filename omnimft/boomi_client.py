"""Client for the Boomi AtomSphere Platform API (process execution)."""
from __future__ import annotations

import os
import time
from typing import Any

import httpx


class BoomiError(RuntimeError):
    pass


REQUIRED = ("BOOMI_ACCOUNT_ID", "BOOMI_USERNAME", "BOOMI_API_TOKEN")


def boomi_configured() -> list[str]:
    """Return the names of missing Boomi settings (empty list = ready)."""
    return [k for k in REQUIRED if not os.getenv(k)]


class BoomiClient:
    def __init__(self) -> None:
        missing = boomi_configured()
        if missing:
            raise BoomiError(f"Boomi is not configured; set {', '.join(missing)} in .env")
        account = os.environ["BOOMI_ACCOUNT_ID"]
        base = (os.getenv("BOOMI_API_URL") or os.getenv("BOOMI_API_BASE") or "https://api.boomi.com").rstrip("/")
        self.default_atom = os.getenv("BOOMI_DEFAULT_ATOM_ID") or os.getenv("BOOMI_TEST_ATOM_ID")
        self._http = httpx.Client(
            base_url=f"{base}/api/rest/v1/{account}",
            # API-token auth: username is "BOOMI_TOKEN.<user>", password is the token.
            auth=(f"BOOMI_TOKEN.{os.environ['BOOMI_USERNAME']}", os.environ["BOOMI_API_TOKEN"]),
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=30,
            # Use the OS trust store (it carries this network's TLS-inspection CA); certifi's bundle does not.
            verify=os.getenv("BOOMI_CA_BUNDLE") or ("/etc/ssl/certs/ca-certificates.crt"
                                                    if os.path.exists("/etc/ssl/certs/ca-certificates.crt") else True),
        )

    def _call(self, method: str, path: str, **kw: Any) -> httpx.Response:
        try:
            resp = self._http.request(method, path, **kw)
        except httpx.HTTPError as exc:
            raise BoomiError(f"cannot reach Boomi API ({type(exc).__name__}: {exc})") from None
        if resp.status_code >= 400:
            detail = resp.text[:500]
            try:
                detail = resp.json().get("message", detail)
            except ValueError:
                pass
            raise BoomiError(f"Boomi API {resp.status_code}: {detail}")
        return resp

    def execute(self, process_id: str, atom_id: str | None, properties: dict[str, str] | None) -> dict:
        atom = atom_id or self.default_atom
        if not atom:
            raise BoomiError("atom_id not given and BOOMI_TEST_ATOM_ID is not set")
        body: dict[str, Any] = {"@type": "ExecutionRequest", "processId": process_id, "atomId": atom}
        if properties:
            body["DynamicProcessProperties"] = {
                "@type": "",
                "DynamicProcessProperty": [{"@type": "", "name": k, "value": str(v)} for k, v in properties.items()],
            }
        return self._call("POST", "/ExecutionRequest", json=body).json()

    def execution_record(self, request_id: str) -> dict | None:
        """Return the execution record, or None while Boomi is still preparing it (HTTP 202)."""
        resp = self._call("GET", f"/ExecutionRecord/async/{request_id}")
        if resp.status_code == 202 or not resp.content:
            return None
        data = resp.json()
        results = data.get("result") or []
        return results[0] if results else data

    def wait_for(self, request_id: str, timeout_s: int) -> dict | None:
        deadline = time.monotonic() + timeout_s
        record = None
        while time.monotonic() < deadline:
            record = self.execution_record(request_id)
            if record and record.get("status") not in ("INPROCESS", "STARTED", None):
                return record
            time.sleep(3)
        return record

    def query_executions(self, process_id: str, since_hours: float = 24, status: str | None = None,
                         limit: int = 20) -> list[dict]:
        """Recent execution records for one process (newest first)."""
        from datetime import datetime, timedelta, timezone
        now = datetime.now(timezone.utc)
        fmt = "%Y-%m-%dT%H:%M:%SZ"
        exprs: list[dict] = [
            {"operator": "EQUALS", "property": "processId", "argument": [process_id]},
            {"operator": "BETWEEN", "property": "executionTime",
             "argument": [(now - timedelta(hours=since_hours)).strftime(fmt), (now + timedelta(minutes=5)).strftime(fmt)]},
        ]
        if status:
            exprs.append({"operator": "EQUALS", "property": "status", "argument": [status]})
        body = {"QueryFilter": {"expression": {"operator": "and", "nestedExpression": exprs}}}
        rows = self._call("POST", "/ExecutionRecord/query", json=body).json().get("result", []) or []
        rows.sort(key=lambda r: r.get("executionTime", ""), reverse=True)
        return rows[:limit]

