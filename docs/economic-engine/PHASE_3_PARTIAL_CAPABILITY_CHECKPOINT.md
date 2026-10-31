# Phase 3 partial capability checkpoint — 2026-10-31

Status: acceptance preparation only. **Phase 3 F Exit is NOT accepted; Phase 4 production Entry is NOT authorized.**
This records existing main capabilities and bounded evidence, not a new permanent gate or economic policy.
The [P3-12 proposal](PHASE_3_P3_12_ACCEPTANCE.md), scoped contracts and Owner decisions remain authoritative;
this checkpoint does not amend them or release PR-specific holds.

## Immutable source checkpoint

Main: `8a8b04178a9c54f71f413005fc8ade130b03b348`.
Tree: `f4611391c814276801d8dded98582aaec4c8f15a`.
Source/API/test pointers below describe that tree. They are a capability catalog, **not claims that every listed
suite was rerun in this checkpoint**. New main CI must be checked independently of earlier green source heads.

## Capabilities and retained boundaries

All reader rows are partial, opt-in observations. The presence of an exported method does not establish complete
issuer-family coverage, a current legal registry, complete wealth or permission to execute an economic command.

| Slice | Present source/API | Existing test pointers | Boundary retained |
| --- | --- | --- | --- |
| P3-4 | [planner](../../js/phase3-ownership-planner.js), [verification/application module](../../js/phase3-ownership-apply.js); 10/13 supported writer IDs have installed `beginOwnershipLeg` calls | `phase3-ownership-planner-test.js`, `phase3-ownership-apply-test.js`; per-family evidence documents | Verification routing is not family closure. `ACTIVATION` remains `disabled`; no authority cutover. |
| P3-5 | [economicReadModel](../../js/economic-read-model.js): `buildOwnershipIdentityIndex`, `projectExternalListedHoldings`, `projectOwnershipSnapshot` | `phase3-listing-observations-test.js`, `phase3-ownership-snapshot-test.js` | Selected ownership-source token is not a financial/valuation snapshot; unresolved identity or rights remain explicit. |
| P3-6 | `economicReadModel.projectSubsidiaryRelationships`, `projectSubsidiaryOwnershipSnapshot` | `phase3-subsidiary-relationships-test.js`, `phase3-subsidiary-composition-test.js` | Hierarchy edges are not additional assets; accepted source replacements must not double-count interests. |
| P3-7 | `economicReadModel.projectPEOwnership`; [phase3PeFundInterests](../../js/phase3-pe-fund-interests.js): `projectPEFundInterests`, `projectLPCommitments` | `phase3-pe-ownership-adapter-test.js`, `phase3-pe-fund-interests-test.js`, `phase3-pe-lp-commitments-test.js` | Direct company holdings, fund participation and LP commitments are distinct evidence. Proceeds/funding fractions do not establish legal portfolio equity or votes. |
| P3-8 | [phase3VCSourceInterests](../../js/phase3-vc-source-interests.js): `projectVCSourceInterests` | `phase3-vc-source-interests-test.js` | Raw source fractions, paid-round evidence and IPO conversion are different obligations; unknown identity/rights/quantity cannot become invented shares or wealth. |
| P3-9 | [phase3ControlEligibility](../../js/phase3-control-eligibility.js): `projectControlEligibility` | `phase3-control-eligibility-test.js` | Exact Control Ladder eligibility is not execution permission; unsupported actor/issuer/generation evidence stays UNKNOWN. |
| P3-10 | `phase3ControlEligibility.explainOwnershipCommand` | `phase3-control-eligibility-test.js`; [explanation evidence](PHASE_3_COMMAND_EXPLANATION_SLICE.md) | Always non-executable/NOT_AUTHORIZED. Historical snapshots can explain historical eligibility; this is not a live authorization guard. No command/UI/effect lifecycle is enabled. |
| P3-11 | [phase3FounderWealth](../../js/phase3-founder-wealth.js): `captureFounderWealthEvidence`, `projectFounderWealth` | `phase3-founder-wealth-test.js` | Bound evidence and known subtotals do not waive missing asset/liability coverage; stale inputs and unknown components remain explicit. No consumer/UI cutover implied. |
| P3-12 | [acceptance proposal](PHASE_3_P3_12_ACCEPTANCE.md) and this preparation checkpoint | Existing permanent and slice-specific suites are reused; their existence alone is not acceptance | Required capability, family, review, current CI and Owner gates remain unsatisfied. No formal F Exit or Phase 4 Entry. |

Test names in the table are relative to `tests/`. This catalog is deliberately limited to the named interfaces;
it is not a complete writer inventory and does not replace the Owner-held Writer Matrix or S Evidence PRs.

## Newly integrated evidence

| PR / source HEAD | Actual merge / tree | Bounded executed proof |
| --- | --- | --- |
| [#1248](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1248), `caa00f5ce6d37916993b9f63f384b377680d62f2` | `504c9e37475b26d6b95a506a89ab64d14d0e0432` / `83b11b87fa03944fb7b432886be1df4d3b9b3193` | Captured old buyback rejection while an accepted predecessor put is in flight; full source buyback suite including 10 captured cases passed. Latest-base candidate retained that source proof because only WorkB diagnostics changed, with candidate/postmerge ownership-apply PASS. Successful legacy settlement remains unadopted. |
| [#1250](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1250), `8166f874f49f783e05d928f2a597e8e7c43fe8f2` | `8a8b04178a9c54f71f413005fc8ade130b03b348` / `f4611391c814276801d8dded98582aaec4c8f15a` | Full control/explanation suite on the combined tree: real v9 critical import, rejected speculative transaction, reload and fresh durable-only fake-IDB, exact half boundary, unchanged state/cash/RNG/storage and no execution permission. Postmerge control and ownership-apply PASS. |

Both final source-head Test workflows succeeded: #1248 run `41168709131`, #1250 run `41172413820`,
20 executed successful jobs each, with 6 inapplicable skips excluded. Exact-head Codex reviews completed without findings;
these are **SAME_MODEL_REVIEW**, not genuinely independent financial audits. Actual merge trees matched the
normal local integration candidates. These are Node/fake-IDB partial proofs, not new native WebKit or physical-iPhone
measurements. Earlier/current integration CI and final source-head CI are distinct records; see PR handoffs for updates.

## Remaining gates and next dispatch

- Fresh source recount: 13 planner-supported writers; installed verification calls cover 10. Remaining
  `W-MA-EQUITY/SH`, `W-IPO-CHAIN`, `W-TURNAROUND-RATCHET` are open #1210, #1213, #1214 respectively.
  Their exact-head CI/Codex evidence does not supply the missing genuinely distinct financial review or narrow
  specific Owner authorization. Keep those merges held and preserve the approved shadow/IPO/weekly boundaries.
- #1093 remains under its explicit PR-specific Owner merge hold. Held #1089/#1091 evidence proposals are not
  merged authority. This checkpoint does not release them or infer closure from rounding/routing completion.
- Captured base rejection, direct exports, weekly callers, live/shadow replacement, storage ordering, replay and
  supported positive settlement have separate obligations. Reuse accepted evidence; do not count a rejected-only
  legacy call as a supported successful settlement or a reader test as authoritative writer closure.
- P3-10 executable commands still need concrete issuer/effect/payer/accounting/Control Ladder permissions and
  their transaction/receipt gates. Even 100% eligibility does not enable commands.
- Next dispatch: verify new-main CI, resolve material in-scope findings, obtain the held writer review/Owner gates,
  then reconcile each partial reader against its approved slice contract before selecting a missing dependency-ready
  function. Do not generate equivalent fault permutations solely to keep creating PRs.
- Formal acceptance still requires the applicable adopted-family, preservation, compatibility, determinism, browser,
  review and Owner gates. Latest explicit Owner old-save compatibility instructions apply; no save migration is
  introduced here. Expanded unrelated audits, large seed/century simulations and balance work remain Stage Q.
