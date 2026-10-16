# Capitalism Tycoon Web — Development Handoff

MAIN SHA: `26a22a971db457025821ef27503163f4ebaef927`
CURRENT PHASE: Phase 3 — IN PROGRESS, Stage F
CURRENT SLICE: P3-5 external listed source-evidence adapter
IMPLEMENTATION STATUS: Pure opt-in API implemented; not integrated into a combined ownership view, not a completed Phase 3 slice. Shared/individual design proposals #995/#996 remain unmerged dependencies for contract adoption.
OPEN PR: See the PR containing this record.
PR HEAD SHA: See the PR's final commit/check-run evidence; this document does not certify later commits.
FILES CHANGED: `js/economic-read-model.js`, focused adapter test, canonical runner/shard registration, this handoff.
TESTS PASSED: New adapter test; existing ownership projection/reconciliation and economic read model; test registration, shard contract, syntax and static checks. Further executed checks and final independent re-review are recorded in the PR.
TESTS FAILED: Initial added malformed UTF-16 negative fixture reproduced an exception; fixed by descriptor-safe source validation. No outstanding failure in the focused adapter test.
CI STATUS: Not yet run at document creation. Main SHA's Test/Strategy/Pages/attestation workflows were successful; docs-only main did not imply fresh execution of all economic writer workflows.
GATE STATUS: S local evidence in progress; merge gate pending applicable final-HEAD CI and contract integration. Phase F/Q not complete.
MERGED: NO. No ownership authority or consumer changes.
KNOWN P0/P1: P3-4 remains blocked. #1008 personal VC refounding loss has open fix #1016. Debt P4-AUD-001–008 remain subject to their exact issue/PR dispositions; open #989/#990/#1010/#1015 are not evidence of repairs merged into main. No new production P0/P1 reproduced by this read-only work.
DEFERRED TO STAGE Q: Broad untouched-writer audits, mass seed/century simulations, scale/calibration campaigns. No affected writer safety requirement waived.
BLOCKERS: Shared/individual contracts require integration and review dispositions. No merge authority is inferred for this new implementation PR. Phase 4 Entry and P3-4 cutover remain unapproved by this work.
OWNER DECISIONS REQUIRED: New implementation PR merge permission after review/CI; later Phase 4 Entry and exact authority migrations only when their prerequisite evidence is ready.
NEXT TASK: Resolve #995 shared coverage/review and scheduling alignment, then #996 contract adoption; complete remaining adapter/composition coverage without changing live consumers. Continue safe read-only slices independently of blocked writers.

## Delivered boundary

`economicReadModel.projectExternalListedHoldings(rawState, optionalIndex)` preserves account quantities with explicit source references, unique diagnostic position IDs and unknown issuer/class/voting/economic denominator evidence. A unique retained startup IPO link with zero residual private stakes can identify a **source-scoped** startup issuer; it never proves class continuity or voting rights. Plain market IDs, issued counts and ticker/name matches do not establish legal ownership rights. Company holder IDs are active-slot references with unproven generation; personal/company positions are never pooled.

Personal own-ticker lots delegate to existing P3-2. Conflicting player/IPO aliases mark that delegation quarantined. External rows include replacement metadata for future composition, but existing P3-1/2 rows are **not** concatenated or replaced by this PR. All current external positions retain null ownership keys/class/votes/fractions and `assetRole=unresolved`; this cannot support a wealth total or an executable command. Missing/delisted rows preserve holding quantities; duplicates and conversion conflicts fail closed.

`buildListedHoldingsIdentityIndex(rawState)` is deliberately scoped to P3-5 evidence. It is an opaque, ephemeral source handle, bound to the same raw object and copied relevant source fields; changed relevant fields and foreign/forged handles produce `STALE_EVIDENCE`. It is **not** #995's proposed common cross-slice snapshot token, identity registry or valuation/liability snapshot binder. Unrelated prices/history/cash are not captured, cached or certified by this handle. Callers must provide a fresh committed view; there is no persistent cache or live consumer.

Descriptor inspection rejects accessors without invoking them, catches detectable introspection failures, rejects malformed UTF-16/cycles/exotic source data and retains invalid quantities as null with reasons. Only relevant source branches/fields are copied; no game-state clone or source freezing. Output is recursively frozen. No ensure/normalize/save/emit/accounting/RNG/clock/ID-counter call, new script, saved root or save format is introduced.

## Existing work triage (observed 2026-10-16)

- #995 → #996–#1003: shared contract before individual adoption. #995 needs angel-investment coverage; #997 installed-wrapper/source inventory, #999 refounding lifecycle and #1002 common snapshot binding need review dispositions. Reuse their existing PRs.
- #995/#1003/#981 need explicit alignment with merged `PHASE_3_4_IMPLEMENTATION_FIRST_GATE_ALIGNMENT.md`; comprehensive Q campaigns are separate from F Exit, while targeted authority safety remains mandatory.
- #989 → #990: stacked debt remediation dependency. Do not merge #990 ahead of #989 or treat historical older-head WebKit evidence as final-head PASS.
- #1009 is existing MBO browser regression work. #1016 is the existing VC-refounding fix; no duplicate production fix was created.
- #935/#936/#938/#940 are historical diagnostics/policy proposals. Preserve evidence and necessary tests; no closure or removal was performed because newer fix correspondence needs scoped confirmation.
- Phase 3 tracker #909 marks P3-4–P3-12 incomplete. Phase 4 #981 is a proposal, not production Entry. Phases 5–16 are not claimed started by this task.

Independent reviewer AI inspected the actual implementation diff and ran focused checks. It found malformed-string and detectable-proxy exception cases; fixes and new regression fixtures are in this PR. This is a scoped review, not an independent audit of the entire engine or all writers. No physical iPhone or new real-IndexedDB browser run is claimed locally; existing installed writer regressions are separate evidence from this pure API.
