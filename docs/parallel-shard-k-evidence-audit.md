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
