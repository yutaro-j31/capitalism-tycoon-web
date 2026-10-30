# H/I read-only follow-up — 2026-10-31 JST

Snapshot `42d774598aef785a91cbb325758f4df9e4be1260`; timings from completed main Test4352 ([run41070752147](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/41070752147)), workload SHA `0d2b60267e23489076b25b8d4e85336cab72a907`. Hjob124123918124/Ijob124123918155 both success. Only source reads, metadata enumeration and existing CI logs were used: **no H/I workload, parallel experiment, source mutation or setting change was executed**. All H/I command source files and package/production inputs are unchanged between the timed SHA and this snapshot; future changes need a new comparison.

[Manifest](ci-evidence/hi-readonly-2026-10-31.json) retains all54 H and8 I command identities/digests/direct-file hashes, every owned command's timing, source/job/run references, static hits, absent memory fields and explicitly hypothetical LPT models. The serial runner prints done-lines for628 seen commands, including0.0s for unowned stubs. Extraction matches **only canonical owned labels**, requiring exactly one exit0 done-line for each; positive-duration filtering would incorrectly discard fast owned tests. Log timing precision is0.1s; authoritative canonical totals below retain3 decimals.

| shard | executed/seen | canonical total | job elapsed | longest command |
|---|---|---:|---:|---|
|H|54/628|1622.834s|1629s|internal-venture-business-save-atomicity189.5s|
|I|8/628|1013.279s|1019s|competitor-product-counter-reachability212.1s|

H's next longest are finance-history175.8s and cash-write-runtime-guard140.2s. I's next longest are exploration-style185.9s and industry-event-response-plans-reachability152.2s. These are one hosted serial observation, not repeated medians or local2/4 measurements. H/I CPU model, nproc, physical and peak memory are **not emitted** by the current H/I jobs, so those fields remain null. The Owner's historical I parallel2~4.4GB warning remains a caution with metric/context unverified here; do not transplant J/C host memory into I or assert a memory gate PASS.

## H is blocked on shared checkout writes

- `tests/map-phase2-lazy-load-recovery-test.js:391` creates fixed `js/_scratch-lazy-load-negtest.js`, reads it during an async negative test and unlinks in finally. A concurrent writer/reader can collide; abrupt process termination can bypass finally.
- `tests/static-asset-cache-coherence-test.js:69` temporarily rewrites `css/d-ui-map-phase2-markers.css` and restores it; its later negative case similarly rewrites `prototypes/map-world-preview.js`. Map/cache readers in the same checkout must not overlap these writers. Restoration on normal exit does not prove safe concurrent reads or crash recovery.
- `scripts/asset-revision.js` defines a writing `writeStamps()` but this test uses read-only `computeRevision()`/`verifyStamps()` plus its explicit probes; the lexical hit in a definition is not a demonstrated extra stamp write.
- `cash-write-runtime-guard-test.js` writes its baseline only with `UPDATE_CASH_WRITE_RUNTIME_BASELINE=1`; default is read/compare. That opt-in must remain off in diagnostics. `stock-split-price-history-test.js` reads `SPLIT_EXTERNAL_FIRST==='1'`; the scanner's assignment-looking equality match is a false positive, not a demonstrated environment write.

H also has explicit `--max-old-space-size=4096` flags in finance-history and supply-rng. These are per-process heap caps, not measured usage or a safe total-memory bound. The procurement npm command contains four sequential Node children; supplier-material coverage also appears in a separate canonical npm command. Every existing invocation stays in the54-command contract; do not deduplicate tests to accelerate it. The manifest fingerprints all compound npm child files, not just the first.

A possible **future design**, not implementation/approval, is separate checkout isolation or a strictly serial writer phase before all readers, including crash-failure containment and file-restoration evidence. Both keep every test/assertion. The model places the two known unconditional writers (rounded20.4s combined) before all52 others. Fixed-duration LPT would yield821.4s at2 and421.2s at4, ignoring CPU/memory/I/O contention and all unproven safety assumptions. These are not executed speeds or a safe schedule certificate. H needs shared-state/port/process/order and sampled memory evidence before a parallel diagnostic; production enabling is not approved.

## I is unqualified despite no static hits

The current depth-limited scanner reports no shared-write hits for8 commands; direct selected source search found no fs mutation/port/subprocess patterns. This is not dynamic/native/worker completeness. Tests simulate durable saves in their harness; do not equate in-memory IDB fixtures with proof about every filesystem path. Fresh per-command CPU/memory, namespace-consistent process groups, temp/port/order observations and retained outputs are missing. A future diagnostic should start at2 with physical-memory<=50% enforcement and all failure/timeout/residue controls; do not infer4 is safe from a null/static result. Hypothetical fixed-duration LPT509.5s at2/270.0s at4 is only a model; the212.1s longest command is a serial-duration floor, not an immutable future wall time under contention.

## Priority and actual critical path

1. **K remains the most prepared candidate**, production1:29-command hosted22/24 serial/2/4 and runtime-write evidence already preserved on main. All29 direct K files plus selected production/index/helpers/fixtures/runner/config/registry/package paths are byte-unchanged since the165d9244 pin at this snapshot. This selected-path comparison is not a complete dynamic dependency proof. Work A #1231 actively changes K's phase3-ownership-snapshot test outside this snapshot; requalify the future merged source and never overwrite that PR. Latest-source/source-closure review and separate Owner K enabling approval remain gates; prior single2~1.91x is not an end-to-end promise.
2. **H design comes before H execution** because the shared checkout writers are confirmed, while potential occupancy savings are larger. No implementation or parallel run is authorized by this read-only report.
3. **I follows fresh memory evidence**, with the historical~4.4GB caution and no current memory qualification. H/I production variables/allowlists/workflows remain unchanged.

On Test4352, A ended15:20:55Z, D15:13:37, H15:12:40, G15:06:40, K15:06:39, I14:59:33; aggregate15:21:01. With fixed start times, accelerating H alone would not remove A's8m15s later finish, nor I's21m22s gap to A. Runner occupancy/queue effects are separate and not proven by these arithmetic counterfactuals. No runner quota~20 claim, main-push reduction, dependency change, F split or Node/WebKit consolidation is made.

## Handoff

#1230 exact6314fd82 full CI4354/Codex no findings/thread0 and exact latest-main focused gate passed; merged42d77459. New-main CI is nonterminal at this report, not postmerge PASS. Work A economic code/branches/PRs untouched. J/C2,E/K1 maintained, C19 previous qualified observations retained until fresh full audits; historical independent C final-group listing limitation and E local leftover cause remain. E1203 stays Owner-held; E merge/E2 and future K production remain separate Owner decisions. This docs-only report needs reference/data/diff validation plus its finalHEAD CI/review; no H/I experiment should be inferred from synthetic scheduling calculations.
