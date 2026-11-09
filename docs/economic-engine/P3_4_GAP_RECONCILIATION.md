# Phase 3 P3-4 — family-closure gap reconciliation (G7)

**Status: docs only.** No code change, no S_PASS, no activation. Authority stays `disabled`.

This is step 1 of [PHASE_3_P3_4_ACTIVATION_READINESS.md](PHASE_3_P3_4_ACTIVATION_READINESS.md) §3, approved by the
Owner on 2026-11-03 (recorded in the memo's "Owner decision (2026-11-03)" section, #1315). It maps the 51 gaps of two open documents onto the evidence on current `main`
(`ef05e51a`, after #1314). The player-common rows and the Result were refreshed on 2026-11-04 against `77539f83`;
the other rows are unchanged from that first pass:

- the S evidence manifest, #1089 at
  [`5beb6b19`](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/5beb6b195eccbebae61a5e25cd83fb890bfae8b9/docs/economic-engine/P3_4_S_EVIDENCE_MANIFEST.md);
- the family-closure test specification, #1091 at
  [`8a05c2f6`](https://github.com/yutaro-j31/capitalism-tycoon-web/blob/8a05c2f624a5356aeb0962e1d37a2d6f366efce2/docs/economic-engine/P3_4_FAMILY_CLOSURE_TEST_SPEC.md).

## Method and its limits

Each gap G01–G51 names one writer or one set of writers. For each one, this table records which evidence on `main`
targets it:

- a merged evidence document in `docs/economic-engine/`;
- a registered test: a Node test listed in `tests/run-all.js`, or a WebKit test run by the
  `ma-acquisition-financing` workflow;
- the routing PRs that added the verification legs (#1185, #1186, #1191, #1194, #1199, #1201, #1202, #1204 and
  #1210–#1214);
- the rounding slices of [YEN_CEILING_ROUNDING_CONTRACT.md](YEN_CEILING_ROUNDING_CONTRACT.md).

This is a **presence-and-scope check**. It reads each evidence document's stated scope and limits. It does **not**
re-run each S obligation of #1091 (F/A/M/S/L/R/D/W/P) case by case. A row marked EVIDENCED therefore means
"targeted evidence exists in both runtimes, both cover the shared fault set (save, mirror, enqueue, saved/change and,
where reachable, pending and nested cases), and no stated limit names a remaining gap". It does not mean S_PASS.
The fault-set check compares the fault names each test file uses; it is not a case-by-case audit. Weekly writers
(G15–G17) replace `change` and `notify` with the week's own terminal events (`finalize`, `week`); that counts as the
shared set. The memo-G5 competitor dilution (step 4) is a gameplay correction, not an evidence obligation, so it does
not count against EVIDENCED; it is noted on G06, G11, G12 and G13 for tracking. Every evidence
document also disclaims "raw/helper bypass closure". That family-wide item is tracked once, under G01 and step 2, not
against each row.

| Status | Meaning |
| --- | --- |
| EVIDENCED | Registered Node and WebKit tests target the writer, both with the shared fault set. No stated limit leaves an open obligation. |
| PARTIAL | Targeted evidence exists, but a named obligation or entry is still missing. The column says which. |
| OPEN | No targeted evidence. |
| DEFERRED | Missing because of a scope item the Owner deferred on 2026-11-03 (readiness memo G1, G2 or G6). |

Next steps refer to the readiness memo: **step 2** is the G3/G4 bypass closure and **step 4** is the G5 dilution
correction. Both are approved.

## Reconciliation

### Player-common writers

| Gap | Writer | Evidence on `main` | Status | What remains |
| --- | --- | --- | --- | --- |
| G01 | Player-common writer and bypass closure | Every `supported` planner writer is routed (see Method); raw entries closed by step 2 (#1317, which also routes the legacy `acquireTarget` share swap as `W-ACQUIRE-COMPAT`). | PARTIAL | Generation 2+: DEFERRED (memo G1); the Owner decided the binding rule on 2026-11-05 ([P3_4_G1_GENERATION_BINDING_DECISION.md](P3_4_G1_GENERATION_BINDING_DECISION.md)), and implementation is pending. A leg is also left unchecked whenever inspection is not `OBSERVED` or the planner throws (`beginOwnershipLeg` returns null); activation must turn that into a refusal. |
| G02 | Refounding (`foundNewCompanyAfterBuyout`, `migrateSave`) | `found-new-company-save-atomicity` Node + WebKit; `PHASE_3_REFOUNDING_IDENTITY_EVIDENCE.md` (partial). | DEFERRED | Replacement rule and generation binding (memo G1, G2). |
| G03 | `buyStock` | `stock-purchase-save-atomicity` Node + WebKit (shared fault set, pending and nested cases since #1321); routed. | EVIDENCED | — |
| G04 | `sellStock` | `stock-sale-save-atomicity` Node + WebKit (shared fault set for personal and company accounts since #1322); routed. | EVIDENCED | — |
| G05 | `sellFounderShares` | `founder-share-sale-save-atomicity` Node + WebKit (shared fault set since #1323); routed; R10b. | EVIDENCED | — |
| G06 | `acceptInvestorOffer` | `investor-offer-save-atomicity` Node + WebKit (shared fault set since #1325); `PHASE_3_INVESTOR_REPLAY_EVIDENCE.md`; routed. Competitor dilution: step 4 done (#1318). | EVIDENCED | — |
| G07 | `executeIPO` chain | `parent-ipo-save-atomicity` Node + WebKit (shared fault set, nested, notify, enqueue-throw and a rollback-disabled control since #1327); `PHASE_3_CAPTURED_IPO_EVIDENCE.md`; IPO leg (#1213). A standalone base `executeIPO` opens its own transaction (step 2, #1317). | EVIDENCED | — |
| G08 | Margin liquidation | `personal-stock-margin-save-atomicity` Node + WebKit (shared fault set, pending, nested and direct-call cases since #1328); `PHASE_3_MARGIN_TRANSACTION_EVIDENCE.md`; legs (#1212). Direct `liquidate` / `processWeek` open their own transaction (step 2, #1317). | EVIDENCED | — |
| G09 | Buyback | `shareholder-buyback-save-atomicity` Node + WebKit; base rejection and export evidence. The overridden base `buybackOwnShares` refuses (step 2, #1317). | EVIDENCED | — |
| G10 | Dividend declaration and payment | `shareholder-dividend-declaration-` and `-payment-save-atomicity` Node + WebKit. Holder classes (#1337): the founder leg is the P3-2 founder beneficial quantity (original founder shares plus the personal own-company lot); treasury shares are outside the denominator; rejected ownership evidence keeps the pre-fix ratio (Owner decision 2026-11-04, Option C). `dividend-personal-own-lot-case` covers the bought lot, treasury, zero lot, rejected evidence and an installed buy/sell/founder-sale/buyback/split lifecycle. Two Owner-relayed independent review rounds. | EVIDENCED | The competitor stake has no separate holder account; it is paid inside the external leg by design. |
| G11 | `requestSponsorInjection` | `sponsor-injection-save-atomicity` Node + WebKit; routed. Competitor dilution: step 4 done (#1318). | EVIDENCED | — |
| G12 | Turnaround `accept` | `turnaround-fund-accept-save-atomicity` Node + WebKit; routed. Competitor dilution: step 4 done (#1318). | EVIDENCED | — |
| G13 | Turnaround ratchet `settle` | `player-crisis-turnaround-ratchet-week-rollback` (Node), `player-crisis-turnaround-ratchet-webkit`; mirror (#1211); leg (#1214). `settle` outside a transaction opens its own (step 2, #1317); competitor dilution: step 4 done (#1318). | EVIDENCED | — |
| G14 | `buyCompetitorStake` | `week-competitor-stake-save-atomicity` (Node fault set); `competitor-stake-float-webkit` (healthy run only). | DEFERRED | No WebKit fault set. Holder binding for the competitor stake (memo G6). |
| G34 | `createInitialState` and the second-game reset | Covered with G02. | DEFERRED | Same as G02. |
| G35 | `refreshInvestorOffers`, `declineInvestorOffer`, `declineInboundBuyoutOffer` | `investor-offer-aux-save-atomicity` (Node, #1207) and its WebKit shared fault set with pending, nested and a rollback control (#1336); `decline-buyout-ownership-save-atomicity` Node + WebKit. | EVIDENCED | — |
| G36 | Load, compaction, restore | `PHASE_3_OWNERSHIP_REPLACEMENT_EVIDENCE.md` (partial). | DEFERRED | Import failure atomicity is not certified. Replacement rule (memo G2). |
| G38 | M&A equity raise `executeFinancing` | `ma-equity-raise-shadow-atomicity` Node + WebKit (the rest of the shared fault set at the shadow boundary since #1329); leg (#1210). | EVIDENCED | — |
| G41 | Share swap `completeTargetAcquisition` | `ma-share-swap-save-atomicity` Node + WebKit (shared fault set since #1326); `PHASE_3_RAW_ISSUANCE_EVIDENCE.md`. Legacy `acquireTarget('shareSwap')` is routed and standalone `issueSharesToExternalHolders` refuses outside a boundary (step 2, #1317). | EVIDENCED | — |
| G42 | `activateDefense` | `activate-defense-save-atomicity` (Node fault set); `activate-defense-ownership-ratios-webkit` (healthy run only). | DEFERRED | No WebKit fault set. `HOLDER_UNPROVEN`: holder binding for the competitor stake (memo G6). |
| G43 | Activism `accept` | `shareholder-activism-accept-save-atomicity` Node + WebKit (shared fault set, pending, nested and a rollback control since #1330). | EVIDENCED | — |

### Writers outside the player-common family

These writers change VC, subsidiary, PE or group facts, not player-common shares. As #1091 §1 summarises #1080 §5,
they must stay isolated from the player-common authority; they are not adopted by it. They do not block
player-common activation.

| Gap | Writer | Evidence on `main` | Status | What remains |
| --- | --- | --- | --- | --- |
| G15 | VC round close | `vc-round-close-week-save-atomicity` Node + WebKit. | EVIDENCED | — |
| G16 | VC write-off | `vc-writeoff-week-save-atomicity` Node + WebKit. | EVIDENCED | — |
| G17 | `listStartup` | `vc-listing-week-save-atomicity` Node + WebKit. | EVIDENCED | — |
| G18 | Subsidiary IPO, `makeSubsidiary` | `subsidiary-ipo-` and `make-subsidiary-save-atomicity` Node + WebKit. | PARTIAL | The `make-subsidiary` WebKit test has no nested case; the Node test has it. |
| G19 | Subsidiary IPO secondary sale | `subsidiary-secondary-sale-save-atomicity` Node + WebKit. | EVIDENCED | — |
| G20 | Listed subsidiary market trade | `subsidiary-market-trade-save-atomicity` Node + WebKit. | EVIDENCED | — |
| G21 | Listed subsidiary tender offer and squeeze-out | `subsidiary-control-save-atomicity` Node + WebKit. | EVIDENCED | — |
| G22 | Listed subsidiary follow-on | `subsidiary-follow-on-save-atomicity` Node + WebKit. | EVIDENCED | — |
| G23 | Subsidiary relisting | `subsidiary-relist-save-atomicity` Node + WebKit. | EVIDENCED | — |
| G24 | Negotiated group sale `closeSale` | `group-negotiated-sale-save-atomicity` Node + WebKit. | PARTIAL | Its evidence document excludes the weekly earnout payment, which #1091 includes. |
| G25 | Internal venture funding | `internal-venture-business-` and `subsidiary-funding-save-atomicity` Node + WebKit. | EVIDENCED | — |
| G26 | New-business commercialization | `new-business-commercialization-save-atomicity` Node + WebKit. | PARTIAL | The class and ownership of the created subsidiary are unresolved, as its evidence document states. |
| G27 | PE fund formation | `pe-fund-formation-save-atomicity` Node + WebKit. | PARTIAL | The raw exported `createFund` / `addLPCommitment` helpers have no atomicity evidence of their own. |
| G28 | PE portfolio company acquisition | `pe-parent-acquisition-save-atomicity` Node + WebKit. | EVIDENCED | — |
| G29 | PE deal transfer to the company | `pe-transfer-save-atomicity` Node + WebKit; R10a. | EVIDENCED | — |
| G30 | `syncPESubsidiary`, `normalizeHoldingMap` | `pe-dual-ownership-test.js` (functional only). | OPEN | No caller enumeration or fault set. |
| G31 | Weekly PE fund `processFundsWeek` | `week-pe-fund-save-atomicity` (Node only). | PARTIAL | No WebKit. |
| G32 | Weekly `updateMarket` | `PHASE_3_WEEKLY_MARKET_EVIDENCE.md` (partial). | PARTIAL | Unknown holder, class and control evidence stays unsupported. |
| G33 | Expanded week `updateCapitalMarketsExpandedWeekly` | Margin hook covered by G08; `week-transaction-atomicity-test.js` covers the installed company-PE mirror plus public ownership/quarterly hooks through the applicable shared save-fault set, pending predecessor, nested transaction, retry and fresh durable hydration. | PARTIAL | Combined PE/public-hook native WebKit evidence remains open; this does not adopt unknown holder/class/control authority. |
| G39 | `executeMBO`, fund exit | `execute-mbo-` and `pe-portfolio-exit-save-atomicity` Node + WebKit. | PARTIAL | The MBO Node test has no pending or nested cases (#1089: E09 incomplete). Neither WebKit test, nor the fund-exit Node test, has nested cases. |

### Cross-cutting

| Gap | Subject | Evidence on `main` | Status | What remains |
| --- | --- | --- | --- | --- |
| G40 | Shared browser fault-applicability matrix: `stockSplit`, `declineInboundBuyoutOffer`, `investStartup`, `participateStartupFundingRound`, `sellStartupSecondary`, `makeSubsidiary`, `executeGroupRestructuringSale`, `sellMASubsidiary`, `createPEDeal`, `exitPEDeal`, `createAngelInvestment` (obligations S, L, R, D, W) | Per-writer WebKit tests; read-only applicability matrix in [P3_4_G40_BROWSER_FAULT_APPLICABILITY.md](P3_4_G40_BROWSER_FAULT_APPLICABILITY.md). | EVIDENCED | All eleven writers run their applicable shared set in real WebKit. #1344–#1348 filled the sbt, pending st and nested sf/st tuples, plus eqt for `sellMASubsidiary`. The matrix was re-read on `7ab463cc`. R and D stay with each writer's Node suite. |

### Money oracles (M0)

These gaps ask for whole-yen conservation oracles. Each is owned by a rounding slice.

| Gap | Writers | Rounding slice | Status | What remains |
| --- | --- | --- | --- | --- |
| G37 | Engine buy, sell, IPO, listing, market | R2 | PARTIAL | Slice DONE. This reconciliation did not re-check each row's acceptance. |
| G44 | Refounding, decline, earnings | R2c | PARTIAL | As G37. #1091 records that R2c covers HQ and completion rows, not every refounding ownership case. |
| G45 | `expansion.js` money writers | R2d (as #1091 assigns it), R10a, R10b | PARTIAL | As G37. |
| G46 | Margin, buy, sell | R4c | PARTIAL | As G37. |
| G47 | Buyback, dividend | R5c | PARTIAL | As G37. |
| G48 | M&A, PE, subsidiary IPO, exit, group sale | R6 | PARTIAL | As G37. |
| G49 | Sponsor, turnaround accept, venture funding, commercialization | R7 | PARTIAL | As G37. |
| G50 | Competitor stake purchase, defense | R8a | PARTIAL | R8b (NPC internals) is OUT OF SCOPE in the rounding contract. |
| G51 | Initial state, load, compaction, base IPO, activism | R9 | PARTIAL | As G37. |

## Result

For the player-common family, 21 gaps (refreshed 2026-11-04 on `main` `77539f83`, after #1317, #1318 and the
WebKit fault-set PRs #1321–#1323 and #1325–#1330):

| Status | Count | Gaps |
| --- | --- | --- |
| EVIDENCED | 15 | G03, G04, G05, G06, G07, G08, G09, G10, G11, G12, G13, G35, G38, G41, G43 |
| PARTIAL | 1 | G01 (generation 2+ and the null-leg refusal) |
| DEFERRED | 5 | G02, G14, G34, G36, G42 |

Steps 2 and 4 are done, and the nine WebKit fault sets are in place. G10 and G35 moved to EVIDENCED in a second
refresh on `main` `eea44960` (after #1336, #1337 and #1338). The player-common family now has one PARTIAL gap, G01:
its null-leg refusal is part of activation, and its generation 2+ part is deferred with G02. The cross-cutting G40
is EVIDENCED on `main` `7ab463cc`: its read-only matrix (#1342) listed the missing browser tuples. The per-writer
follow-ups #1344–#1348 filled them.

As first published (on `ef05e51a`) the counts were: EVIDENCED 2; PARTIAL closed by step 2, 3 (G01, G09, G13); PARTIAL
step 2 and a WebKit fault set, 3 (G07, G08, G41); PARTIAL WebKit fault set incomplete, 6 (G03–G06, G38, G43); PARTIAL
other, 2; DEFERRED, 5.

Outside the family, 20 gaps:

- 11 are EVIDENCED.
- G18, G24, G26, G27, G31, G32, G33 and G39 are PARTIAL.
- G30 is OPEN.

None of these blocks player-common activation. As #1091 §1 summarises #1080 §5, activation waits for every
player-common fact writer, and other issuers only need to stay isolated.

The 9 money gaps depend on rounding slices that are all DONE. Their per-row acceptance has not been re-checked here.

Total: 21 + 20 + 1 cross-cutting + 9 money = 51.

## Disposition of #1089 and #1091

Both documents are pinned to older `main` commits. Their gap lists are now tracked by this reconciliation, and their
case specifications stay readable at the commits linked above.

Recommendation: **close both unmerged**, with a comment linking this document. Merging them would add two large
documents whose status columns are already out of date.

## Limits

This reconciliation:

- changes no code;
- grants no S_PASS;
- activates nothing;
- does not certify P3-10, Phase 3 Exit or Phase 4 Entry.

Its statuses come from evidence presence and the stated limits of each evidence document. They are not a case-by-case
re-run of the S obligations.
