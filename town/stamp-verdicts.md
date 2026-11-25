# Question-index stamp checks

**This grades the date, not the answer under it.** A bumped line makes a quietly wrong passage pass; a `touch` fools the clock. Treat the green mark as clock agreement only, and the count in the ledger as machine runs, not verdicts, readers, or a schedule.

No person reads this stamp. A sync invocation checks it when the sync runs; the ledger's timestamps are not hourly. This view publishes no count of checks — the count lives only in the ledger, as a record of machine runs, not as a credential on this page. A repeated PASS is one observed gap seen again, not a series of new measurements. Derived from `stamp-verdicts.jsonl` on every sync. Consecutive identical verdicts are collapsed into one dated line whose interval names its span, so quiet PASSes cannot bury a FAIL or pose as certificates. This records a clock agreement between the index's typed stamp and the file's mtime; it is not a verdict about a person, a reader, or the town. The checker catches an edit that forgot to bump the stamp, not a deliberate `touch`.

- 2026-11-24T23:36:57Z → 2026-11-25T02:34:25Z — **PASS · last checked 2026-11-25T02:34:25Z** · one observed gap +21s on one stamp (2026-11-24T22:02:38Z) · file_moved 2026-11-24T22:02:59Z · grace 120s
