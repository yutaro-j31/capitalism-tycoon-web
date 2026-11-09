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
or parity evidence. No K internal hotspot measurement is claimed yet; the only
real profile exercised here is the short fixture. Existing K bounds still refer
to their original source and the cross-Node1byte gap remains unresolved.

No production test, economic module, workflow, runner or shard-concurrency setting
changes. `sourceBindingVerified`, `cpuUtilizationMeasured`, `speedupPredicted`,
parallel qualification and production authorization remain false.
