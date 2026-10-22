# Whole-Yen Ceiling Rounding Contract (Phase 0 §5 vNext)

**Status: PROPOSED — becomes the approved contract when the Owner merges the PR that adds this file.**
**Owner decision (2026-10-22):** every in-game monetary amount is settled in whole yen. Any fraction of a yen is **rounded up** (切り上げ). Old saves do not need to stay compatible (Owner decision of the same day; `AGENTS.md` and `CLAUDE.md` are updated by #1071, which must merge before this PR). An old save that loads with fractional balances is not normalised: rewriting a balance would create or destroy money. Its fractions are simply spent through whole-yen postings; the strict whole-yen checks of §6 run on new games.
**Supersedes:** the ¥0.01 posting quantum in `PHASE_0_CONTRACTS.md` §5.1/§5.3 and ECO-019, slice by slice, as recorded in §8 below.

This document is written so that **any agent** (Claude Code, Codex/ChatGPT, or another) can pick up the work at any slice. If you are resuming this work, read §9 first.

## 1. Scope

In scope: every monetary amount that the game **settles or posts**, for every party:

- company cash, debt, ledger rows (`finance.event` amounts and their `cashEffect` / `profitEffect` / `assetEffect` / `liabilityEffect`), loan rows, fixed-asset and property book values;
- personal cash, debt and personal holdings' settled amounts;
- competitor, PE-rival and other NPC money (`competitorStates` cash/debt, fund balances).

Out of scope (keep their current precision; do **not** round them):

- rates, ratios, ownership/voting fractions, FX rates, weights, scores, probabilities;
- share/security quantities (already integer by their own contracts);
- per-share prices, valuations, market values, forecasts and other estimates **until** they are settled or posted. When one of them is posted, the posted amount is rounded by this contract.
- UI formatting (display already shows whole yen; an integer amount displays the same).

## 2. The rounding function

One shared implementation lives in `js/economic-operation.js` (it loads third, before every economic writer) and is exported as `economicOperation.ceilYen`:

```text
ceilYen(x):
  require typeof x === 'number' and finite                 (TypeError otherwise)
  require |x·100| <= MAX_SAFE_INTEGER                         (RangeError otherwise; the same envelope as roundMoney)
  k   = Math.round(x)
  tol = max(1e-9, |x| · 64 · Number.EPSILON)                 (a few units of float precision at x's magnitude)
  y   = |x − k| <= tol ? k : sign(x) · ceil(|x|)              (float noise snaps to k; every real fraction rounds the magnitude up)
  return y === 0 ? 0 : y                                     (never return -0)
```

Consequences, which are intended:

- `ceilYen(12.3) = 13`, `ceilYen(-12.3) = -13`: a payment and a receipt each grow by the fraction. Do **not** use bare `Math.ceil`; for a negative amount it moves toward zero (`Math.ceil(-12.3) = -12`).
- `ceilYen(1200.0000000002) = 1200` and `ceilYen((0.1+0.2)*10) = 3`: a difference within float precision is noise, not a fraction. Any larger fraction, however small, rounds up: `ceilYen(12.004) = 13`, `ceilYen(1200.004) = 1201`, `ceilYen(0.1+0.2) = 1`. Do **not** normalise to ¥0.01 first; that would drop real sub-¥0.01 fractions.
- `ceilYen(12) = 12`. The function is idempotent: rounding an already rounded amount does nothing.
- The tolerance is relative, so a value near ¥10¹³ snaps only within a few thousandths of a yen, below what a Number can represent there anyway.

A writer's **private** helper (for example `const round=v=>Math.round(n(v)*100)/100` in a real-estate module) replaces its body with a call to the shared function, but only when every caller of that helper is in the same slice. It does not keep a private copy of the rule. A helper that also coerces non-finite values (`n(v)`) keeps that coercion before calling `ceilYen`.

**Shared normalisers stay ¥0.01 until R9.** `finance.js`'s `r`, which `finance.event` applies to the amount and every effect of a ledger row, and `economic-settlement.js`'s use of `roundMoney` serve writers in every slice, and also derive statement and reconciliation figures. If one of them were switched early, a writer that has not migrated yet would write a cent value to state while its ledger row became whole yen. A migrated writer instead calls `ceilYen` itself, **before** it writes state or calls `finance.event`. The ¥0.01 normaliser leaves a whole-yen amount unchanged, so state and ledger agree. R9 switches or removes the shared normalisers only once no unmigrated writer remains. The same rule applies to any other helper with callers in more than one slice.

## 3. Where rounding happens

Rounding happens **once**, at the point where an amount is settled or posted. It does not happen repeatedly in intermediate formulas (unchanged from Phase 0 §5.3).

1. **Compute, round, then write.** A writer computes the amount, rounds it once with `ceilYen`, and uses that **same** value for the state field (`companyCash`, `companyDebt`, `mortgageBalance`, …) and for every effect on the ledger row. Writing an unrounded value to state and a rounded one to the ledger (or the other way round) breaks the balance sheet.
2. **Derived amounts are not rounded again.** A gain = proceeds − book value, a net = gross − fee, or a new balance = old − payment is the difference of two whole-yen amounts, so it is already whole. Do not call `ceilYen` on it, because that hides a component that was not rounded.
3. **Caps keep their cap.** When a balance caps an amount (a payment cannot exceed the balance; depreciation cannot exceed the remaining book value), round first, then cap: `min(ceilYen(x), balance)`. Rounding up never makes a payment exceed what is owed, nor a book value go negative.
4. **Cash limits.** When available cash limits a payment (`min(due, cash)`), round `due` first.
5. **During the migration, balances can still carry fractions.** Until R9, writers that have not migrated yet (and old saves, §1) can leave a fraction in `companyCash` or another balance. A migrated writer whose amount is capped by such a balance posts the capped amount **as is**, without rounding up past the balance, and writes that same value to state and ledger. This is the only case where a migrated writer may post a non-whole amount. It disappears once every writer of that balance has migrated. The runtime guard (§6) therefore checks migrated rows in scenarios that start from whole-yen balances, and checks all rows strictly only from R9.

## 4. Splitting one amount into parts

Rounding every part separately makes the parts disagree with the rounded total (12.3 + 87.4 = 99.7 → 100, but 13 + 88 = 101). Rule:

- **Two parts (charge + remainder).** Round the total. Round the *charge* part (interest, fee, tax, commission). The other part is `total − charge`, clamped at 0. Example: due = `ceilYen(99.7) = 100`, interest = `ceilYen(12.3) = 13`, principal = `100 − 13 = 87`.
- **Many recipients (dividends, distributions, allocations, waterfalls).** Round the aggregate with `ceilYen`. Give each recipient `floor` of its exact share. Hand the remaining yen out one at a time by **largest fractional remainder**; break ties by stable entity/security ID, ascending. This fulfils Phase 0 §5.4: the residual is deterministic, attributed to a named recipient, and the parts sum exactly to the total. The shared helper `economicOperation.allocateYen(total, weights, ids)` implements this rule; writers must not invent their own.
- **Per-unit or per-holder rounding.** A family-specific contract may round per unit or per holder instead (for example, a fixed per-share dividend). It must say so explicitly in that family's slice notes in §8.

## 5. What does not change

- `SAVE_KEY`, `saveVersion=9`, determinism, company/personal separation, and the ban on `Math.random()` in simulation paths.
- Legacy validation tolerances in `finance.validate()` (Phase 0 §5.5) stay as they are during the migration. Tightening them is a separate, later PR after slice R9.
- `roundMoney` keeps its current ¥0.01 behaviour, and `tests/economic-operation-contract-test.js` keeps its assertions. `ceilYen` does not call it (§2).

## 6. Determinism, fixtures and tests

- Changing a rounding rule legitimately moves money values, fingerprints and possibly the RNG call count, wherever a branch depends on an amount (for example, "can the company afford X"). A slice may update a fixture such as `tests/fixtures/transaction-baseline-v1.json` **only** under all of these conditions:
  - the PR body explains which values moved and why;
  - the accounting identities (`finance.validate`, the debt rollforward) still hold;
  - no transaction appears or disappears without a stated reason.
- An existing test that asserts a cent value (for example `1234.56`) gets the new whole-yen expected value. This applies the approved contract; it does not weaken the test. Never delete a test, skip it, or widen a tolerance to make it pass.
- **Ratchet guard** (added in slice R0): `tests/yen-ceiling-rounding-guard-test.js` with its baseline `tests/fixtures/yen-ceiling-rounding-baseline.json`. It checks two things:
  - **Lexical:** a `js/` file that is not listed in the baseline's `pendingFiles` must not contain a ¥0.01 rounding pattern (`*100)/100` and its spacing variants), except where `economic-operation.js` defines `roundMoney`.
  - **Runtime:** each slice adds focused scenarios for its migrated sources. The scenarios start from whole-yen balances and drive the slice's writers directly. The test asserts that every ledger row those writers produce has a whole-yen `amount` and whole-yen effects. A full seeded run would also exercise unmigrated writers, whose fractions can legitimately cap a migrated amount (§3.5), so the full run is not used before R9. From R9, when `pendingSources` is empty, the test adds a fixed seeded full run and asserts that every ledger row is whole, and that every company, personal and competitor cash/debt field is whole.
  - Each slice **removes** its entries from both lists. The lists may only shrink; the test fails if an entry is added.

## 7. Approval boundary

These slices change authoritative cash, ledger and debt writers. Under `AGENTS.md` §3 and #1055, they are **not** low-risk autonomous merges.

**Owner decision required (Q1):** Does merging this contract also authorize merging each slice PR (R0–R9) once:

- CI on its final HEAD is green;
- the Codex review has no unresolved finding;
- the slice's acceptance checks in §8 pass?

The other answer is that every slice PR still needs a fresh Owner "OK to merge". Until the Owner answers, the default is a fresh Owner approval per slice.

## 8. Slices and progress

One slice per PR. Branch name: `fix/yen-ceil-<slice id lower-case>` (for example `fix/yen-ceil-r1`). Each slice PR updates its row in this table: status, PR number, and any family-specific rule it adopted. Keep the rows in order. A slice may be split further if it is too large; add the sub-rows (R3a-1, …) here.

| Slice | Files / families | Notes | Status | PR |
|---|---|---|---|---|
| R0 | `economic-operation.js` (`ceilYen`, `allocateYen` + unit tests); ratchet guard test + baseline listing every current file and source | No behaviour change: nothing calls the new helpers yet | TODO | |
| R1 | `finance.js`'s own writers (generic interest, loan schedule postings, depreciation), `treasury-prepayment.js` | Calls `ceilYen` explicitly at each posting. The shared `r` (and with it `finance.event`'s normalisation) stays ¥0.01 (§2) | TODO | |
| R2 | Store operations: `engine.js` store P&L and weekly cash (revenue, costs, wages, rent, closures, refunds), `workforce.js`, `supply.js`, `store-equipment.js`, `menu-research.js`, `player-media-advertising.js`, `product-lifecycle.js`, `completion.js`, `parity.js`, `expansion.js` | Largest slice; split into R2a (engine.js) / R2b (rest) if the diff exceeds one review | TODO | |
| R3a | Company real estate, acquisition/finance/disposal: `real-estate.js`, `real-estate-mortgage-refinancing.js`, `real-estate-property-disposals.js`, `real-estate-property-taxes.js`, `real-estate-development.js`, `real-estate-price-negotiation.js`, `real-estate-complete-cycle.js`, `real-estate-redevelopment-projects.js`, `real-estate-agency-credit-line.js` | Mortgage: interest is the charge, principal is the remainder (§4) | TODO | |
| R3b | Company real estate, tenants/rent: `real-estate-tenant-*.js`, `real-estate-rent-*.js`, `real-estate-security-deposits.js` | Deposits are refunded at their stored whole-yen amount | TODO | |
| R3c | Company real estate, upkeep/risk: `real-estate-property-insurance.js`, `real-estate-insurance-*.js`, `real-estate-property-maintenance.js`, `real-estate-property-management.js`, `real-estate-capex-*.js`, `real-estate-safety-certification.js`, `real-estate-risk-mitigation.js`, `real-estate-portfolio-dashboard.js` | Dashboard values are display; round only what it posts | TODO | |
| R4 | Personal: `personal-real-estate-*.js`, `personal-stock-margin.js`, personal cash/debt writers in `engine.js` and `app.js` | Personal and company stay separate; do not move money between them | TODO | |
| R5 | Debt and capital markets: `bank-loans-covenants.js`, `corporate-bonds-ratings.js`, `convertible-bonds-dilution.js`, `preferred-shares-dividends.js`, `player-debt-service.js`, `shareholder-returns.js` | Dividends and coupons to many holders use `allocateYen` (§4) | TODO | |
| R6 | M&A, PE, subsidiaries: `ma-*.js`, `pe-fund.js`, `pe-portfolio-operations.js`, `pe-value-creation.js`, `pmi-100-day-plan.js`, `listed-subsidiary-*.js`, `subsidiary-*.js`, `group-*.js`, `inter-subsidiary-synergy-allocation.js` | Fund waterfalls use `allocateYen` | TODO | |
| R7 | Crisis, governance, new business: `player-crisis-*.js`, `company-recall-crisis.js`, `industry-event-response-plans.js`, `executive-reviews-succession-board.js`, `executives-department-assignments.js`, `new-business-*.js`, `internal-venture-business.js`, `sports-management.js` | | TODO | |
| R8 | Competitors and NPCs: `competitor*.js` (money fields only), `pe-rivals.js` | `competitor-credit.js` already rounds to whole yen with `Math.round`; switch it to `ceilYen` for consistency | TODO | |
| R9 | Remainder and closing: switch or remove the shared ¥0.01 normalisers (`finance.js` `r` as applied by `finance.event`, `economic-settlement.js`'s `roundMoney` calls); `save-storage.js`, `save-v9.js`, `play-runtime-compat.js`, `player-engine-bridge.js`, `difficulty-scenario-balance.js`, `iphone-baseline-probe.js`, any file still in the baseline; empty both pending lists; enable the state-level whole-yen assertion; update `PHASE_0_CONTRACTS.md` §5 status to "fully migrated" | After R9, a later separate PR may tighten the `finance.validate` tolerances | TODO | |

The file lists come from the 2026-10-22 inventory of `main` (`2690051`):

- 90 `js/` files either write `companyCash` / `personalCash` / `companyDebt` / `personalDebt` directly (63 files), contain a ¥0.01 rounding helper (37 files), or post `finance.event` (184 calls).
- The R0 baseline is generated from the code, not from this table. If the two disagree, the baseline is authoritative for "what is left". This table is authoritative for "who owns which slice".

### Acceptance checks for every slice

1. The slice's files contain no ¥0.01 money rounding. Every amount they settle or post is whole yen, and the ratchet guard passes after removing their entries.
2. The focused tests of every changed file pass: the tests that `node scripts/select-affected-tests.js --base origin/main` lists, at least those that name the changed files directly.
3. `finance.validate` passes and the debt rollforward has no failing check in the slice's focused scenarios. `tests/phase0-5-acceptance-gate-test.js` and `tests/finance-category-taxonomy-test.js` pass. If the lexical writer inventory moves, refresh it with `node scripts/phase0-5-acceptance.js --refresh-writers` and state that `exactAuthority` is unchanged.
4. Every fixture or expected-value change is listed and explained in the PR body (§6).
5. Two runs with the same seed give the same result (determinism). No `Math.random()` is introduced.
6. Canonical CI (shards A–L) is green on the final HEAD, and the Codex review has no unresolved finding.

## 9. Resuming this work (any agent)

1. Read `AGENTS.md` (operating rules, approval boundary, "never push while CI on the same PR head runs") and this document.
2. Fetch `origin/main`. Look at §8: the first slice whose status is not `DONE` is next. Before starting it, check for an open PR on branch `fix/yen-ceil-*`. If one exists, continue that PR; do not open a second PR for the same slice.
3. Branch from current `origin/main` as `fix/yen-ceil-<slice>`. Change only that slice's files, plus the tests and fixtures they require, plus this document's §8 row.
4. Validate as in "Acceptance checks". Open the PR; in its body, list the moved values and the slice's §8 row. Request `@codex review` (unless Codex itself is the author; then note that the review is same-model, as `AGENTS.md` requires).
5. Merge only as §7 allows. After the merge, set the row to `DONE` with the PR number. That can be done in the same PR before merging, or in the next slice's PR.
6. If you stop mid-slice (usage limit, end of session), push the branch, and leave a PR comment stating what is done, what is left and which tests were run, so that the next agent can continue from that comment.
