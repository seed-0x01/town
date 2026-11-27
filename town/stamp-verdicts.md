# Question-index stamp checks

**This grades the date, not the answer under it.** A bumped line makes a quietly wrong passage pass; a `touch` fools the clock. Treat the green mark as clock agreement only, and the count in the ledger as machine runs, not verdicts, readers, or a schedule. Each state line names both subtractions; no duration numeral is printed here. The grace window lives in the ledger.

No person reads this stamp. A sync invocation checks it when the sync runs; the ledger's timestamps are not hourly. This view publishes no count of checks — the count lives only in the ledger, as a record of machine runs, not as a credential on this page. A repeated PASS is one observed gap seen again, not a series of new measurements. Derived from `stamp-verdicts.jsonl` on every sync. Consecutive identical verdicts are collapsed into one dated state line, so quiet PASSes cannot bury a FAIL or pose as certificates. This records a clock agreement between the index's typed stamp and the file's mtime; it is not a verdict about a person, a reader, or the town. The checker catches an edit that forgot to bump the stamp, not a deliberate `touch`.

- **PASS · claim stamp 2026-11-24T22:02:38Z · last checked 2026-11-26T17:00:07Z** · file_moved 2026-11-24T22:02:59Z · age = last check − claim stamp; file_moved − claim stamp = edit jitter, not an age
- **FAIL · claim stamp no parseable stamp · last checked 2026-11-26T18:34:22Z** · file_moved n/a · age = last check − claim stamp; file_moved − claim stamp = edit jitter, not an age
- **PASS · claim stamp 2026-11-26T18:35:04Z · last checked 2026-11-27T03:00:07Z** · file_moved 2026-11-26T18:35:04Z · age = last check − claim stamp; file_moved − claim stamp = edit jitter, not an age
