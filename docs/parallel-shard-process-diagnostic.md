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


## 2026-10-30 follow-up

Test #4314 ([run 40843743757](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40843743757)) failed in shard A because the iPhone static test searched beyond the `iphone-webkit-smoke` job and matched this diagnostic job's PR condition. The WebKit workflow condition was unchanged. The repair scopes condition checks to that job, adds a following-job noninterference fixture, and rejects both replacing the actual iPhone condition with PR and adding PR alongside the allowed triggers. No test was removed or skipped.

Both hosted diagnostics **passed** on the original HEAD 14175c16:

| Node | job | artifact | result |
| --- | --- | --- | --- |
| 22.23.4 | [123346120877](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40843743757/job/123346120877) | 12887399342 | namespace consistent; real pair serial + three parallel-2 repeats clean |
| 24.22.1 | [123346120702](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40843743757/job/123346120702) | 12885601095 | namespace consistent; real pair serial + three parallel-2 repeats clean |

Downloaded JSON confirms every real-pair original residue flag is false, stdout/stderr hashes and byte counts match its same-Node serial reference, and all recorded post-return groups contain no live members. Intentional infinite-background and pipe-holder controls retain true flags and classify as observed-and-cleaned; normal background completion remains clean. Generic runner regression also passed. No version-dependent residue behavior was observed in this sample. This is not the full 33-command E safety gate and does not determine the historical event's cause.

The current local executor provides concrete evidence for the PID namespace hazard: Node reported PID 6 while `/proc/self/status` reported PID 8445 and `NSpid: 8445 6`. `/proc/6` also existed, so presence alone is insufficient: it can reference a different outer-namespace process. The procfs view uses ancestor-namespace PID numbers while Node uses its inner namespace. The historical report lacks the target PID/start time, so attributing that specific flag to this mismatch remains an inference. The diagnostic fails closed on identity mismatch. No residue flag or production runner behavior was changed.

The same branch-only Node 22/24 jobs now additionally check out exact E HEAD `20dcfe71a3fc5e8ad662c8f8497fac1120162ae1` into an isolated subdirectory. They assert identical runner source, enumerate all 33 commands, record the same-source contract, run a serial reference then longest-first parallel-2 using E's timings/serial configuration, and compare every command's exit/signal/state/stdout/stderr hashes/bytes/lines/PASS count. Original residue flags must all be false; post-cleanup groups and identities are retained. Spawn traces are matched by command/arguments, not launch order. The diagnostic job budget is 90 minutes for two full passes plus controls (prior local E serial 25.5min and parallel 13.4min); canonical job/test budgets are unchanged. Full-E internal per-command timeout remains 1500s; diagnostic pass timeout is 3000s. The full-E hosted result is pending and must not be reported as PASS before completion. A new E HEAD requires a fresh pinned comparison.
