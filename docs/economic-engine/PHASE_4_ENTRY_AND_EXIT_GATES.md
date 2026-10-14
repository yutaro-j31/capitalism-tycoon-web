# Phase 4 — Proposed Entry / Exit Gates

Status: **PROPOSED / OWNER APPROVAL PENDING**. Baseline `ee4f37f561fe326545deed96a127d0a032ebcb24`, 2026-10-14. **Phase 4 Entry: NOT AUTHORIZED**. Neither docs merge nor successful CI authorizes production implementation, adoption, migration, source-of-truth cutover or next-phase entry.

## 1. Phase 3 dependencies and legal boundaries

| Dependency | Current baseline | Classification / impact |
|---|---|---|
| Borrower legal identity | economicReadModel exposes player-company/founder; general subsidiary/fund registry not authoritative | A schema/read projection possible; B first player-company/founder cohort after stable entity-lifecycle contract; unknown borrower blocks executable debt |
| Lender identity | external:lender and founder known; specific bank/LP not fully mapped | A aggregate lender adapter; B internal lender requires matching legal entity/accounts; Phase16 bank balance-sheet gameplay deferred |
| Company/personal cash | Separate state plus shared save checkpoint | A audit; B first settlement after fault gaps repaired; personal funds never borrower company cash |
| Parent/sub ownership | Phase3 entry conditional; P3-4+ tracker incomplete; ratios not legal debt authority | A exposure read; B explicit mapped legal entities/control capability; ownership changes do not change borrower or debt obligation |
| PE Fund Cash | peFunds cash/LP/portfolio separate legacy system | A schema/projection; C live fund borrowing/portfolio financing requires relevant Phase13 PE settlement authority as well as Phase4 debt kernel |
| Borrower vs guarantor | No blanket parent guarantee established | A separate guarantee schema/scenarios; B known guarantor accounts/consent; C guarantee settlement involving non-adopted fund/sub/security domain |
| Intercompany lending | Founder-to-company exists; general parent/sub loan not found | A balanced model; B founder first cohort; C new parent/sub/PE/VC financing waits for domain settlement/consolidation prerequisites (Phase12/13/14), explicit later gate |
| Minority ownership | Economic/voting rights separated by Phase3 contract; NCI cash/profit gaps #976 | A exposure reporting; B known borrower can owe100% regardless minority percentage; C distributions/elimination/control implementation stays later authority |
| Voting vs economic rights | catalog conditional, no unconditional management unlock >50% | A debt eligibility proposal; B executable financing requires its own corporate consent/capability, not ownership threshold alone |
| Group exposure | No complete common group debt registry/consolidation authority | A gross borrower/guarantee view with completeness; B standalone certified borrowers; C official consolidated debt/net-cash eliminations need Phase12, not Phase4 inferred netting |
| Real estate/SPV | Multiple debt representations; vehicle bundles no own financing | A alias/unknown projection; B independently supported borrower debt only; C new SPV/real-estate asset settlement Phase15 |
| M&A acquisition finance | Parent term/bridge debt exists, transaction boundary in installed close path | A audit/read/pure debt economics; B approved parent-debt lifecycle compatibility; C new deal debt assumption/novation/public/share-swap settlement Phase9/10 |
| Personal margin collateral | Existing product and liquidation paths | A debt projection; B contract math; C new securities settlement/margin liquidation authority cannot be granted through debt slice (Phase9) |
| Cost of Debt inputs | Partial rate/accounting/risk models | A pure definitions; B certified borrower debt outputs; Phase6+ full WACC/valuation/optimal structure remains later |

A = design/isolated validation can be planned before Phase3 exit, no production execution. B = implementation possible only after formal Phase3 prerequisites/Phase4 Entry and the slice permission. C = additionally requires the indicated later authority; schema support is not settlement permission. Phase9 is not a universal blocker for ordinary loan servicing, but security-dependent collateral/transactions are individually gated.

Entity identity must survive share sale and ownership change. Refounding creates a new company identity/obligation disposition contract; constant player-company ID alone cannot prove old borrower debt is extinguished. Legal entity, operating role, economic ownership, control, asset owner, cash account and debt obligor are separate fields. Guarantees cannot be inferred from percentage holding. Group debt does not equal ownership-weighted debt.

## 2. Proposed formal Entry gate

Each row needs exact-SHA evidence, named reviewer and Owner disposition. Current status is not approved merely because a box appears below.

| Gate | Required evidence | Baseline status |
|---|---|---|
| E1 Phase3 formal exit | #909 final slices/scope attestation, ownership authority manifest, independent audit and explicit Owner exit acceptance | NOT MET; tracker incomplete |
| E2 clean current baseline | Latest main exact SHA; all applicable final-head main checks done/green, browser jobs inspected, active overlapping PRs identified | Same baseline final recheck:50 completed,42 success/8 nonapplicable skipped; refresh again at Entry |
| E3 known P0/P1 disposition | #978/#968/#955/#954 remainder closed or documented scoped exclusion; #865 historical status formally reconciled; no unresolved blocker in adopted family | NOT MET |
| E4 debt fault remediation | P4-AUD-001 installed borrow false-save leak fixed elsewhere; every in-scope writer all shared faults/reload/pending/fresh hydration and WebKit | NOT MET; only happy-path tests plus one fault REPRO |
| E5 complete inventory/parity | All caller/wrapper/weekly/migration paths, aliases, source units, defaulted balances, unknown legacy exposures; matrix vs lexical inventory diff | Design supplied; executable verification pending |
| E6 financial inputs | Certified standalone P/L/BS/CF and principal roll-forward; no double-count subsidiary income/cash; current #976 policy disposition; default/current maturity treatment | Partial; Owner policy missing |
| E7 entity/cash boundary | First borrowers/lenders/accounts stable through sale/refounding; fund/sub/person separation; supported entities explicit | First-cohort proposal only |
| E8 adoption policy | Contract interest convention, fee/OID, partial payment/default/PIK, IDs, provenance and unknown legacy quarantine; no auto migration | Owner decisions in §5 pending |
| E9 test/budget manifest | Tier1/2/3 plan, current permanent gates, precise supported scale, measured baseline/mobile protocol and adoption lifecycle coverage | Proposed; not executed Phase4 evidence |
| E10 explicit permission | Owner accepts final Entry Contract and initial implementation scope; separately authorizes each authority/migration cohort | **NOT AUTHORIZED** |

No unresolved confirmed money/save P0/P1 may be waived silently. A purely read-only slice can have narrowed scope, but this does not permit the later debt writer cutover or official Phase4 Entry while required Phase3 exit is absent. The current design work remains authorized even though E1–E10 are not satisfied.

## 3. Per-family authority gate

Required immediately before each P4-10 family, in addition to Entry:

- Same current base SHA, explicit supported borrowers/contract families and old-save cohorts, alias map with100% coverage; unknown source stays read-only and blocks executable aggregate certification.
- One opening principal/accrued-interest/receivable/cash snapshot accepted. No invented past interest, no cash normalization/balancing plug. `SAVE_KEY=capitalism_tycoon_web_v1`, effective saveVersion9 unchanged.
- Whole lifecycle available (or temporarily non-executable until complete): issuance, accrual/payable, settlement, schedule/early/maturity, credit status and error handling. Principal and accrued interest verified independently.
- Every old cash/principal/service caller for the adopted family disabled/gated in same approved concern; unrelated legacy families still serviced once. Compatibility projection cannot write back into reducer. No skipped unknown helper/caller because UI currently hides it.
- Installed-method RED→GREEN plus exact accounting/save/ID/replay/headless tests; real WebKit+IDB proof; post-save exception, valid pending predecessor and fresh-context hydration included. No consumption of host RNG; semantic replay exact.
- Bounded contracts/events/receipts and compacted replay watermark proof; active/defaulted balances never truncated. Debt-free closed objects retire only under tested accounting receipt policy.
- Backup/adoption/reverse-adoption plan with limits, mismatch abort and unambiguous fallback. No global toggle can turn legacy writers back on after canonical transactions without reconciliation.
- Owner explicitly grants the cohort source-of-truth transition. Phase4 schema alone cannot grant settlement of fund/PE/VC/M&A/stocks/property assets or Phase16 banking.

## 4. Proposed Exit gate / Phase5 handoff

| Gate | Required acceptance |
|---|---|
| X1 scope | Named instrument/borrower families certified; unsupported legacy bonds, LBO/fund/SPV/VC contracts clearly unavailable. If required debt families remain ambiguous or legacy-only, declare PARTIAL and seek explicit roadmap-scope decision; do not quietly call full Phase4 complete. |
| X2 one writer | Each adopted principal/accrued/payable/cash fact has exactly one reducer/caller authority; matrix/callers/manifest cover all paths; no dual-authority replay. |
| X3 accounting | Per-entity balanced EconomicOperation; principal and accrued-interest roll-forwards, receivable match, cash conservation, BS/CF/P&L and no double interest; defaulted debt retained; no NaN/Infinity or unexplained money. |
| X4 atomicity | All in-scope failed writes leave live/storage/mirror/cache/pending/durable+fresh hydration unchanged under common contract; sequence monotonic; no failed transaction revival; duplicate replay rejected after compaction. |
| X5 long run | Tier2 208/520 weeks + Tier3/exit5200-week supported scenarios, multiple persisted seeds/diverse rate/economic paths, replay/reload/compacted forks, scale capability declared, bounded bytes/runtime/envelope. Actual report artifacts, not proposed test names. |
| X6 mobile/performance | Relevant WebKit current-head success; physical iPhone Safari accepted protocol comparing startup/week/save/load/background resume to approved baseline. Measured vs estimated distinguished, no unbounded UI reads or heavy schedule arrays. |
| X7 metrics | Every Design §6 metric known/null status and provenance; no999 sentinel as real result; Cost of Debt vs coupon vs realized labelled; no market/book mix; tax-shield inputs not assumed realized shields. |
| X8 compatibility | Old v9 saves supported under Owner-approved cohort adoption; unknown/historically damaged saves no auto repair; unchanged SAVE_KEY/version; adoption rejection restores all. |
| X9 quality | New P0/P1 absent; all relevant old blockers closed/dispositioned with evidence; independent audit on exact final SHA, final-main applicable CI green, Owner accepts exit. |
| X10 handoff | Versioned debt input snapshot `{asOfPeriod, borrowerScope, grossFaceDebt, accruedInterest, unrestrictedCash, rates, schedules, credit/covenant, taxInputs, coverage, sourceRefs, formulaVersion}` for Phase5/6. No Ke/WACC/EV writer; Phase5 Entry separately reviewed. |

Future full Phase4 authority completion and a deliberately narrow first-cohort acceptance are different milestones. If Phase3 cannot supply the necessary general entity/account boundaries, report that explicitly rather than skipping a required family and declaring full Exit.

## 5. Owner decisions needed (concrete proposals, not assumed approval)

| Decision | Proposed default / alternatives / effect |
|---|---|
| D1 first cohort | Company general loans + founder lending first; raw unsupported aggregate personal debt read-only. Alternatives bank-term first only after its fractional cash/residual policy is fixed. Pure schema/adapter precede either. |
| D2 actual vs contract rate | Shadow reproduces actual current charged pool; canonical new contracts use per-instrument coupon only after approval. Grandfather legacy-policy contracts unless separately approved conversion; row rate0 must not silently become free credit. |
| D3 weekly timing/rounding |52-period simple annual coupon, deterministic cent recognition/remainder, opening principal and explicit issue-period convention matching family characterization. Changing existing whole-yen products is an economic/accounting policy change; exact approved residual rule required. |
| D4 partial payment/order | Due interest before principal, fees by contract; unpaid amounts retained. No automatic capitalization except approved margin PIK contract; no automatic forgiveness. Alternative all-or-nothing scheduled payment must be family explicit. |
| D5 default/workout | Preserve owed balances; no debt haircut/new penalty/nonaccrual without terms. Covenant consequences and grace/cure explicit; defer unsupported recovery waterfall to later authority. |
| D6 fees/OID | First canonical adoption excludes OID/amortized-cost products and inactive bonds; model fields retain unsupported status. Upfront fee policy grandfathered per family; new effective-yield model optional later approved slice. |
| D7 ambiguous legacy debt | Quarantine, disclose unknowns, block debt certification/action if material. Never guess lender, double-sum aliases, invent balancing loan or load-time repair. #979 repair stays separate program. |
| D8 borrower/entity lifecycle | Stable legally mapped borrower through ownership changes; new company after buyout distinct lifecycle contract. Decide old obligation disposal before adoption; no reset erasure. |
| D9 subsidiary income/CFADS | Resolve #976 parent profit/cash overlap before certified coverage/leverage. CFADS defined as approved projected cash after operating/tax/required reinvestment, before debt service; provisional historical proxy clearly separate. |
| D10 scope/later phases | No new LBO/fund/SPV/VC debt gameplay or security settlement; external lender only. Read schemas/analyses permitted; live domain additions wait Phase9/10/12/13/14/15/16 as applicable. |
| D11 merge/Entry/adoption | Review this docs-only PR separately. Its merge does not authorize Entry. After Phase3 exit and blocker closure accept refreshed Entry + first pure slice, then approve each authority cohort. |

## 6. Present verdict

**DESIGN READY** as a reviewable proposal, with unknowns, financial policies and executable acceptance requirements explicit. **IMPLEMENTATION NOT READY**. Phase4 Entry **NOT AUTHORIZED**. Confirmed new P1 command families: P4-AUD-001/002 (company/personal general borrowing/repayment and founder lending save rejection). Known open P1/status decisions: #978/#968/#955/#954 remainder; #976 accounting policy and #979 damaged-save investigation; #865 P0-labelled historical closure verification remains open, not a newly verified live P0.

Recommended next Owner action: review/approve docs-only PR merge if satisfied; keep Phase4 production stopped. After separate Phase3 formal exit and P0/P1 reconciliation, review a refreshed Entry contract and authorize P4-1 pure schema validator. No production patch, save conversion or cutover is sought implicitly by this report.
