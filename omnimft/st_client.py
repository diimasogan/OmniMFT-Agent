"""Thin client for the Axway SecureTransport Admin REST API (v2.0)."""
from __future__ import annotations

import os
from datetime import datetime
from email.utils import format_datetime, parsedate_to_datetime
from typing import Any, Iterator

import httpx


class STError(RuntimeError):
    """Raised when ST returns an error. Never carries credentials."""

    def __init__(self, status: int, message: str, details: list[str] | None = None):
        self.status = status
        self.details = details or []
        super().__init__(f"ST API {status}: {message}" + (f" — {'; '.join(self.details)}" if self.details else ""))


def _truthy(v: str | None, default: bool = True) -> bool:
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def parse_st_date(value: str | None) -> datetime | None:
    """ST returns RFC 2822 dates, e.g. 'Tue, 31 Dec 2030 23:59:59 +0700'."""
    if not value:
        return None
    try:
        return parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None


def to_st_date(dt: datetime) -> str:
    return format_datetime(dt)


class STClient:
    def __init__(self) -> None:
        base = os.environ["ST_BASE_URL"].rstrip("/")
        version = os.getenv("ST_API_VERSION", "v2.0")
        ca_bundle = os.getenv("ST_CA_BUNDLE")
        verify: bool | str = ca_bundle if ca_bundle else _truthy(os.getenv("ST_VERIFY_TLS"), True)
        self.base_url = f"{base}/api/{version}"
        self._http = httpx.Client(
            base_url=self.base_url,
            auth=(os.environ["ST_USERNAME"], os.environ["ST_PASSWORD"]),
            verify=verify,
            timeout=float(os.getenv("ST_TIMEOUT", "30")),
            headers={"Accept": "application/json"},
        )

    # ---- low level -------------------------------------------------------
    def _request(self, method: str, path: str, **kw: Any) -> httpx.Response:
        # ST ties session cookies to CSRF tokens; stay stateless (Basic Auth on every call).
        self._http.cookies.clear()
        try:
            resp = self._http.request(method, path, **kw)
        except httpx.HTTPError as exc:
            raise STError(0, f"cannot reach SecureTransport ({type(exc).__name__}: {exc})") from None
        if resp.status_code >= 400:
            msg, details = resp.reason_phrase, []
            try:
                body = resp.json()
                msg = body.get("message", msg)
                details = body.get("validationErrors") or []
            except ValueError:
                msg = resp.text.strip()[:300] or msg
            raise STError(resp.status_code, msg, details)
        return resp

    def get(self, path: str, **params: Any) -> dict:
        resp = self._request("GET", path, params={k: v for k, v in params.items() if v is not None})
        return resp.json() if resp.content else {}

    def exists(self, path: str) -> bool:
        try:
            self._request("GET", path)
            return True
        except STError as exc:
            if exc.status == 404:
                return False
            raise

    def post(self, path: str, payload: dict) -> httpx.Response:
        return self._request("POST", path, json=payload)

    def delete(self, path: str) -> None:
        self._request("DELETE", path)

    def paginate(self, path: str, page_size: int = 100, max_items: int = 5000, **params: Any) -> Iterator[dict]:
        offset = 0
        while offset < max_items:
            data = self.get(path, limit=page_size, offset=offset, **params)
            rows = data.get("result", [])
            yield from rows
            total = data.get("resultSet", {}).get("totalCount", 0)
            offset += len(rows)
            if not rows or offset >= total:
                return
