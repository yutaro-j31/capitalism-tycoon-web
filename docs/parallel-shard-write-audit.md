# Optional Node write/port audit

This diagnostic preparation addresses the remaining runtime shared-write evidence gap in K's parallel safety review. It is independent of active PR #1219: that PR's HEAD and running comparison jobs are unchanged. No production shard, allowlist, repository variable, game source, test list or process runner behavior is modified.

## Usage and evidence

`scripts/parallel-shard-write-audit.cjs` is an optional Node preload. Without `PSR_WRITE_AUDIT_DIR`, loading it installs no hooks. When enabled, it records Node API calls in one `<pid>.jsonl` file per process. Each event has PID, cwd, operation and target; rename/copy/link operations also retain destination. Descriptor writes retain the descriptor number, not a guaranteed descriptor-to-path mapping. It records attempts before invoking the original function, so a failed write is an attempted-write event, not proof of a successful mutation.

```sh
PSR_WRITE_AUDIT_DIR="$PWD/artifacts/write-audit" \
NODE_OPTIONS="--require=$PWD/scripts/parallel-shard-write-audit.cjs" \
node tests/phase3-ownership-snapshot-test.js
```

Use a unique audit directory per trial. Preserve an uninstrumented same-source reference before interpreting output parity or runtime. The instrumented command's exit/status and all evidence must be checked; a log directory or artifact merely existing is not a safety PASS. Future K integration must inspect every command's initialized record and mutation/port/subprocess calls. Do not attach it to the current running K jobs or clear any residue flag.

The preload observes synchronous, callback and Promise fs mutation APIs, FileHandle mutations, potentially writable opens, `net.Server.listen`, cwd changes and child-process launches. It preserves callback results, return values, thrown errors and promisified descriptor result shapes. Captured native fd calls write the evidence without recursively auditing the log. Recording failures propagate and fail the diagnostic. A child Node process inherits observation through NODE_OPTIONS unless it sanitizes its environment.

This is **Node API observation, not syscall tracing, a sandbox or a guarantee of complete write detection**. Native addons, workers/alternate runtimes, subprocess-internal writes and sanitized environments can bypass hooks. Shell command payloads and environments are deliberately not logged; subprocess calls require source review. High/low-level wrappers can produce multiple events for one underlying write. Reading a file is not recorded. Thus an initialized-only record supports no observed hooked mutation for that process; it does not prove universal absence of shared writes. Process cleanup and PID/procfs consistency remain separate requirements.

## Controls and CI

Run `node scripts/parallel-shard-write-audit-test.cjs`.

The self-test creates only its own temporary fixtures and cleans them. It verifies a read-only negative control (only initialization, no audit-log recursion), writes through sync/callback/Promise/FileHandle/descriptor APIs, rename destination/cwd, subprocess inheritance, an ephemeral loopback listener, native ENOENT behavior, and instrumented vs uninstrumented stdout/stderr equality. A destination that is a file instead of a directory must fail before the target body runs. A workflow mutation removing the self-test step must fail its contract.

One short self-test step is added to the existing `test-shard-contract` job, with the same job condition, Node22, five-minute budget and dependency graph. Existing steps, shards, iPhone conditions, J/C variables and diagnostics remain intact. K diagnostics themselves are not instrumented by this PR. Hosted Node22 self-test and final-HEAD CI/review remain pending until inspected.

Local Node24 real-command sample on source165d9244: `tests/phase3-ownership-snapshot-test.js` exited0 with and without the preload, stdout SHA256 `8056e4f0e4a519fadd3b17ccf41f6ef54b70cdb6d8641613fabfcbf117e73072`, empty stderr SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Only initialized was observed. This one-test observation is not a K29 PASS or a parallel/process-residue qualification.

## Cycle handoff — 2026-10-30 JST

Main at start165d924423f1e4bde8be8c801c28b15bbac76e72. Previous diagnostic #1215 is merged as37271e38; its post-merge Test #4325 and all applicable checks were re-fetched terminal successful (37 success, no pending/failure). Current main Test #4326 remains nonterminal. K #1219 exact HEAD56b509ed has Codex no findings/no threads; both Node22/24 comparison steps are active, so this work uses a separate branch and non-overlapping files/step. Main, target PR and reviews must be refreshed again at completion.

C gate remains the documented12 conservative-qualified aggregate-success observations, with failure/cancelled/early runs excluded; do not count newer C-only successes before the aggregate completes. Historical C artifacts directly verify original residue flags, not an independent post-cleanup listing. E #1203 remains Owner-held and production serial; exact-HEAD Node22/24 full33 safety evidence is documented in #1219. J2/C2 maintained. No E/K/H/I enablement.

Work A files in #1210/#1213/#1214/#1218 were inspected and remain untouched. H/I stay read-only: H has fixed scratch-path and actual asset-file mutation tests requiring future isolation, while I's earlier ~4.4GB parallel2 memory needs fresh qualification. Next priority is #1219's complete 1/2/4 artifacts, then this optional audit's hosted CI/review and any justified integration. No E merge without its separate Owner decision.


Supplemental C observation: post-#1215 main Test #4325 (run41017779598, C job123938005428) completed successfully. Downloaded C/J JSON confirms C2/25pass, J2/10pass, no signal/reason/timeout/residue flags; C digest unchanged. Its actual C summary executed25/seen628 matches its same-run contract628, peak2757/15983MiB (17.25%), wall889.9s. E log explicitly remains parallelism1/executed33. This adds one unique qualified aggregate-success observation to the previous12, yielding **13**, without re-counting earlier runs. Independent C post-cleanup listings remain unavailable. Latest main165d9244's run is still excluded until complete.
