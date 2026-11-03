# Observed shared-resource candidates — 2026-11-03

`node scripts/parallel-shard-resource-candidates.cjs WRITE_OBSERVATION.json`
groups findings from the existing write collector, offline. The report identifies
lexical resource targets seen in more than one command invocation, retaining
index/label/finding/PID/thread/operation witnesses. Repeated labels stay distinct
by array position; multiple events within one invocation alone are not a shared
resource between commands. It does not modify input or execute workloads.

Filesystem API targets and destinations are resolved using each event's POSIX
cwd. Rename/copy/link sources may be reads, so a shared filesystem path is a
review candidate, not proof of concurrent writes. Symlink/case equivalence and
native resource identities are not resolved. File descriptors, URL/opaque path
strings, omitted endpoint options and opaque child/worker APIs are retained as
unresolved findings rather than silently discarded.

Fixed numeric TCP and UDP ports are grouped separately. Port zero remains
unresolved/ephemeral; equal port numbers across protocols do not imply a conflict.
Binding addresses/options were deliberately omitted by the original observer,
so equal ports do not prove the same endpoint. String net.listen arguments are
lexical Unix socket paths, sharing the filesystem-path candidate namespace.

No time overlap is inferred. The owned regression fixture runs two writes to the
same temporary file **sequentially**, verifies stdout/stderr and collector output,
and checks module/CLI replay. Synthetic controls cover different cwd paths,
rename destination sharing, TCP/UDP separation, ephemeral ports, descriptor and
worker gaps, duplicate labels, witness identity and invalid records. The existing
required write-observation self-test invokes these short controls.

`simultaneousExecutionVerified`, endpoint/descendant completeness and shared-write/
parallel/production qualification remain false even with zero candidates. All
underlying findings still require review; this summary does not turn a collector
failure or missing coverage into PASS. Use it to prioritize real H/I/K resource
observations and isolation work before any Owner decision on production
parallelism. No workflow, runner, production shard or economic-test changes.
