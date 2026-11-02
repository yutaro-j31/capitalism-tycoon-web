# Node write-observation wrapper controls

The required workflow contract job already invokes
`node scripts/parallel-shard-write-observation.cjs`; that entry point now also runs
`scripts/parallel-shard-write-wrapper-test.cjs`. It can be run separately too.
No workflow job, production shard command, parallelism or runner setting changes.

The test creates a local npm package in an owned temporary directory. `npm run
probe --silent` executes a short Node script that writes an owned JSON file and
fixed stdout/stderr bytes. It performs no install and uses an isolated offline
npm cache and separate empty user/global config files. Every spawn has a timeout
and output bound; the owned directory is removed on completion.

Controls verify:

- npm's root PID log and the script child's own initialization/write log exist;
- instrumentation preserves stdout and stderr byte-for-byte against an
  uninstrumented baseline;
- a parent that removes both `NODE_OPTIONS` and `PSR_WRITE_AUDIT_DIR` from its
  child's environment leaves no child PID log despite that child's real write;
- that parent's opaque spawn remains a finding, as do observed writes and npm
  child calls. Successful fixture exit does not make the observation `ok`.

The additive `coverage` object counts root invocations, PID log files and
observed opaque child calls. `pidLogs` is a count of logs across commands, not a
unique global process census. Descendant, native syscall and worker completeness
remain explicitly false even for a clean observation. `ok` retains its existing
meaning: no recorded findings; it does not certify complete observation.
Historical evidence without this additive object retains its original scope.

This is a prerequisite control for investigating I's npm wrapper, not an audit
of I's eight workloads or a qualification for I/H/K production parallelism.
Native processes, sanitized descendants and workers need separate evidence.
