# P3-4 pure ownership planner API

**Authority: READ_ONLY. No apply, routing, activation, command permission or settlement.**
**Implementation base:** `d92237708c2e97b663f78b3f9454acdb632df6a0`.

This implements only the pure portions of [#1080 §3.1](PHASE_3_P3_4_PREFLIGHT_AND_DESIGN.md), using the [writer evidence inventory](PHASE_3_P3_4_WRITER_FAILURE_WEBKIT_EVIDENCE.md) and [new-game scenarios](PHASE_3_P3_4_NEW_GAME_GENERATION_REFOUNDING_SPEC.md). Owner authorization: 2026-10-23 pure-planner task. Existing writers are unchanged. `applyOwnershipPlan` is deliberately absent.

The classic-script module exports `__capitalismTycoonModules.phase3OwnershipPlanner`. Loading registers frozen API metadata only. It does not install an engine method, hook or consumer. Its only dependency is the existing read-model's three identity constants.

## Inspection

```js
const api = __capitalismTycoonModules.phase3OwnershipPlanner;
const scope = {
  family: 'player-common',
  issuerEntityId: 'entity:company:player',
  securityClassId: 'security:player-company:common',
  currentCompanySerial: 1
};
const evidence = api.inspectOwnershipAuthority(committedState, scope);
```

Inspection requires explicit own data fields for generation, sold/listed flags, ticker, issued/founder/treasury quantities, personal/company stock maps, market and startup arrays. Only the designated personal lot's `qty`, designated market row's issued quantity, market IDs and startup IPO aliases are read; cost basis, prices, other lots and financial/operating roots are not read. Nonzero company-owned own-ticker aliases, conflicting IPO aliases, repeated/mismatched own listings, unsupported identities and missing generation evidence reject. Any matching market ticker while the player is private is an unresolved external alias, even if its quantity matches; no existing row is claimed as an IPO mirror. Present own-ticker map keys whose values are undefined/null or other non-records are rejected; only actual key absence denotes zero holdings. Nonempty startup IPO aliases must be valid string identifiers. Nothing is normalized or repaired. The supplied scope cannot override the state's generation.

`OBSERVED` contains copied quantities, canonical source paths, the known founder's legal identity, ECO-010/011 checks and a deterministic ownership-only `sourceFingerprint`. This is a literal canonical representation, not a cryptographic receipt or a financial-state revision. No input reference escapes in a result, and only newly constructed output objects are frozen. Inspection permits exactly representable finite fractional legacy evidence; planning rejects fractional units rather than rounding them. Neither function uses `ceilYen`.

The accepted buckets are `sharesOut`, `treasuryBuybackShares`, `founderShares`, `personalOwnShares`. Derived quantities are issued minus treasury, original founder plus designated personal lot, and the unallocated remainder. Exact arithmetic and the safe-number envelope are checked. The remainder never identifies a shareholder, fund position or voting right.

## Planning

```js
const result = api.planOwnershipChange(committedState, {
  scope,
  writerId: 'W-INVESTOR',
  kind: 'external-issue',
  operationId: 'existing-offer-id',
  account: 'company',
  sourceLots: ['sharesOut'],
  expected: {
    sourceState: committedState,
    sourceFingerprint: evidence.sourceFingerprint,
    quantities: {
      sharesOut: evidence.quantities.sharesOut,
      treasuryBuybackShares: evidence.quantities.treasuryBuybackShares,
      founderShares: evidence.quantities.founderShares,
      personalOwnShares: evidence.quantities.personalOwnShares
    }
  },
  change: { quantity: 100 }
});
```

Every intent field shown is required. Unknown intent/scope/change/expected fields reject, including attempted financial payloads. `expected.sourceState` is an ephemeral caller-supplied **reference**, compared without traversing it. It prevents reuse of expected evidence against an equal but replaced root; it is neither persisted nor a hidden global token. Rebuild the intent after JSON reload/hydration. The fingerprint and all four expected pre-quantities must match the actual ownership sources. A supplied operation ID is a bounded identifier only: this slice does not attest its lifecycle, payment or idempotency receipt.

Planning requires safe-integer units and positive existing outstanding quantity. It accepts these narrowly scoped fact legs:

| Kind | Change | Account | Canonical sourceLots order | Writer IDs |
|---|---|---|---|---|
| personal-buy / personal-sell | positive `quantity` | personal | designated personal `qty` path from evidence | W-BUY / W-SELL, W-MARGIN-LIQ (sale only) |
| founder-sale | positive `quantity` | personal | founderShares | W-FOUNDER-SALE |
| external-issue | positive `quantity` | company | sharesOut | W-INVESTOR, W-SHARE-SWAP, W-MA-EQUITY/SH, W-SPONSOR, W-TURNAROUND-ACCEPT, W-TURNAROUND-RATCHET |
| buyback | positive `quantity` | company | treasuryBuybackShares | W-BUYBACK |
| split | safe integer `factor` ≥ 2 | company | sharesOut, treasuryBuybackShares, founderShares, designated personal qty | W-SPLIT |
| ipo | nonnegative `issuedQuantity`, `founderSecondaryQuantity`; at least one positive; expected `listingTicker` | company-and-personal | sharesOut, founderShares | W-IPO-CHAIN |

All trades/sales, buybacks and splits require a current listing. IPO requires private state. Share-swap/financed public-equity issuance requires listed state; other issuance may use private or listed state. The prospect must conserve all modeled quantities and cannot sell more than held, buy more than the unallocated remainder or create negative treasury/outstanding/holder quantities. All outputs remain safe integers. There is no coercion, epsilon grant or fraction repair.

IPO planning alone also reads the own data string `companyName`. The installed `js/engine.js::executeIPO` derives its listing ticker by removing non-ASCII letters, taking the first four letters, uppercasing, then falling back to `CPTY`. `change.listingTicker` must match that target or planning returns STALE_SOURCE. Any existing target market row or startup IPO alias rejects; if the ticker changes, any old-ticker or target-ticker key in either stock map rejects, including zero holdings. The planner cannot prove lot rebinding and never moves or claims those lots. Its `listingRequirement` reports the actual target and `previousTicker`; it emits no existing mirror for a private company. Inspection and non-IPO planning do not read `companyName`. These checks establish a prospective listing identity, not whole-command validation.

`PLANNED` contains copied before/after quantities, changed backing quantity paths with issuer-total/treasury/known-founder attribution, existing issued-share mirror changes, and (for IPO) a listing requirement for the existing writer. It never creates a full listing record, recomputes prices/cost bases, attributes unallocated equity, or modifies lifecycle status.

**A planned fact leg is not whole-command acceptance.** Every result has `authority: 'read-only'`, `executable: false`, and plans have `wholeCommandValidated: false`. The existing financial writer still owns filled-order/price/cash/fee/ledger rules; split per-share terms/history, IPO state and receipts are outside this quantity-only result. Multi-lot margin liquidation and the rest of a shadow/weekly command are not certified by one accepted own-lot/issuance leg. No caller is routed here, no S_PASS is granted, and no plan is an execution/replay ticket.

## Structured refusal and all writer dispositions

A rejection returns `{status:'REJECTED', authority:'read-only', executable:false, reasons:[{code,path,message}]}`. It never throws an input validation error to its caller. Prototype/accessor/array/data validation uses descriptors; getters on supported inputs are never invoked. Plain records from other realms and null-prototype maps are supported; exotic objects and hostile proxies are outside the plain-data contract (reflective proxy errors produce INPUT_INVALID). Untrusted objects are not stringified or recursively traversed wholesale.

| Reason | Meaning |
|---|---|
| INPUT_INVALID / QUANTITY_INVALID | Missing, unexpected, accessor, exotic, malformed or nonfinite/out-of-envelope evidence |
| NUMERIC_DOMAIN_UNSUPPORTED / DENOMINATOR_UNSUPPORTED | Fractional prospective units or no positive outstanding source denominator |
| CONSERVATION_FAILED | Negative residual/holding/outstanding, overflow or precision loss |
| ISSUER_FAMILY_UNSUPPORTED / CLASS_UNSUPPORTED | Outside the initial player-common contract |
| GENERATION_UNPROVEN | Sold, missing/invalid generation, or any serial other than 1 |
| OWN_SHARE_ALIAS_UNRESOLVED / ALIAS_BINDING_UNPROVEN / MIRROR_MISMATCH | Unproved alias/identity or inconsistent issued mirror |
| STALE_SOURCE / SOURCE_LOT_UNSUPPORTED | Root/fingerprint/expected-quantity mismatch or noncanonical source lots |
| ACCOUNT_UNSUPPORTED / COMMAND_UNSUPPORTED / COMMAND_DOMAIN | Wrong legal account, writer-kind pairing or quantity-operation domain |
| WRITER_UNSUPPORTED | Unknown matrix ID |
| INTERNAL_ENTRY | File-local/captured/raw compatibility path; model its installed enclosing fact leg instead |
| REPLACEMENT_UNSUPPORTED | Initialization, refounding, load/restore/compaction cannot replay a quantity command |
| NO_COMMON_QUANTITY_CHANGE | Auxiliary/ratio/dividend/price-only row |
| HOLDER_UNPROVEN | Named competitor/defense holder evidence is not adopted by this four-bucket model |
| ORCHESTRATION_ONLY | Select a concrete inner quantity leg; no high-level activism/M&A routing |

`WRITER_POLICIES` has one disposition for each of #1081's 67 main-matrix rows. The new test asserts equality against that document, then tests each supported row's valid fact leg and wrong account/kind, and each unsupported row's refusal. These IDs are evidence taxonomy, not a registry of callable or adopted writers. Additional alias/normalizer surfaces in the inventory still require future closure review.

## Generation scenarios and limitations

The new test covers the **pure portions** of NG-01…NG-16: initial binding, synthetic rename/reticker variations, sold/serial-2/serial-3 quarantine, retained-ticker/IPO conflicts, refusal of PE/VC family adoption, deterministic store/digital/investment input sequences, JSON inspection roundtrip, same-week quantity changes and equal-but-replaced root rejection. Retained assets are never deleted or reassigned.

It does **not** execute sales, refounding, funding, notices, save faults, IndexedDB, compaction or WebKit workflows. Those are the deferred executable portions of NG-03…NG-16, not PASS claims from these fixtures. Financial/payment provenance, fund ownership, generation-2+ supported bindings and whole-command S evidence remain outside scope. Pure equality cannot distinguish a same-root mutation that was completely undone; future application needs its own existing-boundary freshness/revalidation rules. There is no plan consumer here to bypass them.

## Wiring, validation and ordering

`index.html` and `tests/fixtures/module-load-order.json` wire the module after the existing Phase 3 read-only modules. `tests/run-all.js` registers `tests/phase3-ownership-planner-test.js` in the canonical path (default shard A). Tests also load the actual runtime without the module, install it, and check that engine prototype methods and a frozen initial state are unchanged. Clock/RNG/save/emit traps and hostile getters prove the absence of those calls in this slice.

The Phase 0.5 lexical inventory also gains the new module's three ownership field-name tokens via the existing `--refresh-writers` command. Its discovery is string matching, so read-only models are candidates too. The only inventory delta is that candidate row; `exactAuthority` and its hash are unchanged. The initial acceptance run exposed the stale candidate declaration; synchronizing it does not weaken or exclude any gate.

No rounding-owned writer file is edited. R0/R1 completion does not activate P3-4; routing continues to wait for the relevant R2–R9 slices under the [rounding contract §8/§10](YEN_CEILING_ROUNDING_CONTRACT.md) and #1080 §3.2. This PR is only the pure inspection/planning concern; no fixture monetary values, tracker or rounding slice status are changed.
