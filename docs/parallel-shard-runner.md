# Parallel shard runner — stage 0

`scripts/parallel-shard-runner.js` is a **standalone** runner that executes the commands one canonical shard owns, with bounded concurrency. **Nothing in the repository calls it**: `tests/run-all-shard.js`, `tests/run-all.js`, `tests/run-all-shards.json` and every workflow are unchanged, so CI behaves exactly as before. It exists to prove, locally and repeatably, that running a shard in parallel keeps every test, exit code and output intact, before any production wiring is decided (stage 1 and later need separate Owner approval).

## Usage

```sh
node scripts/parallel-shard-runner.js --shard J --enumerate-only          # what would run, with a digest
node scripts/parallel-shard-runner.js --shard A --audit                   # static shared-state audit (heuristic)
node scripts/parallel-shard-runner.js --shard J --concurrency 4 \
  --order longest-first --timings timings.json --report report.json --write-timings timings.json
node scripts/parallel-shard-runner.js --commands-file cmds.json --concurrency 2   # explicit [{label?,command,args}]
```

Options: `--concurrency N` (default 1), `--order recorded|longest-first`, `--timings file` (label → seconds; unknown labels sort last), `--serial a,b` or `--serial-config scripts/parallel-shard-runner.config.json`, `--test-timeout-sec` (default 1800), `--run-timeout-sec`, `--no-fail-fast`, `--sample-ms` (default 250), `--report`, `--write-timings`.

Exit status: the failing command's own exit status (`1` if it has none), `124` for the whole-run timeout, `130`/`143` for SIGINT/SIGTERM, `2` for usage errors, `3` for a runner error.

## How it works

- **Enumeration.** The production `tests/run-all-shard.js` is loaded in a child process in which `spawnSync` only *records* the commands the shard owns and returns a stub success. The list therefore comes from the production code path (same ownership rules, same order) and cannot drift from it. The same input gives the same list and the same `enumerationDigest` (SHA-256 of label, command, args).
- **Scheduling.** Serial-group commands run first, alone, in recorded order. The rest run through a pool of `concurrency` workers in `recorded` order or `longest-first` order (timings file; ties and unknown timings keep recorded order).
- **Per command.** Spawned as its own process group with piped stdout/stderr. Failure = non-zero exit, killed by a signal, per-test timeout, output over the 64 MiB cap (the serial runner's `maxBuffer`), or spawn error. On timeout, abort or interrupt the whole **process group** is sent SIGTERM, then SIGKILL after a grace period, and the runner waits until no member of the group is alive. A passing command that leaves background processes behind is reported (`leftoverProcesses`) and cleaned up: when the command itself exits, descendants get `--leftover-grace-ms` (default 2000) to finish; if any still holds the output pipes after that, the group is terminated so the run cannot stall until a timeout.
- **First failure.** No new command starts; running ones are terminated and reported as `aborted`; the failing command's stdout/stderr are printed with `::error title=Test suite failed::<label>` like the serial runner, and the process exits non-zero.
- **Reconciliation.** Every enumerated command must end in exactly one of `passed`, `failed`, `aborted`, `notStarted`; a run without a failure or abort must have passed all of them, otherwise the runner throws.
- **Records.** Per command: wall time, sampled CPU time and peak RSS of its process group (Linux `/proc`, 250 ms), SHA-256/length/line count of stdout and stderr. Per run: wall time, system CPU utilisation, peak system memory in use and its growth over the start of the run, the runner's own CPU seconds. The `::notice title=Shard X timing::label Ns` lines match the production runner's format.

## What the production runner relies on from `spawnSync` (audited)

`tests/run-all.js` runs every command with `spawnSync(..., { encoding: 'utf8', maxBuffer: 64 MiB })` and reads only `result.status` (to fail), `result.stdout`/`result.stderr` (printed on failure) and `result.signal` (log text). `tests/run-all-shard.js` replaces `spawnSync` with a wrapper that stubs non-owned commands and times owned ones, plus one pre-step (`product-recall-reachability`, owned by shard C). No test result is parsed, and no command depends on another command's output.

**Pre-existing gap, not changed here:** a test killed by a signal (for example the OOM killer), or one whose output exceeds `maxBuffer`, makes `spawnSync` return `status === null`, and `if (result.status)` treats that as a pass. `tests/parallel-shard-runner-test.js` demonstrates this with a self-`SIGKILL` command. This runner treats those endings as failures, so at concurrency 1 its results equal the serial runner's for every normal ending and are stricter only for those abnormal ones. Whether to tighten the production runner is a separate decision.

## Evidence (local, 4 cores / 15 GB, shard J: 10 commands)

All eight runs below enumerated the same list (digest `aea0ed6ef221`), passed 10/10, and produced **byte-identical stdout and stderr (SHA-256), exit codes, PASS-line counts and line counts for every test**.

| Run | wall | speed-up vs concurrency 1 | system CPU | peak system memory growth* |
|---|---:|---:|---:|---:|
| concurrency 1, recorded order | 1463.6 s | 1.00x | 29% | 1349 MB |
| concurrency 2, recorded order | 832.8 s | 1.76x | 50% | 1663 MB |
| concurrency 4, recorded order | 679.6 s | 2.15x | 62% | 2104 MB |
| concurrency 4, longest-first (5 runs) | 487.8 / 497.0 / 501.5 / 502.2 / 486.6 s | 3.00x / 2.94x / 2.92x / 2.91x / 3.01x | 89–92% | 2.07–2.22 GB |

\* Growth of system memory use over the start of the run (`MemAvailable` at start minus its lowest value). The first seven runs predate the `peakSystemMemInUseMb` metric (`MemTotal` minus the lowest `MemAvailable`, which includes what was already running). In the last run, with the final code, the peak in use was 2734 MB of 16 GB and the growth 2220 MB, so in-use figures are about 0.5 GB above the growth figures in this table.

The machine's speed drifted by about ±10% over the session: the production serial runner, run last (`TEST_SHARD=J node tests/run-all-shard.js`, 1620.9 s, `executed=10 seen=605`, exit 0), was slower on every one of the 10 tests (by 5–19%) than this runner at concurrency 1, and it executed exactly the same 10 labels in the same order. Compare only within one group of runs. In the last run (final code) the runner itself used 4.1 CPU-seconds over 502 s of wall time, 0.2% of the machine's 4-core capacity. The largest single test process is 1408 MB (`subsidiary-disposal-accounting-test.js`).

Failure and interruption on the real shard J commands:

- one command replaced by `exit 3` after 3 s, concurrency 4: exit 3 after 3.1 s, 1 failed / 3 aborted / 6 not started, `forced failure` kept, no test process left;
- `--test-timeout-sec 20`: first test failed with `timeout after 20000ms`, siblings aborted, exit 1 after 20.0 s, no test process left;
- SIGTERM to the runner 25 s into a run: exit 143, no test process left.

`tests/parallel-shard-runner-test.js` (about 10 s, synthetic commands, part of the canonical suite) covers: enumeration equals `tests/run-all-shards.json` for shards B–L and the 12 enumerations partition the 605 commands the production runner sees; identical results at concurrency 1/2/4 in recorded and longest-first order and equality with a serial `spawnSync` reference (exit, stdout, stderr); first-failure handling; signal/timeout/output-cap/spawn-error as failures; process-group kill of grandchildren; leftover cleanup; serial-group isolation with a negative control (a shared lock is violated without the group); the static audit; CLI exit status, report, and SIGTERM handling.

## Shared-state audit (`--audit`, a heuristic text scan — not a proof)

The scan reads each command's test file, its relative `require`s (two levels) and the `node ...` commands inside `npm run` script bodies, and flags file writes, temp directories, `artifacts/`, ports and environment assignment. Result per shard: B, C, E, I, K, L none; **J** two hits, both `writeFileSync` that run only when a `*_PARITY_OUTPUT` variable is set (read, harmless); **D** two, the same pattern; **F** one (`exploration-smoke-test.js` uses `mkdtempSync`, unique); **A** six; **G** three; **H** four. The tests that rewrite tracked files or share `js/` / `artifacts/` are listed with reasons in `scripts/parallel-shard-runner.config.json` as the serial group for A, G and H (for example `static-asset-cache-coherence-test.js` temporarily appends to tracked CSS/JS and restores it). A reviewed-safe list sits next to it. Stage 1 would turn this into an enforced contract; stage 0 does not, so that new tests added by other work cannot fail CI because of a heuristic.

## Not covered

CI runner cores, memory and concurrency allowance are unverified; all speed-ups above are local. Concurrency 1 equality with the production runner was checked for shard J only (labels, order, exit status); output equality with the production runner is not observable because it prints child output only on failure. The `npm run` script bodies are scanned for `node <file>` commands only. `IndexedDB` is a per-process fake in these tests, which is why parallel processes do not interfere; any test that used a shared real store would need the serial group.
