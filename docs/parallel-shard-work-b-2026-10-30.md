# Work B CI evidence — 2026-10-30 JST

Snapshot main: `60bd759dd95159d6180489646312c5bd08dca206` (fetched at start). Test #4320 is nonterminal; queued/in-progress is not PASS. Previous main `069e4c38dcdbfff25f7a40b75b8196cf2273fc24` Test #4317 passed. E #1203 HEAD `20dcfe71a3fc5e8ad662c8f8497fac1120162ae1` Test #4310 passed and its exact-HEAD Codex summary completed without findings. E merge and production enablement remain Owner-held. Diagnostic #1215 original HEAD `14175c16fe05c0397f412b0bfc9c3ec6f7ade563` Test #4314 failed from the iPhone static job-boundary bug; both Node diagnostic jobs passed. See [diagnostic evidence](parallel-shard-process-diagnostic.md).

## C production observation

C is already 2; no variable operation is requested or performed. J remains 2; E production remains serial. Twelve completed runs have actual C log concurrency=2, 25 enumerated/passed/executed, zero failed/aborted/notStarted, no signal/reason/timeout, and zero command-level residue flags in downloaded JSON. All twelve C full enumeration digests and ordered labels match; digest `01ba9573fd09e0bb0ac6de70925cdd1793567c1773679e20a404465f2f0b0593`. Each run's canonical seen equals its own same-checkout contract job (627 or 628). Contract job uses shard A to enumerate the whole registry; its global seen is the relevant comparison. J artifacts all show concurrency=2, success, zero residue flags.

Repository-variable creation/update time cannot be read through the available connector. Therefore two counts are kept: **12 C successes / 11 aggregate Test successes / 1 unrelated aggregate failure**, versus a conservative **8 post-activation observations / 7 aggregate successes / 1 unrelated aggregate failure**. The conservative cutoff is the first directly observed C=2 log at 2026-10-29T07:15:55Z. Only runs created after that already-enabled observation count; #4306–4309 are held outside that count until Owner activation time is evidenced. The 10-run gate remains HOLD. No failed/cancelled workflows were relabeled green and no extra CI runs were manufactured to fill the count.

C reports record detection flags, not an independent post-cleanup process listing. All flags are false, but direct final process-group proof is unavailable for these historical C artifacts. Every non-A shard succeeded; #4314 A failed solely in the iPhone workflow static test. No canonical shard settings or execution contracts were changed. Causal performance impact on other shards is not isolated by these observational runs.

| Test | SHA (head) | C job | after conservative cutoff | aggregate | wall s | peak / physical MiB | seen |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| [#4306](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40831491312) | `6f00c95d5be8` | 123306556533 | unconfirmed | success | 867.6 | 2978 / 15983 | 627 |
| [#4307](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40832415361) | `378b101f81a8` | 123310838121 | unconfirmed | success | 872.2 | 2888 / 15983 | 628 |
| [#4308](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40833218443) | `2a61e5e09732` | 123320964298 | unconfirmed | success | 908.5 | 2623 / 15983 | 627 |
| [#4309](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40833950146) | `85a358ad6554` | 123319749106 | unconfirmed | success | 903.9 | 2874 / 15983 | 627 |
| [#4310](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40839157012) | `20dcfe71a3fc` | 123335269749 | yes | success | 521.6 | 2781 / 15983 | 627 |
| [#4311](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40839323555) | `b4fa2ae01f3e` | 123333014470 | yes | success | 869.0 | 2768 / 15983 | 627 |
| [#4312](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40839708182) | `dc43df997d49` | 123339375142 | yes | success | 514.4 | 2922 / 15983 | 627 |
| [#4313](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40841677714) | `96fa864f0aba` | 123343164752 | yes | success | 690.1 | 2966 / 15983 | 628 |
| [#4314](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40843743757) | `14175c16fe05` | 123364105409 | yes | failure | 519.6 | 2409 / 15983 | 627 |
| [#4317](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40846943419) | `069e4c38dcdb` | 123381289102 | yes | success | 726.0 | 2966 / 15982 | 628 |
| [#4318](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40847436515) | `afe0a2dab5ff` | 123363899006 | yes | success | 672.7 | 2266 / 15983 | 628 |
| [#4319](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/40847610841) | `86945dc595ed` | 123360492147 | yes | success | 875.3 | 2205 / 15983 | 628 |

Twelve-run C wall median: 796.8s. Run creation → C job start median: 69.02min (includes contract dependency and scheduling, not pure runner queue). Eleven successful Test creation → final job completion median: 116.27min. Peak in-use system memory range 13.8–18.6%, all below 50%. Each runner nproc=4; CPU models and full SHA/timestamps/job IDs, CPU utilization, total test time, other-shard durations and last-finishing job are recorded in [machine-readable evidence](ci-evidence/work-b-c-2026-10-30.json). Timing ratios are not a measured serial speedup. Run-level last-finishing jobs describe observed critical paths; schedule effects are not a causal model. Cancelled #4315/#4316 produced no C job and are excluded from both success and failure counts. Latest #4320 is pending and excluded.

## E and review gates

The old two-command Node 22/24 diagnostic is qualified hosted evidence, not historical root-cause proof. Local procfs/Node namespace mismatch is now directly observable via NSpid; attribution to the historical event remains unproven. Original residue flags are never ignored. The revised diagnostic compares full E at its exact HEAD under Node 22/24 and records per-command hashes/flags and post-return process groups. Its new results and final-HEAD required CI/Codex review must finish before qualifying the revised diagnostic. The diagnostic job can fail independently of the aggregate `test` job, so both must be checked.

E #1203 is HOLD: full-E safety evidence, C stability gate, latest-main compatibility and Owner final merge approval remain mandatory. Latest-main merge-tree checks for both E and diagnostic branches are clean at the snapshot. Work A open economic PRs #1210/#1213/#1214 were inspected as separate work; none was edited. No Economic Engine source changed.

## K read-only next experiment

K owns 29 commands, enumeration digest `4754f096494cac2753f5d41d59afe3790e70962fa10c8f4b028b6d6c12aaf5ef`. Previous recursive inspection reached 46 JS files: no filesystem-write/temp/port collision pattern found; the child-process import resolved to a synchronous read-only git rev-parse. This heuristic does not prove all dynamic paths safe. Three long commands were measured on Node 24 using wait4 rusage (independent of procfs PID lookup): 531.787s/626.3MiB, 234.905s/689.0MiB, 169.973s/535.2MiB; all exit0. The other 26 commands still need fresh standalone resource qualification.

Planned order (no K allowlist/workflow/variable changes):

1. Pin one source and enumerate all 29 plus the same-source contract. Run each alone once, recording exit/signal/output hashes/bytes, wall/user/system/maxRSS, file-write trace, ports and post-cleanup groups on a PID-consistent Linux host.
2. Use the exact same list to run isolated full-shard serial then longest-first concurrency2 and4, sequentially on comparable idle hosts, with at least three repetitions per level. Record physical memory and total in-use peak; reject unexplained failures, timeout, output drift, shared writes or residual groups. Do not run simultaneous measurement variants.
3. Compare measured medians and full output hashes with the same-commit serial reference; estimate runner occupancy separately from repository queue effects. Audit the longest command's lower bound before proposing a production opt-in PR.

Historical 29-command sum 1659.1s / longest 564.6s gives a fixed-duration LPT model of 829.6s at2 and564.6s at4. These are modeled bounds, not measured speedups. K=2 is the first candidate;4 requires separate memory/safety evidence and Owner approval. H/I remain later (I's historical ~4.4GB warrants caution).
