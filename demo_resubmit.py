"""Prepare a realistic 'fixable failure' for demoing resubmit in OmniMFT Ops Copilot.

Scenario: the Boomi endpoint on the partner's transfer site is misconfigured, so ST's push fails. After the
operator fixes the site, the agent resubmits the transfer and the file reaches Boomi.

  .venv/bin/python demo_resubmit.py prepare   # create partner demo_resubmit (if needed), break its Boomi path, upload a file
  .venv/bin/python demo_resubmit.py status    # show the partner's transfers
  .venv/bin/python demo_resubmit.py fix       # restore the correct Boomi path (then ask the agent to resubmit)
  .venv/bin/python demo_resubmit.py cleanup   # delete the demo partner
"""
from __future__ import annotations

import io
import logging
import os
import sys
import time

import paramiko

import server as omni
from omnimft.st_client import STError

logging.getLogger("paramiko").setLevel(logging.WARNING)
ACCOUNT = "demo_resubmit"
GOOD_PATH = f"/ws/simple/executeStInboundFile?account={ACCOUNT}"
BAD_PATH = f"/ws/simple/executeStInboundFileV2?account={ACCOUNT}"  # endpoint that does not exist -> HTTP 404
SAMPLE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs", "samples", "resubmit_demo_invoice.csv")


def site_id() -> str:
    return next(s["id"] for s in omni.st().get("/sites", account=ACCOUNT)["result"] if s["name"] == f"{ACCOUNT}_to_boomi")


def set_path(path: str) -> None:
    omni.st()._request("PATCH", f"/sites/{site_id()}",
                       json=[{"op": "replace", "path": "/customProperties/ghttpUploadUrlPath", "value": path}])


def status(limit: int = 6) -> None:
    res = omni.check_secure_transport_status(account=ACCOUNT, limit=limit)
    for t in res.get("transfers", []):
        print(f"  {t['start_time']} | {t['status']:9} | {t['direction']:8} | {t['filename']} | {(t['error_message'] or '')[:110]}")
    if not res.get("transfers"):
        print("  (no transfers yet)")


def prepare() -> None:
    if not omni.st().exists(f"/accounts/{ACCOUNT}"):
        r = omni.create_secure_transport_usecase(ACCOUNT, route="boomi", dry_run=False)
        if not r.get("ok"):
            sys.exit(f"could not create demo partner: {r.get('error')}")
        print(f"created demo partner {ACCOUNT} (route boomi)")
    set_path(BAD_PATH)
    print("broke the Boomi endpoint path on the transfer site (simulated misconfiguration)")
    pw = dict(l.split("=", 1) for l in open(os.path.join("secrets", f"{ACCOUNT}.txt")).read().split())["password"]
    name = f"resubmit_demo_invoice_{time.strftime('%H%M%S')}.csv"
    t = paramiko.Transport((omni.urlparse(os.environ["ST_BASE_URL"]).hostname, omni._sftp_port() or 8022))
    t.connect(username=ACCOUNT, password=pw)
    paramiko.SFTPClient.from_transport(t).putfo(io.BytesIO(open(SAMPLE, "rb").read()), f"/inbound/{name}")
    t.close()
    print(f"uploaded {name}; waiting for ST to push...")
    time.sleep(30)
    status()
    print("\nNext: ask the agent why it failed, run `demo_resubmit.py fix`, then ask the agent to resubmit it.")


def fix() -> None:
    set_path(GOOD_PATH)
    print("restored the correct Boomi endpoint path - the transfer can now be resubmitted")


def cleanup() -> None:
    c = omni.st()
    for x in c.get("/subscriptions", account=ACCOUNT)["result"]:
        c.delete(f"/subscriptions/{x['id']}")
    for x in c.get("/sites", account=ACCOUNT)["result"]:
        c.delete(f"/sites/{x['id']}")
    try:
        c.delete(f"/accounts/{ACCOUNT}")
    except STError as exc:
        if exc.status != 404:
            raise
    if os.path.exists(f"secrets/{ACCOUNT}.txt"):
        os.remove(f"secrets/{ACCOUNT}.txt")
    print(f"removed demo partner {ACCOUNT}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    {"prepare": prepare, "fix": fix, "status": status, "cleanup": cleanup}.get(cmd, lambda: print(__doc__))()
