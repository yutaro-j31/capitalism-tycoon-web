# Offline CPU sample hotspots — 2026-11-03

`node scripts/parallel-shard-cpu-hotspots.cjs PROFILE.cpuprofile EXPECTED_SHA256`
validates a hash-pinned V8 CPU profile and groups sampled leaf nodes by function,
URL and zero-based line/column. Different call-tree nodes for the same frame are
merged. Counts and summed sample deltas are reported without adding inclusive
parent time, so parent/child stacks are not double counted. The default top20
report retains omitted-function count; module callers can request up to1000.

The parser requires unique node IDs, known sample references, matching nonempty
samples/timeDeltas, finite nonnegative deltas and valid profile chronology. It
records sampled deltas exceeding the profile span as an explicit inconsistency,
not CPU utilization. Frame labels/URLs are profiler metadata and may refer to
VM code such as index.html, anonymous functions, builtins or idle/GC frames.
Call-tree structure and the association between a URL and repository source are
not verified. Sample-weighted self time is an approximation, not elapsed-time
causality, utilization, a speedup forecast or a parallel-safety gate.

`--sample-counts` selects a separate report ranked by sampled leaf counts. It
keeps profile, frame, sample-reference and hash validation and reports the
number of negative deltas. Its fractions use all sample references as the
denominator. It emits no time totals or time-weighted fractions. The default
report still exits 1 on a negative delta.

The existing required process-diagnostic self-test invokes a short real Node
`--cpu-prof` fixture alongside synthetic corruption controls. The fixture writes
outside the source checkout, compares profiled/unprofiled stdout/stderr bytes,
verifies source samples, SHA mismatch rejection and module/CLI replay, then
removes its owned files. No full K/I test is run by these controls.

For a later approved measurement of the K longest invocation, use an independently
clean pinned checkout and write the profile outside it, for example:

```
node --cpu-prof --cpu-prof-dir=OUTSIDE_SOURCE --cpu-prof-name=k-longest.cpuprofile \
  tests/full-index-weekly-validate-208w-test.js
```

Retain source SHA and source/input hashes, exact Node/host, command, child exit/
signal, complete stdout/stderr, profile hash, memory and final-process evidence
before attributing results to K. Keep all208 weeks/routes/fork/assertions. A
profiled run has profiler overhead and cannot replace uninstrumented performance
or parity evidence. Existing K bounds still refer to their original source and
the cross-Node one-byte stderr gap remains unresolved.

## K longest invocation capture — 2026-11-09 JST

One Node 24.22.1 invocation on an EPYC 9V74 host at source
`369df100a70cbfc8b42c522cb048603cd4781dde` exited 0 after 520.058 seconds.
All four routes passed 208 weeks and Phase 2 acceptance. The reload fork covered
12 weeks from week 104. Stderr was empty and the invocation's process group
was absent at exit. The wrapper observed 680572 KiB child peak RSS. This
observation does not measure the sum across a process tree or cgroup.

The [capture record](ci-evidence/k-longest-node24-2026-11-09.json) retains exact
UTF-8 stdout and stderr, hashes, host and source provenance, and the count
report. The [compressed raw profile](ci-evidence/k-longest-node24-2026-11-09.cpuprofile.gz)
contains 465618 samples, including a single `-1 µs` delta at zero-based index
559. Its cause is unconfirmed. Replaying with the default parser exits 1.
The count report's largest sampled frames were `compare` (17.78%),
`canonicalSerializeV2` (12.50%) and `clone` (8.10%) from `index.html`.
These shares describe sample references from this one capture.

```sh
profile=$(mktemp)
trap 'rm -f "$profile"' EXIT
gzip -dc docs/ci-evidence/k-longest-node24-2026-11-09.cpuprofile.gz > "$profile"
node scripts/parallel-shard-cpu-hotspots.cjs --sample-counts "$profile" \
  c5ec9917b9177444ba2518aa4e4ec4853d01a98ec2d73ed9825f3b19a85640c5
```

This capture covers one K command on one Node version. It leaves the
same-source uninstrumented timing and output parity, cross-Node attribution,
and hosted workflow impact open.

No production test, economic module, workflow, runner or shard-concurrency setting
changes. `sourceBindingVerified`, `cpuUtilizationMeasured`, `speedupPredicted`,
parallel qualification and production authorization remain false.
