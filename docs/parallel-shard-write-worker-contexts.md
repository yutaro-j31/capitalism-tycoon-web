# Worker write-observation contexts — 2026-11-03

The optional Node API preload now keeps main-thread events in `PID.jsonl` and
worker events in `PID.thread-ID.jsonl`. Each new event includes `threadId`.
Workers share process.pid, so a single PID file previously mixed initialization
records and the strict collector rejected it. Separate files preserve that
strict one-initialization rule per context without interleaved worker records.

The collector keeps `processes` for main-thread PID logs and adds `threads` for
worker context logs. Every filename/PID/thread identity is checked. Legacy
PID-only records without threadId remain accepted as main-thread records only;
worker records must identify their thread. Duplicate initialization, truncated
records, missing root logs and inconsistent identities still fail closed.
Findings include all contexts. Coverage retains `pidLogs` for main-thread logs
and adds `workerThreadLogs` and `opaqueWorkerCreations`.

Worker construction is recorded through a constructor Proxy with Reflect.construct;
the observer does not inspect script payloads or options. Even an inherited,
fully logged worker remains an opaque finding requiring review. A worker that
strips preload/env can otherwise write without emitting a context log. Therefore
`workerCoverageComplete`, descendant completeness and native syscall completeness
remain false; a successful fixture does not qualify shard safety.

`node scripts/parallel-shard-write-observation.cjs` (already required CI) invokes
`parallel-shard-write-worker-test.cjs`. Its bounded, owned temporary fixtures
compare uninstrumented/instrumented stdout/stderr byte-for-byte, run two workers
with the same PID and distinct thread IDs, verify both real write logs, corrupt
thread/PID/initialization metadata, replay legacy root records and demonstrate a
sanitized worker's actual unobserved write while retaining its creation finding.
No game workload, production parallelism, workflow or runner setting changes.

Historical K evidence is unchanged. The K evidence auditor's original PID-only
raw-log contract is deliberately not broadened here: a future artifact containing
worker logs will require a separate reviewed evidence schema before acceptance.
The collector's new thread inventory alone is not full K/I qualification. This
work does not identify or fix the historical E local leftover root cause.
