# Phase 3 Entry Contract

**Status:** OWNER CONDITIONALLY APPROVED — 2026-10-08 07:23 JST

**Source:** explicit owner decision recorded on [#909](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/909).
**Implementation base:** `0f86c9023f7766ab6c6c1c52cbd38ddfc2f79347`, the formal Phase 2 exit recorded on #890.
**Slice:** P3-0 — entry contract and initial issuer-family scope; documentation only.

## Approval and execution boundary

The owner approved the Control Ladder, separation of voting/economic rights, the catalog including informationRequest at 1% and managementProposal at 3%, the initial issuer scope, fail-closed handling, read-only-first founder wealth, and staged implementation based on P3-0–P3-12.

This approves eligibility policy and implementation planning. It does not make any command executable. In particular, obtaining more than 50% or at least 2/3 of voting rights must not unconditionally unlock existing management commands.

Before implementing an executable command, its slice contract must specify:

- exact command and concrete effect, including any persisted proposal/resolution lifecycle;
- supported issuer family and acting/registered/beneficial holder identities;
- authoritative input, voting/economic denominator and threshold crossing;
- command-specific execution conditions, issuer status and duplicate/replay behavior;
- payer, consideration, fees/taxes and accounting postings, or an explicit no-cash/no-accounting-effect contract;
- complete writer/call-site coverage, atomic failure/rollback and save adoption where applicable;
- UI entitlement and the same engine-side precondition, including direct-call rejection;
- acceptance tests and required dependencies on later settlement phases.

An eligibility result is necessary for a rights-gated action, but never sufficient by itself to execute it. Unspecified command effects or unsupported issuer evidence remain non-executable. New important game-design choices return to the owner; ordinary technical failures are repaired autonomously.

## Initial issuer scope and evidence

Initial executable ownership/control scope is limited to a single ordinary/common share class of the player company and explicitly supportable listed subsidiaries. A subsidiary must be mapped explicitly; a legacy ownership percentage or publicCompany flag alone does not establish all required voting evidence.

Other listed positions, subsidiary/M&A relationships, PE fund/portfolio and VC/startup interests may be represented through read-only adapters. This does not authorize their settlement or control-command cutover. Unknown share classes, special votes, beneficial fractions or joint control cannot be inferred merely to make an adapter executable.

- Economic ownership, voting ownership, registered holder, beneficial owner and control are separate facts.
- Voting denominator uses eligible outstanding voting units of modeled classes. Treasury and non-voting quantities do not vote. Economic allocation uses the relevant outstanding economic rights.
- One underlying security/beneficial interest is represented once; source lots and legacy aliases are evidence, not additional assets.
- Reuse persistent identities, including the existing Phase 1 player-company/person/common-class IDs. Names and tickers alone do not establish issuer identity.
- Missing or contradictory identity/rights evidence must fail closed, with an explicit reason. Do not fabricate historical holdings or receipts and do not add RNG-based IDs.
- Family/trust interests count only to documented beneficial fractions. No automatic spouse/family aggregation.
- Joint/acting-in-concert control is unsupported unless explicitly modeled. No automatic aggregation across person, company, fund and vehicle accounts.
- Already-controlled subsidiaries must not receive duplicate rights or repeat acquisition recognition.
- Use underlying voting quantities and exact crossing semantics, not rounded display percentages or EPSILON-based right grants. Invalid/non-finite/negative quantities, impossible conservation and numeric-envelope overflow fail closed.

These are representation and eligibility contracts. Issuer-family adoption and authoritative writer changes require their own complete slice contracts.

## Conditionally approved rights catalog

Catalog keys are policy identifiers, not declarations that production APIs already exist. Each executable implementation still needs the command-specific contract above.

| Catalog key | Crossing semantics | Approved eligibility policy / UI boundary |
|---|---|---|
| informationRequest | ≥1% eligible voting ownership | Read-only issuer information request; no money or management change. Explain evidence/denominator and unsupported status. |
| managementProposal | ≥3% eligible voting ownership | Non-binding management proposal; does not execute policy or guarantee approval. Specify submission/duplicate lifecycle before implementation. |
| blockSpecialResolution | >1/3 eligible voting ownership | Block a modeled shareholder special resolution. This is not a veto over board-member voting. |
| ordinaryResolution | >1/2 eligible voting ownership | Carry a modeled ordinary shareholder resolution only after the exact resolution/effect contract exists. No blanket access to management methods. |
| specialResolution | ≥2/3 eligible voting ownership | Carry a modeled shareholder special resolution subject to applicable modeled class/control constraints. Unknown constraints remain unsupported. |
| squeezeOutEligibility | ≥90% eligible voting ownership | Eligibility for wholly-owned conversion of a supported issuer. Status, funding, price, residual-holder consideration and atomic ownership/accounting conditions still apply. |
| disclosureSignal | 5% marker only | Disclosure/large-holding signal; not a Control Ladder stage. |
| equityMethodMarker | 20% marker only, where modeled | Accounting classification signal; not a control right or authorization to consolidate. |

The six Control Ladder stages remain 1%, 3%, >1/3, >1/2, ≥2/3 and ≥90%. Do not substitute 5%, 20%, 51% or 80% stages. Existing TOB initiation remains its current acquisition route until separately cut over; 1/3 eligibility does not automatically authorize a TOB.

Board approval and shareholder control use different denominators. The existing boardGovernanceResolution 2/3 member-vote rule is not evidence of 2/3 shareholder voting ownership and is not changed by P3-0.

## Founder wealth starts read-only

Retain the approved Phase 0 founder valuation contract:

```text
listedOwnCompanyValue = marketPrice × founderBeneficialShares
privateOwnCompanyValue = EquityValue × founderEconomicOwnership × 0.70
```

Equity Value, not Enterprise Value, is the private valuation input. Treasury is excluded. Personally purchased own-company shares join founder beneficial ownership and are not valued again as generic personalStocks assets. Source-lot metadata may remain without multiplying value. Indirect interests, GP/LP/co-investment and portfolio assets must not copy the same beneficial interest into multiple personal asset rows. Pledged holdings retain gross value with linked liabilities deducted separately. Family/trust value uses documented beneficial fractions. Private/public transitions preserve identity and change valuation basis only.

Introduce a pure read-only projection first. Replacing personalNetWorth consumers, credit limits, unlocks, endings or other progression behavior requires a separate explicit consumer/cutover contract; adding a display must not silently change borrowing or game balance.

## Settlement and compatibility boundaries

Phase 3 does not advance Phase 9 public-security/corporate-action, Phase 10 M&A, Phase 13 PE or Phase 14 VC settlement authority. Current cash/accounting/quote/fund/round writers remain authoritative until their own approved cutovers. Ownership eligibility is not authorization to issue, acquire, sell, transfer, distribute or reprice assets.

Preserve SAVE_KEY=capitalism_tycoon_web_v1, saveVersion=9, old-save compatibility, deterministic simulation/RNG order, company/personal/subsidiary/fund separation, accounting integrity, iPhone Safari/WebKit and existing Phase 0.5/1/2 Permanent Gates. Read-only projections add no persisted registry root. An authoritative registry adoption must define its save boundary before implementation; no silent saveVersion change.

## Staged implementation

The owner approved P3-0–P3-12 as the basic staged plan. Each row is one concern; independently migrating command families must be split further when necessary. This is not a guaranteed final PR count or permission to skip per-slice investigation.

| Slice | Concern / acceptance boundary |
|---|---|
| P3-0 | Record the approved entry contract, catalog, owner conditions and issuer scope; no production change. |
| P3-1 | Read-only identity/security/holding projection: reuse Phase 1 identities, deterministic order/source paths, no state/RNG mutation or persisted root, explicit unresolved aliases. |
| P3-2 | Player-company issued/treasury/outstanding conservation and beneficial deduplication: ECO-010/011, legacy parity, purchased own-company shares once, old-v9/compacted reload; start read-only. |
| P3-3 | Issuer-family adoption and complete writer/call-site contract: issue/sale/buyback/IPO/personal own-share wrappers, old-save boundary, rollback/idempotency; no parallel ownership authority. |
| P3-4 | Player-company ownership cutover: approved atomic writers, P2 dividend/buyback receipts, save parity, deterministic writer completeness; split independent command-family migrations. |
| P3-5 | External listed holdings adapter: issuer/holder/account separation; no market-price/quote or Phase 9 settlement cutover. |
| P3-6 | Subsidiary/M&A relationship adapter: parent edges, minority economic interest and alias deduplication; acquisition/cash writers retain authority. |
| P3-7 | PE ownership adapter: fund/GP/LP/co-investor identities; no fund/deal settlement change or overclaim of portfolio ownership. |
| P3-8 | VC ownership adapter: economic fractions and known class terms; unknown voting rights stay unknown; no funding/exit settlement migration. |
| P3-9 | Control Ladder eligibility projection: below/at/above boundaries, treasury/non-voting and unsupported evidence; no new action merely from crossing a tier. |
| P3-10 | Approved command/UI integration for one issuer family: complete effect/issuer/accounting/precondition contract, engine/UI parity, unauthorized direct-call rejection, atomicity and WebKit. |
| P3-11 | Founder wealth read-only projection: approved listed/private basis and beneficial deduplication; borrower/progression consumers preserved until separate cutover. |
| P3-12 | Permanent acceptance/exit review: approved family coverage, ECO-010/011/012/015/016/017/021, save/reload/replay, previous Permanent Gates, appropriate long-run envelope, CI/WebKit and independent A–L audit. |

For every slice: refresh latest origin/main, open PRs, issues, instructions and prior completion; inspect authority/call sites/save/accounting/determinism/RNG/UI/tests; implement the minimum one-concern diff; run targeted then relevant full checks; create a PR; independently audit actual origin/main...HEAD; repair and re-audit. Merge only at Gate PASS with all applicable CI complete/green, zero unresolved findings/conflicts and rechecked main. Verify merge/main SHA and post-merge CI before recording completion and starting the next dependency-ready slice.

P3-0's implementation completion and subsequent slice evidence are tracked on #909. Owner entry approval is not a Phase 3 completion attestation or proof of unexecuted CI.
