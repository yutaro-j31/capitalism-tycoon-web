# P3-10 inspect-only command explanation preparation

Scope: the inspect-only metadata preparation permitted by `PHASE_3_P3_10_CONTRACT.md` §1 and the Owner's
2026-10-29 Work A continuation instruction. This is a pure explanation API, not command/UI activation or P3-10 completion.

## API

`phase3ControlEligibility.explainOwnershipCommand(reconciliationSnapshot, request)` is exported by the existing
`js/phase3-control-eligibility.js`; no new script or runtime consumer is installed. Request fields are `commandId`,
`issuerEntityId`, `actingEntityId`, and optional JSON-data `payload`. Unknown fields or command IDs are refused as
UNKNOWN. It accepts the existing six Control Ladder catalog IDs only.

The function reuses `projectControlEligibility` on the supplied raw P3-2 reconciliation snapshot. It never trusts a
caller-supplied eligibility result. The same actor/issuer, generation, source-binding, treasury-denominator and exact
BigInt threshold rules therefore apply. Output is deeply frozen, deterministic and JSON-compatible:

- `status: EXPLAINED | UNKNOWN`; EXPLAINED means the eligibility could be explained, not that execution is permitted;
- the selected `eligibility` row, including ELIGIBLE / INELIGIBLE / UNKNOWN and its evidence references;
- `authority: read-only`, `executable: false`, `executionStatus: NOT_AUTHORIZED` in every case;
- blockers `AUTHORITY_NOT_ADOPTED` and `EFFECT_UNAPPROVED`, using the shared architecture's Reason shape;
- explicit input/evidence issues for UNKNOWN outcomes.

Even 100% voting eligibility and a payload naming an asset sale cannot execute anything. Payload is inspected as
bounded plain JSON data, never evaluated or passed to an engine. Accessor fields are rejected without invoking getters.
No actor/issuer outside the existing P3-9 supported scope is inferred. Nothing is saved, normalized, posted, emitted,
priced or allocated; no RNG, clock or operation ID is consumed. No state/schema/adoption marker is added.

## Evidence

The already canonical-registered `tests/phase3-control-eligibility-test.js` is extended, with no registration or shard
change. It checks all six commands at 100%, the existing 18 exact threshold cases, unchanged requests/evidence, frozen
results, JSON roundtrip parity, unknown issuer, unknown command/extra fields, malformed/cyclic/accessor payloads and
forged reconciliation. The installed production-state read path preserves the complete state and host RNG while
persistence, finance posting and clock access are made to fail.

The existing P3-9 tests remain intact. Focused control-eligibility, ownership projection/reconciliation and module/static
contracts validate the slice. No WebKit execution is claimed for this slice: there is no UI, persistence or browser
lifecycle change. Relevant browser coverage would be required for a later separately approved UI integration.

## Remaining gates

No engine method, UI button, proposal/resolution lifecycle, durable receipt, new information disclosure or settlement
is enabled. The existing financial writers and permissions remain authoritative. P3-4 family closure and explicit
Authority Cutover, concrete P3-10 effect/issuer/accounting permissions, formal P3-12 acceptance and Phase 4 Entry remain
separate approvals. This API must not be used as an authorization guard: its executable field is always false.

## Partial state-replacement integration evidence

Baseline: `1d73f146b056671a70d75feb617ad1281cc058a0`. The same registered control-eligibility suite additionally
uses production reconciliation and the existing v9 critical-compaction/import path. The fixture has150legacy
founder shares plus1personal own share out of300; ordinary-resolution eligibility is ELIGIBLE. Importing149legacy
plus1personal share replaces the root and changes the freshly explained eligibility to INELIGIBLE at exactly half.
A rejected existing transaction briefly restores151/300, then must restore the entire imported state and150/300
explanation with no candidate put. Production reload and fresh durable-only fake-IDB must explain the same result.

Every explanation stays non-executable/NOT_AUTHORIZED with both authority/effect blockers, even with an asset-sale
payload. Each read preserves full state/RNG, request and mirror/cache/durable bytes and admits no put; save, emit,
finance posting and clock are trapped, with actual VM intrinsics restored afterward. Fresh-VM host RNG is trapped.
Both cash accounts remain unchanged across import/hydration. Existing synthetic/catalog/boundary tests remain.

This pure API explains its supplied snapshot: an earlier snapshot may still explain earlier eligibility and remains
non-executable. It is not a live-state/stale-index authorization guard. Current consumers must obtain current evidence;
future executable commands still require their separate in-transaction revalidation contract. This adds partial
read-only integration evidence for acceptance preparation, not a formal P3-12 gate, command/UI enablement, family
S_PASS, Authority Cutover, Phase3 Exit, Phase4 Entry, native WebKit or physical-iPhone proof. Production and WorkB
CI/runner/registration/vNext files are unchanged.
