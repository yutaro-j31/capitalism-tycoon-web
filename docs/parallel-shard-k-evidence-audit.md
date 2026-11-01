# Offline K write-evidence audit

This independent, read-only diagnostic consumes the four-pass Node22/24 artifacts from #1225. It never launches the K workload, changes a shard or edits the active experiment. It imports only the already-merged production runner's enumeration/digest helpers. Normal canonical/test/diagnostic jobs are unchanged except one short required shard-contract self-test step.

```
node scripts/parallel-shard-k-evidence-audit.cjs \
  /path/to/clean-checkout-at-165d9244 \
  /path/to/extracted-node22 /path/to/full-k-node-22.json \
  /path/to/extracted-node24 /path/to/full-k-node-24.json
```

The source checkout must be exactly `165d924423f1e4bde8be8c801c28b15bbac76e72` with clean tracked files. The auditor records the source's canonical29 command identities/digest, contract seen and runner SHA256 rather than trusting the report's declared command list. This pin deliberately matches #1225; it is not a validator for arbitrary later-source experiments. Paths refer to downloaded, extracted artifacts; do not point at a partial live run and interpret rejection as a workload defect.

Each Node report must have a consistent Linux PID/procfs identity, matching source/runner/contract, no rescue/error, and exactly completed clean serial/audited serial/audited2/audited4. Each pass needs29 successful commands, correct concurrency/full digest/ordered command list, no signals/reasons/residue flags, measured memory<=50%, finite wall/CPU metrics,29 traced spawn identities/classifications and an independent final group snapshot with **no members including zombies**. This final listing check is stricter than checking only false residue flags. Missing fields, passes or coverage fail.

Every stdout/stderr base64 capture is decoded without normalization and checked against its length/SHA256. stdout line/PASS counts are recomputed. All four passes must have byte-identical outputs within each Node. Audited commands must match root PID/label and clean initialized-only events. Raw PID-named JSONL files must match the report's process list and event contents under `audit-node-NODE/PASS/INDEX/`; missing, extra or changed raw logs reject the evidence. A report boolean, artifact presence or synthetic fixture alone cannot establish these checks.

Exit0 means the supplied complete evidence matches this audit scope; it does **not authorize production** or prove Node hooks cover native/syscall/worker/sanitized-child operations. Exit1 rejects incomplete/inconsistent/in-scope failing evidence. Exit2 means both within-Node evidence checks passed but cross-Node raw output differs and needs review; JSON identifies exact command/stream/hash/byte counts. Different Node output is not silently normalized, ignored or automatically called harmless. Inspect retained bytes and source to classify it. Report provenance is not cryptographically authenticated by this utility; retain GitHub SHA/run/job/artifact identities and verify CI/review separately. Process snapshots/sampling also retain their observation limits.

`node scripts/parallel-shard-k-evidence-audit-test.cjs` builds explicitly synthetic29-command/four-pass artifacts and validates acceptance plus19 report mutations, corrupt/missing raw files, binary bytes, cross-Node difference classification and duplicate-version rejection. These are test controls, not hosted performance/safety observations. The existing required contract job runs them on Node22. No tests/conditions/timeouts/variables are removed or weakened.

## Work B handoff — 2026-10-30 JST

At start main `0a1ed0649bbfc7c391b149a8cd3c54a4ec325eb9` after Work A #1224 merged; main Test4345 nonterminal. Previous main d16eb41f Test4341 succeeded, while3fbf6f42 Test4340 was cancelled. Active #1225 exact17007a67 has Codex completed/no findings/threads0; ordinary tests passed and only the two full hosted K comparisons remain active. Its HEAD/job/worktree is untouched; no extra push/rerun or duplicate experiment. This utility is independent preparation for inspecting the completed artifacts, not new K safety evidence.

All12 starting OPEN PR HEAD/base/CI/files/reviews/threads refreshed, no unresolved threads. Work A #1226 edits economic docs/refounding test; its branches and all economic code remain untouched. Issue1171 is still open but its serial abnormal-exit gates are already fixed in current main; no duplicate implementation. J/C2, E/K1 maintained. C16 qualified cohort is retained until newer runs are fully audited; partial/cancelled runs are separate, and historical independent C final-group listing evidence remains unavailable. E #1203 remains Owner-held; historical local leftover and original K cross-Node stderr causes remain unconfirmed. K/E production require separate Owner decisions.

Local focused/synthetic controls and workflow checks are recorded in the PR; hosted final-HEAD CI/Codex remain separate gates. Next: inspect #1225 completed reports/raw logs with this tool, classify exact stderr differences, investigate failed/incomplete evidence before any merge, then refresh latest-main integration. No production activation is part of this PR.

## Verified performance profile (2026-11-01 replay)

After every existing integrity check passes, each node in the JSON output retains
`host` (CPU model, logical CPU count, physical memory bytes). The result also records
`sourceSha` and `runnerSha256`. Each round retains its original wall time and sampled
whole-host `peakMiB`, and now exposes `systemCpuUtilization`, `runnerCpuSeconds`,
`cpuSecondsSampled`, `sumCommandWallMs`, and the three `longestCommands` by measured
command wall time. Ties use canonical command index. Each longest-command row preserves
its index, label, wall milliseconds, CPU milliseconds and sampled RSS MiB. Sorting uses
a copy; raw reports and canonical execution order are unchanged.

The sum is overlapping command time when concurrency exceeds one. It is **not serial
speedup, runner occupancy, or a causal workflow critical path**. Recorded per-command RSS
is distinct from whole-host memory in use and is not a bound on unsampled transients.
CPU hosts differ across Node versions; these fields do not establish host comparability
or a production-parallelism approval. Exit0/1/2 and all output/residue/memory checks are
unchanged, including the exit2 cross-Node output review requirement.

Actual offline replay used the committed complete archive from
[the changed-source results](parallel-shard-k-refresh-results-2026-10-31.md), gzip SHA256
`cbd0dbbde22ab5907d2d605e00cdb37db273722eaefe1d8f0c2850a3080aab63`, with a clean
checkout at `9223004d0bd2e9b0ebb435edf599d01b72020fd0`. No K workload was rerun.
The CLI still returned **exit2**, solely for the already recorded ratchet test stderr
frame difference. Both within-Node evidence audits completed; this is historical
2026-10-31 evidence replay, not fresh current-main safety qualification.

| Node / recorded host | pass | round wall s | longest command wall s | sampled host peak MiB |
|---|---|---:|---:|---:|
|22.23.4 / Xeon 8573C|audited serial|1395.377|478.019|2436|
|22.23.4 / Xeon 8573C|audited 2|737.781|506.898|3268|
|22.23.4 / Xeon 8573C|audited 4|749.660|749.658|3098|
|24.22.1 / EPYC 9V74|audited serial|1314.103|453.324|2539|
|24.22.1 / EPYC 9V74|audited 2|678.633|458.989|3055|
|24.22.1 / EPYC 9V74|audited 4|668.600|668.597|3958|

In all eight recorded rounds the longest command is
`tests/full-index-weekly-validate-208w-test.js`; the next two are
`tests/supply-material-cost-inflation-test.js` and
`tests/yen-ceiling-seeded-full-run-test.js`. The near-round-length longest command at
four-way concurrency is an observed concentration, not proof of its cause or permission
to remove assertions/split tests. Any performance implementation still needs separate
source review, safety evidence and Owner approval where applicable. J/C remain 2;
E/K remain serial and E #1203 remains Owner-held.
