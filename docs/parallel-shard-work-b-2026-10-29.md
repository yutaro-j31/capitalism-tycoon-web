# Work B takeover — C activation gate / E preparation

Evidence snapshot: 2026-10-29 JST. Main: `e731bacb48049cf81765bcb526042bed1795b552`.
This is a dated observation, not a claim about future run state. No production economic source was edited.

## C / J / E gates

- Main [Test #4304](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40825797954) succeeded. Commit checks: 51 success / 9 non-applicable skipped / 0 failed or pending (60 checks). The check inventory includes other workflows.
- C [job 123291913392](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40825797954/job/123291913392): actual env `TEST_SHARD_PARALLELISM: 1`, canonical `executed=25 seen=627 total=1317.657s`. **Not a parallel pilot**.
- J [job 123291913422](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40825797954/job/123291913422): actual concurrency 2, 10 enumerated/passed, 0 failed/aborted/notStarted, digest prefix `aea0ed6ef221`, canonical executed 10 / seen 627, wall 675.5s, total 1326.615s, system CPU 56%, peak system memory in use 3160 MB. Runner: AMD EPYC 9V74, nproc 4, physical memory 15983 MB. The memory ratio is 19.8%. This log alone does not prove absence of leftover processes; that requires the report JSON.
- E [job 123291913443](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40825797954/job/123291913443): actual env 1, canonical executed 33 / seen 627 / total 936.016s. E's opt-in implementation remains PR #1203, not main.
- C activation prerequisites are satisfied: merged opt-in code, green current-main CI, J remains 2, C has 25 commands. **Owner action required:** set `TEST_SHARD_PARALLELISM_C=2`; record the setting time; verify a newly created run's actual concurrency and full acceptance evidence. The available GitHub connection has no repository-variable mutation capability. No privilege bypass was attempted. Qualifying C observations at takeover: **0/10**.
- E's original HEAD `2d52b3aefd5f68e291b8d2f24503a223593c9d33` had successful [Test run 40788249912](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40788249912). The Codex summary comment records completed review, that exact SHA, no findings or unresolved findings; there are no inline comments. This evidence does not certify an updated HEAD.
- E was integrated locally with current main without conflict. The additional contract pins the reviewed count to 33 and compares E's parallel `seen` against its contract mode. Rollback instructions now distinguish current status, C's 10-run gate, J's unchanged 2, and E's separate merge/activation decisions. Final updated-HEAD CI and review must be re-established. **Do not merge E before C's gate and Owner's merge decision.**

## Local verification limitation

Host Node is v24.22.1 (CI uses Node 22); nproc 9, physical memory approximately 9967 MB, cgroup cpu quota 8 cores. Local timings are not CI timings.
The unchanged `parallel-shard-runner-test.js` failed its leftover-process assertion at line 134. A minimal diagnostic showed Node `process.pid=5` while `/proc/self/stat` identified PID 4146; a live child PID returned by Node did not exist under `/proc/<pid>`. The command sandbox exposes mismatched PID namespaces and procfs. This prevents trustworthy local `/proc` process-group/RSS/CPU accounting. No assertion was weakened and no runner change was made to mask it. Verify the unchanged regression on GitHub's normal runner; local residual-process and memory claims remain unverified.

E's real 33-command serial/parallel output SHA256 comparison is collected separately after this update; a pending run is not a PASS. Synthetic opt-in tests and workflow contracts are separate evidence from real test parity.

## Queue and execution snapshot

Source: the latest 100 repository workflow runs returned by the API at inspection, filtered to Test (26 runs created 2026-10-28 23:32:42Z through 2026-10-29 07:12:31Z), plus each run's complete jobs page (0 or 21–22 jobs; no truncated pages). Outcomes in this snapshot: 14 success, 3 failure, 5 cancelled, 4 pending. Pending and cancelled are not counted as success. Statistics below use only the **14 successful workflows**, with 168 successful shard jobs. They are a mixed historical population, not a controlled before/after comparison.

| Metric | Median |
|---|---:|
| Test creation → final update/completion (14 successful runs) | 109.73 min |
| PR only (10 successful runs) | 109.73 min |
| main push only (4 successful runs) | 118.61 min |
| Shard job creation → start (168 jobs; queue measure) | 37.66 min |
| Test run creation → shard start (168 jobs; includes workflow/dependency delay) | 55.31 min |

| Shard | Successful-job execution median (14 each) |
|---|---:|
| A | 25.45 min |
| B | 21.03 min |
| C | 27.41 min |
| D | 26.13 min |
| E | 23.24 min |
| F | 27.68 min |
| G | 25.80 min |
| H | 26.83 min |
| I | 27.13 min |
| J | 14.09 min |
| K | 24.78 min |
| L | 25.35 min |

On latest main alone, Test wall was 44m58s; the last shard was A (30m26s execution), then aggregate Test took 4s. C finished at 06:25:29Z and E at 06:22:23Z, before A at 06:36:28Z. Therefore accelerating only C/E would release runner capacity but would not directly reduce this run's final completion time with start times held fixed. Queue-wide benefit requires new observation.

Across the 14 successful workflows, last-finishing shards were A/C/F/I/K/L twice each and G/H once each. There is no single permanent critical shard. Queue time frequently exceeds execution time, and later-starting short jobs can become critical.

Observed overlapping Test-job execution intervals peak at **19**, excluding other workflows/accounts. This is a lower bound on observed activity, **not proof of an account limit of 20**. The connection does not expose an authoritative account concurrency entitlement or hosted-runner capacity. Ready jobs waiting tens of minutes, multiple overlapping PR runs, and main-push workflows are evidence of contention; account quota vs hosted capacity cannot be separated with these endpoints.

Five cancelled push runs have no job records in this snapshot. Test's concurrency group uses PR number or ref; PR runs set `cancel-in-progress=true`, main pushes set it false. Different PRs therefore still compete. Replacement of pending runs within the same concurrency group is consistent with these zero-job cancellations; cancellation is not a test failure. No concurrency or trigger change was made.

Three historical failures were shard A / aggregate Test (runs 40798863544, 40798196599, 40797388624), not C parallel failures. The first log includes an expected J canonical-summary assertion failure. Current main's A succeeds; this report does not relabel those historical failures as successes or infer their full root cause without further investigation.

C/E use two child processes **within one job**, not two Actions runners. A first-order estimate using half of historical serial job duration would release about 13.7 and 11.6 runner-minutes per Test run respectively, with combined savings about 25.3 runner-minutes. This is a capacity planning estimate only: startup/serial work, CPU/memory pressure, hardware variance, and queue order can change it. It is not a measured speed-up or guaranteed reduction in workflow wall time. No main-push reduction, contract dependency change, F split, or Node/WebKit merge is authorized or implemented.

## Next candidates (read-only)

| Priority | Candidate | Audit / constraint | Next evidence |
|---|---|---|---|
| 1 | K | 29 commands; heuristic shared-state scan empty. Latest-main longest single command `full-index-weekly-validate-208w` is 564.6s, imposing at least a 9.41min floor before parallel contention. | Same-SHA output parity at 1/2/4, memory and residue checks before opt-in proposal. |
| 2 | H | 54 commands; writes tracked assets and `js/` scratch files. Existing serial group isolates `static-asset-cache-coherence`, `map-phase2-lazy-load-recovery`, `cash-write-runtime-guard`. SPLIT_EXTERNAL_FIRST env assignment is process-local. | Manually trace writes and relative requires, preserve whole serial phase, verify no file/port/order collisions; only then local timings. |
| 3 | I | 8 commands; heuristic scan empty, but previous parallel-2 peak was about 4.4GB. Longest observed node command is competitor-product-counter-reachability at 281.3s; npm command timing must also be included before stating the shard's longest-test floor. | Prioritize memory measurements at 2; do not infer safe 4 from CPU count. No production enablement without Owner approval. |

Empty heuristic scans do not prove safety: transitive imports, async file APIs, shell scripts, shared ports and ordering still require review. Local 2/4 speed and trustworthy resource/residue results have not yet been established in this environment. No I/K/H allow-list or workflow change was made.

Work A conflict check: open #1210 changes economic M&A/ownership files and focused tests; #1211 changes turnaround code plus `tests/run-all.js`; #1212 changes margin/ownership files and tests; #1213 changes IPO/engine/ownership files and tests. E's delta is limited to test.yml, parallel runner config, two parallel contract tests and CI docs. Current-main shared files were accepted as-is; Work B does not edit Work A's branches or economic code.
