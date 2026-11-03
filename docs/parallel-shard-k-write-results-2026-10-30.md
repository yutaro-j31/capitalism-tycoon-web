# K hosted write observation — 2026-10-30

#1225/Test4343 ([run41053357200](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/41053357200)) completed on exact PR HEAD `17007a673c2cce89829d72beb4612813c99aff57`, pinned workload source `165d924423f1e4bde8be8c801c28b15bbac76e72`. Jobs124054639440(Node22.23.4)/124054639854(Node24.22.1), artifacts12982272978/12978834073. Both use4 logical CPUs/~15983MiB physical memory;22 host EPYC7763,24 host EPYC9V74. Different hosts do not isolate a Node-version performance effect.

| Node | clean serial seconds | audited serial | audited2 | audited4 | peak in-use MiB (clean/serial/2/4) |
|---|---:|---:|---:|---:|---|
|22.23.4|1699.725|1710.870|887.558|908.628|2288/2353/2607/3544|
|24.22.1|1301.684|1319.866|679.863|655.988|2508/2504/3105/4011|

These are single ordered observations, not medians. Audited serial/2 ratios are1.928/1.941; they include instrumentation and are not clean production speedups.4 is slower than2 on22 and slightly faster on24, consuming more memory on both. The earlier clean experiment's4 slowdown is not a universal rule. Do not derive speedup from test-time sum/wall or promise end-to-end CI savings from these timings. Sampled in-use peak stays<=25.10% physical, with normal sampling/serialization limits.

Every pass has29 enumerated/passed, failed/aborted/notStarted0 (232 successful command executions total), full digest `4754f096494cac2753f5d41d59afe3790e70962fa10c8f4b028b6d6c12aaf5ef`, same ordered command/args and contract. Every original residue flagfalse, no signal/reason/timeout/rescue, consistent PID/procfs identities and final process groups empty **including zombies**. Both hosted real controls and abnormal/timeout/process regressions passed. All174 audited command roots have initialized coverage and raw JSONL matching their records, with no non-initialization Node API events. This observation does not prove native/syscall/worker/sanitized-child completeness or authorize production K.

The offline auditor from #1227 passed all within-Node evidence checks, including decoded output hashes/bytes/lines/PASS counts, all four output captures identical within each Node, traced PIDs/groups and extracted raw logs. It correctly returned exit2 for a cross-Node stderr difference rather than silently accepting it.

## Cross-Node stderr cause established

Cross-Node stdout29/29 and stderr28/29 match. Only `tests/player-crisis-turnaround-ratchet-week-rollback-test.js` differs, in an intentional IndexedDB enqueue-rejection rollback diagnostic. Both stderr payloads are2613 bytes; the sole differing byte is offset1707 (zero-based), ASCII51 versus52, in the runtime stack frame:

```
Node22: at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
Node24: at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
```

Node22 stderr SHA256 `38c77360043860f51872789e7dcac5970d5cbffe6674eef69dfcc799be14a435`; Node24 `6e72056b379d257cd3fd2d861560cee7fa3d8b59e1ec21eb8ddf85727058a8ae`. Both exactly match their original K experiment hashes. The retained bytes therefore explain that earlier hash difference with direct evidence; it is no longer merely a guessed stack-line explanation. Source fixture intentionally rejects IDB enqueue and rollback assertions pass. No output normalization, hash waiver or auditor exit-code weakening was introduced. The cross-version difference remains explicitly reported and manually classified. Historical **E local leftover** cause remains a separate unconfirmed issue.

## Durable evidence and gate

[Compressed normalized JSON](ci-evidence/k-write-hosted-2026-10-30.json.gz) retains original report SHA256s, source/job/artifact identities, CPU/memory/namespace/contract data, all29 reference stdout/stderr captures,232 per-command measurements/original flags, spawn identities/final group listings/classifications and174 raw initialized JSONL payloads/digests. Read with `gzip -dc docs/ci-evidence/k-write-hosted-2026-10-30.json.gz`. Normalization retains the final snapshots/spawn identities, not every intermediate original trace event; originals remain linked through the run/artifact IDs. It is not a drop-in original-report archive for the CLI. Gzip is deterministic (mtime0).

#1225 merged as `97e47888492384a26f9c6cbcfe2518652456e4a3` after exact-head CI/Codex(no findings)/threads0, complete Linux evidence audit, latest starting main0a1ed064 Test4345 PASS and clean integration/focused checks. #1227 exact4afa46fc also reached full CI/Codex/no findings, merged as `92aaa5b6a325c23170300e2362d3f5ff0fcf3a0f`; combined treec9beff14 matches locally tested integration. New-main CI is nonterminal at this report, **not** postmerge CI PASS. E1203 remains Owner-held and K production1; J/C2 maintained. Work A branches/economic source untouched. C18 qualified after auditing unique completed main Test4345 (0a1ed064): C2/25pass/flags0/seen628/full digest+commands,peak2924/15983MiB=18.29%,J2 maintained; the historical independent final-group-listing limit remains. Next cycle must refresh main/CI/Owner decisions and this report's finalHEAD gates; no production E/K activation follows from diagnostic merges.

Compressed payload SHA256 `4669c3b8fa261a4febd8839f75905ac5acb2d773fc08f8ff3fdb69e834e36559`; decompressed JSON SHA256 `7866fb73870dc66b19e7f6fd5525e691794440e9117f37e6e5860655c1177e0d`. Both validated against the generated evidence.
