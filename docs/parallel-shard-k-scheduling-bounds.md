# K fixed-duration scheduling bounds — 2026-11-03

The offline analyzer reuses the full K29 Node22/24 artifact archive at source
`daa5236d2483a9dbd1b208bb6b84e44d88a39762`. It first runs the existing complete
archive/raw-output/process/memory evidence audit. No workload is rerun, and the
known cross-Node stderr byte difference remains `cross-node-output-review-required`
with CLI exit 2. Invalid evidence exits 1; only a difference-free audited input
could exit 0. This does not requalify moving main.

```
node scripts/parallel-shard-k-scheduling-bounds.cjs \
  docs/ci-evidence/k-current-source-hosted-2026-11-02.json.gz \
  34cb96d26ea87f471dfc0996d8c1cfab35f234bcd62066fd2c46df8f7b223c8c \
  docs/ci-evidence/k-refresh-source-daa5236d.json
```

[Retained output](ci-evidence/k-scheduling-bounds-2026-11-03.json) is reproduced by
this command. For a fixed list of command durations and C execution slots, any
schedule takes at least `max(sum(duration)/C, longest duration)`. The report
computes that bound both from serial-reference durations at C=1/2/4 and from each
actual pass's own observed durations. The former scenarios assume invariant
durations; their speedup ceiling is **not a prediction**. The latter gaps must
not be called removable scheduler overhead: command durations already include
contention, preemption and waiting within each invocation.

| historical host | serial reference longest | C2 measured / own-duration floor | C4 measured / own-duration floor |
|---|---:|---:|---:|
|Node22.23.4 / EPYC7763|577.105s|887.644 / 887.529s|937.143 / 937.139s|
|Node24.22.1 / EPYC9V45|323.297s|515.688 / 515.630s|504.590 / 504.587s|

Both serial references identify invocation26,
`tests/full-index-weekly-validate-208w-test.js`, as the longest. In each actual C4
pass the longest invocation bound, rather than total work divided by four,
accounts for nearly all measured pass time. Extra slots alone cannot shorten
that invocation under fixed durations. Actual durations differ between passes,
and the two Node versions used different CPU models, so no Node-version or
resource-contention cause is established. The older observation that C2 beat C4
on Node22 is preserved; Node24's C4 was slightly faster, not a blanket C2 rule.

Next profiling should focus on the longest invocation's own runtime while
preserving all208 weeks/assertions/output contracts. This report does not split
it, remove tests, change scheduling, change production K parallelism or infer CI
workflow critical-path/queue savings. Memory, parallel safety, production
approval and moving-main qualification remain false. Required K audit controls
invoke synthetic bound tests and full retained-evidence replay.
