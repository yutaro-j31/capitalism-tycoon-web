# P3-4 dormant ownership plan application

**Authority: DORMANT. No writer calls `applyOwnershipPlan`; routed writers only verify (below); activation is `disabled`. No command permission, settlement or S_PASS.**

This adds the `applyOwnershipPlan` half of [#1080 §3.1](PHASE_3_P3_4_PREFLIGHT_AND_DESIGN.md) beside the
[pure planner](PHASE_3_P3_4_PURE_PLANNER_API.md). It is the first step of §3.2 order 2, which routes player-common writers
through one authority. It changes no installed writer: routing each writer is a later, separately reviewed PR, and the
capability stays inactive until every writer of the same facts is routed (§3.2, Owner decision 2026-10-22).

## API

`js/phase3-ownership-apply.js` registers `__capitalismTycoonModules.phase3OwnershipApply`:

```js
const result = modules.phase3OwnershipApply.applyOwnershipPlan(engine, plan); // AppliedResult | false
```

`ACTIVATION` is `'disabled'`, and every result carries `activation: 'disabled'`. Loading the module installs no engine
method, hook or consumer. No installed `js/` file calls it; the test asserts that.

## Rules

`applyOwnershipPlan` returns `false` without any write unless all of these hold:

1. The engine is inside an active outer transaction (`engine.inTransaction() === true`). The function is never a
   standalone writer: it does not save, emit, notify, read a clock or draw RNG.
2. The plan is a `PLANNED` result of a supported fact leg:
   - `personal-buy` and `personal-sell` (W-BUY, W-SELL, W-MARGIN-LIQ);
   - `founder-sale`;
   - `external-issue` (W-INVESTOR, W-SHARE-SWAP, W-MA-EQUITY/SH, W-SPONSOR, W-TURNAROUND-ACCEPT, W-TURNAROUND-RATCHET);
   - `buyback`;
   - `split`.

   IPO is excluded, because its listing record and lot rebinding stay with the existing writer (`listingRequirement`).
3. It revalidates against the engine's current state:
   - re-inspects the current state, and the ownership fingerprint must match the plan;
   - rebuilds the intent from the plan, plans it again, and the result must equal the supplied plan field for field.

   The caller's plan object is never trusted, only compared. A forged, stale or already-applied plan therefore
   writes nothing. A plan is identified by its content: another admissible writer or operation ID for the same fact
   leg is that writer's own plan. The identifier is not a lifecycle or idempotency receipt.
4. A personal-lot change needs the designated lot to exist already. Lot creation and deletion, prices and cost basis,
   cash, fees, ledger rows and history remain with the existing writer.

When they hold, it writes the planned quantities to the backing fields and the issued-share mirror:

- `sharesOut`, `treasuryBuybackShares` and `founderShares`;
- the designated personal lot's `qty`;
- `market[i].issuedShares`.

The writes are synchronous. The enclosing transaction commits them with the command's own single save, or restores
them with everything else when the command fails. Exceptions follow the existing command's boundary.

## Evidence

`tests/phase3-ownership-apply-test.js`, registered in `tests/run-all.js` (default shard A):

- Runs in a context whose clock and RNG throw, against an engine whose `save`, `emit` and `notify` throw.
- For each supported leg it checks that:
  - nothing is written outside an active transaction or without a transaction boundary;
  - inside one, the state equals an independently written expected state (quantities and mirror only);
  - the same plan cannot apply twice;
  - re-inspection shows the planned quantities.
- These write nothing and return `false`:
  - a stale source;
  - forged quantities, updates, mirrors, fingerprint, status, kind, before-quantities or account;
  - an IPO plan;
  - a missing personal lot;
  - malformed plans or engines.
- In the installed runtime:
  - the module loads right after the planner, and no `js/` file routes to it;
  - a real `runTransaction` restores the applied quantities, with nothing durable, when the command fails;
  - when the command succeeds, the quantities commit once and are durable.

`tests/phase3-ownership-planner-test.js` builds its planner-less runtime without this dependent module as well. Its
assertions are unchanged. The Phase 0.5 writer inventory gains the module's candidate row through
`--refresh-writers`.

## Verification mode for routed writers

The Owner decided on 2026-10-28 that player-common writers are routed in **verification mode** until activation. A
routed writer keeps its own quantity writes, so no supported or unsupported outcome changes.

- `beginOwnershipLeg(engine, {writerId, kind, operationId, change})` runs inside the writer's transaction, before
  the writer writes. It plans the leg against the current state. It returns `null` when there is no rollback
  boundary or the planner cannot plan the leg. A rollback boundary is the engine's active transaction, or a shadow
  engine whose owner restores the live state when the shadow's command fails and marks it with an own
  `ownershipShadowBoundary: true` property (only the M&A financing wrapper does). The planner cannot plan, for example:
  - a later company generation (`currentCompanySerial` above 1);
  - an unlisted company for a public-only leg;
  - a quantity outside the planner's domain.
- `confirmOwnershipLeg(engine, handle)` runs after the writer's quantity writes. It is `true` for a `null` handle.
  Otherwise it is `true` only when re-inspection observes a consistent issued mirror and exactly the plan's
  prospective quantities. On `false`, the writer rejects its command and the transaction restores everything.

Activation later replaces the writer's own quantity writes with `applyOwnershipPlan`.

### Routed writers

| Writer | Leg | PR |
| --- | --- | --- |
| W-FOUNDER-SALE `sellFounderShares` (`js/expansion.js`) | `founder-sale` | #1185 |
| W-BUY `buyStock` / W-SELL `sellStock` (`js/engine.js`), personal account, the player's own ticker only | `personal-buy` / `personal-sell` | #1186 |
| W-SPLIT `stockSplit` (`js/expansion.js`), the player's own ticker only | `split` | #1191 |
| W-BUYBACK installed `buybackOwnShares` (`js/shareholder-returns.js`) | `buyback` | #1194 |
| W-SPONSOR `requestSponsorInjection` (`js/player-crisis-actions.js`), unlisted company in crisis | `external-issue` | #1201 |
| W-INVESTOR `acceptInvestorOffer` (`js/expansion.js`), pre-IPO | `external-issue` | #1199 |
| W-SHARE-SWAP `completeTargetAcquisition` (`js/ma-deal-room.js`), listed company, deal-room share swap | `external-issue` | #1204 |
| W-TURNAROUND-ACCEPT `accept` (`js/player-crisis-turnaround-fund.js`), unlisted company in crisis | `external-issue` | #1202 |
| W-MA-EQUITY/SH `executeFinancing` (`js/ma-acquisition-financing.js`), listed company, M&A public equity raise on the financing wrapper's shadow engine | `external-issue` | this PR |

`tests/phase3-ownership-apply-test.js` covers the legs at two levels:

- **Unit:**
  - no leg outside a transaction;
  - planning writes nothing;
  - unwritten, wrong and extra-bucket quantities are rejected;
  - the planned quantity is confirmed;
  - unplannable states are left unchecked.
- **Installed runtime:**
  - founder sale:
    - a first-generation founder sale succeeds unchanged;
    - a founder write that diverges from the plan is rejected and the whole sale is rolled back;
    - a second-generation company keeps the existing sale;
  - personal own-share trades:
    - a purchase or sale leaves the lot unchanged from today: an exhausted lot is deleted and a new one is created as
      before;
    - a lot write skewed by one share is rejected, and the whole trade is rolled back;
    - another ticker and a second-generation company keep the existing trade;
  - own-share split:
    - a split multiplies every bucket and the issued mirror as before, and a later split plans against the split
      quantities;
    - a bucket write skewed by one share is rejected, and the whole split is rolled back;
    - another ticker and a second-generation company keep the existing split;
  - buyback:
    - a buyback raises only the treasury bucket, leaves the issued mirror unchanged, and a later buyback plans against
      the bought-back quantity;
    - a treasury write skewed by one share is refused, and the whole buyback is rolled back. The existing P2 buyback
      reconciliation would also catch it, but by throwing; the leg refuses first. `buybackOwnShares` builds the derived
      statement cache before its transaction (existing behaviour), so the rollback baseline is taken after that read;
    - a second-generation company keeps the existing buyback;
  - sponsor injection (distressed unlisted company):
    - an injection issues exactly the pinned 2,020 new shares, as before;
    - an issued-share write skewed by one share is refused, and the whole injection is rolled back;
    - a second-generation company keeps the existing injection;
  - investor acceptance (unlisted company):
    - an accepted offer issues exactly the computed new shares, as before;
    - an issued-share write skewed by one share is refused, and the whole investment is rolled back;
    - a second-generation company keeps the existing acceptance;
  - turnaround fund acceptance (distressed unlisted company):
    - an acceptance issues exactly the pinned 6,186 new shares, as before;
    - an issued-share write skewed by one share is refused, and the whole acceptance is rolled back;
    - a second-generation company keeps the existing acceptance;
  - only the reviewed writers call `beginOwnershipLeg`.
- **Writer suite** (`tests/ma-share-swap-ownership-ratios-test.js`), deal-room share swap on a listed company with its
  own market row:
  - the closing issues exactly the computed new shares and the existing dilution, reload and fresh-hydration checks
    pass;
  - an issued-share write skewed by one share is refused, the whole closing is rolled back and nothing is durable;
  - a second-generation company keeps the existing closing.
- **Writer suite** (`tests/ma-equity-raise-ownership-ratios-test.js`), financed M&A closing with a public equity raise on a
  listed company with its own market row:
  - the raise issues exactly the computed new shares (20,000) and the own row mirrors them;
  - an issued-share write skewed by one share is refused, the whole financed closing is rolled back and nothing is
    durable, and the unskewed retry commits;
  - a second-generation company keeps the existing closing.
- **Unit:** a shadow engine plans only with its own `ownershipShadowBoundary: true`; an inherited or false marker, or no
  boundary, does not.

The existing founder-share-sale, stock-split, buyback and investor-offer Node suites pass unchanged. The sponsor-injection Node and
WebKit suites had a negative control that skewed the live issuance and expected the command to succeed; the writer now
refuses that issuance, so the control breaks a copy of the committed state instead, and both suites add a case that
the skewed live issuance is refused and rolled back. The turnaround-fund acceptance Node
and WebKit suites had a negative control that skewed the live issuance and expected the command to succeed; the writer
now refuses that issuance, so the control breaks a copy of the committed state instead, and both suites add a case
that the skewed live issuance is refused and rolled back. The weekly ratchet (W-TURNAROUND-RATCHET) is not routed here. The overridden base engine
`buybackOwnShares` (W-BUYBACK-BASE) is not installed and is not routed.

The share swap needed one writer fix to be checkable. `issueSharesToExternalHolders` (`js/engine.js`) raised
`sharesOut` without the listing's own market row, which `updateMarket` only re-synced at the next week. The planner
refuses a listing whose row disagrees with `sharesOut`, so every listed swap would have been refused. The helper now
mirrors `issuedShares` and `marketCap` on the own row at once, as `updateMarket` does. The dormant legacy
`acquireTarget('shareSwap')` and the M&A equity raise use the same helper and get the same mirror. The deal-room unit-test loader (`tests/ma-deal-room-test-helpers.js`) now loads the read model, planner and
apply modules in production order, because the routed writer requires them.

The M&A equity raise runs on the financing wrapper's shadow engine, outside any `runTransaction`, so a transaction-only
gate would never plan it. The wrapper now marks its shadow as a rollback boundary. `executeFinancing` plans the leg
before the issuance and confirms it after; a mismatch throws into the wrapper's existing catch, which restores the live
state and the save checkpoint. This adds no nested transaction and does not change how §1 treats the shadow boundary.

## Limits

This routes only the writers listed above, in verification mode, and does not activate the authority. It does not grant S_PASS for any family, and it does not
change whole-command validation. The existing writers still own their financial and lifecycle rules. It does not
certify P3-10, Phase 3 Exit or Phase 4 Entry.
