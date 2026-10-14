# Phase 4 Preimplementation Audit

**Design proposal only — Phase 4 Entry: NOT AUTHORIZED.**

Baseline: `ee4f37f561fe326545deed96a127d0a032ebcb24`, verified by Git remote HEAD, fresh clone/origin/main and GitHub branches/main on 2026-10-14 JST. This package changes documentation only. Phase 3 production work, debt writers, save format, workflows and tests are untouched. No document here supersedes the formal roadmap or an Owner decision.

## Latest supplemental evidence — 2026-10-15 JST

Latest audited main is `4a7e20c6148f20861321b3b17a8964f82debcadd`. [Additional P1 audit](PHASE_4_ADDITIONAL_P1_AUDIT.md) executes 19 scenarios on main and the #990 head, plus capital persistence faults: six additional P1 families remain after the two scoped fixes. Earlier CODE-only mortgage/interest concerns now have reproduction evidence. **Implementation remains NOT READY; Phase 4 Entry remains NOT AUTHORIZED.** Earlier baseline statements below are historical, not a current all-clear.

## Reading map

| Deliverable | Purpose |
|---|---|
| [Writer Authority Matrix](PHASE_4_WRITER_AUTHORITY_MATRIX.md) | Actual writers, mirrors, omitted/disabled products, evidence and risks |
| [Debt Instrument Design](PHASE_4_DEBT_INSTRUMENT_DESIGN.md) | Contract/state/operation separation, lifecycle, accounting, metrics |
| [Implementation Roadmap](PHASE_4_IMPLEMENTATION_ROADMAP.md) | One concern per PR; dependencies, RED/GREEN, atomicity and approval boundaries |
| [Entry and Exit Gates](PHASE_4_ENTRY_AND_EXIT_GATES.md) | Phase 3 prerequisites, migration, permanent tests and evidence checklist |

## Scope and method

Read `AGENTS.md`, relevant `CLAUDE.md` invariants, `ECONOMIC_ENGINE_ROADMAP.md` Phase 4, `ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md`, `PHASE_0_CONTRACTS.md`, Phase 1 operation/read-model/settlement/shadow-journal implementation, Phase 2 debt/accounting contracts and finance implementation, Phase 3 entry and P3-3 contracts, and `TRACK_A_WRITER_AUTHORITY_AUDIT.md`.

Repository-wide lexical searches included `companyDebt`, `personalDebt`, `outstandingPrincipal`, `loan`, `mortgage`, `creditLine`, `lbo`, `leverage`, `interest`, `maturity`, `refinanc`, `covenant`, `default`, `write-off`, `borrow`, `repay`, `bond`, computed cash/debt keys, prototype overrides, array insertion/removal, normalization and wholesale state replacement. Followed domain methods and production script order in `index.html`, not only the first definition of a method. Tests were inspected as coverage evidence; only executed commands below are PASS evidence.

Evidence labels: **CODE** = source inspection; **NODE** = executed characterization; **GITHUB** = fetched issue/PR/CI state; **PROPOSAL** = future behavior. CODE findings are migration risks, not newly reproduced P0/P1 defects. Lexical coverage is extensive but is not a formal proof against every computed assignment, proxy, imported save or dynamic wrapper. Each adoption slice must refresh the inventory and exercise installed call paths.

## Repository baseline and live work

Latest main includes #973 (quarterly subsidiary cash duplication remedy), #974 (listed-subsidiary weekly settlement) and #977 (subsidiary disposal accounting). Do not repeat stale pre-merge claims from Track A or #909 comments as current defects.

Open PR collection (GitHub REST, baseline observation):

| PR | Concern | Phase 4 overlap |
|---|---|---|
| #965 | Post-buyout refounding atomicity | Company-generation debt/identity boundary |
| #964 | Player-triggered earnings transaction | Phase 3 Track A prerequisite |
| #963 | Hostile-offer decline ratios | Phase 3 control prerequisite |
| #940 | CI parallelization development sequence docs | Gate planning only |
| #938 | Independent integrity/architecture audit docs | Review context |
| #936 | Staged migration/P3-4 scope docs | Authority boundary |
| #935 | PE portfolio Exit atomicity RED audit | Later-phase settlement characterization |

No existing Phase 4 Economic Engine design file or overlapping Phase 4 PR was found. Legacy gameplay documents named Phase 4/6/8 are a different numbering system; they do not authorize Economic Engine Phase 4/6/8.

[#909](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/909) records P3-0 through P3-3 completed, P3-4 through P3-12 unchecked. P3-4 Ownership Authority Cutover remains STOPPED and Track A remains BLOCKED. Adapters, eligibility, settlement and phase exit are different deliverables.

### Open priority records

| Issue | Current interpretation for this design |
|---|---|
| [#978](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/978) P1 | Group capital allocation floors cash/book without posting; remains open. Blocks clean accounting prerequisites. |
| [#968](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/968) P1 | Refounding finance opening cash mismatch; distinct from #965 atomicity. Blocks generation-boundary acceptance. |
| [#955](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/955) P1 tracker | Own-company writers; #963/#964/#965 still open. |
| [#954](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/954) P1 tracker | Historical issue text is stale for several now-transactional expansion writers. Current `expansion.js:615-624` uses transactions. Require tracker reconciliation and remaining PE Exit evidence, not blanket assertion that all listed writers remain broken. |
| [#865](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/865) P0 tracker | Still open in issue collection; old Gate F statement predates later Phase 1/2 completion. Establish closure/evidence disposition at Entry; do not infer an active unrepaired defect solely from title. |
| [#976](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/976) | Listed dividend profit recognition versus already-booked weekly profit; Owner accounting decision remains relevant after #974. |
| [#979](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/979) | Already-broken pre-#977 saves; investigation only, no automatic repair authorized. |
| [#969](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/969) P2 | Success notify can precede failed save/rollback; future debt UI must not call that durable success. |

These are the priority records returned by the inspected open collection, including stale trackers, not a claim that every record is an independently reproduced current-main defect. No new P0/P1 issue is filed by this docs-only task. Ownership over-conservation and M&A goodwill-cash concerns recorded in Track A require their own current-main disposition; neither is silently resolved here.

### CI evidence at baseline

Fetched Actions runs for the exact main SHA. Pages Deployment Smoke `38498051384`, M&A Acquisition Financing `38498051385`, Pages build `38498050895`, Strategy Balance `38498051330`, Release Attestation Sync `38498921097` were successful. Test run `38498051274` was still in progress when first inspected. Its iPhone WebKit Smoke job `115638241886`, iPhone Acceptance `115638242133`, Phase 0.5 Acceptance Smoke `115638241915`, shard-contract, product-innovation and competitor-ai were already successful; release-readiness and extended acceptance were skipped. Several canonical A–L shards were still running. This observation is **not** an all-green-main attestation. Final PR review records later terminal states separately.

Branch protection/required-check policy and physical iPhone Safari were not verified. Automated WebKit success does not establish physical-device performance or 100-year capacity.

## Existing architecture

`companyDebt` and `finance.loans` are legacy-authoritative facts updated together by several writers. Phase 2 observes event `liabilityEffect` in a forward roll-forward; it does not replace debt settlement. `finance.js::debtRollforwardStatus`, `finalizeDebtRollforward` and `validate` check principal/event/aggregate identities. `PHASE_2_DEBT_ROLLFORWARD.md` specifically retains writer authority.

`economic-read-model.js:101-138` already exposes `companyDebtInstruments` and founder receivables: reuse/extend that read-model boundary, do not create an independent writable registry merely because a new schema is desired. Its current adapter is not a full contract model and cannot infer borrower/lender, coupon basis or legal maturity from a display rate alone.

`economic-operation.js` supports stable debt references, balanced JPY postings and accrued-interest liability taxonomy. `economic-settlement.js:108-135` implements **only store renovation** settlement. A general debt reducer, debt family validator, interest receivable account, amortized-cost/fee accounts and durable canonical debt receipt system do not yet exist. Phase 1 schema support is not evidence of executable debt operations.

`engine.js:817-875` and `play-runtime-compat.js:29-40,87-120` make installed weekly wrappers atomic, finalize accounting before commit and checkpoint persistence. Direct commands that mutate/save outside this boundary do not inherit weekly atomicity. `save-storage-idb.js:220-250` updates cache/mirror and queues durable IDB asynchronously; a synchronous save success does not by itself prove durable hydration. Cancellation protects writes newly queued by a rolled-back boundary; it must preserve predecessor pending writes.

## Main audit findings

| Risk | Evidence and consequence | Required treatment |
|---|---|---|
| Same principal has multiple mutators | Generic repay, treasury prepay, maturity repay and bank/property servicers can touch the same finance row. Domain balances in `bankFinancing` / `realEstateMarket` are also mutable. | Family-wide closure over all mutators before adoption; prohibit one-command cutover while remaining commands can bypass it. |
| Specialized loan mirrors can diverge | Generic `engine.repay`, `treasury-prepayment.reduceLoans`, `player-debt-service.reduceLoanBalances` mutate finance rows without invoking every domain's mirror synchronizer. | Explicit alias reconciliation and mixed-command tests; no aggregate-only parity certification. CODE risk. |
| Rate shown is not rate charged | Generic company interest uses live wrapped company rate; finance rows store origination rates. Credit-line rows store zero but principal remains in generic interest pool. Emergency/M&A premium rows also use generic pool. | Adapter emits `contractRateEvidence` and `observedServicingBasis` separately; no silent retuning. |
| Single-interest exclusion is status-dependent | `finance.js:63-65` excludes only active bank/gym/propertySecuredLoan rows from generic pool. Default/workout moves to generic interest. | Verify every active→default/workout transition; preserve one charge, explicitly approve any new default-rate policy. |
| Maturity is not a debt extinguishment event | Bank service marks repaid when remaining weeks reach zero; complete-cycle property service can zero balance at terminal term. Aggregate maturity service repays a share and schedules another date, not a contractual instrument-by-instrument refinancing. | Residual/rounding tests; overdue remains a liability until a posted repayment or approved release. Do not copy time-triggered deletion into target. |
| Personal specialized debt inclusion differs | Personal property complete-cycle loans enter `personalDebt`; personalRealEstateHoldings mortgages and personalMarginLoan are outside it until shortfall transfers. | Never add all rows to aggregate personalDebt. Model included/excluded aliases and residual reconciliation. |
| Unpaid interest semantics differ | Margin capitalizes unpaid interest; personal mortgage tracks unpaid/delinquency but not a separate payable; bank service skips cash payment on shortage. | No invented historical accrual. Opening unknown is explicit, future recognition starts at an approved boundary. |
| Independent legacy property product | `real-estate-mortgage-refinancing.js:10-12` changes property mortgageBalance, posts aliases, but does not itemize companyDebt/finance loans. | Quarantine mismatch; do not merge same-property products merely on collateral ID. Phase 15 settlement stays legacy. |
| LBO label does not establish a liability | PE tiers/targets carry leverage, but `pe-acquisition.js:95-139` spends fund/coinvest cash and records investment; no matched loan origination/service writer was found. | LBO capital-structure scenario only; no synthesized EV-minus-equity debt. |
| Disabled securities remain legacy records | Corporate/convertible bond modules Mode 0 return false for issue/service/conversion. | Keep unsupported rows visible in adapter; no activation or auto-conversion in Phase 4. |
| Read APIs may mutate | ensureFinance, bank ensure/migration, debt-service state normalizers, buildStatements and some quotes write defaults/caches. | Read raw immutable snapshots or isolated clones; deep state/save/RNG equality for adapters. |

## Verification and limits

Executed locally against the audited production baseline: all 16 focused existing Node tests PASS (exit0):

- phase2-debt-rollforward, loan-single-interest, founder-shareholder-loan-lender
- bank-loans-covenants-accounting, bank-loans-covenants-default-consistency
- player-debt-maturity-negative-cash, real-estate-agency-credit-line
- personal-real-estate-mortgage, personal-stock-margin, real-estate-mortgage-refinancing
- real-estate-complete-cycle, real-estate-property-disposals, treasury-prepayment
- ma-acquisition-financing-accounting, gf-002-financing-mode0, economic-read-model

Commands were `node tests/<name>-test.js`; no test or fixture was modified. Logs retained locally during preparation; final PR records the outcomes. The selected debt tests characterize principal roll-forward, single-interest routing, founder lender cash, bank service/default/migration, negative-cash maturity, credit-line and personal products. They do not prove a new canonical model or exhaustive save-fault coverage for debt commands.

No production Phase 4 test was added. No debt fault or long-run capacity PASS is inferred from unrelated tests. WebKit, IndexedDB, all-seed 520-week and 5,200-week experiments are specified in the gate document for future implementation; physical iPhone remains NOT RUN.

## Advance-design verdict

**DESIGN READY** for review and staged pure-schema/read-adapter preparation; the package specifies the architecture, inventory, test obligations and explicit decisions. **IMPLEMENTATION NOT READY**: Phase 3 exit, Track A remediation/dispositions, Entry approval and writer-family adoption contracts are outstanding. This is not a debt cutover readiness attestation. The safest first implementation after authorization is a pure schema validator (P4-1), followed by the read-only extension (P4-2). No runtime implementation is authorized by this PR.

## Final review and latest-main addendum (2026-10-14 JST)

Initial source anchors remain pinned to ee4f37f5. Refreshed GitHub/origin main: **`6250aef7c7b81c149305e9a47175af63df96212f`**. Reviewed all changed paths since initial baseline: completion.js, group-capital-allocation-execution.js, pe-fund.js and Track A, plus associated tests/workflow registration. No core debt/interest/property servicer or operation-schema file changed. Refounding D31 now has shared transaction/actual opening-ledger initialization and sold-company asset retention; historical D31 risk classification is superseded by that implementation evidence, not by a Phase3-complete declaration.

Current disposition: #980/#983/#984/#965 merged; #978/#968/#955 issue trackers closed. #909 remains open and Phase3 formal exit absent. #963/#964 remain open even though #955 closed, so their commands still need individual disposition. Other open PRs: #981, #940, #938, #936, #935. Additional current records: #954, #976, #979, #985 P2, #969 P2, historical #865 open. Initial snapshot above is retained as historical evidence.

Same original main final CI:50 checks,42 success/8 skipped. Refreshed main6250aef7:53 checks,43 success/10 skipped,0 pending/failed. PR981 initial df59530f:22 checks,20 success/2 skipped,0 failure/pending. These are distinct heads, not interchangeable proof. Updated document head requires its own checks.

### Newly reproduced debt P1s on refreshed main

**P4-AUD-001 — save rejection is reported as success with live mutations.** Installed production harness at6250aef7, fresh configured game, `save=()=>false`: company borrow100k, company repay10k (after borrow100k), personal borrow100k, personal repay10k (after borrow100k), founder lending100k each returns true and full state changes. Company borrowing moves cash8M→8.1M, debt0→100k and adds one loan. Founder lending moves company cash/debt+100k and personal cash−100k. No custom fixture repair required. This upgrades direct-save CODE risk to REPRO P1 for these commands. Durable IDB/cache/pending/fresh hydration was not tested in this probe; do not claim full fault coverage.

**P4-AUD-002 — generic principal repayment leaves specialist alias stale, next servicing diverges.** Fresh installed game with company cash100M and company-owned property value300M, monthly rent4M, occupancy1, expense ratio.2; initialize opening finance from those fixture facts. `borrowAgainstProperty(id,60M,{rateType:'fixed',termWeeks:260})` succeeds. `repay(1M,'company')` leaves companyDebt/finance mirror59M and realEstateMarket loan60M; finance validation still reports true. Next week `realEstateCompleteCycle.processLoans` produces companyDebt58,791,450.53 but market/finance principal59,791,450.53; debtRollforwardStatus returns P2-DEBT-INSTRUMENTS difference1M, limit.01. This is current principal consistency failure, not merely CODE suspicion. No production patch is included.

Reproduction core (tests/harness.js installed loader, ephemeral game state only):

```js
const {loadGame}=require('./tests/harness');
const l=loadGame({headless:true});
const e=new l.engineModule.TycoonEngine();
e.configure({playerName:'P4',companyName:'P4',difficulty:'normal',simulationSeed:83951617});
e.g.companyCash=100000000;
e.g.properties=[{id:'p4-mirror',owner:'company',marketValue:300000000,
  value:300000000,purchasePrice:300000000,
  realEstate:{monthlyRent:4000000,occupancyRate:1,expenseRatio:.2}}];
e.g.finance=l.modules.finance.defaultFinanceState(e.g);
e.borrowAgainstProperty('p4-mirror',60000000,{rateType:'fixed',termWeeks:260});
e.repay(1000000,'company');
e.g.week++;
l.modules.realEstateCompleteCycle.processLoans(e.g);
// debtRollforwardStatus: P2-DEBT-INSTRUMENTS difference=1000000, limit=.01
```

### Review resolution and verification limits

Three automated P2 design findings are incorporated: mandatory account/schema prerequisite P4-4a before builders; explicit gameplay profit/tax/cash/credit/report compatibility P4-4b before adoption; D17 company/personal legacy specialized plus generic interest overlap. Separate read-only reviewer additionally identified strict operation fields: operationType/status and metadata termsVersion/entityGeneration, now corrected. Review findings are design changes only.

A concurrent duplicate docs PR982 was closed without merge. Earlier PR981 is the sole surviving Phase4 design PR; independent audit material remains preserved on docs/phase4-advance-architecture at0bd6328d as historical comparison, not a second authority. Additional13 focused existing Node suites were executed successfully on initial baseline: operation/read model/shadow journal/shared fault harness plus debt roll-forward/single interest/founder lender/negative-cash maturity/property cycle/refinancing/personal mortgage/margin/agency line. These overlap the16 original characterization tests and are not31 unique suites. Current-main extra evidence is the two command-path reproductions above; old-suite PASS is not silently relabelled current-main execution. No physical iPhone or redesigned century simulation has been executed.

Final architecture status remains **DESIGN READY for proposal review / IMPLEMENTATION NOT READY / Phase4 Entry NOT AUTHORIZED**. The new P1s must be separately remediated before debt adoption. Next future code slice remains P4-1 pure schema, only after the formal Entry permission.
