# K source refresh diagnosis — 2026-10-31 JST

The previous complete K write/output/process observations target `165d924423f1e4bde8be8c801c28b15bbac76e72`, not a moving main. Work A #1231 merged additional actual same-week stock-split / save-failure / retry / fresh-hydration assertions into `tests/phase3-ownership-snapshot-test.js`. Its existing success log also gains a new line. Thus the old payload hash and timing cannot certify this changed command. Work B does not edit the economic test or production engine.

This branch-only diagnosis pins **`9223004d0bd2e9b0ebb435edf599d01b72020fd0`** (main after #1232). At that snapshot the other28 direct K scripts are unchanged from the historical pin. Selected `js`, `index.html`, `tests/helpers`, `tests/fixtures`, runner/config, canonical registry and `package.json` are also unchanged; this is a selected-path comparison, not complete dynamic dependency closure. Both snapshots still enumerate29 commands, seen628, digest `4754f096494cac2753f5d41d59afe3790e70962fa10c8f4b028b6d6c12aaf5ef`.

| source | phase3-ownership-snapshot-test.js SHA256 |
|---|---|
|165d9244|55cd3e4220071a71c09d9cbd4f7dc967368d05dbf3c493e821780ceb37d7d274|
|9223004d|1be1f62f37ebf15070449f671d307ca5013b02be7ccf5c60c23e330aa3420466|

## Experiment and gates

The existing K write-observation job is retargeted only to PR branch `ci/k-source-freshness` and the new immutable checkout/claimed SHA. It retains Node22/24,120-minute budget, fail-fast false, process controls/regressions, always-upload evidence, read-only token, no persisted checkout credentials, clean serial then audited serial/2/4, all29 commands, raw stdout/stderr and per-PID API logs. No new job or normal/main-run work is added. Every other workflow job/key is YAML-equivalent, including canonical J/C settings and iPhone WebKit conditions. This is a justified changed-source experiment, not an unchanged CI rerun.

The offline auditor now accepts an optional **explicit full pinned SHA** as the last argument. It still requires exact clean source HEAD, independently enumerates and reads that source contract/runner, and requires each report's target SHA to match. Omitting it keeps the historical165d default so old artifacts remain auditable. A floating ref, short/invalid SHA, mismatched HEAD or dirty tracked source rejects before evidence can qualify. No signal/timeout/OOM/residue/hash/memory rule is relaxed; cross-Node output differences still return review-required exit2, even when an older Node stack-line difference was explained.

```sh
node scripts/parallel-shard-k-evidence-audit.cjs SOURCE_ROOT ARTIFACT22 REPORT22 ARTIFACT24 REPORT24 9223004d0bd2e9b0ebb435edf599d01b72020fd0
```

Compare within-Node clean/audited serial/2/4 byte-for-byte; reclassify any cross-Node difference using retained bytes, never normalize/ignore it. Verify namespace identity, original per-command leftover flags, raw PID coverage, final group listings including zombies, memory<=50%, failure/signal/timeout counters and CPU/wall. Do not call a PID/procfs-inconsistent local host safe. New hosted results and final-HEAD CI/review are pending at PR creation, not PASS. Later source changes require another explicit comparison; this snapshot is not perpetual qualification or production approval.

## Focused validation and handoff

Local Node24 auditor negative controls (including new SHA/default/dirty-source controls), write observation self-test, workflow contract, syntax and YAML semantic diff pass. Clean worktree metadata-only `expectedFrom` succeeded for both immutable sources (29/628/digest equal); no K workload was launched locally for that check. Opt-in stub regression PASS. The separate local process regression FAILS at its background-leftover assertion (line134); diagnostic identity control independently reports Node/procfs PID mismatch and exits1 before launching groups. This local host is therefore UNQUALIFIED for residue/RSS safety, not a PASS or grounds to ignore a flag. The unchanged full process regression remains mandatory in the hosted Node22/24 job. The workflow contract initially rejected the deliberately retargeted branch; its exact expected branch and checkout/claim assertions were updated together, preserving the original branch-only restriction.

#1232 finalHEAD e197aa66 full Test4357/run41087873941 SUCCESS, exact-head Codex completed/no findings/threads0; current-main H/I source hashes and integration focused checks passed. Merged as9223004d. Its postmerge Test4360/run41104701943 was queued at first check, not postmerge CI_PASS. H/I stay READ_ONLY, no experiment or isolation implementation.

Main before this merge779c33b3 Test4358/run41089002951 SUCCESS: complete12-shard metadata shows job creation-to-start median96.5s, execution median1591.5s, run-to-aggregate3106s, last shard F, aggregate tail5s, within-workflow observed overlap13. These are this single run's medians, not a cross-run distribution, pure capacity queue or account quota proof. No main-push/contract-dependency/F-split/Node-WebKit changes follow.

Fresh C/J artifact+log audit of4358 adds one unique success to the prior20: C2/25passed/executed25/seen628/full digest and ordered commands equal, failure/abort/notStarted/timeout/original leftover flags0; peak2888/15983MiB=18.07%, wall861.659s,total1723.125s, CPU56.35%. J2/10passed, flags0, peak3017/15983MiB; E1/33. Aggregate and every applicable canonical shard succeeded. C qualified total21, keeping prior cancelled/overall-failed cohorts separate; conservative count uses run creation after the first independent C2 observation2026-10-29T07:15:55Z, not an assumed variable setting timestamp. Historical C artifacts still do not independently list final process groups; this remains an evidence limitation, not silently resolved by K's stronger diagnostics.

E #1203 remains held at20dcfe71, with its prior Linux Node22/24 full33 serial/2 parity and empty groups intact; historical local leftover cause remains unconfirmed. E final merge, E2 enabling, and K production enabling each need separate Owner approval. J/C2,E/K1 unchanged. No Work A branch/PR/source, test counts, production allowlist or variable changed. Next priority is exact new diagnostic HEAD CI/Codex and complete two-Node artifacts; do not push while this HEAD's CI is active.
