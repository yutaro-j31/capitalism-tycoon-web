# Phase 3 Design Audit and Evidence Ledger

**DESIGN REVIEW ONLY. External independent A–L audit NOT COMPLETE. Phase3 Exit NOT PASS; Phase4 Entry NOT AUTHORIZED.**

Audit baseline743d08d1867f453fe09c61e1fd5312c846cfc1eb, verified via GitHub branches/main and fresh local clone, rechecked before design publication on2026-10-15 JST. Main unchanged during authoring. Companion design contracts are proposals; no production JS, tests, fixtures, workflows, schema/version, official P3-4 contract/Track A or Phase4 #981 branch changed. No merge authorization.

## 1. Method and evidence levels

CODE: approved Roadmap (all1900 lines read in the separate same-session reviewer stage), dependency graph (all256 lines), Entry/P3-1/2/3 contracts, AGENTS/CLAUDE invariants, Track A history, actual read-model/entity/operation code, installed engine/expansion/fund/VC/M&A/subsidiary wrappers, index script ordering and current workflow/test registration inspection. Lexical searches include share quantities/ratios, market maps, startup/IPO/funding/secondary/subsidiary, PE fund/direct/parent conversion, founder wealth and finance/debt identities. This is not a mathematical proof against every computed writer.

TEST:12 existing Node characterization files actually executed against audited production; exact command is `node <file>` from repository root, runtime Node v24.19.0 from execution environment. All exited0. No new adapter production/API exists, so this is not TEST evidence for future APIs.

WEBKIT: no local WebKit or physical iPhone executed by this design session. Actual GitHub check runs inspected at baseline include successful stock-split-atomicity, pe-acquisition-atomicity, vc-funding-atomicity, vc-secondary-atomicity, comprehensive-ma, iPhone WebKit Smoke and iPhone Acceptance Playthrough. These are legacy baseline CI evidence at their tested head/event, not new adapter or physical-device proof. Workflow source inspected to distinguish path/event applicability. No downloaded artifacts/log-by-log claim for all existing jobs.

REVIEW: separate reviewer agent `/root/design_review` in this same Work session inspected eight slice drafts/shared architecture, relevant approved contracts and selected production paths. It was read-only, did not execute tests or post reviews. This is a separate author/reviewer stage, **not external independent audit**, not an independent Claude P3-4 implementation audit and not proof of complete dynamic-writer coverage. Second reviewer pass rechecked the first seven corrections and completed dependency/readiness/audit documents against source. A third full-Roadmap/coverage pass then identified RV08/09; their corrections are recorded below and were rechecked by the separate same-session reviewer, leaving no remaining material P0/P1/P2. Reviewer checked stored Node log endings and result table for consistency, without rerunning tests. Final candidate must still receive requested external/fresh independent review before formal Exit.

DESIGN: all proposed adapter/eligibility/wealth/command APIs, added-test candidates, numeric/performance targets and future Gate assertions. Existence in a Markdown contract is not implementation or PASS.

## 2. Repository state observed

| Item | Observation |
|---|---|
| main / local production audit |743d08d1867f453fe09c61e1fd5312c846cfc1eb|
| Phase3 #909 |open; P3-0..3 accepted, P3-4..12 not complete; old comments are historical|
| D3 / PR992 |merged d0802d88; shared issueSharesToExternalHolders corrects share-swap dilution|
| D4 / PR993 |merged743d08d1; buyCompetitorStake buys external float only|
| PR994 |open7ac82961a5ba9ce837c6a9025dbc65fe6dc2b72e; M&A financing public-equity dilution, not yet main|
| Debt PR989 |open d90fbc38ab18e1d0ff8d04d3fba369ce184a87f0; borrowing/repayment atomicity|
| Debt PR990 |open390d62d40593f5b09f4dbbca5ebeeaf8c3a43f55; company property-principal mirror, stacked on989|
| Phase4 design PR981 |open7234639d094309a837438ebe82a62af8bb5375b0; schema and additional P1 addendum reviewed; untouched|
| Other open PRs at start |935 diagnostic Draft;936/938/940 docs; no duplicate P3-5..12 contracts in main|
| #954 |closed; old body says not fixed but current writers/merge evidence supersede it|
| #976 |open Owner accounting-policy decision: weekly subsidiary flow-through versus listed distributions; reader does not change it|
| #979 |open investigation only for already-broken legacy saves; no automatic repair|
| #969 |open P2 success notification before durable commit; policy separate|
| #865 |historical P0-titled tracker still open; title/body alone do not establish current unrepaired P0; disposition required|
| CI at final pre-publication refresh |main checks include50 success/24 skipped/2 in progress across returned check entries; duplicate workflow/event records exist; not a final all-green attestation|

Open issue inventory at start:979,976,969,922,909,878,875,865,826,825,822,424,423,356,349,348,318,316,307,303,300,297,246,244,242,241,63. Older UI/roadmap trackers are not automatically Phase3 blockers. No issue closure, label change or comment to others performed by this task.

P3-4 remains STOPPED despite D3/D4 integration: adopted single authority absent; complete dynamic/base/raw/shadow/weekly/whole-root writer coverage and failure/WebKit evidence missing; independent A–L audit absent; old-save/generation adoption contract must be satisfied. Track A's older D3/D4/path-filter claims are stale: this package records current delta without overwriting Claude-owned file. Branch protection enforcement unverified; historical API403 is not proof it is disabled. CI is evidence, never a bypass authorization.

## 3. Executed Node characterization

| Command file | Exit | Approx seconds | Proven scope |
|---|---:|---:|---|
|tests/phase3-ownership-projection-test.js|0|0.76|existing P3-1 identity/purity|
|tests/phase3-ownership-reconciliation-test.js|0|0.75|existing P3-2 source/conservation|
|tests/economic-read-model-test.js|0|0.73|existing P1 read-model parity|
|tests/ma-share-swap-ownership-ratios-test.js|0|8.09|merged D3 installed share-swap|
|tests/competitor-stake-float-test.js|0|68.42|merged D4 external float/weekly path|
|tests/pe-dual-ownership-test.js|0|10.27|legacy company/personal PE separation|
|tests/pe-fund-coinvest-test.js|0|0.13|existing fund/co-invest settlement math|
|tests/startup-funding-round-test.js|0|6.56|existing VC round lifecycle|
|tests/finance-startup-subsidiary-test.js|0|0.29|existing startup subsidiary accounting|
|tests/save-compat-test.js|0|1.20|existing save compatibility|
|tests/accounting-invariants-test.js|0|2.64|existing accounting invariants|
|tests/simulation-determinism-contract-test.js|0|0.11|existing simulation determinism contract|

No failed command is hidden. Full canonical/century/1000-company/new API suite was not run locally; docs changes do not warrant a fabricated future API test. New PR CI results must be read separately after publication, not inferred from this table.

## 4. Author cross-slice architecture audit A–L

| Axis | CODE / DESIGN finding and disposition | Remaining proof |
|---|---|---|
|A Single Authority|pure adapters have no writeback; current writers retained; competing registry prohibited|P3-4 actual adoption/all bypasses|
|B Entity Identity|active-slot IDs retained, generation/source-scoped aliases explicit; ticker/name insufficient|old/refounded collision fixtures + future adoption|
|C Economic vs Voting|PE capital/proceeds/legal votes separated; VC preferred unknown; exact voting units required|new adapter/eligibility implementation tests|
|D Accounting/Settlement|no normalize/ensure/settle/event in reader; strict monetary schema preserved|whole-state/storage/RNG spies for new APIs|
|E Anti-double-count|shared claim merge handles own stock, PE/VC/sub mirrors, IPO, parent conversion, wealth coverage|all cross-family lifecycle fixtures|
|F Save|save9/key, no new roots or repair; existing installed save-v9 version recognized|compaction/import/hydration of future APIs|
|G Determinism|code-unit sort, no RNG/time/ID draw, exact transient voting comparison|new mixed/replay/purity tests|
|H Performance|single source index, O(N+E)+sort; no per-row clone/rebuild; correct cache invalidation|100/1000 fixture and real iPhone measurements|
|I Integration|P3-4/P3-9 gate P3-10; later settlement/Phase4/WACC boundaries preserved|integrated future candidate tests|
|J Failure Safety|null+reason for unknown/invalid/conflict; no clamping/repair/rights inference|mutation/fault negative controls|
|K Actual Source|real symbols/fields checked; nonexistent names corrected by separate review|refresh all writer/call sites at implementation|
|L Acceptance Evidence|CODE/TEST/WEBKIT/REVIEW/DESIGN distinct; shards not independent audit; Exit NOT PASS|external/fresh audit and final candidate artifacts|

Verdict: conditional DESIGN coherence after corrections. Not production Gate PASS and not external independent A–L completion.

## 5. Separate reviewer findings and corrections

Counts for this design review: **newly confirmed P0=0, P1=0, P2=9**. These counts are not a clean-bill-of-health for the repository. Existing #981 reports6 additional P1 root-cause families on its stated baselines; those were not re-executed here and are not counted as newly discovered by this design review. Owner has separately approved their minimal Writer repair; this task makes no such edits.

| ID / P2 | Finding | Design correction |
|---|---|---|
|RV01|ambiguous code-versus-contract precedence wording|headers distinguish observed source facts from approved required future behavior; discrepancies logged, formal Roadmap precedence preserved|
|RV02|nonexistent followOnStartupFundingRound symbol|corrected to participateStartupFundingRound, distinct from open/close lifecycle|
|RV03|wrong listed-subsidiary squeeze method|corrected to squeezeOutListedSubsidiary|
|RV04|nonexistent founder lender test name|corrected to tests/founder-shareholder-loan-lender-test.js|
|RV05|nonexistent save-v9-test.js evidence|corrected to tests/save-v9-migration-test.js|
|RV06|no explicit conflicting own-company price policy|P3-11 now requires active-generation price evidence; stockPrice/market disagreement/missing binding gives unknown+reason and test candidate|
|RV07|grouped iPhone job row omitted PR acceptance/smoke schedule distinctions|split exact smoke, acceptance and release-readiness event rows; docs-only Test iPhone Acceptance remains applicable|
|RV08|commercialization spinout maSubsidiaries Writer omitted|added source fields/missing ownership provenance, unresolved/duplicate-derived-ID/lost-history fixtures and real reusable tests; operational/overseas coverage explicit|
|RV09|readable quantity envelope not explicit for external adapter|shared/P3-5 predicate now preserves P3-1 finite0..MAX_SAFE envelope; fractions diagnostic, integer voting separate; posting quantum distinct from quote precision|

Author design corrections beyond reviewer list: forbid fund financing ratios as legal shares; preserve pending VC contribution evidence without current voting equity; no legacy total-plus-founder wealth shortcut; no false total from unknown debt/equity coverage; separate12 test shards from audit axes; remove stale unmerged D3/D4 blocker claims. No production defect was repaired or claimed repaired by these edits.

## 6. Risk register

| Risk | Severity / status | Required disposition |
|---|---|---|
|Command effects/lifecycle/receipt retention unspecified|Owner decision blocker, not a reproduced production P1|P3-10 BLOCKED; OD01–03|
|Issuer generation/ticker/class provenance absent in old saves|P2 design coverage risk|source-scoped/unresolved, no automatic repair or control|
|PE/VC/sub hierarchy overlap|P2 design risk mitigated by composition contract|implement and test canonical claim/lifecycle conflict logic|
|Full fund/parent equity and personal liability coverage unknown|P2 projection-completeness risk|partial known subtotal, total=null; OD04–05|
|#976 listed dividend economics|existing Owner-policy dependency|no adapter accounting change; record explicit disposition|
|#979 broken old saves|existing legacy dependency|preserve and fail closed; repair separate approval|
|P4-AUD001..008 /989/990|existing financial readiness dependencies from prior audit|separate approved repairs/evidence; no Phase4 Entry from design alone|
|Independent final audit/performance/WebKit unexecuted for new APIs|acceptance gap|remain DESIGN; P3-12 NOT PASS|

## 7. Final evidence rules and handoff

Before Owner merge decision, verify exact docs-only changed paths, all20 sections in each slice, no nonexistent current-source/test references, relative links, final diff whitespace, latest main/PR head, applicable CI terminal state and unresolved reviewer findings. Only the M&A financial WebKit jobs not triggered by its current path filter are inapplicable; Test iPhone Acceptance Playthrough applies to docs-only PRs and must succeed. Other genuinely inapplicable jobs must be marked inapplicable, not claimed executed. Never manually rerun unchanged green CI as a ritual. Later implementation approval is separate from these docs PRs. Final PR links/head/check summaries are handoff evidence and must use actual GitHub values after publication.
