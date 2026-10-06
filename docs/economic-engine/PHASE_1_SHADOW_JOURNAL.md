# Phase 1 Shadow Operation Journal Contract

**Status:** Phase 1 / P1-3 implementation contract  
**Authority:** Shadow evidence only. This document does not authorize an Economic Core settlement cutover.

## Purpose

P1-3 introduces bounded replay/idempotency evidence for validated `EconomicOperation` values before any operation family becomes authoritative.

The journal is deliberately separate from production game state in P1-3. It does not write company cash, personal cash, debt, ownership, finance transactions, saveVersion, or any other authoritative economic field.

## Journal model

The production-loaded `economicShadowJournal` module maintains a JSON-safe value object:

- journal schema version
- explicit retention limits
- monotonic journal sequence
- latest observed period
- bounded live committed operations
- bounded compacted exact-idempotency receipts
- deterministic compaction checkpoint

Only P1-1 operations that pass `economicOperation.validateOperation()` and have `status === "committed"` may enter the shadow journal.

## Phase 1 shadow defaults

These are **P1-3 shadow defaults**, not permanent full-engine normative limits:

| Limit | Default |
|---|---:|
| Live operation detail | 512 operations |
| Live posting detail | 8,192 postings |
| Exact compacted receipts | 4,096 receipts |
| Exact replay/idempotency lifetime | 260 periods |

The full-engine retention budget may be revised by a later owner-approved migration based on measured operation density and stored-save cost.

P1-3 does not add this journal to the persisted game-state root, so these defaults do not increase current production save size.

## Deterministic compaction

When either the live-operation or live-posting cap would be exceeded:

1. oldest live operations are compacted in journal-sequence order;
2. a minimal exact receipt is retained while its replay lifetime remains valid;
3. checkpoint counts and the deterministic chain digest advance;
4. live detail remains inside both caps.

The checkpoint records:

- compacted operation count
- compacted posting count
- latest compacted sequence
- latest compacted operation period
- deterministic chain digest

The checkpoint persists historical evidence even after an expired exact receipt is eligible for retirement.

## Idempotency

Within the valid replay lifetime, exact evidence is keyed by both:

- `operationId`
- `idempotencyKey`

and binds those identities to the canonical operation digest.

Rules:

- same operationId + same idempotencyKey + same digest => duplicate, no journal change;
- reuse of either identity with different operation content or counterpart identity => conflict;
- a still-valid receipt is never silently evicted to make room;
- if receipt capacity would be exceeded before expiry, the append fails closed;
- after the declared replay lifetime expires, exact receipt detail may be retired, while the compaction checkpoint remains monotonic.

This is the bounded-lifetime mechanism required to avoid an unbounded idempotency-key set.

## Save/reload evidence

P1-3 serialization is explicit:

`serialize(journal) -> JSON string`

`hydrate(JSON string) -> validated immutable journal`

Hydration revalidates:

- schema and limits
- committed operations through the P1-1 validator
- operation digests
- posting counts
- unique operation IDs, idempotency keys, and sequences
- checkpoint/sequence ordering
- cap compliance

P1-3 harness evidence must prove that duplicate/conflict behavior is unchanged after JSON roundtrip and after detail compaction.

## Safety boundary

P1-3 MUST NOT:

- mutate authoritative production economic state;
- settle postings;
- call `finance.event()`;
- create a second cash/debt/ownership writer;
- consume simulation RNG;
- depend on wall-clock time;
- change `SAVE_KEY` or `saveVersion`;
- wire executable gameplay actions to the shadow journal.

P1-4 is the first slice that may propose a limited authoritative cutover, and only after P1-3 evidence is accepted.
