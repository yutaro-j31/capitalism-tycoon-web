# Phase 2 Accounting Acceptance

**Slice:** P2-6 — permanent accounting acceptance infrastructure

**Implementation base:** `47bcd31e04160d275aad5192ba850bf7ab4ec2f3`
**Source of acceptance criteria:** issue #890 and `ECONOMIC_ENGINE_ROADMAP.md`, Phase 2

## Scope and authority

`scripts/phase2-acceptance.js` and `tests/phase2-acceptance-gate-test.js` add a permanent read-only gate over the completed P2-1–P2-5 contracts. The production finance module and existing settlement writers retain authority. This slice adds no runtime module, settlement family, migration, RNG draw, economic tuning, or accounting tolerance.

`SAVE_KEY=capitalism_tycoon_web_v1` and `saveVersion=9` remain unchanged. Existing old-save adoption, receipt archival and rollback contracts remain covered by the dedicated slice tests.

## Raw state and duplicate gates

The probe scans the raw state before JSON serialization or finance initialization. NaN, positive/negative Infinity, nested invalid numbers and cycles fail closed with paths. JSON's conversion of invalid numbers to null and legacy numeric normalization cannot turn invalid raw evidence into a PASS.

Live finance transaction IDs must remain unique; non-empty idempotency keys must remain unique. A single operation may legitimately have multiple differently identified transaction legs. Operation IDs are therefore not indiscriminately treated as transaction IDs. Existing dividend, buyback and fixed-asset cumulative/archived receipt gates enforce their family-specific duplicate-recognition contracts; P2-6 does not invent a global historical idempotency journal.

The listed-company fixture executes production borrowing, store acquisition, equipment upgrade, buyback and dividend actions. Replaying each recognized family must be rejected or return the existing idempotent no-op result, with the entire state unchanged. The P2-3–P2-5 tests additionally cover archival/compaction replay and missing receipts.

## Close and accounting integrity

The probe evaluates `finance.standaloneClose()` and `finance.validate()` against a cloned state. Its required-check manifest contains all 36 existing close checks across cash/BS/CF, debt, dividends, buybacks and fixed assets. A missing or repeated required check fails coverage even if the returned close says `ok:true`. Exceptions fail closed. Original state, transactions, cash, RNG and validation diagnostics remain unchanged.

P2-1 close tolerances, P2-2 debt tolerance, P2-3 exact dividend/residual contract, P2-4 share/book tolerances and P2-5 cent-safe asset tolerances are unchanged. Historical P2-0 legacy compatibility tolerances remain separately documented; they are not the sole acceptance criterion.

## Save, reload and replay

The short acceptance fixture uses an explicit persisted simulation seed. It runs 13 weeks and checks every state, including its opening state. Normal production save and normal compacted save are loaded into fresh runtimes with distinct host entropy. The complete accounting projection (finance, company/personal cash and debt, holdings, shares/ownership and simulation RNG) must be exactly equal across the save/reload boundary. Each restored run must reject duplicate recognition, and two reload forks must agree over three further weeks with valid accounting.

This projection is explicitly an accounting assertion, not a replacement for the existing whole-state replay contract. The permanent Phase 0.5 persistence characterization also runs: continuous/reload, compacted save/reload, exact replay, rollback, idempotency, shadow-journal, approved single-writer cutover, ID allocation and legacy parity checks. Their existing comparisons remain unchanged. The existing four-route long-run test keeps its full-state reload comparisons.

## Approved long-run envelope

The P2-0 production-composition envelope is retained:

- ramen, convenience store, gym, real-estate agency;
- 208 committed weeks per route;
- reload fork at week 104, compared for another 12 weeks;
- zero accounting-invariant violations.

`tests/full-index-weekly-validate-208w-test.js` now invokes the raw/read-only P2-6 gate at every main and reload-fork checkpoint before explicit external validation. Existing finance validation, weekly CF identity, finite-state, serializability, survival, state equality and final P2-0 baseline assertions are retained. No second duplicate 208-week matrix is added.

This evidence is limited to that approved envelope. It does not attest every company-count/duration combination in the broader Phase 0.5 scale matrix.

## Canonical gate and exit review

The new acceptance test participates in canonical shard K alongside the dedicated P2-1–P2-5 tests and the long-run test. A CLI smoke report is labelled `scope:smoke`; smoke PASS alone cannot attest the long-run matrix, iPhone or GitHub CI.

Phase 2 exit requires all of:

1. P2-0–P2-5 completion evidence on #890;
2. the P2-6 targeted gate, dedicated slice tests and approved long-run envelope passing;
3. Phase 0.5 and Phase 1 permanent gates retained and green;
4. independent actual-diff A–L audit with no unresolved findings;
5. final-head relevant CI green, including iPhone/WebKit acceptance;
6. rechecked latest main, no conflicts and no unresolved review findings;
7. post-merge main Test, Strategy, iPhone/WebKit and relevant workflows green.

The completed review and exact exit SHA/CI evidence belong on #890 after those conditions are met. This document defines the permanent gate and does not claim an unexecuted CI result.

Phase 2 acceptance does not approve Phase 3 ownership/control command entitlements or later settlement/source-of-truth migrations. The roadmap's Phase 3 entry contract remains a separate dependency.
