# Phase 4 Implementation Roadmap

**Provisional implementation plan, not authorization. Phase 4 Entry: NOT AUTHORIZED.**

Baseline `ee4f37f561fe326545deed96a127d0a032ebcb24` (2026-10-14 JST). One concern / one PR. A slice with independently migrating writer families must split again; these are dependency units, not a promised PR count. The formal roadmap is unchanged.

## 1. Lowest-risk path and shared slice contract

This docs-only package is **P4-0 preparation**; its merge needs Owner approval and does not satisfy formal Entry. After Phase 3 exit and Entry approval, implement P4-1 pure schema validator first, then P4-2 extension of the existing read adapter. They make missing evidence and alias conflicts visible without changing any financial outcome. P4-3 reconciliation is the next risk-reduction step. Do not start by rewriting borrow/repay or persisting a debt registry.

Every slice below inherits these explicit requirements:

| Concern | Mandatory contract |
|---|---|
| Existing writer relationship | Legacy authoritative until a named adoption manifest changes it. Pure/shadow slices never call live writer/save APIs. |
| Accounting | Schema/read/metric/contract PRs have no postings. Proposed operation builders balance each currency and expose exact principal/payable/cash/P&L effects. |
| Save atomicity | Pure slices add no persistent root. Adopted writes use existing checkpoint/outer transaction; rollback terms/state/receipts/IDs/RNG and queued writes. Durable IDB/fresh hydration is separate proof. |
| RNG | No host RNG/time or locale ID ordering. Pure calculations consume zero simulation draws. New admitted deterministic sequence rolls back and resumes on hydration. |
| RED/GREEN | RED violates the stated economic invariant, GREEN proves it through installed APIs where applicable; no fixture weakening. Existing malformed legacy values remain evidence, not silently repaired. |
| Node Gate | Focused family tests, operation schema, Phase0.5/1/2 permanent gates, affected save/accounting/determinism checks. Canonical registration and shard distribution for new tests in their eventual implementation PR. |
| WebKit Gate | Pure no-runtime-wiring PR: actual applicable boot/acceptance CI plus read purity if loaded. Writer/API/persistence/UI PR: real iPhone WebKit family test including durable IDB and failure cases. Skipped job is not execution evidence. Physical iPhone only when actually performed. |
| Completion | Actual diff review, family claims verified against latest main, Node and applicable CI terminal success, no unresolved introduced P0/P1, current main/conflicts checked, independent review and Owner-approved merge. |
| Approval | This package authorizes none of these runtime PRs. Entry and each adoption/product/accounting policy are explicit Owner decisions. PR creation/review is not cutover approval. |

## 2. Dependency chain

P4-0 docs preparation → Phase 3 exit + Owner Entry → P4-1 schema → P4-2 read adapter → P4-3 reconciliation.

From P4-3: P4-4 accrual/accounting compatibility contract → P4-4a approved interest-receivable taxonomy/validator implementation → P4-5 pure debt operation validators → P4-6 pure interest schedule → P4-7 pure principal/maturity schedule → P4-8 pure reset/refinance → P4-9 credit-state projection.

P4-10 metrics can build from P4-3 and the relevant schedule modules; P4-11 persistence/receipt contract depends on all event schemas. P4-12 writer adoption contract needs P4-4 through P4-11 plus P4-4b gameplay/accounting compatibility acceptance and a clean Phase 3/Track A baseline. P4-13 and later concern-specific implementation PRs require Owner-approved adoption, not merely P4-12 docs. Final P4-F acceptance/handoff follows completed approved family implementations and main evidence.

## 3. Slice contracts

### P4-0 — Entry proposal and complete audit documentation

- **Purpose/modules:** these five `docs/economic-engine/PHASE_4_*` documents; no roadmap edit.
- **State/API and writers:** none. Covers 31 actual writer families plus aliases, disabled products and absent mechanics.
- **Preconditions/dependency:** latest main/instructions/Issue909/Track A reviewed; user authorization for this advance design only.
- **Accounting/save/RNG:** no posting, no migration, no simulation change.
- **RED/GREEN and Gates:** detect false implemented claims, broken anchors, missing writer boundaries and contradictions; validate references/diff. Existing characterization and applicable docs PR CI; no new production tests.
- **Done/Owner:** reviewable docs-only PR, merge held. Owner may approve documentation independently of Phase 4 Entry.

### P4-1 — Pure Debt Instrument schema and validator

- **Purpose/modules:** proposed `js/debt-instrument-schema.js`; reuse validation primitives/contracts from `economic-operation.js` rather than broad generic reducer refactor.
- **State/API:** pure `validateDebtContract`, `validateDebtState`, normalized unsupported evidence; no root state or public action.
- **Writers/preconditions:** legacy unchanged; formal Entry + P4-0 disposition. Initially test module independent of production script wiring.
- **Accounting/save/RNG:** no ledger/cash/save; deterministic finite JSON and stable IDs only.
- **RED/GREEN:** negative/nonfinite principal/rates, duplicate IDs, invalid schedule, unsupported currency, unknown parties, accessor metadata, terms mismatch → reject; valid fixed/floating/legacyUnknown fixtures → accept unchanged input.
- **Node/WebKit:** schema and operation contract tests; no UI test addition needed until wired; applicable actual boot gates.
- **Dependency/done/Owner:** schema field semantics frozen, compatibility null reasons preserved; approve unsupported versus executable product set. First recommended implementation PR.

### P4-2 — Legacy debt read adapter extension

- **Purpose/modules:** existing `economic-read-model.js` with pure `debt-read-adapter.js` only if separation improves maintainability; reuse existing companyDebtInstruments/founder receivables public contract.
- **State/API:** `projectDebtSnapshot`; sourceAliases, aggregate inclusion, contract/servicing rate evidence, unknown dates; no persistent ID issuance.
- **Writers/preconditions:** P4-1; inspect latest installed code and all source collections. No live ensure/migration/normalization.
- **Accounting/save/RNG:** no postings; whole input/save bytes/RNG identical before/after and repeated renders.
- **RED/GREEN:** duplicate bank/property finance aliases, same property multiple independent loans, included personalDebt loans versus excluded mortgage/margin, disabled bonds, unresolved IDs, founder dual-sided claims; unknown not fabricated.
- **Node/WebKit:** adapter parity, legacy v9/compacted reload and immutable input; WebKit repeat read/navigation purity once integrated.
- **Dependency/done/Owner:** maps every audited collection or reports unsupported; approve read-only coverage, no cutover.

### P4-3 — Projection reconciliation and authority diagnostics

- **Purpose/modules:** proposed `debt-reconciliation.js`, read-model diagnostics; observe finance debtRollforwardStatus on clone if needed.
- **State/API:** pure per-instrument/per-entity/per-family differences, alias conflicts, coverage and authority source; no corrective writer.
- **Writers/preconditions:** P4-2; retain all mismatches and unknowns. Do not infer repairs from matching amounts.
- **Accounting/save/RNG:** compare contractual principal and account balances separately from carrying amount; cent precision for new projections, documented legacy numeric domain; no balancing entries.
- **RED/GREEN:** aggregate matches but mirror differs, outstanding default excluded incorrectly, missing loan, duplicated founder receivable → named FAIL; consistent aliases → PASS.
- **Node/WebKit:** reconciliation tests + existing P2 rollforward/loan-single-interest; WebKit read purity if displayed.
- **Dependency/done/Owner:** no silent hydration repair; decide eligible family scope and disposition of detected gaps before adoption.

### P4-4 — Accrual/ledger compatibility contract (docs-only)

- **Purpose/modules:** Phase4 accounting addendum; references finance.js, economic-operation.js, existing P2 close. No edits to runtime or formal roadmap.
- **State/API:** specification for accrued-interest payable, lender receivable, cash-only payment, PIK and fee/OID accounts; terms-event envelope.
- **Writers/preconditions:** P4-3; explain difference between legacy interest-paid expense and new accrual; approve forward opening boundary, no historical reconstruction.
- **Accounting/save/RNG:** explicit Dr expense/Cr payable and later Dr payable/Cr cash; repayment profit0; immutable operation receipts/storage model designed.
- **RED/GREEN:** paper/executable isolated fixtures for accrue once/pay once, PIK no second expense, old interest cannot run concurrently. Runtime tests belong later PR.
- **Node/WebKit:** docs claims/link checks; existing characterization as needed, no invented accrual WebKit PASS.
- **Dependency/done/Owner:** Owner approves accounting policy, taxonomy extension, fee method, fixing cutoff and error policy before executable accrual code.

### P4-5 — Pure monetary debt operation-family builders/validators

- **Purpose/modules:** proposed `debt-operation.js`; required interest-receivable taxonomy/validator is implemented in prerequisite P4-4a, never deferred until after accrual builders.
- **State/API:** build/validate origination, principal repayment, accrual/payment and capitalization operation data; terms-only validated event schema separately approved. No reducer/write hookup.
- **Writers/preconditions:** P4-4 approved and P4-4a implemented/accepted; capability stays shadow.
- **Accounting/save/RNG:** balances borrower+counterparty legs, debt ID references; no hidden fee/net-cash leg; command-derived deterministic IDs, no draw.
- **RED/GREEN:** missing lender leg, mismatched currency, principal in P&L, paid interest expensed twice, different payload same key, unsafe Number quantum → reject; exact valid operation → stable output.
- **Node/WebKit:** economic-operation-contract, family conservation, pure data tests; actual boot CI if loaded.
- **Dependency/done/Owner:** all operation fields are representable under approved schemas; accept external-lender aggregate treatment, no banking authority.

### P4-6 — Pure interest accrual and payment obligations

- **Purpose/modules:** proposed `debt-interest-schedule.js`; no advanceWeek wrapper.
- **State/API:** evaluate interval coupon, `projectAccrual`, `projectInterestDue`, payment allocation and accrual cursor proposal.
- **Writers/preconditions:** P4-5; approved game-week basis/rate snapshots; unknown legacy accrued interest remains unknown.
- **Accounting/save/RNG:** operation proposal cash0 accrual, profit0 payment; recognize cents once at boundary; residual schedule explicit.
- **RED/GREEN:** fixed/zero/floating, partial period, missing reset, no cash, PIK prohibited/permitted, interest repeated after reload → exact expected obligations; input unchanged.
- **Node/WebKit:** schedule vectors + loan-single-interest; wiring forbidden in this slice; WebKit pure consumer check if exposed.
- **Dependency/done/Owner:** no drift in 52/208 scheduled math; accept rounding and origination accrual timing, no public financial change.

### P4-7 — Pure principal schedule and maturity obligations

- **Purpose/modules:** proposed `debt-principal-schedule.js`.
- **State/API:** bullet/equal-principal/annuity/manual/sweep due projections, prepay consent and final residual; matured-unpaid projection.
- **Writers/preconditions:** P4-5/6; explicit schedule evidence; 9999 markers not silently legal maturities.
- **Accounting/save/RNG:** repayment principal only; maturity cash0/liability unchanged unless a payment operation settles; zero-expense proof.
- **RED/GREEN:** final penny, delinquent maturity, moratorium/extension, negative cash, early payment penalties, simultaneous due → exact conservation; no debt deletion.
- **Node/WebKit:** schedule tests, P2 debt and negative-cash maturity; no weekly production writer in this PR.
- **Dependency/done/Owner:** all principal paid or explicitly outstanding/overdue; approve payment allocation order and partial payment semantics.

### P4-8 — Pure rate reset and atomic refinancing proposal

- **Purpose/modules:** proposed `debt-rate-reset.js` and refinancing builder; split independent modules/PRs if concerns cannot be reviewed together.
- **State/API:** frozen rate fixing snapshot, new/old linkage, consent/funding/fee/payoff preview; versionConflict results.
- **Writers/preconditions:** P4-6/7; reference source units and reset lag; no change to treasury policy or MA/property financing.
- **Accounting/save/RNG:** composite new borrow + old payoff + accrued payoff + fees balance; old never closes on proposal; deterministic IDs.
- **RED/GREEN:** +100/+300bp shock, floor/cap, stale approval, failed new funding, fee financed vs cash, partial old balance, duplicate replay → all or nothing in isolated reducer test, no live mutation.
- **Node/WebKit:** pure schedule/operation tests; existing MA atomicity/real-estate refinance characterization; actual browser consumer if wired read-only.
- **Dependency/done/Owner:** no self-funded imaginary refinancing; accept original versus new maturity and consent terms; settlement stays non-executable.

### P4-9 — Covenant, delinquency/default/workout projection

- **Purpose/modules:** proposed `debt-credit-state.js`; preserve existing playerCrisis/bank/personal servicers.
- **State/API:** pure credit-state transition proposals and evidence; borrower/guarantor separate; modeledUnsupported legal release.
- **Writers/preconditions:** P4-3/6/7/8; full metric window and terms; unknown data cannot grant compliance/default.
- **Accounting/save/RNG:** breach/default alone money0; loss on lender book does not extinguish borrower liability. Recovery payment and legal release distinct schemas.
- **RED/GREEN:** below/at/above covenants, grace/cure, partial due, cross-default disabled, parent cash inaccessible, missing metric, writeoff versus release → evidence-preserving status.
- **Node/WebKit:** boundary vectors + bank default/gym workout tests; UI/persistence families only if later authorized.
- **Dependency/done/Owner:** approve default/grace/PIK/recovery policy before executable consequences; no automatic creditor waiver.

### P4-10 — Cost of Debt and risk input read model

- **Purpose/modules:** proposed `debt-metrics.js`; finance/read-model consumers; explanatory D UI only in a separately scoped consumer PR.
- **State/API:** tagged formula outputs with coverage/missing reasons; maturity ladder, rate sensitivity, debt-service/covenant headroom.
- **Writers/preconditions:** P4-3 plus relevant P4-6/7/8/9 projections; complete book windows; no credit-limit/valuation writer migration.
- **Accounting/save/RNG:** no postings; identical debt/cash/fees scope to reconciled instruments; debt/equity book values not market WACC weights.
- **RED/GREEN:** zero/negative denominator, partial TTM, unknown rates, floating reset lag, tax shield unused, duplicate alias, shared fund/personal cash → null/reason or exact scoped result.
- **Node/WebKit:** analytical formula fixtures; browser repeated render, 44px/folding/no overflow if UI. No RNG consumption.
- **Dependency/done/Owner:** every metric meets design table data/units/frequency; approve CFADS/cash eligibility and display policy only; Phase6 consumes immutable input later.

### P4-11 — Durable receipt/checkpoint and v9 adoption storage contract (docs-only first)

- **Purpose/modules:** design against save-v9.js, save-storage.js, save-storage-idb.js, economic-shadow-journal.js and shared fault harness.
- **State/API:** proposed opening checkpoint/terms/cursors/admitted IDs/receipt lifetime; per-family adoption manifest; no persistent root yet.
- **Writers/preconditions:** P4-5 through9; explicit size budget. Existing journal is shadow and must not be assumed persisted production authority.
- **Accounting/save/RNG:** snapshot plus receipt must become durable together; old saves retain source IDs; no reconstruction of pre-adoption operations.
- **RED/GREEN:** compact/prune/reload/replay, false/throw/cache/pending/durable/fresh hydrate, source conflicts, refounding → full-state conservation and monotonic admission. Future implementation proof obligation, not PASS from docs.
- **Node/WebKit:** reviewed against helpers/transaction-fault-case.js semantics and actual IDB API; approval before implementing storage.
- **Dependency/done/Owner:** approve retained receipt budget, checkpoint coverage, old-save behavior and explicit reversible adoption mechanism. No automatic migration permitted by this plan.

### P4-12 — Writer-family closure and authority cutover contract (docs-only)

- **Purpose/modules:** refresh matrix and explicit adoption manifest for one chosen family; list exact installed APIs, UI callers, raw helpers, delegated/week/load/reset/refounding writers.
- **State/API:** proposed reducer entry/compatibility mirrors/write guards, not runtime changes.
- **Writers/preconditions:** P4-4 through11 approved, Phase3 exit/Track A resolved, current main stable. Generic repay/prepay/maturity touch specialized loan rows: do not pretend generic origination is an isolated cutover.
- **Accounting/save/RNG:** prove native+legacy family contributions to company aggregate reconcile without a second setter. Legacy later-phase settlement cannot be redirected early; mixed operations either use approved dispatch closure or disable the new family until complete.
- **RED/GREEN:** inventory bypass test plan, direct exported helper, mixed native/legacy payoff, bank/property/founder mirror, sale/refounding, concurrent render/load; no unexplained adjustment.
- **Node/WebKit:** plan final installed command fault+replay and browser call-site evidence; validate source completeness at PR head.
- **Dependency/done/Owner:** **CUTOVER READY only for specified family** after all dependencies/evidence; Owner separately authorizes exact storage/adoption/servicing replacement. This task does not grant that decision.

### P4-13+ — Executable adoption, divided by one economic concern

No production code is included in this advance task. Future implementation must retain a safe activation boundary: pure foundations can merge earlier, executable activation cannot expose partially covered writers. Suggested independently reviewed PRs are reducer infrastructure in shadow, approved accrual-ledger projection support, family-wide writer routing with activation disabled, then one activation PR only after complete closure. If enabling origination, servicing and repayment requires one indivisible family transition, review/approve it as that single authority concern, not as competing independent writers.

Each future PR must specify exact modules/state/API, disabled/enabled manifest, predecessor and successor authority, operation postings, save/RNG behavior, concrete RED/GREEN and installed WebKit cases. A generic `allDebtCutover=true` switch or dual-write compare-and-correct scheme is forbidden. Borrower-domain families whose settlement belongs to Phases10–15 remain read-only; debt schema readiness does not migrate the whole deal/vehicle/property operation.

Completion requires zero hidden mutations for the enabled family, full fault matrix plus mixed debt replay, P2 close including accrued-interest compatibility, stable old-save reload, per-instrument due preservation and current-main WebKit. Owner decides **which family**, **what becomes authoritative**, **whether saved records may be adopted**, and **when activation is permitted**. No executable slice exists merely because this roadmap names it.

### P4-F — Final acceptance and Phase 5 / Phase 6 handoff

- **Purpose/modules:** acceptance/exit docs and approved permanent tests, implementation evidence manifest; no Phase5 industry or Phase6 valuation implementation.
- **State/API:** immutable debt input snapshot with version/perimeter/quality, adoption coverage, unresolved unsupported families.
- **Writers/preconditions:** all approved Phase4 scopes complete, latest-main no P0/P1, Owner-approved perimeter not every optional later-domain writer.
- **Accounting/save/RNG:** ECO cash/principal/payable identities, P0.5/P1/P2/P3 parity, durable replay and no host entropy; preserved v9.
- **RED/GREEN:** full lifecycle combinations, MA/sale/refounding legacy interactions, long-run seeds and capacity budgets from gate plan.
- **Node/WebKit:** integration and nightly/deep-audit evidence; actual main push-only browser jobs; physical iPhone limitations explicit.
- **Dependency/done/Owner:** Owner formal Phase4 exit; Phase5 receives financing constraints/inputs, Phase6 receives Cost of Debt/tax/capital-structure observations. No WACC authority granted here.

## 4. Implementation agent handoff

At every slice refresh origin/main, rules, #909, open issues/PRs and CI; inspect source anchors again. Check existing APIs before creating modules. Keep tests registered and risk-appropriate, avoid repeating costly long-run gates for a documentation-only change. If a prerequisite or Owner policy is absent, continue pure investigation but do not turn the capability executable. Update contracts and final PR description to match the actual final concern. No merging without the authorization applicable to that PR.

## Additional prerequisite slices from review

### P4-4a — Interest-receivable account and strict schema prerequisite

- Purpose/files/API: separately approved extension to `economic-operation.js` taxonomy and validators, accounting mapping contract; no debt servicing or cash writer. Existing per-entity JPY balance and cent quantum unchanged.
- State/legacy: no persistent debt root or legacy writer changes; account identifier and schema compatibility are Owner-approved after P4-4.
- RED/GREEN: modeled-lender accrual rejected on old taxonomy; new approved account with debtInstrumentId validates, unknown accounts and invalid top-level `type`/termsVersion/entityGeneration still reject; metadata versions accepted. Existing operation/read-model/shadow tests stay green.
- Node/WebKit/save/RNG: focused strict-schema tests, save compatibility of existing operations, zero RNG/state writes, applicable boot gates; no invented debt WebKit coverage.
- Dependency/completion: mandatory before P4-5 modeled-lender accrual builder. Owner approves taxonomy, with no implicit lending authority.

### P4-4b — Gameplay profit and accounting compatibility before live accrual

- Purpose/files/API: separately scoped compatibility for `engine.js:2318-2325`, finance event/close projections and affected reports/tax/credit/history consumers. Split independently reviewable accounting and gameplay changes further if necessary; one concern per PR.
- State/legacy: preserve existing game fields and v9; explicit cohort capability keeps new execution inactive until adopted. Accrued expense and cash-paid interest become distinct inputs, without another authoritative cash writer.
- Postings/atomicity: accrue expense/payable once; settlement cash/payable only; principal zero P&L; paired founder income/receivable and cash attribution; existing outer transaction/storage checkpoint, no bespoke persistence.
- RED/GREEN: cash-zero accrual changes gameplay profit/tax/retained earnings/report/history once; payment no repeat expense; normal tax/dividend weeks, default/workout, mixed cohorts, rollback and reload; exact cash/BS/CF and credit input reconciliation.
- Node/WebKit/RNG: focused accounting/gameplay/save/fault/52-208-week tests, actual WebKit/IDB before live adoption; deterministic old/new fixture comparison with declared approved behavior change.
- Dependencies/done/Owner: P4-4 policy, P4-4a/P4-5 operations; completed before P4-12 adoption readiness and any P4-13 live accrual. Owner accepts financial/gameplay recognition policy. Pure builder work does not authorize this production compatibility change.
