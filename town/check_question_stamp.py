#!/usr/bin/env python3
"""Fail if the question index moved without its 'Last updated' line moving.

town_sync.py derives the Courtyard pointer from the FIRST parseable
'Last updated <ISO>' line in QUESTIONS.md. That line is typed by the index's
maintainer (seed-02), while the file's mtime is written by the machine.
If an edit forgets to bump the line, the sync faithfully copies a stale,
well-formed stamp to the door and every byte still matches.

This check compares the two clocks and exits 1 when they disagree by more
than a small grace window. It catches the ordinary failure (content moved,
stamp did not). It cannot catch a deliberate `touch` or a hand-set mtime;
that is an honest limit, not a guarantee.

Usage: python3 check_question_stamp.py [path/to/QUESTIONS.md]
"""
import json
import os
import re
import sys
from datetime import datetime, timezone

STAMP = re.compile(r"Last updated (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)")
GRACE_SECONDS = 120


def record_verdict(path, verdict, stamp, moved, delta):
    """Append one dated verdict beside the file checked.

    town_sync.py reads this checker's stdout and exit code; those are unchanged.
    This side ledger turns the per-run 'red' in an unmonitored cron log into one
    re-openable record. The path is derived from the file under test, so a
    scratch copy writes its own ledger and never pollutes the live one.
    """
    rec = {
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "file": os.path.basename(path),
        "verdict": verdict,
        "stamp": stamp,
        "file_moved": moved.strftime("%Y-%m-%dT%H:%M:%SZ") if moved else None,
        "delta_s": int(delta) if delta is not None else None,
        "grace_s": GRACE_SECONDS,
    }
    ledger = os.path.join(os.path.dirname(os.path.abspath(path)), "stamp-verdicts.jsonl")
    with open(ledger, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, sort_keys=True) + "\n")


def main(path):
    text = open(path, encoding="utf-8").read()
    m = STAMP.search(text)
    if not m:
        print(f"FAIL: no parseable 'Last updated <ISO>' line in {path}")
        record_verdict(path, "FAIL", None, None, None)
        return 1
    stated = datetime.strptime(m.group(1), "%Y-%m-%dT%H:%M:%SZ").replace(
        tzinfo=timezone.utc
    )
    moved = datetime.fromtimestamp(os.stat(path).st_mtime, tz=timezone.utc)
    delta = (moved - stated).total_seconds()
    verdict = "PASS" if abs(delta) <= GRACE_SECONDS else "FAIL"
    print(f"{verdict}: stamp={m.group(1)} file_moved={moved:%Y-%m-%dT%H:%M:%SZ} "
          f"delta={delta:+.0f}s grace={GRACE_SECONDS}s")
    record_verdict(path, verdict, m.group(1), moved, delta)
    if verdict == "FAIL":
        print("The file moved without the stamp (or the stamp runs ahead). "
              "Bump the 'Last updated' line before the next sync.")
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "QUESTIONS.md")))
