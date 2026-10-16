# Phase 3 writer integrity audit — 2026-10-10

Pinned main: `fbfdccdbdbee8f98aa7d6cbef3ec7e411e48ddc7`. Trackers: #922 / #909.
This is an audit/diagnostic proposal, not a correction or authority adoption. Do not merge the diagnostic draft. No production, save, canonical runner, workflow or timeout changes.

## Repository and approval boundary

GitHub ref and git fetch independently agree. Initially zero open PRs. All six applicable main workflows succeeded: Test `38002166353`, Strategy `38002166349`, M&A `38002166392` attempt 2, Pages Smoke `38002166288`, pages deployment `38002165627`, attestation `38002512677`. Latest attempts contain 36 successful jobs and 8 nonapplicable skips; skips and M&A attempt-1 cancellation are not PASS. #934 is merged, #933 closed unmerged. Relevant #909/#922 bodies and all returned comments were reviewed, including earlier two static matrices. Existing docs/phase3-ownership-writer-contract branch corresponds to merged #914, not pending overlapping work. No active PE Exit atomicity correction was found.

Current authority: read-only audit, temporary diagnostics, issue evidence, matrix and harness design only. Newly confirmed P0/P1 requires separate Owner approval BEFORE production correction. Existing individual approvals are not blanket authorization. Ownership Authority Cutover remains STOPPED.

## Coverage matrix and completeness limit

[Machine-readable matrix](PHASE_3_WRITER_COVERAGE_AUDIT_20261010.json) records all requested fields for **277 candidates**: 276 installed-method/dispatch candidates plus the primary PE UI adapter Exit writer. Counts: VERIFIED 12, SUSPECT 72, UNTESTED 187, BLOCKED 6. BLOCKED includes two new Exit entry paths, known stockSplit P3-4-007, and three disabled issuance APIs (corporate/convertible/preferred). These categories are not all confirmed defects.

Discovery inspected 617 final installed methods across the whole prototype chain, after full production index load and DOMContentLoaded hooks, rather than only the final prototype or source grep. Source sites and engine/API/UI call candidates were mapped; ordinary/share-swap, financed company cash, and PE/coinvest closing are distinct routes. The existing Phase 0.5 lexical index was also consulted.

This is an **overinclusive candidate inventory, not an exhaustive economic-writer certificate**. Settings/internal methods are retained where reachability/economic effect remains unresolved. Module exports, inline writes, aliases and transitive helper callers still require complete tracing. The first newly confirmed P1 stops further unrelated runtime probing. It would be incorrect to say that the first mission's full-writer completeness gate passed. No cutover readiness claim is made.

VERIFIED means the explicit existing correction implementation, named permanent tests, canonical registration and current same-SHA CI evidence were inspected. It does not mean every possible fault/platform is covered. For example financed company closing has fake-IDB fault/durable proof and normal WebKit UI/reload proof; a dedicated real-IDB financing fault matrix was not found and remains an explicit gap.

| Priority route | Source / actual entry | Current evidence / disposition |
| --- | --- | --- |
| buyStock / sellStock | engine.js:1431–1462; app.js:909 | #919/#920; permanent Node/WebKit registered; main CI; VERIFIED within cited cases |
| investor acceptance / founder share sale | expansion.js:387–430; app.js:900/920 | #917/#918 permanent Node/WebKit; VERIFIED |
| parent IPO | final pe-network-sourcing.js:138–146; app.js:898 | #924 encloses base IPO, PE/scenario and network registration; VERIFIED |
| ordinary/share-swap M&A | ma-deal-room.js:118; closeMADeal wrapper chain | #916 Node/WebKit; VERIFIED |
| financed M&A | ma-acquisition-financing.js:369–405; final PE selector delegates | #915 shadow/shared checkpoint; fake-IDB faults verified; real-IDB fault coverage gap |
| PE fund/coinvest acquisition | pe-acquisition.js:164–181; closeMADeal | #928 permanent 34-case coverage; VERIFIED |
| M&A subsidiary sale | engine.js:1729–1734; app.js:911 | #926 permanent regression; VERIFIED |
| VC initial / follow-on / secondary | engine.js:1467–1500; expansion.js:502–526; app.js:910 | #930/#932/#934 permanent Node/WebKit; VERIFIED |
| stockSplit | expansion.js:381–386; app.js:920 | BLOCKED: existing P3-4-007 still open as finding. #921 corrected history only; no save-atomicity regression found. Do not recreate #921. |
| PE portfolio Exit engine/API | pe-network-sourcing.js:152–159 → pe-acquisition.js:200–207 | BLOCKED: newly reproduced P1 below |
| PE portfolio Exit primary UI | pe-ui.js:203 → pe-ui-adapter.js:401–405 → helper directly | BLOCKED: same P1; bypasses engine wrapper, must not be omitted |
| PE formation | pe-fund.js:1055–1062; adapter perform/formFund, app.js:935 | SUSPECT direct unchecked save; no new runtime claim |
| VC subsidiary conversion | engine.js:1511–1517; app.js:910 | SUSPECT, cash/basis/ownership mapping needs failure injection |
| VC/subsidiary IPO | subsidiary-ipo-preparation.js:59–60; app.js:910 | final transaction wrapper present; still UNTESTED for complete fault matrix |
| MBO / takeover defense | expansion.js:582–586; app.js:920 | SUSPECT direct save; not executed as new P1 |
| legacy acquireTarget | final ma-deal-room.js:121 → engine.js:1718 | no direct UI caller found; UNTESTED API/delegate boundary, not dead-code proof |
| legacy PE create/exit/transfer | expansion.js:592–595, pe-value-creation wrappers; app.js:921 | mixed direct/delegated transaction paths; unresolved faults; no certificate |
| fund portfolio→parent acquisition | pe-portfolio-operations.js:987–994; pe-ui adapter acquireIntoGroup | transaction marker; UNTESTED full failure/durable/parity proof |
| dividends / own-share buyback | shareholder-returns.js:36–37; app.js:899 | P2 accounting/idempotency regressions present; complete route-specific real-IDB fault coverage still UNTESTED |
| weekly ownership/fund ratchet | final play-runtime-compat.js:94–119 around all weekly wrappers | outer weekly transaction exists; every internal mutation/enclosing-boundary failure path remains to be catalogued |
| founder/loan/inter-account/real-estate/sports/assets | see JSON matrix | candidate routes retained, not assumed covered by global week tests |
| corporate / convertible / preferred issuance | respective installed MODE 0 modules | BLOCKED/disabled; issue() returns false; not enabled issuance writers |

The JSON source mapping is a candidate index. Fields labelled delegate/unresolved or NOT VERIFIED must be resolved before cutover; a `runTransaction` text match never upgrades a row by itself.

## PE-PORTFOLIO-EXIT-ATOMICITY-001 — P1 CONFIRMED

Two enabled entry routes share the failing settlement helper:

1. Legacy UI app.js:940 calls final `engine.exitPEPortfolioCompany`. `pe-network-sourcing` calls base Exit, then adds network metadata after base success. `pe-acquisition` normalizes and settles outside a transaction, directly saves/emits and returns true.
2. Primary PE UI pe-ui.js:203 calls `peUIAdapter.performPortfolio('exit')`. At adapter.js:405 it calls `portfolio.exitPortfolioCompany` directly; `saveSuccessful` at :401 ignores `save()`'s false result. It does not call the engine method and does not emit the engine route's change/network effects.

Helper `pe-portfolio-operations.js:956–977` invokes `peFund.settleExitProceeds`; `pe-fund.js:283–294,911–923` credits personal GP proceeds and LP/GP/coinvest distributions, stores settlement and marks the deal exited. The common save adapter can cancel rejected storage candidates, but cannot undo nontransactional live mutations. Later healthy save resurrects them durably. For save-after-acceptance/saved/change exceptions, the bad Exit candidate itself reaches durable IDB. #915 is reused by protected writers; this is missing writer participation, not evidence that #915 should be replaced.

Fixture: existing `prepareAcceptedPE(..., coinvest=true)` builds an actually supplied target, DD, accepted offer and actual `closeMADeal` acquisition. Company endowment has a matching finance ledger. The holding is then placed at acquiredWeek+156 with improvementScore=67 as an explicit controlled maturity/IPO-eligibility witness, not a claim of natural 156-week progression. Preview is eligible for sale and IPO, company finance validation passes, and healthy preview/settlement/conservation/account separation/RNG/duplicate checks pass. An earlier initial fixture run failed only the IPO score prerequisite and was not defect evidence.

| Field | Before | Failed sale Exit (save=false) | Failed IPO Exit (save=false) |
| --- | ---: | ---: | ---: |
| personalCash | 14,999,922,000 | 18,255,456,108.541862 | 18,027,568,720.94393 |
| companyCash | 50,421,103,179.35735 | unchanged | unchanged |
| fund.cash | 72,243,223,155.06767 | unchanged | unchanged |
| fund.distributed | 0 | 21,376,076,082.01082 | 19,879,750,756.27006 |
| fund.lpDistributed | 0 | 18,120,541,973.468956 | 16,852,104,035.32613 |
| fund.gpDistributed | 0 | 3,255,534,108.5418625 | 3,027,646,720.943932 |
| coinvestReturned/pool | 0 | 16,042,078,524.046682 | 14,919,133,027.363413 |
| deal.status | active | exited | exited |
| company finance rows | 5 | 5 | 5 |

Return is true despite rejected save, both entry routes. Company journal and simulationRng are unchanged: this is incorrect acceptance/persistence of fund settlement, not a proved company-ledger duplicate or nondeterminism defect. Investment amount remains 43,101,400,598, but the active beneficial interest is marked exited and its settlement/distributions persist. The fixture has zero carry payout; profitable/carry-positive branches are not covered by this diagnosis.

### Executed Node evidence

`node tests/pe-portfolio-exit-audit-diagnostic.js` exits **1 / RED**, deliberately after completing the matrix and writing evidence. 30 cases: 4 healthy cases and 26 fault cases. All 26 faults retain economic live changes.

Engine route: sale and IPO × save false, mirror SecurityError, enqueue false, enqueue throw after admission, accepted-save throw, saved/change exception, plus three physically held fake-IDB in-flight predecessor cases. Primary adapter: sale and IPO × normal/save false/mirror/save-after-acceptance throw. Notify is not a normal Exit emission; no pretend notify coverage. Node fake IDB is explicitly not a real browser database.

Every case records full original/live state and raw mirror/cache/durable bytes locally, changed paths and economic summaries; flush, production load, fresh durable-only VM, later healthy save and subsequent load/fresh are executed. Refusal cases keep original durable state immediately, but later save persists failed live Exit. Post-save failures already persist Exit after flush. Prior accepted fake-IDB in-flight write is retained; the subsequent failed candidate can still follow it. See [structured Node RED](PE_PORTFOLIO_EXIT_ATOMICITY_001_NODE_RED.json).

### Real WebKit evidence

The diagnostic script uses full production index, actual WebKit 26.5, iPhone 13 emulation, actual IndexedDB availability and exact baseline durable-byte assertions. It records engine and primary adapter paths, reload, separate durable-only contexts before/after a later healthy save. Browser pending is same-task preceding enqueue, not Node's physically held request. Final execution: **28 cases complete, 4 healthy / 24 fault cases; all 24 faults retain live changes; exit 1 / RED**. Playwright 1.62.1 / webkit-2336 / WebKit 26.5. Exact current main production scripts, real IDB, engine and adapter routes, flush/load/page reload, durable-only separate contexts and recovery save were executed. Company ledger and RNG remain unchanged. See [structured WebKit RED](PE_PORTFOLIO_EXIT_ATOMICITY_001_WEBKIT_RED.json). Notify throws and adapter-specific enqueue/saved/change combinations were not tested; change is not a normal adapter emission. CI stays on its existing pinned Playwright 1.61.0.

The first attempts failed browser download/archive, absent system libraries or context launch before assertions and do not count as tests. Dependencies were downloaded/extracted locally; missing libraries linked into the browser bundle without changing repository/runtime logic. `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` bypasses only static host validation; browser launch, real-IDB prerequisite and assertions execute. Current diagnostic Playwright/build is recorded in final evidence; CI remains pinned and unchanged.

## Minimum correction proposal — NOT IMPLEMENTED

- One Exit concern/one production PR only after explicit Owner approval.
- Include **both** installed engine/API route (normalization, settlement, exit metadata, post-base network effects) and primary UI adapter's direct helper route in common runTransaction/#915 checkpoint participation. Protect prevalidation as appropriate and delegate direct saves to commit. Do not add compensation, Exit-only rollback or a new storage system.
- Do not patch only pe-acquisition::exitPEPortfolioCompany: it would leave the primary UI broken. Conversely only wrapping the adapter leaves legacy API broken.
- Preserve waterfall/valuation/LP/GP/coinvest accounting, capital separation, duplicate guard, RNG, save key/version and existing saves.
- **Parity/design risk:** today's engine route emits saved→change then post-save network effects; adapter emits saved only and has no engine-network registration. Routing adapter to engine blindly would alter network behavior and event order. Characterize each healthy route first; the approved implementation must state exact event/network contract and resolve this with existing APIs. No implicit save-contract change is authorized.
- Permanent tests must cover both routes, sale/IPO, fund-only/coinvest, loss/profit/carry-positive, buyer variants, save false/throw/mirror/enqueue/saved/change and applicable notify, predecessor in-flight/pending, raw full rollback, flush/reload/fresh/recovery, invalid/duplicate refusals and normal route-specific parity. Register only in the separately approved correction PR; keep this diagnostic unregistered/unmerged.

## Shared transaction fault harness — design only

Reuse tests/harness.js (production script order and DOM hooks), existing deterministic fixture factories, `pe-fund-acquisition-faults.js::inject/indexedDBFor`, full-state/economic normalization helpers and existing WebKit HTTP/context/IDB routines. Do not introduce another checkpoint/backend or modify production serialization. Existing helpers named PE are already shared by VC; generic names alone do not justify rewriting them.

Proposed test descriptor: `writerID`, `dispatch/entryRoute`, `fixtureFactory`, `accountKinds`, `command`, `normalOracle`, `faultKinds`, `state/aliasSelectors`, `stored-byteSelectors`, `eligibleRefusals`, `freshHydrationOracle`, `normalizationExclusions`, `boundaryExpectation` and `coverageLimitations`.

Lifecycle: prove prerequisites and healthy oracle → save exact baseline → optional accepted pending/in-flight predecessor → inject one fault → collect false/exception and all live fields (cash/equity/basis/ledger/news/RNG) → compare mirror/cache/pending → release/flush and inspect actual durable bytes → production reload → separate durable-only VM/browser → later healthy command/save → flush/reload/fresh again → deterministic normal parity.

Report schema should distinguish `fixturePrerequisite`, `injectionReached`, `commandContract`, `liveRestored`, `mirror/cache/pending/durable`, `predecessorPreserved`, `reload/fresh/recovery`, `economicInvariants`, `normalParity`, engine SHA/runtime/browser version, exception stacks, actual put count and test registration/CI execution. Outcomes: PASS / RED / NOT RUN / NOT APPLICABLE / PREREQUISITE FAILED. Diagnostic collection exit 0 must never imply atomicity PASS. Node fake IDB and real-browser IDB need separate fields; physical-device claims remain separate.

Smallest adoption PR: **test-helper-only**, after Owner approval of its CI contract. First extract shared *test* runner/oracles and parameterize two already-corrected routes (VC secondary and PE acquisition), retaining old test entry filenames, all assertions and shard/workflow coverage. No mass production-writer wrappers. Avoid broad fixture normalization, silently excluding fields, or same-host fresh contexts; these could hide aliases or ledger differences. Keep physically held fake request behavior and separate same-task real pending behavior.

Adoption gates: exact old/new scenario count + fault reachability + outcomes, independent RED mutation/oracle sanity check, complete state/raw byte assertions unchanged, actual WebKit/real IDB, predecessor/recovery checks, accepted price/accounting/RNG/normal event/save-count parity, canonical registration/execution and existing Phase 0.5/1/2 gates. Re-audit final clean checkout. No production save/checkpoint/schema/authority changes and no timeout/skip/assertion weakening. Any CI permanence change needs explicit Owner approval first.

## Remaining limits / next action

New P1 confirmed; further unrelated runtime probing and all production corrections stopped. Ask Owner for the separate two-entry PE Exit correction. P3-4-007 remains an independently existing blocker (prior approval recorded in #909); do not treat #921 or #934 as correcting it. Full writer completeness, remaining SUSPECT/UNTESTED routes, real-IDB financed-M&A fault coverage, physical iPhone, profitable/carry-positive Exit and long-run play are not certified. Cutover cannot resume.
