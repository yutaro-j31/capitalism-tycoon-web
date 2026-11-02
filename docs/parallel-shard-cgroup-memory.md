# Explicit cgroup memory observations

For I/H/K resource-contention investigation, host free memory and Node's process
capacity point do not show cgroup memory events. This optional read-only tool
captures five files from an **explicitly supplied directory**:

```sh
node scripts/parallel-shard-cgroup-memory.cjs /path/to/verified/cgroup
```

It reads `memory.current`, `memory.max`, `memory.high`, `memory.events` and
`memory.events.local` once each, preserving bounded raw text and start/end capture
times. It never writes, resets counters, mounts, discovers a cgroup or runs a
workload. There is no default directory and no workflow integration. The operator
must separately establish that the directory represents the intended job/cgroup
and retain run/attempt/HEAD and that mapping with the JSON. Capturing an arbitrary
container root does not establish a hosted runner's or shard I's resource scope.

The [kernel cgroup-v2 documentation](https://docs.kernel.org/admin-guide/cgroup-v2.html)
defines these files. Byte limits distinguish `max` (unlimited, bytes=null) from
numeric zero. Counters are cumulative observations, not per-command event counts;
`memory.events.local` is local, while `memory.events` normally includes descendant
events (the `memory_localevents` mount option changes that behavior). Both are
kept separate with no invented hierarchy or subtraction. Unknown event keys are
retained and absent keys are not zero-filled. A historical `oom_kill` count is not
proof this job was killed, and a zero count does not replace existing OOM/SIGKILL/
timeout/error/output/residue gates. `high` events alone do not prove global OOM.

Missing files, read errors, empty/malformed/duplicate/unsafe-integer data have
explicit statuses and null observations. They are never reported as zero events
or unlimited limits. Each text observation is limited to64KiB in the emitted
record; oversized text is invalid and omitted. Reads are separate in time and may
race with activity. No peak, interval delta, workload attribution, physical-pool
utilization, parallel qualification or production authorization is inferred.
`observationsComplete` means only all five reads parsed; it is not a safety PASS.
The CLI may successfully emit an incomplete observation; inspect its statuses.

Synthetic file/CLI controls run through the existing memory-capacity self-test in
the required process-diagnostic contract self-test. They cover zero/unlimited,
local versus hierarchical counters, unknown/missing keys, read failures, malformed
or oversized values, no writes, and incomplete evidence. This adds no production
parallelism, runner setting or new test-workflow job. Any live local snapshot is
only that environment's point observation; hosted I remains unqualified.
