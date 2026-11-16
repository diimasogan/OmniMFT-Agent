"""OmniMFT MCP server: Axway SecureTransport + Boomi tools for an MFT operations agent."""
from __future__ import annotations

import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlparse

from dotenv import load_dotenv
from mcp.server.mcpserver import MCPServer

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

from omnimft.boomi_client import BoomiClient, BoomiError, boomi_configured  # noqa: E402
from omnimft.st_client import STClient, STError, parse_st_date, to_st_date  # noqa: E402

logging.getLogger("httpx").setLevel(logging.WARNING)
mcp = MCPServer("omnimft")
_st: STClient | None = None


def st() -> STClient:
    global _st
    if _st is None:
        _st = STClient()
    return _st


def _err(exc: Exception) -> dict:
    return {"ok": False, "error": str(exc)}


# --------------------------------------------------------------------------
# 1. File tracking
# --------------------------------------------------------------------------
DIAGNOSES: list[tuple[str, str]] = [
    (r"http 404|404 not found", "The receiving endpoint path does not exist (HTTP 404). Check the upload URL path on the "
     "transfer site (for Boomi: /ws/simple/executeStInboundFile), fix it, then resubmit the transfer."),
    (r"transfer site upload failed|status code is: 5\d\d",
     "The receiving endpoint rejected the file. For Boomi routes, check the Boomi execution log of "
     "'OmniMFT API - ST Inbound File' (empty files are rejected by design with ST_INBOUND_REJECTED), "
     "fix the cause, then resubmit from ST."),
    (r"status code is: 403|access denied", "The remote HTTP endpoint refused the request (403). For Boomi, verify the "
     "transfer site is a Generic-HTTP(S) site with the shared web server credentials and the full /ws/simple/... path."),
    (r"authentication fail|password authentication|auth.*denied|login incorrect|530 ",
     "Credentials rejected by the remote host. Update the user/password or key on the transfer site, "
     "or confirm the remote account is not locked."),
    (r"host key|fingerprint", "The remote SSH host key changed or is not trusted. Verify the new fingerprint with "
     "the partner before updating the transfer site."),
    (r"pkix|certificate|handshake|ssl|tls", "TLS trust or handshake failure. Import the partner's CA chain into ST's "
     "trusted store, or check protocol/cipher compatibility."),
    (r"connection refused|timed out|timeout|unknownhost|no route|unreachable",
     "Network-level failure. Check that the remote host and port are reachable from ST (firewall, DNS, DMZ/edge)."),
    (r"no such file|not found|550 ", "Remote folder or file does not exist. Check the upload/download folder on the "
     "transfer site."),
    (r"permission denied|access denied|553 ", "Permission denied on the remote side. Check folder permissions for the "
     "remote user."),
    (r"no space|quota|disk full", "Storage exhausted on the source or target. Free space or raise the quota."),
    (r"virus|icap|infected", "The file was blocked by content scanning (ICAP). Review the scan result before "
     "resubmitting."),
]


def _diagnose(message: str | None) -> str | None:
    if not message:
        return None
    for pattern, hint in DIAGNOSES:
        if re.search(pattern, message, re.I):
            return hint
    return "No known pattern matched. Check the ST Server Log for this transfer's coreId."


def _summarize(row: dict, detail: dict | None = None) -> dict:
    d = detail or {}
    incoming = bool(row.get("incoming"))
    site = (row.get("site") or {}).get("name") or d.get("transferSite")
    site = None if site in ("(none)", "") else site
    remote = row.get("remoteHost") or d.get("remoteHost")
    remote_dir = row.get("remoteDir") or d.get("remoteFolder")
    st_side = f"ST account '{row.get('account')}'" + (f" ({row.get('accountFolder')})" if row.get("accountFolder") else "")
    if incoming:
        sender = f"{row.get('login')}@{remote}" if remote else row.get("login")
        receiver = st_side
    else:
        sender = st_side
        receiver = f"{site or remote}:{remote_dir}" if (site or remote) else remote_dir
    error = d.get("errorMessage")
    # Generic-HTTP(S) failures carry the remote HTTP status only in protocolCommands (e.g. "<< 404 Not Found").
    m = re.search(r"<<\s*(\d{3})[^\n]*", d.get("protocolCommands") or "")
    remote_http = m.group(0).replace("<<", "").strip() if m else None
    return {
        "tracking_id": (row.get("id") or {}).get("mTransferStatusId") or d.get("transferId"),
        "ref": (row.get("id") or {}).get("urlrepresentation"),
        "status": row.get("status") or d.get("status"),
        "direction": "inbound" if incoming else "outbound",
        "initiated_by": "ST (server-initiated)" if row.get("serverInitiated") else "partner (client-initiated)",
        "filename": row.get("filename") or d.get("file"),
        "size_bytes": row.get("filesize"),
        "protocol": row.get("protocol"),
        "sender": sender,
        "receiver": receiver,
        "transfer_site": site,
        "application": row.get("application") or d.get("application"),
        "start_time": row.get("startTime"),
        "duration": row.get("duration"),
        "resubmitted": row.get("resubmitted"),
        "resubmittable": row.get("isResubmittable"),
        "core_id": row.get("coreId"),
        "error_message": error,
        "remote_http_status": remote_http,
        "diagnosis": _diagnose(f"{error or ''} HTTP {remote_http or ''}") if (row.get("status") or "").lower() in ("failed", "aborted") or error else None,
    }


def _detail(ref: str | None) -> dict | None:
    if not ref:
        return None
    try:
        return st().get(f"/logs/transfers/{ref}")
    except STError:
        return None


@mcp.tool()
def check_secure_transport_status(
    tracking_id: str | None = None,
    filename: str | None = None,
    account: str | None = None,
    status: Literal["Processed", "Failed", "In Progress", "Aborted", "Paused", "Waiting"] | None = None,
    since_hours: float | None = None,
    limit: int = 10,
) -> dict:
    """Track file transfers in Axway SecureTransport (File Tracking / transfer log).

    Look up one transfer by tracking_id (transfer status ID, coreId, or the 'ref' value returned earlier),
    or search by filename (glob, e.g. '*.csv'), account, status and time window. Failed transfers include
    the ST error message and a diagnosis.
    """
    try:
        limit = max(1, min(limit, 100))
        if tracking_id:
            tid = tracking_id.strip()
            if len(tid) > 60 and re.fullmatch(r"[A-Za-z0-9+/=_-]+", tid):  # an ST urlrepresentation
                detail = st().get(f"/logs/transfers/{tid}")
                row = {"id": {"mTransferStatusId": detail.get("transferId"), "urlrepresentation": tid}, **detail}
                return {"ok": True, "count": 1, "transfers": [_summarize(row, detail)]}
            for row in st().paginate("/logs/transfers", max_items=2000, account=account):
                ids = (row.get("id") or {}).get("mTransferStatusId"), row.get("coreId"), row.get("cycleId")
                if tid in ids:
                    return {"ok": True, "count": 1,
                            "transfers": [_summarize(row, _detail(row["id"]["urlrepresentation"]))]}
            return {"ok": True, "count": 0, "transfers": [],
                    "note": f"No transfer with id '{tid}' among the 2000 most recent records."}

        params: dict[str, Any] = {"filename": filename, "account": account, "status": status}
        if since_hours:
            params["startTimeAfter"] = to_st_date(datetime.now(timezone.utc).astimezone() - timedelta(hours=since_hours))
        data = st().get("/logs/transfers", limit=limit, **params)
        rows = data.get("result", [])
        out = []
        for row in rows:
            needs_detail = (row.get("status") or "").lower() in ("failed", "aborted")
            out.append(_summarize(row, _detail(row["id"]["urlrepresentation"]) if needs_detail else None))
        return {"ok": True, "count": len(out), "total_matching": data.get("resultSet", {}).get("totalCount"),
                "transfers": out}
    except STError as exc:
        return _err(exc)


# --------------------------------------------------------------------------
# 2. Certificate / key expiry guard
# --------------------------------------------------------------------------
def _openssl_subj(subject: str | None) -> str:
    parts = [p.strip() for p in (subject or "").split(",") if "=" in p]
    return "/" + "/".join(parts) if parts else "/CN=CHANGE_ME"


def _remediation(c: dict) -> dict:
    name = re.sub(r"[^A-Za-z0-9_.-]", "_", c.get("name") or "key")
    ctype, usage = (c.get("type") or "").lower(), (c.get("usage") or "").lower()
    if ctype == "x509" and usage == "trusted":
        return {"action": "Obtain the renewed CA/partner certificate from the issuer and import it into ST "
                          "(Certificates > Trusted CAs). Do not delete the old one until the partner switches.",
                "wsl_commands": [f"openssl x509 -in renewed_{name}.crt -noout -subject -enddate -fingerprint -sha256"]}
    if ctype == "x509":
        algo = "ec -pkeyopt ec_paramgen_curve:P-256" if (c.get("keyAlgorithm") or "").upper().startswith("EC") \
            else f"rsa:{max(int(c.get('keySize') or 2048), 2048)}"
        return {"action": "Generate a new key + CSR, have it signed by your CA, import the signed certificate into ST, "
                          "then re-point servers/sites that use the old certificate.",
                "wsl_commands": [f"openssl req -new -newkey {algo} -nodes -keyout {name}.key -out {name}.csr "
                                 f"-subj '{_openssl_subj(c.get('subject'))}'"]}
    if ctype == "ssh":
        return {"action": "Generate a new SSH key pair, import it into ST, and send the public key to the partner.",
                "wsl_commands": [f"ssh-keygen -t ed25519 -f {name} -C 'ST {name}' -N ''"]}
    if ctype == "pgp":
        return {"action": "Extend the PGP key expiry (or generate a new key) and send the updated public key to "
                          "partners, then re-import into ST.",
                "wsl_commands": ["gpg --list-keys --with-subkey-fingerprints",
                                 "gpg --quick-set-expire <FINGERPRINT> 1y", "gpg --armor --export <FINGERPRINT> > "
                                 f"{name}.asc"]}
    return {"action": "Renew this key/certificate following its issuer's process.", "wsl_commands": []}


@mcp.tool()
def check_security_certificates(
    within_days: int = 30,
    cert_type: Literal["x509", "ssh", "pgp"] | None = None,
    usage: str | None = None,
    account: str | None = None,
    include_ok: bool = False,
) -> dict:
    """Audit SSL/TLS certificates, SSH keys and PGP keys stored in SecureTransport for expiry.

    Flags anything already EXPIRED or EXPIRING within `within_days` (default 30) and proposes WSL
    remediation commands (they are suggestions only and are never executed by this tool).
    """
    try:
        now = datetime.now(timezone.utc)
        horizon = now + timedelta(days=within_days)
        expired, expiring, ok, no_expiry = [], [], [], 0
        for c in st().paginate("/certificates", type=cert_type, usage=usage, account=account):
            exp = parse_st_date(c.get("expirationTime"))
            if exp is None:
                no_expiry += 1
                continue
            item = {"name": c.get("name"), "type": c.get("type"), "usage": c.get("usage"),
                    "account": c.get("account"), "subject": c.get("subject"), "issuer": c.get("issuer"),
                    "expires": c.get("expirationTime"), "days_left": (exp - now).days,
                    "validation_status": c.get("validationStatus")}
            if exp <= now:
                expired.append({**item, "severity": "CRITICAL", "remediation": _remediation(c)})
            elif exp <= horizon:
                expiring.append({**item, "severity": "WARNING", "remediation": _remediation(c)})
            elif include_ok:
                ok.append(item)
        expired.sort(key=lambda x: x["days_left"])
        expiring.sort(key=lambda x: x["days_left"])
        result = {"ok": True, "checked_at": now.isoformat(timespec="seconds"), "window_days": within_days,
                  "summary": {"expired": len(expired), "expiring": len(expiring),
                              "healthy": len(ok) if include_ok else None, "no_expiry_date": no_expiry},
                  "expired": expired, "expiring": expiring}
        if include_ok:
            result["healthy"] = sorted(ok, key=lambda x: x["days_left"])
        return result
    except STError as exc:
        return _err(exc)


# --------------------------------------------------------------------------
# 3. Boomi orchestration
# --------------------------------------------------------------------------
@mcp.tool()
def trigger_boomi_process(
    process_id: str,
    atom_id: str | None = None,
    dynamic_properties: dict[str, str] | None = None,
    wait_seconds: int = 0,
) -> dict:
    """Execute a deployed Boomi process (e.g. after a file lands in ST, or to reprocess one).

    dynamic_properties are passed as Dynamic Process Properties (e.g. {"st_filename": "...",
    "st_tracking_id": "..."}). If wait_seconds > 0, polls the execution record until it finishes.
    """
    try:
        client = BoomiClient()
        req = client.execute(process_id, atom_id, dynamic_properties)
        out = {"ok": True, "request_id": req.get("requestId"), "record_url": req.get("recordUrl")}
        if wait_seconds > 0 and out["request_id"]:
            rec = client.wait_for(out["request_id"], min(wait_seconds, 300))
            out["execution"] = {k: rec.get(k) for k in ("executionId", "status", "message", "executionTime",
                                                        "inboundDocumentCount", "outboundDocumentCount",
                                                        "executionDuration")} if rec else "still pending"
        return out
    except BoomiError as exc:
        return _err(exc)


@mcp.tool()
def get_boomi_execution_status(request_id: str) -> dict:
    """Get the status of a Boomi execution started by trigger_boomi_process (by its request_id)."""
    try:
        rec = BoomiClient().execution_record(request_id)
        return {"ok": True, "pending": rec is None, "execution": rec}
    except BoomiError as exc:
        return _err(exc)


@mcp.tool()
def resubmit_transfer(ref: str) -> dict:
    """Resubmit (re-run) an ST transfer, e.g. a failed push to Boomi after the cause is fixed.

    `ref` is the 'ref' value returned by check_secure_transport_status. Only call after the user confirms.
    """
    try:
        if not re.fullmatch(r"[A-Za-z0-9+/=_-]{40,400}", ref or ""):
            return _err(ValueError("ref must be the 'ref' value from check_secure_transport_status"))
        detail = st().get(f"/logs/transfers/{ref}")
        target_ref, via = ref, "this transfer"
        if not detail.get("isResubmittable", True):
            # Basic Application auto-push: the failed outbound push is not resubmittable itself; resubmitting the
            # original partner upload (same coreId) re-runs the subscription and pushes the file again.
            core = detail.get("coreId")
            target_ref = None
            for row in st().paginate("/logs/transfers", max_items=500, account=detail.get("account")):
                if row.get("coreId") == core and row.get("incoming") and row.get("isResubmittable"):
                    target_ref, via = row["id"]["urlrepresentation"], "the original partner upload (same coreId)"
                    break
            if not target_ref:
                return _err(ValueError("ST reports this transfer is not resubmittable and no resubmittable original upload was found"))
        resp = st()._request("POST", f"/logs/transfers/{target_ref}/operations", params={"operation": "resubmit"})
        body = resp.json() if resp.content else {}
        return {"ok": True, "filename": detail.get("file"), "account": detail.get("account"),
                "previous_status": detail.get("status"), "resubmitted": via, "st_response": body}
    except STError as exc:
        return _err(exc)


BOOMI_INBOUND_PROCESS_ID = os.getenv("BOOMI_INBOUND_PROCESS_ID", "115d58f8-ac63-47ed-8b12-feeed7fc74be")


@mcp.tool()
def get_boomi_inbound_history(since_hours: float = 24, status: Literal["COMPLETE", "ERROR"] | None = None,
                              limit: int = 20) -> dict:
    """List recent executions of the Boomi listener that receives files from ST ('OmniMFT API - ST Inbound File').

    ERROR rows carry Boomi's message (e.g. ST_INBOUND_REJECTED for empty files). Use with
    check_secure_transport_status to correlate both sides of a transfer by time and account.
    """
    try:
        rows = BoomiClient().query_executions(BOOMI_INBOUND_PROCESS_ID, since_hours, status, max(1, min(limit, 100)))
        keep = ("executionId", "status", "executionTime", "executionDuration", "message",
                "inboundDocumentCount", "outboundDocumentCount")
        return {"ok": True, "count": len(rows), "executions": [{k: r.get(k) for k in keep} for r in rows]}
    except BoomiError as exc:
        return _err(exc)


# --------------------------------------------------------------------------
# 4. Partner onboarding / use-case provisioning
# --------------------------------------------------------------------------
NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]{2,63}$")
SECRETS_DIR = ROOT / "secrets"


def _mask(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: ("********" if k.lower().endswith("password") and v else _mask(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_mask(v) for v in obj]
    return obj


def _store_secret(partner: str, text: str) -> str:
    SECRETS_DIR.mkdir(mode=0o700, exist_ok=True)
    path = SECRETS_DIR / f"{partner}.txt"
    path.write_text(text)
    path.chmod(0o600)
    return str(path)


def _find_id(collection: str, account: str, match: dict) -> str | None:
    for row in st().paginate(f"/{collection}", account=account):
        if all(row.get(k) == v for k, v in match.items()):
            return row.get("id")
    return None


def _sftp_port() -> int | None:
    try:
        for srv in st().get("/servers", limit=50).get("result", []):
            if srv.get("protocol") == "ssh" and srv.get("isActive"):
                return int(srv["port"])
    except (STError, ValueError, KeyError):
        pass
    return None


PROFILES_F = ROOT / "config" / "route_profiles.json"
AR_APPLICATION = os.getenv("ST_AR_APPLICATION", "Advance Routing")


def _profiles() -> dict:
    import json as _json
    try:
        return _json.loads(PROFILES_F.read_text())
    except (OSError, ValueError):
        return {}


def _find_route_id(name: str, rtype: str) -> str | None:
    for row in st().paginate("/routes", name=name):
        if row.get("name") == name and row.get("type") == rtype:
            return row.get("id")
    return None


def _boomi_site(partner: str, url: str, user: str | None, pwd: str | None) -> dict:
    # Generic-HTTP(S) plugin site: raw-body PUT to a REST endpoint (the native ST "http" site speaks the
    # ST-to-ST protocol, POSTing to "/" first, which Boomi's cloud load balancer rejects with 403).
    # The plugin always wraps the file as multipart/form-data with the file name in Content-Disposition;
    # the Boomi listener unwraps it. The partner account rides as ?account=.
    u = urlparse(url)
    sep = "&" if u.query else "?"
    path = (u.path or "/") + (f"?{u.query}" if u.query else "") + f"{sep}account={partner}"
    site = {
        "type": "http-generic", "protocol": "http-generic", "name": f"{partner}_to_boomi",
        "account": partner, "default": False, "accessLevel": "PRIVATE",
        "ghttpUseUriEnabled": False, "ghttpHost": u.hostname,
        "ghttpPort": u.port or (443 if u.scheme == "https" else 80), "ghttpNetworkZone": "none",
        "ghttpSecureHttpEnabled": u.scheme == "https",
        "ghttpVerifyCertificateEnabled": os.getenv("ST_VERIFY_PARTNER_TLS", "true").lower() == "true",
        "ghttpUploadMethod": "PUT", "ghttpUploadUrlPath": path,
        "ghttpUploadHeaders": "Content-Type=application/octet-stream#!#CVD#!#",  # ST list encoding
        "ghttpConnectTimeout": "25", "ghttpReceiveTimeout": "60",
    }
    if user:
        site.update({"ghttpUserName": user, "ghttpUsePasswordEnabled": True, "ghttpPassword": pwd or ""})
    return site


def _ssh_site(partner: str, profile_name: str, prof: dict) -> dict:
    # Modelled on the working RTGS site 02_ts_ssh_to_inbox. Host-key pinning stays off like that site.
    return {
        "type": "ssh", "protocol": "ssh", "name": f"{partner}_to_{profile_name}", "account": partner,
        "default": False, "accessLevel": "PRIVATE", "host": prof["host"], "port": str(prof.get("port", "22")),
        "uploadFolder": prof["upload_folder"], "uploadFolderOverridable": False,
        "userName": prof["user"], "usePassword": True, "usePasswordExpr": False,
        "password": os.getenv(prof.get("password_env", ""), ""),
        "verifyFinger": False, "transferMode": "AUTO_DETECT", "dmz": "none", "uploadPermissions": "0644",
    }


@mcp.tool()
def create_secure_transport_usecase(
    partner_name: str,
    inbound_folder: str = "inbound",
    route: Literal["boomi", "ssh", "both"] = "boomi",
    ssh_profile: str = "inbox_lab",
    boomi_endpoint_url: str | None = None,
    boomi_endpoint_user: str | None = None,
    boomi_endpoint_password: str | None = None,
    partner_password: str | None = None,
    dry_run: bool = True,
) -> dict:
    """Onboard a new SFTP partner in SecureTransport and route its uploads.

    route="boomi": Generic-HTTP(S) site to the Boomi listener + Basic Application subscription (auto-push).
    route="ssh":   SSH/SFTP site to a registered target profile (config/route_profiles.json) + Basic subscription.
    route="both":  both sites + Advanced Routing subscription, with SIMPLE/TEMPLATE/COMPOSITE routes whose
                   Send To Partner step delivers every file to the Boomi site AND the SSH site.
    SSH targets come only from registered profiles (credentials in .env), never from chat.
    dry_run=True (default) only returns the plan. Re-run with dry_run=False ONLY after the user confirms.
    On failure, every object created so far is rolled back. A generated partner password is written to
    secrets/<partner>.txt (mode 600) and never returned.
    """
    if not NAME_RE.match(partner_name):
        return _err(ValueError("partner_name must start with a letter, 3-64 chars of letters, digits, _ . -"))
    if route not in ("boomi", "ssh", "both"):
        return _err(ValueError("route must be boomi, ssh or both"))
    folder = "/" + inbound_folder.strip("/")
    home_root = os.getenv("ST_HOME_ROOT", "/STData").rstrip("/")
    generated = partner_password is None
    password = partner_password or secrets.token_urlsafe(18)

    sites: list[dict] = []
    if route in ("boomi", "both"):
        url = boomi_endpoint_url or os.getenv("OMNIMFT_BOOMI_ENDPOINT",
                                              "https://c01-sg.integrate-test.boomi.com/ws/simple/executeStInboundFile")
        u = urlparse(url)
        if u.scheme not in ("http", "https") or not u.hostname:
            return _err(ValueError("boomi_endpoint_url must be an http(s) URL"))
        sites.append(_boomi_site(partner_name, url, boomi_endpoint_user or os.getenv("SERVER_USERNAME"),
                                 boomi_endpoint_password or os.getenv("SERVER_TOKEN")))
    if route in ("ssh", "both"):
        profiles = _profiles()
        prof = profiles.get(ssh_profile)
        if not prof:
            return _err(ValueError(f"unknown ssh_profile '{ssh_profile}'; registered: {sorted(profiles)}"))
        if not os.getenv(prof.get("password_env", "")):
            return _err(ValueError(f"credential for profile '{ssh_profile}' is not set on the OmniMFT host"))
        sites.append(_ssh_site(partner_name, ssh_profile, prof))

    account_payload = {
        "type": "user", "name": partner_name, "homeFolder": f"{home_root}/{partner_name}",
        "homeFolderAccessLevel": "PRIVATE", "uid": os.getenv("ST_DEFAULT_UID", "7000"),
        "gid": os.getenv("ST_DEFAULT_GID", "7001"), "disabled": False,
        "user": {"name": partner_name, "passwordCredentials": {"password": password, "forcePasswordChange": False}},
    }
    route_name = f"{partner_name}_omnimft_route"
    if route == "both":
        sub_payload = {"type": "AdvancedRouting", "folder": folder, "account": partner_name,
                       "application": AR_APPLICATION, "transferConfigurations": [{"tag": "PARTNER-IN", "outbound": False}]}
        site_list = "".join(f"{x['name']}#!#CVD#!#" for x in sites)
        simple_payload = {"name": route_name, "type": "SIMPLE", "description": f"OmniMFT fan-out for {partner_name}",
                          "conditionType": "ALWAYS", "condition": "true", "steps": [{
                              "type": "SendToPartner", "status": "ENABLED", "autostart": False,
                              "conditionType": "ALWAYS", "condition": "", "actionOnStepSuccess": "PROCEED",
                              "actionOnStepFailure": "FAIL", "fileFilterExpression": "*", "fileFilterExpressionType": "GLOB",
                              "targetAccountExpression": partner_name, "targetAccountExpressionType": "EXPRESSION",
                              "transferSiteExpression": site_list, "transferSiteExpressionType": "LIST",
                              "usePrecedingStepFiles": False, "maxNumberOfRetries": 5, "maxParallelClients": 4,
                              "sleepBetweenRetries": 3000, "sleepIncrementBetweenRetries": 2000}]}
        template_payload = {"name": route_name, "type": "TEMPLATE", "description": f"OmniMFT routes for {partner_name}",
                            "conditionType": "MATCH_ALL", "steps": [{"type": "ExecuteRoute", "status": "ENABLED",
                                                                     "executeRoute": "<simple route id>"}]}
        composite_payload = {"name": route_name, "type": "COMPOSITE", "account": partner_name,
                             "routeTemplate": "<template route id>", "conditionType": "MATCH_ALL", "condition": "true",
                             "subscriptions": ["<subscription id>"]}
    else:
        sub_payload = {"type": "Basic", "folder": folder, "account": partner_name, "application": "Basic Application",
                       "transferConfigurations": [{"tag": "PARTNER-IN", "outbound": False},
                                                  {"tag": "PARTNER-OUT", "outbound": True, "site": sites[0]["name"]}]}

    plan = [{"step": 1, "action": "create account", "endpoint": "POST /accounts", "payload": _mask(account_payload)}]
    for x in sites:
        what = "Generic-HTTP(S) transfer site (PUT) to Boomi" if x["type"] == "http-generic" else \
            f"SSH transfer site to profile '{ssh_profile}' ({x['host']}:{x['port']}{x['uploadFolder']})"
        plan.append({"step": len(plan) + 1, "action": f"create {what}", "endpoint": "POST /sites", "payload": _mask(x)})
    if route == "both":
        plan.append({"step": len(plan) + 1, "action": f"subscribe {folder} to {AR_APPLICATION}", "endpoint": "POST /subscriptions", "payload": sub_payload})
        plan.append({"step": len(plan) + 1, "action": "create SIMPLE route: Send To Partner -> " + " + ".join(x["name"] for x in sites),
                     "endpoint": "POST /routes", "payload": simple_payload})
        plan.append({"step": len(plan) + 1, "action": "create TEMPLATE route (executes the SIMPLE route)", "endpoint": "POST /routes", "payload": template_payload})
        plan.append({"step": len(plan) + 1, "action": "create COMPOSITE route binding the account and subscription", "endpoint": "POST /routes", "payload": composite_payload})
    else:
        plan.append({"step": len(plan) + 1, "action": f"subscribe {folder} to Basic Application (auto-push to {sites[0]['name']})",
                     "endpoint": "POST /subscriptions", "payload": sub_payload})
    notes = [f"route={route}" + (f", ssh_profile={ssh_profile}" if route != "boomi" else ""),
             "Partner password: " + ("generated and saved to secrets/ (not shown)." if generated else "provided by the user.")]

    leftovers: list[tuple[str, str]] = []
    try:
        if st().exists(f"/accounts/{partner_name}"):
            return _err(ValueError(f"account '{partner_name}' already exists in SecureTransport"))
        # Routes left behind when an OmniMFT partner account was deleted outside OmniMFT: the COMPOSITE route goes
        # with the account, but the account-less SIMPLE/TEMPLATE routes stay. Clean those up; refuse real conflicts.
        if _find_route_id(route_name, "COMPOSITE"):
            return _err(ValueError(f"route '{route_name}' is still bound to an account in SecureTransport"))
        for rtype in ("TEMPLATE", "SIMPLE"):
            rid = _find_route_id(route_name, rtype)
            if rid:
                leftovers.append((rtype, rid))
    except STError as exc:
        return _err(exc)
    if leftovers:
        plan.insert(0, {"step": 0, "action": "remove leftover OmniMFT routes from a previous onboarding of this partner "
                        "(not bound to any account): " + ", ".join(f"{t} {route_name}" for t, _ in leftovers),
                        "endpoint": "DELETE /routes/{id}"})
        notes.append("Leftover routes from an earlier onboarding of this name will be removed first.")
    if dry_run:
        return {"ok": True, "dry_run": True, "route": route, "plan": plan, "notes": notes,
                "next": "Ask the user to confirm, then call again with dry_run=False."}

    for rtype, rid in leftovers:  # TEMPLATE first: deleting it cascades the SIMPLE route
        try:
            st().delete(f"/routes/{rid}")
        except STError as exc:
            if exc.status != 404:
                return _err(exc)
    created: list[str] = []
    try:
        st().post("/accounts", account_payload)
        created.append(f"/accounts/{partner_name}")
        for x in sites:
            st().post("/sites", x)
            sid = _find_id("sites", partner_name, {"name": x["name"]})
            if not sid:
                raise STError(0, f"site {x['name']} was created but its id could not be found")
            created.append(f"/sites/{sid}")
        st().post("/subscriptions", sub_payload)  # ST references sites by name in transfer configurations
        sub_id = _find_id("subscriptions", partner_name, {"folder": folder})
        if not sub_id:
            raise STError(0, "subscription was created but its id could not be found")
        created.append(f"/subscriptions/{sub_id}")
        if route == "both":
            st().post("/routes", simple_payload)
            simple_id = _find_route_id(route_name, "SIMPLE")
            if not simple_id:
                raise STError(0, "SIMPLE route id not found after create")
            created.append(f"/routes/{simple_id}")
            template_payload["steps"][0]["executeRoute"] = simple_id
            st().post("/routes", template_payload)
            template_id = _find_route_id(route_name, "TEMPLATE")
            if not template_id:
                raise STError(0, "TEMPLATE route id not found after create")
            created.append(f"/routes/{template_id}")
            composite_payload.update(routeTemplate=template_id, subscriptions=[sub_id])
            st().post("/routes", composite_payload)
            comp_id = _find_route_id(route_name, "COMPOSITE")
            if not comp_id:
                raise STError(0, "COMPOSITE route id not found after create")
            created.append(f"/routes/{comp_id}")
        secret_file = _store_secret(partner_name, f"account={partner_name}\npassword={password}\n") if generated else None
        return {"ok": True, "dry_run": False, "route": route, "created": created, "secret_file": secret_file, "notes": notes,
                "delivers_to": [x["name"] for x in sites],
                "partner_connection": {"protocol": "SFTP", "host": urlparse(os.environ["ST_BASE_URL"]).hostname,
                                       "port": _sftp_port(), "user": partner_name, "upload_to": folder}}
    except STError as exc:
        rollback = []
        for path in reversed(created):
            try:
                st().delete(path)
                rollback.append(f"deleted {path}")
            except STError as rexc:
                # 404 = already gone (ST cascades a SIMPLE route away with its TEMPLATE route)
                rollback.append(f"already removed {path}" if rexc.status == 404 else f"FAILED to delete {path}: {rexc}")
        return {"ok": False, "error": str(exc), "rolled_back": rollback}


def _site_target(site: dict) -> str:
    cp = site.get("customProperties") or {}
    if site.get("protocol") == "http-generic":
        return f"https://{cp.get('ghttpHost')}:{cp.get('ghttpPort')}{cp.get('ghttpUploadUrlPath', '')}"
    if site.get("protocol") == "ssh":
        return f"sftp://{site.get('userName')}@{site.get('host')}:{site.get('port')}{site.get('uploadFolder') or ''}"
    return site.get("protocol") or "?"


def _check_one_partner(name: str, routes_by_name: dict) -> dict:
    expected_boomi_path = urlparse(os.getenv("OMNIMFT_BOOMI_ENDPOINT",
                                             "https://c01-sg.integrate-test.boomi.com/ws/simple/executeStInboundFile")).path
    route_name = f"{name}_omnimft_route"
    routes = {r["type"]: r for r in routes_by_name.get(route_name, [])}
    findings: list[dict] = []
    add = lambda sev, what, fix: findings.append({"severity": sev, "finding": what, "fix": fix})
    exists = st().exists(f"/accounts/{name}")
    result = {"partner": name, "account_exists": exists, "routes_found": sorted(routes)}
    if not exists:
        if routes:
            add("WARNING", f"Account is gone but OmniMFT routes remain ({', '.join(sorted(routes))}) - the partner was "
                "deleted outside OmniMFT.", "Re-onboarding the same name cleans them up automatically.")
            result.update(status="ORPHANED_ROUTES", findings=findings)
        else:
            result.update(status="NOT_FOUND", findings=[])
        return result
    acc = st().get(f"/accounts/{name}")
    if acc.get("disabled"):
        add("CRITICAL", "Account is disabled - the partner cannot log in.", "Enable the account in ST.")
    if acc.get("user", {}).get("locked"):
        add("WARNING", "User is locked after failed logins.", "Unlock the user in ST.")
    sites = st().get("/sites", account=name).get("result", [])
    subs = st().get("/subscriptions", account=name).get("result", [])
    site_names = {x["name"] for x in sites}
    boomi = [x for x in sites if x.get("protocol") == "http-generic" and x["name"].endswith("_to_boomi")]
    sshs = [x for x in sites if x.get("protocol") == "ssh" and x["name"].startswith(f"{name}_to_")]
    ar = [x for x in subs if x.get("type") == "AdvancedRouting"]
    basic = [x for x in subs if x.get("type") == "Basic"]
    route = "both" if (ar or routes) else "boomi" if boomi and not sshs else "ssh" if sshs and not boomi else \
        "both" if boomi and sshs else "unknown"
    result.update(route=route, sites=[{"name": x["name"], "protocol": x.get("protocol"), "target": _site_target(x)} for x in sites],
                  subscriptions=[{"type": x.get("type"), "folder": x.get("folder"),
                                  "pushes_to": [t.get("site") for t in x.get("transferConfigurations", []) if t.get("outbound")]}
                                 for x in subs])
    for x in boomi:
        path = ((x.get("customProperties") or {}).get("ghttpUploadUrlPath") or "").split("?")[0]
        if path != expected_boomi_path:
            add("CRITICAL", f"Boomi site {x['name']} points to '{path}' instead of '{expected_boomi_path}' - pushes will fail (HTTP 404).",
                "Correct the upload URL path on the transfer site, then resubmit failed transfers.")
    if route in ("boomi", "both") and not boomi:
        add("CRITICAL", "Boomi transfer site is missing.", "Re-create the partner (offboard + onboard) or add the site in ST.")
    if route in ("ssh", "both") and not sshs:
        add("CRITICAL", "SSH delivery site is missing.", "Re-create the partner or add the site in ST.")
    if not subs:
        add("CRITICAL", "No subscription - uploaded files are not forwarded anywhere.", "Add the subscription or re-onboard the partner.")
    for x in basic:
        for t in x.get("transferConfigurations", []):
            if t.get("outbound") and t.get("site") and t["site"] not in site_names:
                add("CRITICAL", f"Subscription {x.get('folder')} pushes to site '{t['site']}', which no longer exists.",
                    "Re-create the site or re-onboard the partner.")
            if t.get("outbound") and not t.get("site"):
                add("CRITICAL", f"Subscription {x.get('folder')} has no outbound site.", "Assign the delivery site in ST.")
    if route == "both":
        for t in ("SIMPLE", "TEMPLATE", "COMPOSITE"):
            if t not in routes:
                add("CRITICAL", f"Advanced Routing {t} route '{route_name}' is missing - files are not fanned out.",
                    "Re-onboard the partner to rebuild the routes.")
        comp = routes.get("COMPOSITE")
        if comp:
            d = st().get(f"/routes/{comp['id']}")
            if d.get("account") != name or not d.get("subscriptions"):
                add("CRITICAL", "COMPOSITE route is not bound to this account/subscription.", "Re-onboard the partner.")
        simple = routes.get("SIMPLE")
        if simple:
            d = st().get(f"/routes/{simple['id']}")
            targets = [n for stp in d.get("steps", []) for n in (stp.get("transferSiteExpression") or "").split("#!#CVD#!#") if n]
            for n in targets:
                if n not in site_names:
                    add("CRITICAL", f"Route sends to site '{n}', which no longer exists.", "Re-onboard the partner.")
        if not ar:
            add("CRITICAL", "Advanced Routing subscription is missing.", "Re-onboard the partner.")
    if not (SECRETS_DIR / f"{name}.txt").exists():
        add("INFO", "Partner password file is not on the OmniMFT host (created elsewhere or removed).",
            "Reset the partner password in ST if it is needed.")
    crit = any(f["severity"] == "CRITICAL" for f in findings)
    result.update(status="INCOMPLETE" if crit else "COMPLETE", findings=findings)
    return result


@mcp.tool()
def check_partner_setup(partner_name: str | None = None) -> dict:
    """Read-only health check of OmniMFT partner configuration in SecureTransport.

    With partner_name: verifies account, transfer sites (and their targets), subscription and Advanced Routing routes
    for its route (boomi/ssh/both) and reports COMPLETE / INCOMPLETE / NOT_FOUND / ORPHANED_ROUTES with findings and
    fixes. Without partner_name: checks every OmniMFT partner (accounts with *_to_boomi / profile sites, and partners
    that only have leftover *_omnimft_route routes). Never changes anything.
    """
    try:
        routes_by_name: dict = {}
        for r in st().paginate("/routes"):
            if r.get("name", "").endswith("_omnimft_route"):
                routes_by_name.setdefault(r["name"], []).append(r)
        if partner_name:
            return {"ok": True, **_check_one_partner(partner_name.strip(), routes_by_name)}
        profiles = set(_profiles())
        names = set()
        for x in st().paginate("/sites", max_items=2000):
            n = x.get("name", "")
            if n.endswith("_to_boomi") or any(n.endswith(f"_to_{p}") for p in profiles):
                names.add(x.get("account"))
        names |= {k[: -len("_omnimft_route")] for k in routes_by_name}
        reports = [_check_one_partner(n, routes_by_name) for n in sorted(x for x in names if x)]
        summary = {}
        for r in reports:
            summary[r["status"]] = summary.get(r["status"], 0) + 1
        return {"ok": True, "partners_checked": len(reports), "summary": summary,
                "partners": [{k: r.get(k) for k in ("partner", "status", "route", "findings")} for r in reports]}
    except STError as exc:
        return _err(exc)


@mcp.tool()
def omnimft_health() -> dict:
    """Check connectivity to SecureTransport and whether Boomi credentials are configured."""
    out: dict[str, Any] = {}
    try:
        v = st().get("/version")
        out["secure_transport"] = {"ok": True, "version": v.get("version"), "update": v.get("updateLevel")}
    except STError as exc:
        out["secure_transport"] = _err(exc)
    missing = boomi_configured()
    out["boomi"] = {"configured": not missing, "missing": missing}
    return out


if __name__ == "__main__":
    mcp.run()
