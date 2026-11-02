# Offline multi-run CI queue observations

`node scripts/parallel-shard-queue-series.cjs COLLECTION.json` accepts `{"summaries":[...]}` with at least two complete outputs of `parallel-shard-ci-timing.cjs`, produced from full paginated run/jobs snapshots at retained observation times. Duplicate run IDs, missing/failed canonical shards, queued/cancelled workflows and malformed metrics fail closed. Null metric timestamps remain missing samples, never zero. If even one canonical A–L timestamp is missing, the corresponding full-run last-shard-creation maximum or twelve-shard queue/execution median is `null` and excluded from cross-run metric statistics; H/I/K per-shard observations are still retained. A claimed successful workflow is rejected if its aggregate is missing or non-successful, or if the timing summary reports pending child jobs, even when the canonical A–L shard states appear successful.

The output separately reports run creation to first observed job creation, last canonical shard creation, job creation to runner start, successful shard execution, and aggregate completion. H/I/K receive per-run and subset min/median/max observations. A late-created job with a short queue is not proof of runner starvation. This is not an experiment or release gate: repository coverage and host comparability are false, runner quota and counterfactual speedup are null. No production parallelism or workflow is changed. J/C remain at 2; E/K remain serial; #1203 is Owner-held. Short negative/CLI controls run through the existing K offline evidence contract job.


## Preserve execution attempt and observation provenance

Each input summary must carry a positive safe-integer `runAttempt` and a retained,
parseable string `asOf` from the single-run analyzer. The series output now keeps
both fields with each run's ID and HEAD. Previously it accepted missing attempt
metadata and discarded the observation time, so an exported comparison could not
identify which execution attempt or capture time supplied its timings. No attempt
is guessed as1, and no current timestamp is substituted for absent evidence.
Regenerate older summaries from their retained raw run/jobs snapshots with the
current timing analyzer. If those snapshots are unavailable, the comparison is
blocked rather than repaired with invented provenance.

Distinct run IDs may legitimately have different positive attempt numbers and
capture times. Multiple attempts of the same run remain rejected as duplicate
run samples. These checks validate summary provenance fields, not the authenticity
of a manually supplied summary; original API attempt/chronology/pagination checks
still belong to `parallel-shard-ci-timing.cjs`. No statistical independence or
host comparability is inferred from distinct IDs.

The existing required offline evidence self-test replays the retained three-run
`ci-overlap-2026-10-31.json` snapshots through the single-run analyzer, preserving
attempt1 and `asOf=2026-10-31T05:02:46.070Z` for all three outputs. Its subset
median of per-run canonical queue medians remains65 seconds. Synthetic and CLI
controls reject absent/invalid attempts and observation times without emitting a
successful comparison. This reuses metadata; no workload or green CI is rerun.
