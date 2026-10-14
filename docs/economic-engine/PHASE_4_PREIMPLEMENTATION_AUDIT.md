# Phase 4 — Preimplementation Audit

Status: **DESIGN PROPOSAL / OWNER REVIEW PENDING**. Phase 4 Entry: **NOT AUTHORIZED**. Production implementation, save migration, writer cutover and merge are not authorized by this document.

Audit baseline: `ee4f37f561fe326545deed96a127d0a032ebcb24`, retrieved from GitHub main and independently cloned on 2026-10-14. All code line references in this package refer to this exact SHA; they are not floating-main evidence. Scope: repository-wide lexical discovery, installed-module/caller inspection, debt/accounting/save contracts, focused existing tests and installed-writer fault reproductions. This is not a certification that every legacy save or every browser debt path is correct.

## 1. Documents and evidence hierarchy

Explicit Owner instructions > latest repository > AGENTS.md / CLAUDE.md > approved contracts > approved roadmap > historical audits. Read for this audit:

- [Economic roadmap](ECONOMIC_ENGINE_ROADMAP.md), Phase 4 at lines 753–789; Phase 6 valuation and Phase 16 banking remain later authorities.
- [Dependency graph](ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md), lines 77, 129 and 147–148: Phase 4 depends on Phase 1–3; debt authority is Phase 4; full WACC consumes Phase 6 inputs.
- [Phase 0 contracts](PHASE_0_CONTRACTS.md): entity identity, JPY cent quantum, per-entity balanced operations, timing, retention and migration boundaries.
- [Phase 3 entry](PHASE_3_ENTRY_CONTRACT.md): conditional initial issuer scope, voting/economic separation, fail closed, no Phase 9/10/13/14 settlement acceleration.
- [Phase 2 debt roll-forward](PHASE_2_DEBT_ROLLFORWARD.md), [standalone close](PHASE_2_STANDALONE_CLOSE.md), [accounting baseline](PHASE_2_ACCOUNTING_BASELINE.md), [Phase 1 first cutover](PHASE_1_FIRST_CUTOVER.md).
- [Track A matrix](TRACK_A_WRITER_AUTHORITY_AUDIT.md) is historical to `8f2e50fc`; its old open/closed statements are not current status. This package supplements its debt domain rather than rewriting the share matrix.
- [Permanent harness](PHASE_0_5_HARNESS.md), [seed contract](PHASE_0_5_SEED_VALIDATION.md), `phase0-5-authoritative-writers.json` (lexical discovery, not proof of transaction correctness).

No existing Economic Engine Phase 4 design package was found. Historical files named `PHASE4A_*` describe another development sequence and do not authorize this Economic Engine phase. No formal roadmap was modified.

## 2. GitHub baseline and blockers

[#909](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/909) remains open. Its tracker records P3-0–P3-3 complete and P3-4–P3-12 incomplete; neither that checklist nor successful remediation CI proves formal Phase 3 exit. #977 merged into the audited main and fixes #975 new disposal actions. It does not resolve #978, #968, or already-damaged saves.

Open PR snapshot before this docs PR:

| PR | Concern | Head |
|---|---|---|
| #965 | Refounding atomicity | `dbc25ab4dde5bc7b797e5802f453b456e4def539` |
| #964 | Player-triggered earnings transaction | `27b0341818465bda5e3a6b9e87b66227828e465e` |
| #963 | Declining hostile buyout ownership | `15b93b868e0511973b9a0d8058e16c38f835b4e3` |
| #940 | CI sequence documentation | `2041b3b74a802a73835484485fa7432beff19f56` |
| #938 | Independent integrity audit documentation | `7aea7ce29959c88aac19a15f94726d985968767e` |
| #936 | Staged migration documentation | `32fc55d55418eae1c5ee9523169e99573e497bdf` |
| #935 | PE Exit diagnostic tests | `6419d78c1fec0ea41750f7956575661ba72aacac` |

Open issue evidence requiring disposition at Entry:

| Issue | Baseline interpretation |
|---|---|
| #978 P1 | Fractional company cash/book floored by group allocation; next close fails. Open, not repaired by #977. |
| #968 P1 | Refounding initial ledger uses ¥8m baseline instead of actual investment; progression soft lock. Separate from #965 atomicity. |
| #955 P1 | Remaining own-equity writers; #963–#965 are proposals, not merged evidence. |
| #954 P1 | Mixed legacy PE/angel/subsidiary issue; portions already repaired on main must be verified individually, not treated as wholly open defects or wholly closed. |
| #976 accounting decision | Listed subsidiaries' weekly flow-through plus dividend overlap; borrower income/coverage and cash inputs cannot silently endorse this policy. |
| #979 legacy-save investigation | Already-broken pre-#977 saves; no automatic repair authorized. |
| #865 P0-labelled open issue | Historical commercialization issue. Current finance projects carrying book values; old issue text alone is not proof of a current P0. Formal closure/status reconciliation remains missing. |

At initial GitHub check retrieval main had 49 check runs: 32 success, 8 skipped, 9 in progress, 0 failure. `iPhone WebKit Smoke`, `iPhone Acceptance Playthrough`, Phase 0.5 smoke and M&A economic gate were successful. Main was **not yet fully green** at that cutoff. PR/head checks must be recorded separately; no unchanged green run needs ritual rerunning. Final recheck on the same main SHA: **50 checks,42 success,8 skipped,0 failure,0 pending**. Canonical A–L shards and aggregate test are successful. This supersedes the initial in-progress status; it does not close open defects or grant Entry.

## 3. Current architecture

`engine.js:1624–1664` generic borrow/repay/founder lending writes cash and principal directly. Company loans are itemized in `finance.loans`; personal general debt is aggregate `personalDebt` with no equivalent contractual schedule. `finance.js:89–137` observes company debt movement events and checks opening + borrowings − repayments − cashless reductions = ending principal and loan sum. It does not originate debt. Principal movement uses `liabilityEffect`, not gross payment amount.

`finance.js:55–65` identifies founder receivables and individually serviced active bank/gym/property-secured principal. `engine.js:2318` applies current **company-level** borrowing rate to the remaining pool, not each stored contractual rate. Defaulted individually serviced loans fall back into that pool. Founder lender cash receives principal and proportional interest; no second external inflow is legitimate.

`economic-operation.js:7–70` already defines `asset:debt-receivable`, `liability:debt-principal`, `liability:accrued-interest`, `expense:interest`, `income:interest`, `debtInstrumentId`, external lender, JPY-only postings and ¥0.01 money. Operations balance independently by entity/currency (`validateOperation`). `economic-read-model.js:101–128` projects company loan rows; `snapshot:177–200` only represents player company/founder. It is not a full debt registry. `economic-shadow-journal.js` is bounded validation/replay infrastructure, not a generic debt settlement writer. `economic-settlement.js` currently implements store renovation only; debt builders/settlers proposed here do not already exist.

`engine.js:817–874` provides outer `runTransaction`, state snapshot and storage checkpoint. `play-runtime-compat.js:89–115,185–187` wraps configure/whole week, **not every command**. `save-storage.js:31–43,216–246` and `save-storage-idb.js:245–265` retain checkpoint/compensating storage behavior and monotonic saveSequence. Borrowing cannot assume an outer transaction simply because week advance has one. IDB admission is not a synchronous durable commit guarantee; reuse existing checkpoint/flush/error policy, never claim stronger durability than it provides.

## 4. Discovery and coverage

Search covered all tracked JS, HTML call sites, tests, loader order, and economic docs. Terms: companyDebt/personalDebt/bankDebt, finance.loans, principal/balance, loan IDs, mortgage, creditLine/revolving, refinancing, interest, repayment, maturity, default/workout, bond issuance, debt receivable, leverage/LBO, fund/VC/subsidiary/holding/intercompany debt. Field-assignment sweeps included computed debt/cash keys and synchronization/normalization writers, not only user commands.

Installed paths differ from definitions: `real-estate-complete-cycle.js:52` overrides `real-estate.js:47–48` property borrowing/repayment; the earlier module's legacy-loan weekly servicer remains installed. `pe-network-sourcing.js:121–125` wraps generic borrowing for network activity but does not add a transaction. See [Writer Matrix](PHASE_4_WRITER_AUTHORITY_MATRIX.md) for every identified family and mutation boundary.

Confirmed absent/inactive domains: no actual PE LBO or PE fund-leverage writer in `pe-fund.js`/PE portfolio modules; no VC debt origination (equity investment is not debt); no standalone subsidiary/holding-company debt servicer or general intercompany loan product beyond founder-to-company lending found. `realEstateMarket.vehicles` are value/property bundles (`createVehicle:50`), not independently financed SPVs. Corporate bond `issue/service` are deliberately false/no-op (`corporate-bonds-ratings.js:11–14`, GF-002 Mode 0); legacy bonds remain unsupported records. Loan cancellation/forgiveness/debt-equity conversion not found as executable debt products. Default/gym workout, mortgage foreclosure and margin liquidation do exist. Absence means no writer found by this audit, not permission to invent one.

## 5. Findings and severity

| ID | Finding / evidence | Treatment |
|---|---|---|
| P4-AUD-001 | **REPRO P1:** installed `borrow(100000,'company')` with save=false returns true; company cash ¥8m→¥8.1m, companyDebt 0→¥100k, loan count 0→1. No rollback. | Entry blocker for generic borrowing cutover. Delegate separate minimal remediation; this docs PR does not fix it. |
| P4-AUD-002 | REPRO P1: installed company repay, personal borrow/repay and founder lending also return true and retain live mutation on save=false. CODE: personal mortgage/margin manual actions share direct-save pattern. | Entry blockers for the reproduced commands; personal mortgage/margin remain CODE-only gaps until fault probes. No durable fault matrix claimed. |
| P4-AUD-003 | CODE: bank metadata and finance rows; property legacy rows, market loans and finance mirrors can all be repayment targets. Generic repayment/prepayment/maturity reduces finance rows without synchronizing every property representation. | Double service/stale mirror risk. Require cross-family sequence tests; not declared reproduced exploitation here. |
| P4-AUD-004 | CODE: `properties[].mortgageBalance` is separate from companyDebt/finance rows; company mortgage events omit explicit principal liability effect (`real-estate-mortgage-refinancing.js:10–12`). | Accounting completeness risk. Never silently add/subtract this exposure into a certified company total or use balancing plugs. |
| P4-AUD-005 | CODE: older `realEstate.loans` company rows not mirrored into finance; new market rows are. Old personal property debts included in personalDebt also incur aggregate interest (`engine.js:2186`). | Possible missing principal mirror and duplicate personal interest; legacy fixture characterization required. |
| P4-AUD-006 | CODE: current generic interest uses live blended rate, not stored loan rate; 0 rate credit-line row is still in generic charged pool. M&A equal-principal fields exist but no M&A-specific scheduled servicer found. | Adapter must expose contractual rate vs observed charging policy and unknown maturity; redesign cannot silently change gameplay. |
| P4-AUD-007 | CODE: bank service marks repaid when remainingWeeks=0 even if principal remains; real-estate market service clears balance on zero remaining weeks. | Residual/maturity risk under rounding and amendments; force terminal residual tests. No proof that all normal schedules fail. |
| P4-AUD-008 | CODE: personalDebt can contain mortgage/margin/tax shortfalls; `personal-real-estate-taxes.js:61–69` reclassifies unpaid tax there. | Unknown creditor/product provenance; cannot describe every yen as ordinary bank debt. Tax conversion is explicitly flagged. |
| P4-AUD-009 | CODE: bank/read model exclude status=repaid; finance principal roll-forward sums all loan balances; other callers use active-only or larger terminal sets. | Closed/paid/default semantics need amount-based classification and explicit inconsistency diagnostics. |
| P4-AUD-010 | CODE: ID generation uses loan array length in several legacy products; bank metadata cap 24, bond cap16 in ensure. | Collision/metadata-loss risk under retention; stable-ID/active-instrument protection tests required. No new IDs during adapter reads. |

No new confirmed P0 is claimed. A green happy-path suite does not close these fault/legacy risks. The reproduction also ran installed company repay(10000), personal borrow(100000), personal repay(10000), and founder lending(100000) on fresh fixtures with save=false: each returned true and full state changed. These establish the command-family expansion of P4-AUD-001/002; they do not claim durable hydration coverage.

Existing defects remain under Phase 3 remediation ownership; evidence here neither grants repair authority nor stops the authorized design work.

## 6. Executed local evidence

All run on baseline production files; no tracked tests changed:

| Command | Result |
|---|---|
| `node tests/phase2-debt-rollforward-test.js` | PASS |
| `node tests/loan-single-interest-test.js` | PASS |
| `node tests/founder-shareholder-loan-lender-test.js` | PASS |
| `node tests/player-debt-maturity-negative-cash-test.js` | PASS |
| `node tests/real-estate-complete-cycle-test.js` | PASS |
| `node tests/real-estate-mortgage-refinancing-test.js` | PASS |
| `node tests/personal-real-estate-mortgage-test.js` | PASS |
| `node tests/personal-stock-margin-test.js` | PASS |
| `node tests/real-estate-agency-credit-line-test.js` | PASS |
| `node tests/economic-operation-contract-test.js` | PASS |
| `node tests/economic-read-model-test.js` | PASS |
| `node tests/economic-shadow-journal-test.js` | PASS |
| `node tests/transaction-fault-harness-test.js` | PASS |

Ad hoc reproduction, intentionally read-only to the repository (ephemeral engine state only):

```js
const {loadGame}=require('./tests/harness');
const x=loadGame({headless:true});
const e=new x.engineModule.TycoonEngine();
e.configure({playerName:'P4',companyName:'P4',difficulty:'normal'});
e.save=()=>false;
const result=e.borrow(100000,'company');
// result true; companyCash 8100000; companyDebt 100000; finance.loans.length 1
```

This proves rejected-save live mutation, not a full durable fault matrix. Real WebKit was not run locally for this audit; main's existing WebKit checks cover their registered scenarios only. Physical iPhone: NOT RUN. Proposed Phase 4 tests are plans, not PASS evidence. No 520/5200-week debt redesign simulation was run because no redesigned production engine exists.

## 7. Reviewable deliverables and decision

- [Canonical model, lifecycle and metrics](PHASE_4_DEBT_INSTRUMENT_DESIGN.md)
- [Writer authority and adapter mapping](PHASE_4_WRITER_AUTHORITY_MATRIX.md)
- [Sequential PR plan and test tiers](PHASE_4_IMPLEMENTATION_ROADMAP.md)
- [Entry / Exit contracts and open decisions](PHASE_4_ENTRY_AND_EXIT_GATES.md)

**DESIGN READY** means a concrete reviewable proposal with explicit blocked/unknown capabilities and acceptance evidence defined; it does not mean Owner policy choices are approved or production readiness certified. **IMPLEMENTATION NOT READY**: Phase 3 exit absent, debt fault/representation gaps unresolved, Owner Entry/cutover not authorized. Lowest-risk first future implementation is P4-1 pure schema validation, then P4-2 pure legacy read adapter; neither changes live writers. Before any implementation refresh main, #909, remaining P0/P1, policy decisions and all gate evidence.
