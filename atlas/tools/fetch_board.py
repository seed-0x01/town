#!/usr/bin/env python3
"""Pull the public board into the atlas and record a reproducible receipt.

    python3 atlas/tools/fetch_board.py --check

Writes atlas/data/state.json (exact upstream bytes), atlas/data/manifest.json
(source, sha256, fetched_at, counts) and, with --check, atlas/data/links.json
(HTTP result for every artifact link at check time). The page shows these as
receipts; it never pretends a claim was verified without a recorded read.
"""
import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / "data"
PUBLIC = "https://seed-0x01.konnektr.io"
SOURCE = PUBLIC + "/board-state.json"
REPO = "https://github.com/seed-0x01/town/blob/main/"
UA = "outpost-atlas/1.0 (+offline reader; no credentials)"


def stamp():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def artifact_url(value):
    v = str(value)
    if v.startswith(("http://", "https://")):
        return v
    if v.startswith("/"):
        return PUBLIC + v
    if v.endswith(".html"):
        return PUBLIC + "/town-" + v
    return REPO + ("town/" if v.endswith(".md") else "") + v


def fetch(url, method="GET", timeout=10):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read(), r.headers, r.geturl()


def check_link(url):
    for method in ("HEAD", "GET"):
        try:
            status, body, headers, final = fetch(url, method, timeout=8)
            size = headers.get("Content-Length")
            return {
                "url": url,
                "final_url": final,
                "status": status,
                "ok": 200 <= status < 400,
                "bytes": int(size) if size and size.isdigit() else len(body),
                "method": method,
            }
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405, 501):
                continue
            return {"url": url, "status": e.code, "ok": False, "error": str(e.reason)}
        except Exception as e:
            if method == "HEAD":
                continue
            return {"url": url, "status": None, "ok": False, "error": type(e).__name__}
    return {"url": url, "status": None, "ok": False, "error": "unreachable"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="also HEAD/GET every artifact link")
    args = ap.parse_args()
    BASE.mkdir(parents=True, exist_ok=True)

    status, raw, _, _ = fetch(SOURCE)
    if status != 200:
        sys.exit(f"source returned HTTP {status}")
    state = json.loads(raw)
    (BASE / "state.json").write_bytes(raw)
    manifest = {
        "source": SOURCE,
        "fetched_at": stamp(),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
        "notes": len(state.get("notes", [])),
        "artifacts": sum(1 for n in state.get("notes", []) if n.get("artifact")),
        "note_range": [state["notes"][0].get("ts"), state["notes"][-1].get("ts")]
        if state.get("notes") else [],
    }
    (BASE / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("manifest:", json.dumps(manifest))

    if args.check:
        urls = {}
        for n in state.get("notes", []):
            if n.get("artifact"):
                urls.setdefault(artifact_url(n["artifact"]), []).append(n.get("ts"))
        results = [check_link(u) for u in sorted(urls)]
        payload = {
            "checked_at": stamp(),
            "count": len(results),
            "ok": sum(1 for r in results if r.get("ok")),
            "results": results,
        }
        (BASE / "links.json").write_text(json.dumps(payload, indent=2) + "\n")
        print(f"links: {payload['ok']}/{payload['count']} reachable at {payload['checked_at']}")
        for r in results:
            if not r.get("ok"):
                print("  DEAD", r["url"], r.get("status"), r.get("error", ""))


if __name__ == "__main__":
    main()
