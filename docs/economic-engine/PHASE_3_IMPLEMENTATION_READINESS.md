# Phase 3 Advanced Implementation Readiness

**Design delivery, not implementation completion. No merge, Phase3 Exit or Phase4 Entry authority.**

Baseline/source audit main743d08d1867f453fe09c61e1fd5312c846cfc1eb, GitHub and fresh clone agree, 2026-10-15 JST. P3-0..3 completed; P3-4 STOPPED. D3 PR992 merged (d0802d88), D4 PR993 merged (743d08d1). PR994 equity-raise dilution remains open head7ac82961a5ba9ce837c6a9025dbc65fe6dc2b72e at observation. Debt989 head d90fbc38 and990 head390d62d4 remain open/stacked; Phase4 design981 head7234639d remains open. All statuses time-scoped, must refresh before implementation/merge.

## Current Owner scheduling addendum (2026-10-16)

Use the merged [Implementation-First Roadmap v2](ECONOMIC_ENGINE_IMPLEMENTATION_FIRST_ROADMAP.md) and [Phase 3/4 gate alignment](PHASE_3_4_IMPLEMENTATION_FIRST_GATE_ALIGNMENT.md). Owner has authorized pure/read-only implementation where dependencies and fail-closed evidence are satisfied. Historical approval-needed/design snapshots below do not cancel that later authorization. Stage F requires relevant S tests, permanent gates and complete safety proofs for each adopted writer; broad unrelated A–L sweeps, mass seed/century/scale campaigns and calibration move to Stage Q. `PHASE_3_F_EXIT` requires all mandatory Phase 3 functionality plus Owner acceptance; `Q_ACCEPTED` remains separate. No Exit, merge or Phase 4 Entry is declared here.

Refreshed main: `26a22a971db457025821ef27503163f4ebaef927`; #994 is merged. #995–#1003/#981 are still proposals; #1008 fix #1016 remains open. Historical source/CI observations below retain their stated baselines. Add legacy `angelInvestments` to P3-8 and P3-11 source-coverage/unknown-wealth tests; personal angel rows do not establish issuer/class identity from names or return multiples. Incomplete coverage keeps total wealth incomplete.

## 1. Meaning of readiness

READY means specification/dependency/test contract is concrete enough for an Owner implementation-start decision. READY WITH CONDITIONS means explicit source-evidence/integration prerequisites remain; conservative pure behavior is specified, not an excuse to guess missing facts. BLOCKED means material authority/economic-effect/Owner decisions prevent production integration. No status means code exists or acceptance passed.

| Slice | Design readiness | Reason / implementation boundary | Owner start approval | PR estimate / risk |
|---|---|---|---|---|
| P3-5 | READY WITH CONDITIONS | pure source-preserving adapter specified; common identity/source-token and missing external provenance must remain unknown; no external control adoption | pure implementation approval |1 / medium identity coverage |
| P3-6 | READY WITH CONDITIONS | direct/alias contracts concrete; composition must consume PE/VC canonical claims; #994 refreshed; cyclic and historical unknowns preserved | pure implementation approval |1–2 / high alias/generation |
| P3-7 | READY WITH CONDITIONS | fund/GP/LP/proceeds separated; legal voting and full NAV unsupported where absent; shared identity contract first | pure implementation approval; no new NAV policy |1 / high account/valuation |
| P3-8 | READY WITH CONDITIONS | current/pending/IPO/sub mirrors defined; class/preference unknown; listing-index seam first | pure implementation approval |1 / medium lifecycle |
| P3-9 | READY WITH CONDITIONS | exact safe-integer comparator and18 boundaries specified; fractional/out-of-safe-integer inputs unsupported and initial family scope explicit; no new action | projection approval; family authority before execution |1 + optional UI / high rights |
| P3-10 | BLOCKED | P3-4 and P3-9 incomplete; command effects, lifecycle, receipts and economic settlement not fully approved | OD01–03 + authority/adoption approval |3–7+ / high money/permissions |
| P3-11 | READY WITH CONDITIONS | pure component/unknown/negative projection concrete; total incomplete until equity/debt/fund evidence; no consumer cutover | projector/display approval; OD04–05 for missing valuation policy |1–2 / high wealth double count |
| P3-12 | READY WITH CONDITIONS (acceptance implementation plan only) | matrix concrete; Gate execution waits all implemented slices and independent audit | gate/test implementation approval; formal Exit later |2 / high false PASS risk |

Permanent Phase3 Exit = NOT PASS. P3-12 readiness does not clear any missing implementation. No “all eight ready” claim: P3-10 production is materially blocked; other partial projections must expose unresolved counts and incomplete totals.

## 2. Common data model / authority boundary

Shared entities identify legal persons/companies/funds, roles separate from type; source generations and aliases are explicit. Registered holder, beneficial owner, source lot, economic interest and voting units are distinct. Source rows feed one canonical beneficial position, relationship views reference it, valuation adds each underlying claim once. Existing player IDs remain stable; uncertain historical generation fails closed. Readers have no RNG/time/ID/save/ledger/normalizer side effect and no new persisted root. All current writers keep authority until a separate complete approved adoption. Later securities/M&A/PE/VC settlement phases unchanged.

## 3. Owner decisions (only actionable implementation choices)

| Priority / ID | Decision | Recommendation / alternative / impact |
|---|---|---|
|1 / OD01 | P3-10 information content and non-binding proposal lifecycle, duplicate/expiry/retention, any cost/influence | first pure existing public information; then explicitly approved no-money proposal lifecycle. Alternative eligibility-only UI needs explicit Phase3 integration-scope decision; cannot claim Exit from it unilaterally |
|2 / OD02 | specific ordinary/special/veto resolution effects and conflict/class veto rules | enumerate one effect per PR; defer financial effects requiring later settlement. Alternative broad command unlock prohibited |
|3 / OD03 | squeeze-out execution issuer, price, payer, residual consideration, postings and settlement phase | keep legacy execution authority and show eligibility only until individually approved; not free conversion at90% |
|4 / OD04 | private own-company EquityValue source and coverage | tagged validated equity estimate after coverage audit; otherwise incomplete total until Phase6. EV cannot be substituted |
|5 / OD05 | GP residual carry/fund-interest/family/trust valuation when evidence incomplete | unknown disclosed; no speculative carry or managed-AUM attribution. Existing own-company formulas remain fixed |
|6 / OD06 | independent final audit and #976/#979/known debt issue disposition at Phase3 Exit/Phase4 Entry | separate fresh review with exact scope/provenance; no silent legacy-save repair. Existing approvals for debt P1 repairs remain valid but repairs are outside this docs task |

No extra confirmation is requested to finish design/PR/CI work. These choices block only dependent future production slices. Approving this design does not approve production implementation or broaden prior economic authority.

## 4. Work that can proceed while P3-4 is stopped

After Owner implementation approval: shared pure evidence/index and P3-5..8 readers can run before P3-4 because they neither write registry nor replace a consumer. One editor integrates economic-read-model.js; use separate tests/docs for parallel work. P3-9 may project supported player evidence with executable=false, P3-11 may return incomplete components. P3-10 production cannot start. P3-12 test planning can proceed, Exit cannot.

P3-4 stop reasons remaining after D3/D4: complete Writer Matrix evidence, untested base/raw/weekly/shadow/replacement paths, per-writer fault/WebKit coverage, no complete single adopted ownership authority, independent A–L architecture audit and correct old-save/generation handling. #994 unresolved issuance, #976 accounting policy and #979 damaged-save policy remain material dependencies; debt989/990 and six P4 additional P1 families are separate financing/Phase4 readiness dependencies. Historical865 title alone is not proof of active P0; current source/evidence disposition required.

## 5. Roadmap and verification

Use companion PHASE_3_IMPLEMENTATION_DEPENDENCIES.md for optimized DAG, one-concern PRs and exact reusable test/job coverage; PHASE_3_CROSS_SLICE_ARCHITECTURE.md for shared types/IDs/failure/Phase4 interface; PHASE_3_INDEPENDENT_AUDIT.md for actual evidence and limits. Eight slice documents each contain20 implementation-contract sections. Estimate13–20+ future implementation PRs excluding P3-4 and debt repair. No credible fixed completion date follows from this design: command policy and remaining writer evidence are the gating uncertainty.

## 6. GitHub deliverables and acceptance status

9 docs-only concerns, no production/test/workflow/schema edits. Shared cross-slice package4 documents;8 separate slice contracts. Exact PR/head/check evidence is recorded in PR descriptions and the final handoff, not guessed in static design documents before publication. A docs-only canonical green run verifies compatibility of the docs tree; it does not run unimplemented contract APIs. No PR merges in this task.

## 7. Phase4 Entry readiness

NOT READY / NOT AUTHORIZED. Conditions: all required Phase3 implementations and issuer-family authority coverage; accepted permanent gates including save/replay/conservation/unknown/failure/real WebKit and scoped independent writer review; explicit disposition of material P0/P1 and Owner policy; final-main successful applicable CI and stable source identity handoff; Owner-accepted PHASE_3_F_EXIT and separate Phase4 Entry approval. Comprehensive Q campaigns remain later work. Update #981 by proposal/reviewer coordination only, never overwrite its branch. Founder wealth projection does not switch credit limits; collateral does not transfer votes; borrower/lender/fund separation mandatory; WACC remains Phase6.
