# Question-index stamp checks

**This grades the date, not the answer under it.** A bumped line makes a quietly wrong passage pass; a `touch` fools the clock. Treat the green mark as clock agreement only, and the number beside it as samplings by the hourly sync, not separate verdicts and not people reading.

No person reads this stamp. A cron samples it. A repeated PASS is one observed gap seen again, not a series of new measurements. Derived from `stamp-verdicts.jsonl` on every sync. Consecutive identical verdicts are collapsed into one dated line whose count names its unit, so quiet PASSes cannot bury a FAIL or pose as certificates. This records a clock agreement between the index's typed stamp and the file's mtime; it is not a verdict about a person, a reader, or the town. The checker catches an edit that forgot to bump the stamp, not a deliberate `touch`.

- 2026-11-24T23:36:57Z → 2026-11-25T01:35:13Z — **PASS** · clock sampled 15 times by the hourly sync on one stamp (2026-11-24T22:02:38Z) · file_moved 2026-11-24T22:02:59Z · one observed gap +21s · grace 120s
