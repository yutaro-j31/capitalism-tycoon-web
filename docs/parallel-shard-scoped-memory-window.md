# Operation-scoped cgroup observations — 2026-11-03

The existing fixed 1..10000 ms read-only cgroup window remains supported.
`begin(directory)` also holds the same directory FD until `finish()`/`close()`;
`observeOperation(directory, asyncAction)` pairs captures around a bounded
operation without blocking its execution with Atomics.wait. The return value has
an explicit fulfilled/rejected `outcome` and a separate `observation`. Callback
fulfillment is not a test-success decision. Rejected action identity is retained;
if both action and observation fail, AggregateError retains both errors. Handles
close on completion or failure and cannot be captured twice.

The branch-only process diagnostic accepts optional
`--memory-cgroup-dir EXPLICIT_DIRECTORY` during executed diagnostics. For each
runner pass it saves `record.cgroupMemoryWindow` before interpreting/rethrowing
the action outcome. Original runner result/counts/output/process/memory gates
remain unchanged. With no option, no directory is opened and the previous path
is used. This option is not supported for plan-only or self-test invocations.

Example, only on an environment with consistent Node/procfs namespaces and a
reviewed clean pinned source:

```
node scripts/parallel-shard-runner-process-diagnostic.js --full-shard I \
  --retain-output --root SOURCE --source-sha FULL_SHA --report OUTSIDE_SOURCE.json \
  --memory-cgroup-dir EXPLICIT_CGROUP_DIRECTORY
```

No workflow/runner/production concurrency setting is changed or cgroup path
autodetected. The same cgroup may include other jobs/processes. OOM/high/kill
event deltas are observations, not attribution to the test. Missing/reset
counters and changed limits retain the existing unknown/partial rules.
`requestedWindowMs=null` identifies an operation-duration window; elapsedSeconds
records the measured interval. Peak memory, cgroup/job association, workload
cause and parallel/production qualification remain false.

The existing required process diagnostic self-test invokes short synthetic-file
controls with a bounded child process, rejected callback, failed runner-shaped
value, missing counters and close/reuse checks. These validate lifecycle and
error preservation, not real kernel OOM or full I/K resource safety. Existing
fixed-window replacement/partial/counter-reset/CLI controls are preserved. Local
full I/K workload execution is still blocked when PID namespaces disagree.
