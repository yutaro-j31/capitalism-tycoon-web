# P0/P1 root-cause taxonomy and recurrence audit — 2026-10-20

> **Status: initial, read-only evidence review; not a final whole-repository audit or a release gate.**  
> **Audited main:** 2507203f3f0abdcc08262ede91703915e5ba265f  
> **Scope:** historical priority-labelled issue titles; corresponding closed/open issue narratives; latest-main inspection of selected installed finance/mortgage/commercialization code; open repair PR metadata.  
> **Not executed:** Node reproduction, headless harness, CI, WebKit or physical iPhone. **No production mutation, merge, Owner economic-policy decision or Phase 3/4 authority cutover.**

## 1. Counting protocol — avoid misleading P0/P1 totals

GitHub issue title searches at the audit snapshot returned:
- **15 P0-titled issues**: #726, #727, #728, #729, #730, #731, #732, #733, #751, #755, #837, #839, #841, #842, #865. Of these **14 closed, 1 open (#865)**. Closure is not itself proof of regression acceptance; an open historical title is not itself proof of an extant P0.
- **21 P1-titled issues**, all closed by the title-search filter. **Six are Phase 1 task IDs rather than P1 severity** (#871, #873, #876, #880, #883, #886), leaving **15 severity-sounding records**: #734, #735, #736, #761, #843, #953, #954, #955, #966, #968, #971, #975, #978, #988, #1008. Within those, **#966 expressly states severity P2** in its body, and **#975 / #988 contain P1-candidate or proposed wording**; do not count all fifteen as confirmed P1.
- This title search **does not inventory every P0/P1**. In particular #1013 (P4-AUD-008) documents a **P0-level exploitability risk** pending formal severity designation, and #1014 (P4-AUD-007) explicitly documents **P1 confirmed**, despite neither title containing P0/P1.
- P2 in an issue title can mean Phase 2; distinct from severity P2. Likewise P3-4, P4-AUD identifiers are workstream/defect IDs, not automatic priority labels.
- Counts above measure **historical reports, not unique current defects**. Repeat reports, root-cause siblings, test-only or design work, and reclassified issues require separate treatment.

This is a **bounded baseline**, not a complete historic incidence or defect-escape time series. A future comprehensive inventory must read issue labels/bodies, associated PR closure references, merged code, latest reproducible tests, and PR-head/branch status.

## 2. Root-cause families (related failure mechanisms, not proof of one identical bug)

| Family | Representative historical evidence | Shared failure mechanism | Durable prevention |
|---|---|---|---|
| **A. Save/commit atomicity** | #726, #734, #953, #954, #955; repair PRs #989, #1010 | Writers mutate live state / persist separate sub-actions / ignore failed save or leave durable/live divergence; governance completion persisted separately from buyback | One outer transaction per economic operation; checkpoint covers state, ledger, save storage, IDB and pending writes; failure injection / retry / fresh hydration for the **full installed writer family** |
| **B. Ledger and financial statement conservation** | #728, #730, #733, #751, #755, #837, #865, #968, #971, #975, #978 | Cash, loan, asset, subsidiary and profit changes are not consistently represented in the **production** finance rows/BS projections; invalid bookkeeping may soft-lock week close | Cross-entity double-entry/projection invariants, accounting event at each legitimate settlement, immediate + next-week finance validation, fractional-balance fixtures |
| **C. Ownership, refounding and lifecycle authority** | #727, #729, #955, #968, #1008; #1027 follow-up | Asset/beneficial-interest state lost or duplicated through sale/rebuy/refounding; partial ownership recomputation or overwrite of root collections | Durable identity + owner attribution, conservative source validation, explicit transfer/disposal receipts, full pre/post/refound/reload source-conservation assertions |
| **D. Debt principal authority and financing** | #728, #735, #1013, #1014; repair PRs #989, #990, #1015, #1036 | Property service principal, aggregate company/personal debt and finance loans have competing writers; refinancing principal reduction without paying old lender can mint cash | One instrument principal authority; reconcile service view, finance loan, BS liability, cash and fees; prohibit unfunded principal reduction; maintain standalone/fresh-save tests |
| **E. UI, render or weekly side-effects** | #761, #966 (body classifies P2), #971, #988 | Economic mutation initiated from render/load/UI click rather than canonical period or command boundary, causing repeatable accrual, divergent RNG or missed execution | Pure rendering; at-most-once action/period receipt; write only inside accepted canonical period/transaction; deterministic re-render and retry tests |
| **F. Determinism, normalization and legacy corruption** | #731, #732, #839, #841, #842; #979 legacy-save investigation | Reload/normalization changes future state, nonfinite values, stale asset projections or migration history affect simulation | Persisted simulation seed; schema/legacy fail-closed checks; nonfinite gate before normalization; continuous-versus-reload fork equality |
| **G. Coverage and audit classification** | #741, #922, Track A Writer Authority Audit | A test may validate a simplified fixture, one wrapper, or all-integer balances but miss production modules, real transaction faults or alternative UI paths | Discover writers from production call graph; exact test/CI coverage map; distinguish CODE/REPRO/NODE/WEBKIT/physical-device evidence; no green CI claims for omitted scenarios |

Historic issue records: [P0 list](https://github.com/yutaro-j31/capitalism-tycoon-web/issues?q=is%3Aissue+in%3Atitle+P0), [P1 list](https://github.com/yutaro-j31/capitalism-tycoon-web/issues?q=is%3Aissue+in%3Atitle+P1). Existing [Track A Writer Audit](TRACK_A_WRITER_AUTHORITY_AUDIT.md) and [Phase 2 Acceptance](PHASE_2_ACCEPTANCE.md) remain distinct, current-code-dependent evidence sources; do not replace their contracts with this summary.

## 3. Latest-main read-only findings and disposition

### 3.1 #865: OPEN P0 title versus installed accounting changes — **STATUS RECONCILIATION NEEDED**
- The #865 description records a then-missing finance event and then-missing commercialization asset projection.
- At the audited main, **js/new-business-commercialization.js** action calls finance.event for a nonzero commercialization cost with cashEffect and assetEffect; **js/finance.js** includes commercializationCarryingValue in new-business assets and spinout subsidiary book.
- Accordingly the *original absent-posting symptom* appears addressed at **CODE** level; **do not claim either unresolved P0 or verified closure** without the production route, ledger, fractional-cash, old-save and WebKit evidence.
- **New audit candidate; not reproduced or severity-confirmed:** commercialization helper currently defines integer(v)=max(0,floor(finite(v))) and both cash(state) and setCash(state,v) use that integer conversion; act() performs setCash(state,cash(state)-cost) while posting precisely -cost. If opening company cash has a fractional yen amount, the extra fractional loss would not be represented in the finance event. This is analogous to the previously repaired #978 *mechanism*, not a confirmed duplicate of its exact defect. Test e.g. companyCash = X + 0.75 (ledger already balanced), legitimate ready project, launch/spinout, check deltaCash == -cost, finance.validate immediately/next week and replay. Do **not** edit this writer in the audit PR; open a separate focused issue only if a production-route RED reproduces.

### 3.2 #1013 / P4-AUD-008: refinancing exploit — **OPEN, MAIN SOURCE STILL AT RISK**
- In audited main **js/real-estate-mortgage-refinancing.js**, refinancePropertyMortgage computes target, old, gross=max(0,target-old), fee, net=max(0,gross-fee), credits cash by net and sets mortgageBalance=target. In the target<old branch the old principal declines without a corresponding cash principal payment.
- The historical installed-engine evidence on #1013 describes alternating mortgage products yielding unearned cash. This issue is **not resolved by merely observing a green diagnostic test**.
- **PR #1036** is an **open** focused repair, not merged into the audited main. Its description claims targeted Node validation but explicitly conditions merge on final-head CI / independent review. Do not duplicate this implementation in the audit branch.
- Maintain #1013 severity as **Owner designation pending**; P0-level exploitability claim is documented, but this report is not a fresh severity approval or a fresh Node reproduction.

### 3.3 #1014 / P4-AUD-007: mortgage liability omission — **OPEN, DISTINCT**
- #1014 shows that a property mortgage balance can be recorded without matching companyDebt / itemized finance-loan liability, and identifies principal servicing/repayment mismatches.
- Current main source in the mortgage module still mutates property.mortgageBalance and company cash without a corresponding obvious itemized company mortgage-loan creation there. **Full installed-writer analysis and Node accounting reproduction remain required** to assess other module hooks.
- #1014 is distinct from #990's property-service mirror repair and from #1036's unfunded refinancing repair. No Phase 4 debt-authority cutover is authorized.

### 3.4 #1008 / #1027: refounding regression coverage — **PREVIOUS P1 CLOSED; NEW P2 OPEN**
- #1008 was closed after correction of disappearing personal VC stakes during refounding.
- #1027 records a more restricted malformed funded-round input that passes refounding and is subsequently cleared; **the issue expressly says ordinary legitimate writer generation of this malformed input is not proven**. Do not label this as a repeat confirmed P1.
- **PR #1029** is open with proposed validation guard and tests; do not collide with its writer edits.

### 3.5 Open repair dependency risks — **TRACK, NOT AUTO-MERGE**
- #989: company/personal borrowing and repayment save-atomicity; **open**.
- #990: property principal writer synchronization; **open**, historically stacked on #989.
- #1010: Founder Capital save-atomicity; **open draft**.
- #1015: personal secured-loan double repayment guard; **open draft**.
- #1036: refinancing exploit correction; **open**.
- #981: Phase 4 debt architecture docs; **open**, not approved production authority.
- #976 listed subsidiary dividend accounting policy and #979 broken legacy saves require explicit separate disposition; treating the code as already migrated would be incorrect.

## 4. Test/gate recommendations without blocking independent Phase 3/4 work

1. **Root-cause / remedy relationship:** for each closed P0/P1 report, record affected installed writer, trigger, causal mechanism, original RED, correcting merged PR/SHA, exact regression test, current canonical CI registration, and whether its related writer family is completely covered. Mark **unknown** unless the evidence exists.
2. **Save failure:** for every *touched* financial authority family, cover save-false/throw, pending-write failure, post-save exception, nested TX, live rollback, localStorage, IDB cache and fresh durable-only reload; a false success is blocking.
3. **Accounting conservation:** for company/person/fund/property ownership, test cash and noncash asset/liability/BS/CF effects together. Repeat with **fractional cash/book** and zero/no-op, avoiding all-integer-only fixtures.
4. **Lifecycle:** re-run sale, repurchase, disposal, spinout, VC funding, refounding, subsidiary merger and next-week close with old-save and identity/ownership source preservation.
5. **Idempotency/determinism:** same week UI click twice, render twice, continuous vs reload, invalid inputs; pure reading must not consume simulation RNG.
6. **Triage hygiene:** never infer severity from Phase labels or absence of an OPEN issue. Keep **historical fixed / reproduction pending / code candidate / confirmed live / policy-dependent / unresolved** separate.
7. **Noninterference:** continue Phase 3/4 unrelated pure adapters and individual functional PRs. Do not merge unsafe writers, relax existing permanent acceptance, change saveVersion/SAVE_KEY or launch broad multi-seed campaigns in this RCA track. This work is an **analytical companion** to Owner-approved implementation-first / Stage F + Stage Q sequencing.

## 5. Ongoing convergence metrics and acceptance limits

Proposed weekly measurements, **not yet computable reliably from title search alone**:
- Newly *reproduced and severity-confirmed* P0/P1 per week, grouped by root-cause family and introduction window.
- P0/P1 fixes merged versus newly confirmed, median time to repair and reopens.
- Repeat escapes: confirmed new defects in a writer family already declared covered by a previous correction.
- Incomplete ownership/loan/finance writer coverage and unprotected save-fault paths.
- Regression surface: number of covered production-route / fault / browser cases, never just tests labelled PASS.

**This first pass establishes mechanisms and a bounded inventory; it does not prove a declining defect trend, enumerate every severity event in the repository, re-run the original red tests or certify any financial writer safe to merge.**

## 6. Parallel handoff

- Keep this document on a **docs-only draft PR**, never merge directly into main. It must not modify production, existing tests or shared authority documents.
- For #865, perform focused production Node reproduction on fractional cash and normal whole-yen cash before requesting issue closure or opening a new bug; document actual deltas and finance.validate.
- For #1013/#1014, continue existing independent P4 repair/Owner decision track; avoid overlapping #1036 writer.
- In a later read-only continuation, expand the sample beyond priority strings in titles: scan all historical issue descriptions/labels plus related merged PRs; create per-issue remedy↔test evidence ledger and compute trend with discovery-date versus merge-date separation.
- A reviewer must compare this taxonomy against **latest** main before any formal acceptance, because the audited SHA is only a snapshot.
