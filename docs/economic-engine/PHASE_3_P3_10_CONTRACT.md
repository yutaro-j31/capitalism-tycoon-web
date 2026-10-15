# P3-10 — Command and UI Integration Contract

**DESIGN PROPOSAL — implementation and merge require Owner approval.**

Audited production main: `743d08d1867f453fe09c61e1fd5312c846cfc1eb` (2026-10-15 JST). CODE facts below describe that SHA; proposed APIs/fields are explicitly new, not existing production interfaces. No production implementation, registry adoption, schema change, cutover, Phase 3 Exit or Phase 4 Entry is authorized by this document.

Repository precedence follows the approved Roadmap. Current source establishes observed production facts; approved target contracts establish required future behavior. Discrepancies must be logged, never silently adopted as new policy. Required references: Owner instruction and approved [Entry](PHASE_3_ENTRY_CONTRACT.md), [P3-1](PHASE_3_P3_1_CONTRACT.md), [P3-2](PHASE_3_P3_2_CONTRACT.md), [P3-3](PHASE_3_P3_3_CONTRACT.md), [Roadmap](ECONOMIC_ENGINE_ROADMAP.md) and [dependency graph](ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md). Shared proposed types, identity rules and reason codes are specified in `PHASE_3_CROSS_SLICE_ARCHITECTURE.md` (companion cross-slice PR; dependency must merge first).

## 1. Goal / Scope

Specify how approved rights could connect to commands without inventing gameplay effects. Distinguish pure information display, non-binding proposals, resolution eligibility and paid squeeze-out execution. Current status: BLOCKED for production integration; inspect-only command metadata can be prepared.

## 2. Current Production State

CODE: Entry approves catalog names, not existing methods. Installed listed-subsidiary launchListedSubsidiaryTenderOffer and squeezeOutListedSubsidiary use their current legacy price/ownership logic; board governance votes concern members. There is no approved generic managementProposal lifecycle or ordinary/special resolution effect table. P3-4 STOPPED; adapters/eligibility unimplemented. Do not invent an API call as an existing production fact.

## 3. Existing Source-of-truth

Authority remains existing engine/domain modules for economic commands; P3-9 supplies read-only eligibility only. Exact command effect and issuer support need Owner approval. UI cannot become authority. New command envelope would be proposed `{commandId,issuerEntityId,actingEntityId,entityGeneration,expectedOwnershipRevision,operationId,payload}`; this is a control request envelope, not the strict EconomicOperation monetary schema.

## 4. Dependencies

Hard prerequisites: applicable P3-4 authority adoption + writer/call-site coverage, P3-9 exact eligibility + evidence, each concrete approved command contract, transaction/persistence acceptance and actual WebKit integration. Cash/security/M&A/PE/VC settlements still require their formal later phases; P3-10 cannot migrate them. P3-5..8 alone do not authorize actions on their issuer families.

## 5. Entity / Ownership Data Model

Proposed command catalog is immutable capability metadata; proposed proposal/resolution state is deliberately NOT persisted until lifecycle/retention/idempotency policy is approved. Actor is a legal entity, not login UI selection. Registered/beneficial evidence must bind that actor; delegation is unsupported by default. `operationId` never allocated by rendering; writer allocation must commit/rollback with command.

## 6. API / Function Contracts

Proposed `explainOwnershipCommand(snapshot,request)` returns eligibility plus specific execution blockers; pure. Future `executeOwnershipCommand(request)` must re-read adopted facts inside the existing outer transaction, verify revision/generation/issuer/effect allowlist and cash, validate all postings, commit once, persist successfully then publish success. Same key+same payload returns recorded receipt without reapplying state/cash; same key+different payload rejects. Receipt retention must survive compaction before activation; a bounded news/history list is not an idempotency store.

The command specification below has 18 columns represented as two joined tables to keep review practical. Table keys are proposed policy IDs, not existing JS functions.

## 7. Input / Output Examples

Example: founder at3% requests managementProposal payload {policy:'sellAssets'}. Eligibility can be ELIGIBLE, execution rejects `EFFECT_UNAPPROVED`; no company cash/asset/history changes. A cached90% squeeze eligibility followed by stake drop rejects inside transaction. Information request unknown issuer yields UNKNOWN + no disclosure, no save. Duplicate approved future request with same operation ID must return same committed receipt and make no economic change.

## 8. Invariants

UI and direct API share the guard; no hidden-button bypass. Information display cannot invoke ensure/normalizers. An eligible shareholder cannot arbitrarily choose company/fund/personal payer. No transfer for free at90%; no default one-week proposal lifecycle, fee, success probability, policy influence or automatic board override invented. All command statuses false/throw/save-false have explicit behavior before implementation.

## 9. Unsupported / Unknown Cases

Unapproved effects, missing proposal retention/duplicate lifecycle, unknown votes/issuer class, indirect delegation, stale evidence, old ambiguous save generations and absent durable receipt policy. These block execution and remain separate from low voting percentage. “Supported issuer” is required, not inferred by finding a stock row.

## 10. Save / Transaction / RNG Boundary

Pure information UI needs no save, monetary posting or operation receipt; repeat reads return equal values. For every future persisted command use existing runTransaction + common storage checkpoint, not a new command-specific persistence layer. Inject false/throw at preflight/ledger/state/save/admitted IDB/post-save boundaries; nested outer failure restores all economic and proposal state, IDs, RNG, localStorage/cache/pending/durable bytes. Retry after rollback is safe; already committed replay is receipt-only. A notification exception after a committed transaction must not pretend the economic command failed; existing #969 policy is separate.

## 11. Legacy Compatibility

Keep effective saveVersion=9 and SAVE_KEY=capitalism_tycoon_web_v1; `save-v9.js` supplies the installed version despite engine.js's historical base constant. Add no saved root, adoption marker, normalization or repair. Missing optional collections may mean empty only where existing contract explicitly permits; present malformed data is invalid. Preserve original data and issue source paths. Array index may locate a diagnostic, never establish identity. Compaction/load/import cases with lost identity stay unresolved; do not recreate history.

## 12. Integration Points

Future D UI entry point: issuer detail → rights explanation → explicitly approved action form; no automatic route from ordinaryResolution to arbitrary engine method. Maintain existing market/venture/control UI until reviewed adoption. Proposed command writer must reuse installed common transaction/checkpoint and economic-operation schema; metadata inside allowed fields, no fake zero-money postings for information display.

## 13. UI Contract

| Command ID | Issuer family / actor / ownership evidence | Threshold | Preconditions / target / proposed effect |
|---|---|---|---|
| informationRequest | player common or explicitly mapped listed subsidiary; proven direct actor | >=1% | known issuer; read-only supported information view; recommend existing public snapshot only, no new hidden alpha/information advantage without approval |
| managementProposal | same scope / actor evidence | >=3% | lifecycle/effect allowlist unapproved; target proposed issuer policy; recommendation: non-binding submission with no economic execution, persistence/expiry still Owner decision |
| blockSpecialResolution | same scope; class constraints resolved | >1/3 | only modeled shareholder special resolution; proposal/resolution lifecycle undefined → execution blocked |
| ordinaryResolution | same scope | >1/2 | enumerated ordinary resolution/effect required; no blanket management action |
| specialResolution | same scope + veto/class checks | >=2/3 | enumerated special resolution and conflict policy required; no board override |
| squeezeOutEligibility | proven mapped issuer / acquiring legal actor | >=90% | eligibility display only now; paid conversion status/price/payer/postings later explicitly approved; existing legacy squeeze path remains legacy |

| ID | Cash / accounting | Operation ID / transaction / failure | UI / direct API / replay | WebKit / Owner approval |
|---|---|---|---|---|
| informationRequest | 0 / none for recommended pure view | no persisted op; no transaction/save; invalid evidence returns unavailable | issuer rights view; direct pure API validates same input; repeat/reload equal | no writes/RNG on repeated taps; approve exact visible information before enabling |
| managementProposal | recommend0/none, NOT approved gameplay policy | proposal op/receipt retention unapproved; existing outer transaction for persistence; full rollback required | non-binding label; reject unapproved policy even at100%; replay receipt / fresh hydration required | submit/duplicate/save faults/reload; Owner approves effects, lifecycle, costs and retention |
| blockSpecialResolution | effect-specific, unspecified | future resolution ID+actor+revision; one commit, rejected votes no state | explain veto scope; forged/stale direct request rejects; durable resolution replay | conflict/boundary/fault/reload tests; Owner approves resolution types and veto consequences |
| ordinaryResolution | effect-specific, unspecified | same resolution transaction contract; cash/ledger only for approved effect | future explicit form only; generic engine delegation forbidden | >1/2 and save/direct API cases; Owner approves effect catalog/payer/postings |
| specialResolution | effect-specific, unspecified | same plus conflicting class/right evidence guard | no unconditional execution at2/3; receipt/reload checks | veto/conflict/save boundary; Owner approves special effects/conflicts |
| squeezeOutEligibility | eligibility0/none; execution requires residual-share consideration, fees/tax and book/equity legs, not yet approved | future acquisition op + existing atomic settlement; all residual holders once; false/throw restores | show eligibility + price/funding blockers; refuse early settlement; durable replay | true WebKit full transaction required at later activation; Owner approves issuer/price/payer/authority phase |

All rows bind target state and effects explicitly as pure view, recommendation or UNAPPROVED. Required cash/accounting for unresolved effects is UNKNOWN, not0.

## 14. Tests / CI / WebKit

Extend existing `tests/phase3-ownership-projection-test.js` and `tests/phase3-ownership-reconciliation-test.js` for shared purity/identity/conservation fixtures; do not duplicate their harness. Add a focused adapter test only for new family behavior, register it in `tests/run-all.js` and `tests/run-all-shards.json` with shard contract verification. Run immutable input/output, malformed/unknown, insertion-order permutation, cross-account separation and no host/simulation RNG tests. Existing tests are characterization, not proof of an unimplemented API. CI: Test canonical A–L + aggregate `test`, Phase 0.5 Acceptance Smoke and all other applicable workflows. New browser/UI integration needs actual iPhone-emulated WebKit, reload and fresh durable hydration, with tested HEAD and job/artifact recorded; physical iPhone is separate. Docs-only PR CI cannot prove future adapter behavior.
Reuse transaction/save-storage and installed atomicity fault fixture, stock/subsidiary/PE/VC writer suites. Candidate future `tests/phase3-ownership-command-guards-test.js` and WebKit companion cover threshold direct calls, unsupported issuer, unapproved payload, stale generation/revision, nested rollback, operation collision, post-commit error and durable fresh hydration. No implementation tests are added by this docs-only slice.

## 15. Migration and Cutover Restrictions

Production integration prohibited until P3-4/P3-9 and approved command effect contract complete. Do not wrap an old writer with a permissive new control check as a substitute for authority cutover. Information explanation can be a later approved pure UI slice; new persisted proposal state is outside current authorization. No Phase 9/10/13/14 early settlement.

## 16. Risks and Findings

R-P310-01 (Owner decision blocker): concrete resolution/proposal effects absent. Recommendation: first pure information view, then one non-binding proposal family; defer financial resolution execution to separately approved contracts. Alternative: eligibility-only UI through Phase 3, with explicit Owner-approved Exit scope clarification. Do not choose a reduced Phase 3 completion scope unilaterally. R-P310-02: receipt retention/generation policy unresolved; blocks persistence.

## 17. Acceptance Criteria

Each activated command has all18 fields concrete and approved, not placeholders; dependency gates passed; API/UI guards identical; exact threshold evidence; transaction/receipt/replay/fault/WebKit proof. Until then design can be reviewable but production is BLOCKED. Phase 3 Exit cannot waive this by calling an eligibility badge “integration”.

## 18. Owner Decisions

OD-01: exact information content and non-binding proposal lifecycle (expiry, duplicates, retention, any fee/influence) — recommend pure public info first, then no-cash non-binding proposals in a separate approved PR. OD-02: ordinary/special/veto resolution type/effect catalog and conflict policy — recommend no economic execution until individually specified. OD-03: squeeze-out price/funding/issuer/settlement boundary — retain legacy path until correct later-phase adoption. These are unresolved economic/product choices; technical planning continues around them.

## 19. Implementation Slices

Prepare guards/explanation1 PR after P3-9; information view1 PR; non-binding proposal1 PR only after OD-01; resolution families and squeeze-out each separate future PR after OD-02/03 and phase prerequisites. Estimate3–7+ implementation PRs depending Owner scope; not a promise to implement unresolved effects now.

## 20. Definition of Done

Per-command Owner-approved concrete contract, all predecessors implemented/accepted, full UI/API/fault/persistence/replay/WebKit evidence, independent review and successful applicable CI. This specification intentionally reports production BLOCKED rather than inventing economic effects to call it ready.

