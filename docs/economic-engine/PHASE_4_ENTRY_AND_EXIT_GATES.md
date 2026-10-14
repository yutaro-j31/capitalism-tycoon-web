# Phase 4 Entry, Migration and Exit Gates

**DESIGN PROPOSAL. Phase 4 Entry: NOT AUTHORIZED.**

Baseline `ee4f37f561fe326545deed96a127d0a032ebcb24`, 2026-10-14 JST. This document is an evidence checklist, not an assertion that the checklist passes. [Audit](PHASE_4_PREIMPLEMENTATION_AUDIT.md), [Design](PHASE_4_DEBT_INSTRUMENT_DESIGN.md), [Matrix](PHASE_4_WRITER_AUTHORITY_MATRIX.md), [PR Roadmap](PHASE_4_IMPLEMENTATION_ROADMAP.md) define its scope.

## 1. Phase 3 dependency classification

A = design and isolated/read-only validation possible before Phase 3 completion, with no production integration in this task. B = runtime implementation possible after Phase 3 completion **and formal Owner Phase4 Entry**. C = another later authority required; Phase3 completion alone insufficient.

| Dependency / feature | Current evidence / missing prerequisite | Class / blocked capability |
|---|---|---|
| Borrower identity | P1 company/person IDs and P3 read-only identity exist; generation after sale/refounding still needs invariant disposition | A schema/adapter; B native company/person adoption |
| Lender identity | Founder identifiable; external aggregate approved; many specific bank names unsupported | A evidence/null/external mapping; B known shareholder/external operation; bank balance sheet C Phase16 |
| Legal-entity boundary | companyCash/personalCash separate; subsidiary/fund/SPV no universal account registry | A raw entity projection; B approved standalone scope; C multi-entity settlement |
| Parent/subsidiary ownership | P3-6 relationship adapter / full Phase3 acceptance outstanding | A exposure schema; B legal obligor association after identity evidence; C transfer/optimization Phase11/12 |
| Company vs personal funds | Existing distinct fields; founder receivable and repayment side explicit | A parity audit; B paired founder-company loan family once all writers and book sides approved |
| PE fund cash | pe-fund fund.cash and coinvest pools distinct from manager/founder; P3-7 adapter outstanding | A read exposure; C Phase13 borrowing/acquisition settlement |
| Borrower vs guarantor | No formal guarantee execution found | A contingent exposure schema; B debt clauses if modeled; C guarantee payment using other entity cash needs relevant Phase11/later contract |
| Intercompany loan | Founder shareholder writer exists, corporate intercompany loan absent | A contract/elimination-key proposal; C Phase11 funding settlement, Phase12 eliminations |
| Minority ownership | Beneficial quantity/relationship evidence incomplete outside player scope | A gross debt and attribution uncertainty; B read attributable exposure; C NCI/consolidated allocation Phase12 |
| Voting vs economic rights | P3 catalog conditionally approved; P3-4/9/10/12 incomplete | A model obligations independently of voting; B borrower command entitlement; ownership control never guarantees borrowing approval |
| Group debt exposure | Multiple borrower accounts and guarantees required | A sum known gross obligations without duplicated aliases; C formal consolidated/elimination-aware debt Phase12 |
| M&A finance | Actual parent term/bridge legacy writer exists; target truth netDebt not a loan | A read and interaction tests; C Phase10 settlement, public/security-dependent Phase9 first |
| LBO / PE fund leverage | Leverage metadata, no explicit loan instrument service found | A scenario structuring; C Phase13 executable portfolio/fund settlement |
| VC financing | Ownership/round adapters outstanding; no VC debt writer found | A unsupported model; C Phase14 settlement; convertible security exercise also Phase9 prerequisite |
| Property/SPV finance | Existing owner-scoped legacy loans; vehicles mostly metadata | A inventory/alias parity; C Phase15 property finance/foreclosure; Phase11 cash boundaries first |
| CoE, WACC, optimal structure, ROIC comparison | Phase6 shared valuation inputs absent | A debt inputs/scenarios; C Phase6/7 formal valuation/allocation |

A does not mean a Phase4 production module can be introduced now. This task is documentation/read-only audit only. B does not grant automatic command availability or later-phase settlement.

## 2. Formal Entry evidence

All must be recorded against a fresh main and exact approval revision:

- [ ] Phase3 formal P3-12 exit accepted by Owner; tracker reconciled with actual merged slices and main tests. Phase3 adapters alone do not satisfy exit.
- [ ] Track A complete with writer/call-site coverage, exact ownership conservation and no competing authoritative writer; P3-4 STOPPED lifted by explicit approved evidence.
- [ ] Current P0/P1 records resolved or formally dispositioned with evidence; specifically #978/#968, remaining #955/#954 and open historical #865. Stale titles cannot be treated as either proof of failure or proof of resolution.
- [ ] #976 listed-dividend accounting and #979 old damaged saves have explicit permitted-scope decisions; no unauthorized load repair.
- [ ] Latest main CI fully terminal success for applicable jobs, actual main/push WebKit and deterministic/accounting gates inspected; cancelled/pending/failed are not green, expected skipped jobs excluded by applicability.
- [ ] SAVE_KEY/saveVersion9, company/person/fund isolation, stable identity/generation and Phase0 Number envelope verified.
- [ ] This design's initial supported perimeter and open policy choices approved; debt operation/event/accounting/storage contracts clear.
- [ ] Owner explicitly approves **Phase4 Entry**, separately from merging the design PR. Entry may allow pure foundations only; executable writer adoption requires later family approval.

At baseline these are outstanding. **IMPLEMENTATION NOT READY**. No branch or PR here claims Entry approved.

## 3. Read-adapter and shadow strategy (first)

| Legacy source | Read mapping and guard |
|---|---|
| finance.loans[] | Existing loanID preserved; company borrower; founder source identifies personal lender, others external/unknown evidence; rate shown versus actual service recorded separately |
| companyDebt | Aggregate reconciliation target, **not another instrument**; unexplained remainder returned as unresolved evidence |
| bankFinancing.loans[] / bankDebt | financeLoanID/sourceID links are aliases; never sum mirror balance as extra debt. Reject conflicting/ambiguous alias rather than amount matching |
| realEstateMarket.loans[] company | finance loan by same id is mirror; one instrument; accountingTracked/version evidence retained |
| realEstateMarket.loans[] personal | Already included in personalDebt when tracked; subtract matched principal to derive unresolved residual, never add twice |
| realEstate.loans[] | Legacy collection still serviced even though origination public API overridden; map each durable ID and finance alias if present |
| properties[].mortgageBalance | Independent legacy product unless explicit alias evidence proves otherwise; property ID identifies collateral, not loan uniqueness |
| personalRealEstateHoldings[].mortgageBalance | Separate holding instrument, excluded from personalDebt until shortfall. Distinguish assetID from properties[].id |
| personalMarginLoan | Separate excluded balance; unpaid interest capitalization evidence preserved; shortfall to personalDebt linked conceptually, history insufficient for reconstruction reported |
| personalDebt | Known included rows plus unresolved aggregate residual; originalPrincipal/issue/maturity/lender may be null. Tax shortfalls cannot be assumed deductible financing |
| bondFinancing / convertibleFinancing | Legacy records retained with modeledUnsupported capability; no new service/conversion |
| peFunds/deals and peDeals/subsidiaries | Expose observed investment/cash and aliases; do not synthesize LBO debt from EV, acquisitionPrice, investedAmount or leverage |
| competitorStates / property rivals | Read NPC debt with NPC obligor identity or unsupported evidence; never parent-company debt |

Read output is ephemeral, frozen, deterministic and has no new persisted root. No ensure/migrate called on live input. Stable aliases require source durable IDs and entity-generation scope; if absent/duplicated use diagnostics and fail closed. Missing history is not repaired by an invented opening instrument.

Shadow calculations use a cloned snapshot / isolated harness runtime. Shadow journal currently exists as a pure module; do not persist it into production merely for comparison. Record differences as evidence outside simulation state. Never compare-and-correct live debt/cash. Hash entire state/save bytes plus simulation RNG before/after repeated reads, adverse fixtures, reload and compaction.

## 4. Future adoption procedure (separately approved, NOT performed)

1. Refresh latest stable main, Phase3 exit and all writer/alias inventory. Choose explicit obligor+instrument family, not all debts.
2. Define exact predecessor/successor writers including commands, raw exports, weekly hooks, generic repayment/prepayment/maturity, normalization, sale/refounding and delegated paths. Close cross-family mutations or leave activation blocked.
3. Reconcile source principal/payable/contract evidence at a forward opening checkpoint. Preserve old IDs and numeric values. Unknown terms remain unsupported, historical interest not synthesized.
4. Approve account/operation compatibility and durable receipt/checkpoint design, monetary envelope, save size and runtime budget. SAVE_KEY remains capitalism_tycoon_web_v1, saveVersion remains9.
5. Implement in isolated shadow first with activation disabled. Prove parity, exceptions and exactly-one-interest behavior. Keep later-phase settlement writers legacy; no duplicate writable registry.
6. Obtain explicit Owner adoption/migration approval for the exact family and mechanism. This design PR does **not** permit automatic persisted conversion, writer shutdown or schema migration.
7. Atomically activate complete family closure: reducer authority, legacy servicing exclusion, compatibility mirrors/guards, opening receipt and save boundary together. No interval with two writers or no writer. Unrelated later families remain legacy.
8. Verify live, save/reload, old v9, critical compaction, durable IDB/fresh hydration, pending predecessor writes, duplicate commands, replay and mixed native/legacy actions.
9. Review rollback before release: failed uncommitted adoption restores original bytes/state. After committed canonical events, returning to a legacy writer cannot silently discard accrued payable/terms; needs a compatible export/forward correction contract and separate approval. No blind toggle-back.
10. Freeze evidence to exact PR head and merged main; Owner approves merge/cutover. Monitor invariants; maintain bounded checkpoints and unsupported rows. A mismatch blocks the affected capability, never adjusts cash to force parity.

## 5. Permanent test infrastructure to reuse

| Existing path | Use / limit |
|---|---|
| scripts/phase0-5-harness.js | createScenario/createRuntime/stepEconomicTick/runScenario, invariants, semantic hashes/diffs, persistence forks and benchmark reporting. Run installed wrapper composition |
| scripts/phase0-5-harness.js:22-24 | Existing smoke12 weeks×2 seeds, nightly520×4, deepAudit2600×8. DeepAudit is **50 years**, not100; use explicit durationWeeks5200 for century plan |
| tests/harness.js | Production classic-script runtime; wrappers/load order matter; use persisted seed provenance |
| tests/helpers/transaction-fault-case.js | Nine existing fault kinds, nested/pending, full-state rollback, cache/mirror/durable/fresh-hydrate, monotonic saveSequence; no browser claim from fake IDB |
| tests/fixtures/pe-fund-acquisition-faults.js | Shared fake durable IDB/control faults; extend family fixture without duplicating mutation logic |
| tests/transaction-fault-harness-test.js | Infrastructure contract; preserve independent predecessor queued writes |
| tests/ma-acquisition-financing-*-test.js | Existing acquisition financing isolation/atomicity/accounting/replay and real WebKit interaction characterization |
| tests/phase2-debt-rollforward-test.js / loan-single-interest-test.js | Principal/loan aggregates, zero principal P&L, interest exclusions and default transition |
| tests/phase0-5-acceptance-gate-test.js, phase1-acceptance-gate-test.js, phase2-acceptance-gate-test.js | Permanent predecessor contracts; future P3/P4 acceptance must add, not weaken |
| tests/run-all.js / run-all-shards.json | Canonical test registration/shards; expensive tests assigned by measured runtime |
| .github/workflows/test.yml and ma-acquisition-financing.yml | Actual boot/iPhone Acceptance and family browser gates; inspect path/event filters. No workflow changed here |

## 6. Lifecycle test plan: exact expected assertions

| Case | Required assertion / oracle |
|---|---|
| Borrow external / shareholder | Cash principal conservation, unique loan, fee separate; shareholder cash− and receivable+ exactly offset company cash+/debt+; no personal asset double count |
| Accrual vs payment | Week accrual cash0, principal0, expense/payable+; later payment profit0, payable−, cash−; same operation replay once |
| Scheduled/manual/prepayment | Principal decreases and cash decreases exactly, profit unchanged; lender receivable matches; domain mirrors consistent after generic and specialized commands |
| Maturity with cash / no cash | Full payoff closes only at zero principal/payable; unpaid stays matured/overdue; no next-week automatic extinction, no fabricated cash |
| Refinance | Old/new/funded fees/accrued payoff atomic; old principal zero only after posted payoff; failure preserves old contract and all cash |
| Floating reset / rate shocks | Stored fixing/date/source; reset exactly once; +100/+300bp sensitivity matches schedule including floor/cap and reset lag; fixed unaffected |
| Covenant breach / cure | Exact comparator below/at/above; full window; missing unknown; grace evidence; no cash movement from warning |
| Default / workout | Principal+payable retained; interest once according to approved policy; partial recovery posted; impairment not borrower forgiveness |
| PIK | Expense once on accrual; capitalization moves payable→principal cash0; future interest according to contract; totals conserve |
| Sale / M&A / refounding | Debt contract legal obligor retained, refinanced or settled by explicit approved operation; equity sale alone no discharge; before-sale faults preserve exact debt; MA buyer funding is not target debt |
| Disabled products / unsupported parties | Bonds/CB, LBO implied leverage, missing SPV/guarantee do not become executable or generate synthetic liabilities/cash |

Amounts checked to ¥0.01 inside safe Number envelope; illegal overflow rejected before any mutation. Test same seed/state replay with nuisance labels changed; compare semantic first-diff, full-state oracle for read purity, RNG draw/state and stable next IDs. No host RNG allowed, rendering zero draws.

## 7. Atomicity matrix for every adopted writer family

Required fault kinds: `save-false`, `save-before-throw`, `mirror`, `enqueue-false`, `enqueue-throw`, `save-throw`, `saved`, `change`, `notify` from the shared harness. Include direct/nested command, predecessor pending write and retry after rejection. Each fault must reach the installed writer; no fabricated helper-only PASS.

Assertions: full live state/contract/principal/payable/ledger/RNG/ID cursor rollback; identical localStorage and cache bytes; rejected queued put cancelled; predecessor queued save preserved; flush durable IDB; production reload; brand-new runtime durable-only hydration; next saveSequence monotonic; repeat same accepted operation no second posting; same key/different payload rejected. Record notified versus committed/durable success (#969 limitation).

Real WebKit additionally uses actual browser IndexedDB, iPhone viewport and normal UI command entry; covers at least save-false, save-throw, mirror/enqueue fault, pending predecessor, duplicate, reload and fresh hydration. Cache-only reload is insufficient. Add before-M&A/sale debt assertions to existing interaction fixtures. Any new async durable-failure behavior needs its own failure/recovery oracle; synchronous return cannot substitute.

## 8. Gate tiers and long-run experiment design

| Tier | Mandatory scope / when | Duration / envelope / evidence |
|---|---|---|
| PR docs | These design documents only | Diff allowlist, anchors/claims, no runtime state changes; applicable CI; no blanket century run |
| PR pure/schema/adapter | Every changed concern | Focused vectors, read immutability, operation validation, existing smoke12×2 plus52-week debt math where cumulative rounding relevant; predecessor tests as affected |
| PR writer | Every executable family change | Full Node fault matrix, lifecycle touched, duplicate/reload/compaction, exact principal/payable/finance, installed WebKit family cases, 52 weeks with at least2 persisted seeds |
| Integration | After schedule/ledger hookup, before adoption/exit, relevant cross-domain changes | 208 weeks, seed matrix incl normal/recession/rising rates, founder/generic/bank/gym/credit-line/property/margin mixed paths, legacy MA/PE/VC sale interactions; measured browser hydration |
| Nightly | Approved adopted family branch/main, failures triaged by exact seed | 520 weeks×at least4 seeds, different deterministic macro/rate regimes; all instrument kinds and multiple legal obligors; replay/save at52-week checkpoints |
| Deep/manual exit | Phase4 release acceptance and capacity changes | Explicit5,200 weeks (100 years at52 weeks/year), at least8 seeds; split duration and population sweeps; default2600-week harness tier is insufficient for century claim |
| Scale | Separate from gameplay-long-run and synthetic capacity | 1/10/100/1000 borrower entities, 1/10/100 loans each where supported. Mark isolated reducer synthetic versus full installed simulation. Unsupported large-world gameplay is not claimed completed |

Long runs define seed→persisted simulationRng.seed provenance, difficulty/founding route, rate source/unit, fixed/floating mix, payment frequencies, shock timing, borrower count, actual durable save backend, source/main/hash versions. Compare uninterrupted with save/reload/critical-compaction forks at fixed checkpoints. Record any bankrupt/terminal scenario as an outcome with week and cause, not a successful5,200-week completion; a nonterminal fixture must exercise full duration separately.

Measure tick p50/p95/p99/max, serialization/compaction/hydration/IDB-flush time, UTF16 production save bytes (codeUnits×2), retained instrument/receipt/ledger counts, event queue size, serialized-memory proxy and Number-envelope violations. Journal retention must not grow without bound. Monotonic timing remains outside hashes/state. Browser heap/GC/thermal and physical iPhone benchmarks are distinct from Node proxies.

Before executable adoption record baseline and approved budgets: storage below current production quota and compaction safety envelope; zero receipt loss; no nonfinite/unsafe amounts; no determinism/accounting violations; no uncontrolled per-week accumulation. Proposed performance acceptance is no >10% p95 or save-byte regression at matched workload without explained/approved budget, plus responsive iPhone interaction measurements. This numeric threshold is **a proposal**, not an existing repository SLA. Do not invent absolute iPhone latency/capacity claims without measurement.

Do not run every long suite on every PR. Trigger integration when changing accounting/schedule/writer interactions, nightly on recurring branch/main schedule, deep/manual on exit/capacity changes. New workflow scheduling would be a separate authorized infrastructure concern, not part of this docs PR.

## 9. Exit evidence

- [ ] Owner-approved Phase4 perimeter and exact adopted writer families implemented; all other domains explicitly legacy/unsupported with no competing writer.
- [ ] Contract / economic event / journal / cash / state / display separation demonstrated through installed bypass and failure tests.
- [ ] Principal and payable roll-forwards, borrower/lender conservation, standalone accounting close, zero principal P&L, exactly-one-interest, maturity no extinction.
- [ ] Cost of Debt and risk inputs have verified formulas, units, data quality/window, missing reasons; formal WACC/CoE/valuation integration still Phase6.
- [ ] old-v9 read/adoption compatibility, normal/critical compaction, cache/mirror/pending/durable/reload/fresh hydration and permanent idempotency proof.
- [ ] Deterministic seeds/IDs/RNG/replay, safe monetary envelope and measured retention/performance/save budgets; scale limitations explicit.
- [ ] Approved integration/nightly/century evidence manifests, zero unresolved introduced or prerequisite P0/P1; relevant main CI and actual WebKit green.
- [ ] Independent review of actual final diff and post-merge main evidence; physical-iPhone test status accurately stated.
- [ ] Owner explicitly accepts Phase4 Exit; Phase5/6 handoff records immutable input API/version/quality and later-authority exclusions.

Until these evidence records exist, do not declare Phase4 complete or permit Phase5 production entry by inference. Merging this design PR, if approved, completes an advance-design artifact only.

## Final review addendum — refreshed main and additional prerequisites

Latest inspected main: `6250aef7c7b81c149305e9a47175af63df96212f` (2026-10-14 JST). #978/#968 and #955 trackers are closed; #980/#983/#984/#965 are merged. Historical open statements above are the initial ee4f37f5 observation and must not be used as current defects. #909 remains open with P3-4–P3-12 incomplete; #954, #976, #979 and historical #865 still require scoped disposition; #963/#964 remain open despite #955 tracker closure. #985 is a newly open P2 sold-company PE command-boundary issue.

Formal Entry additionally requires:

- [ ] Resolve P4-AUD-001 reproduced rejected-save live mutations for installed company/personal borrowing/repayment and founder lending; complete shared Node/real-IDB/WebKit faults, reload/pending/fresh hydration before VERIFIED.
- [ ] Resolve P4-AUD-002 reproduced generic property principal repayment/specialist mirror divergence, and prove closure over all generic repayment/prepayment/maturity and specialized servicing paths.
- [ ] Cover D17 and D20 legacy company/personal property interest overlap without silently reconstructing historical interest or auto-migrating saves.
- [ ] Implement/accept P4-4a interest-receivable taxonomy/validator before P4-5 accrual builders, and P4-4b gameplay profit/tax/cash/credit/report compatibility before live adoption. Existing strict EconomicOperation field names are preserved.

Main at this recheck has53 completed checks:43 success,10 nonapplicable skipped,0 failed/pending. PR #981 initial head df59530f has22 completed checks:20 success,2 skipped. New amended head requires its own applicable CI, and docs merge remains Owner-only. No Phase4 Entry, production change or source-of-truth adoption is authorized.


## Supplemental P1 prerequisites — 2026-10-15 JST

- [ ] Resolve or explicitly disposition with evidence **P4-AUD-003–008** in the [additional audit](PHASE_4_ADDITIONAL_P1_AUDIT.md): founder-capital save atomicity; personal property principal; non-active principal allocation; double personal interest; missing mortgage liability; cash-creating downward refinancing.
- [ ] Refresh personal principal/interest and specialist completeness tests; company-only finance/debt validation can remain green during a personal exploit.
- [ ] Do not infer closure from #989/#990: both scoped repairs are included in the tested #990 head and all six additional findings still reproduce. No automatic legacy save repair, new authority or Phase 4 Entry is authorized by this addendum.
