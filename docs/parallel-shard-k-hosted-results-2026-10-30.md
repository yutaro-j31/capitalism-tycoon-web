# K hosted comparison — 2026-10-30 JST

## Result and completed gate

PR #1219 final HEAD `56b509ed8e1f4b04b7a8bb8b7c9cb355efaeedd5` Test #4328 ([41019864423](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/41019864423)) PASS:22 successful checks,3 event-inapplicable skips,0 pending/failure. Exact-HEAD Codex completed/no findings, review threads0. Fresh integration tree9b798361 matched the tested HEAD; diagnostic/iPhone/JCK workflow/trigger/timeout/matrix/registration/YAML/diff checks passed. Every preexisting workflow job and production runner/config remained unchanged. The diagnostic PR was merged under existing low-risk CI authority as `39e71474b1fd2852e357f3a91206954fb2f7754e`.

**K production remains serial.** These are first paired hosted observations, not production enablement approval. Dynamic shared-write evidence remains a separate concern. Post-merge Test #4332 is pending at this record; no new-main PASS is asserted. Main165d9244 push Test #4326 passed; schedule #4331 extended acceptance is a separate execution and was still active at merge verification.

## Measured comparison

Both jobs pin the same target source `165d924423f1e4bde8be8c801c28b15bbac76e72`, use EPYC7763/nproc4/15983.05MiB and sequentially run serial, longest-first2, then4 on each assigned host. They are distinct VMs; matching CPU model does not establish identical load/calibration.

| Node | concurrency | wall s | serial wall / wall | peak in-use MiB | system CPU |
| --- | ---: | ---: | ---: | ---: | ---: |
| 22.23.4 | 1 | 1678.274 | 1.000 | 2246 | 29.23% |
| 22.23.4 | 2 | 879.455 | 1.908 | 2719 | 57.43% |
| 22.23.4 | 4 | 903.721 | 1.857 | 3338 | 83.66% |
| 24.22.1 | 1 | 1636.087 | 1.000 | 2498 | 28.01% |
| 24.22.1 | 2 | 853.113 | 1.918 | 2995 | 55.25% |
| 24.22.1 | 4 | 868.623 | 1.884 | 4064 | 82.51% |

Speed ratios use separately measured serial wall and parallel wall from the same job. They do not divide summed parallel test time by wall. There is one paired observation per Node, not repeated medians or a Node-version performance conclusion. Peak in-use memory includes runner baseline/cache and is sampled; it is not summed per-command RSS. Maximum observed physical fraction25.43%, below50%.

Four is slower than two by2.76% (22) /1.82% (24) and uses more memory. The longest command, `full-index-weekly-validate-208w`, grows from571.477→592.563→903.718s (22) and557.910→583.696→868.619s (24). At4 it sets nearly the entire wall. Increased CPU contention is a plausible contributor, but no scheduler/GC profiling was performed to establish its cause. The old fixed-duration LPT prediction is not a measured speedup and understates this slowdown.

**Recommendation for a later Owner decision: K2 before K4.** The observed per-run occupancy reduction versus serial is798.819s (22) /782.974s (24). This does not imply the same reduction in total repository CI completion time.

## Integrity and process evidence

Artifacts downloaded and audited:

- Node22 job [123944474401](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/41019864423/job/123944474401), artifact12963429052.
- Node24 job [123944474575](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/41019864423/job/123944474575), artifact12963984422.

All six passes have29 enumerated/passed, failed/aborted/notStarted0, same full command digest `4754f096494cac2753f5d41d59afe3790e70962fa10c8f4b028b6d6c12aaf5ef`. Every original residue flag isfalse, no signal/reason/timeout, all29 classificationsclean per pass, final process groups entirely empty (including no zombies), no rescue cleanup. Node PID/procfs identity matches. Every per-command state/exit/signal/stdout+stderr SHA256/bytes/lines/PASS count matches its same-Node serial oracle. Existing intentional-background controls and abnormal-exit/timeout runner regression also passed. No original flag was cleared or ignored.

[Durable normalized evidence](ci-evidence/k-hosted-2026-10-30.json) preserves source/diagnostic/runner/report hashes, hardware, reference command outputs, each round's output fingerprint and resources, and per-command timing/CPU/RSS/original flags. Fingerprints are SHA256 of compact JSON arrays in `fingerprintFields` order, with commands in enumeration order; all three fingerprints must match within each Node. Original full trace JSON remains in the linked Actions artifacts while retained. Normalization preserves results without pretending to retain every original spawn timestamp/snapshot.

The empty static shared-state heuristic and stable output are not proof of every shared write being absent. Native/API write observation prepared in #1220 is not applied to these already-completed trials. That optional helper still needs final integration/review gates before a new experiment. Prior local procfs mismatch remains disqualified for process/RSS safety; kernel wait4 standalone measurements are separate. E's historical local flag cause remains unresolved and is not reinterpreted from K results.

## Queue and critical path

On main165d9244 Test #4326, K job123949425810 ran08:06:34–08:34:10 UTC,1656s. A job123949425783 ran08:12:29–08:42:50 UTC,1821s, finishing8m40s after K. Under fixed job start times, shortening K alone does not change that run's final shard completion. Freed occupancy can help later scheduling, but its queue effect requires an actual enabled-run comparison; it is not inferred as a direct critical-path saving. No main-push reduction, dependency change or shard split is included.

## Handoff

Post-merge main CI must be checked before another merge. #1220 exact HEADb2b55ede already has Test #4329 PASS and Codex no findings, but it is held for current-main integration/final verification. Its clean combined tree with this diagnostic isf97cb4e4; no active CI was superseded. E1203 remains Owner-held with its existing exact-HEAD safety evidence and C gatePASS13 observations; no E/K variable change. J2/C2 maintained. Work A files/branches remain untouched. Next work is verified #1220 integration and, if warranted, a separate runtime shared-write observation of all K commands before requesting production approval.
