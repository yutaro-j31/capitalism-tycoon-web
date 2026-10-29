# E residue diagnosis (Owner decision, 2026-10-29)

Target: `tests/weekly-cashflow-bridge-test.js` reported `leftoverProcesses=true` in
Work B's local E parallel run. E opt-in PR #1203 remains held. No economic source,
canonical command list, repository variable or runner implementation is changed here.

## Reproducible evidence

`scripts/parallel-shard-runner-process-diagnostic.js` runs on Linux / Node 22 and
24 via two jobs in the existing Test workflow. The job condition permits **only**
the PR branch `ci/parallel-shard-process-diagnostic`; no new workflow or schedule,
main job, global concurrency setting, canonical dependency or required check is removed.

The script records Node version, source SHA, runner SHA256, CPU/memory, Node PID,
`/proc/self/stat`, `/proc/<Node-pid>/stat`, namespace links and proc mount.
If identities do not agree, it writes a failing report **without launching or
signalling any test process groups**. Resource and residue evidence in this state
is unqualified; it does not mean no process was left behind.

On a consistent host, the unchanged runner executes:

1. A clean command (no residue expected).
2. A background process that normally finishes while holding inherited output
   pipes (no residue expected).
3. An intentionally long-lived background process with ignored output pipes
   (residue must be detected and cleaned).
4. An intentionally long-lived output-pipe holder (residue must be detected and cleaned).
5. A real serial reference pair: weekly cashflow bridge + agency credit line.
6. Three parallel-2 repetitions of that real pair. Exit status/signal and complete
   stdout/stderr SHA256/byte counts must equal the serial reference.

Each detached child's PID, group/session identity and group members are captured
at spawn, exit and close. Post-run snapshots occur immediately, after 100ms and
after a further 2000ms. Zombies are retained in the JSON, distinguished from live
processes. Every real-test residue flag must remain false, and no live process
may remain after runner cleanup. Intentional controls must retain true flags.

Classifications are `clean`, `observed-and-cleaned`, `still-alive-after-run`, and
`unverifiable-pid-namespace`. **Observed-and-cleaned never clears the original
leftover flag or qualifies the E no-residue gate.** Failed assertions exit nonzero.
The existing generic runner integrity regression also runs on both Node versions.
JSON is uploaded with `always()` and missing artifacts are an error.

## Current local result

Pure parser/classification self-tests, YAML parsing, parallel workflow contract,
shard matrix, workflow path/trigger contract, browser timeout contract, registration
and diff checks pass. Local full diagnostic correctly stops with Node PID 14 vs
procfs self PID 35370 and no `/proc/14` entry; no test groups were launched.
Hosted Actions results are pending at PR creation; no hosted PASS is claimed.

The source of `weekly-cashflow-bridge-test.js` imports assert/fs/path/harness;
its harness imports fs/path/vm, with no child_process/spawn call found in these
inspected files. That supports investigating a monitoring identity mismatch but
does not prove absence of descendants or explain the original flag by itself.

Both main and #1203 currently have byte-identical `parallel-shard-runner.js`.
This diagnostic therefore tests the runner underlying the E report without
changing E's pending HEAD or enabling E in production. It covers a minimal real
pair, not a fresh full 33-command E run. A non-reproduction alone cannot certify
all E interleavings or the historical run's process state.

## Gate

Do not merge #1203 before final-head CI, Codex review, residue cause/safety,
C's production stability gate, current-main conflict check and final Owner merge
approval. Keep J=2. Enable C=2 only after latest-main required CI succeeds and
Owner sets the repository variable; qualify only subsequently created runs.
