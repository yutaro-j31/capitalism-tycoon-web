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

## Bounded live observation window

```sh
node scripts/parallel-shard-cgroup-memory-window.cjs /path/to/verified/cgroup 1000
```

This Linux-only optional CLI holds one read-only directory descriptor across two
captures separated by1–10000 milliseconds. Reads use `/proc/self/fd` for that
handle, so a pathname replacement cannot silently substitute a different group.
Device/inode identity and both raw point records are retained. Missing files after
removal remain missing. No fallback reopens the original pathname. The tool does
not run a command, discover the job's group, write/reset counters or change limits.
The requested window and actual monotonic elapsed time (including capture reads)
are separate. It is a bounded observation window, not whole-test coverage.

Event deltas compare like-named counters separately for events/localEvents. A
missing point file is unavailable; new/disappearing keys and decreased counters
have null deltas with explicit statuses, never zero or a negative event count.
Unknown keys are preserved. Endpoint counter decreases may indicate reset or
invalid continuity; resets followed by regrowth between endpoints are not detected.
`completeEventDeltas` means only that the observed keys can be subtracted. It does
not establish authentic kernel provenance or prove a workload had no OOM. Source
files/limits may change during reads. A change in current bytes is signed endpoint
change, not allocated bytes, peak or pressure. Endpoint max/high changes are
reported separately; unavailable limit evidence remains null.

The held descriptor pins filesystem identity only within this live call. Job/
cgroup mapping, mount options, workload causality, peak/parallel qualification
remain unverified. Missing/error data is retained in both point records. The
required self-test uses synthetic directories, including a renamed original and a
replacement at the same path; no hosted I workload or production setting changes.
