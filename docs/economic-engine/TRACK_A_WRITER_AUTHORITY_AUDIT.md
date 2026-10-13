# Track A — Writer Authority audit: shares, ownership, dividends (#922)

Status: **read-only audit. Verdict: BLOCKED** (see §5). No production, test, CI or save-format change.
Base: first pass on main `35866030c4f47e47d1aac9dc1d4415365b412fb0` (2026-10-12; §1–§7). Second pass on main `9d2a9ddba666b1817b3848d5389b73d6d154e33d`, after #952 (shared fault harness) and #956 merged: §3b records the current evidence and **supersedes** the first-pass evidence where they differ (W-NEW-COMPANY is now reproduced; the render-time writer is reproduced and filed as #966). Third pass on main `8f2e50fcdfcb44d712f956ebb2750610c4db426e` (2026-10-13), after #951 and #957 merged: §3c is the current status and supersedes §3b where they differ. §2 verdicts describe main and change only when a fix merges.

This is the canonical Writer Matrix for the share / ownership / dividend domain. `phase0-5-authoritative-writers.json` remains the machine-generated lexical inventory consumed by `scripts/phase0-5-acceptance.js`; it is a different artifact (token-level discovery, no boundary/test verdicts) and is not duplicated here.

## 1. Method and evidence levels

- Writer = a code path that **actually mutates** economic state for: `sharesOut`, `founderShares`, `treasuryBuybackShares`, `founderOwnershipRatio`, `externalShareholderRatio`, `competitorOwnedRatio`, `stockPrice`, `dividendPerShare`, `publicCompany`, `market[*].issuedShares/price`, `companyStocks`/`personalStocks` quantities, startup / PE / subsidiary stakes, `stockSplitHistory`, `ownershipHistory`.
- Discovery: three independent grep sweeps over `js/*.js` (excluding `js/data.js`) — (a) player share commands, (b) VC / PE / M&A / subsidiary equity, (c) field-assignment sweep for every field above including weekly, UI, migration paths. Installed (last-wrapping) method resolved through module load order (`index.html` order; `play-runtime-compat.js` installs the outer week boundary last).
- Evidence levels used in the matrix:
  - **CODE** — established by reading code only.
  - **NODE** — an existing test registered in `tests/run-all.js` asserts it (canonical shards were green on main `3586603`; the subset re-run locally for this audit is listed in §6).
  - **WEBKIT** — an existing real-WebKit / real-IndexedDB test in `.github/workflows/ma-acquisition-financing.yml` asserts it (last main run success on the rerun attempt; first attempt cancelled by a WebKit install hang — infrastructure, recorded as non-PASS for that attempt).
  - **REPRO** — reproduced for this audit with the Node harness against main production code.
  - **iPhone** — physical-device evidence. **None exists for any writer** in this audit.
- Verdict: a correct boundary established only by code reading is never VERIFIED. **VERIFIED** = whole mutation inside `runTransaction` (or the canonical week transaction) **and** Node save-fault rollback + reload + fresh-IDB hydration **and** WebKit in CI. **GAP** = any of those missing (stated). **BLOCKED** = could not be determined.

Boundary facts used throughout (CODE): `runTransaction` (`js/engine.js:817`) snapshots state + storage checkpoint on the outermost call, defers `save()` to one commit-time save, and rolls both back on `false` / throw. `emit()` is **not** deferred. `advanceWeek` is wrapped by `play-runtime-compat.js` into one outer `'week'` transaction, so every weekly writer commits or rolls back with the week.

## 2. Writer Matrix

Columns: ID · installed location · callers · writes · entity · transaction boundary · save · ledger · fault rollback / reload / fresh IDB · determinism · tests · CI gate · verdict.
Abbreviations: SF = save-fault injection set (save-false, mirror, enqueue-false/throw, save-throw, saved/change/notify throws); RL = reload; HY = fresh durable-only IndexedDB hydration; WK = week transaction.

### 2.1 Player share / own-company commands

| ID | Location (installed) | Callers | Writes | Entity | Boundary | Save | Ledger | SF / RL / HY | RNG | Tests | Gate | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| W-SPLIT | `expansion.js:381` `stockSplit` | UI `app.js:920` | price/previous/issuedShares/priceHistory, holdings qty/avg, own sharesOut/founder/treasury/stockPrice, `stockSplitHistory` | company, personal, market | yes (CODE) | commit | none | NODE+WEBKIT | asserted | `stock-split-save-atomicity`, `stock-split-price-history` (+ WebKit both) | `stock-split-atomicity` (all events), `deal-room`/`comprehensive-ma` | **VERIFIED** (atomicity). Dividend / activist / governance per-share rescale fixed on main by #951 (merged `00cb15fb`, NODE + WEBKIT); price floor #960 open (not on main) |
| W-BUY | `engine.js:1431` `buyStock` | UI `app.js:909` | cash, holdings, quote price | company / personal | yes | commit | `investmentPurchase` (company) | NODE+WEBKIT | asserted | `stock-purchase-save-atomicity` (+WebKit) | `deal-room`, `comprehensive-ma` | **VERIFIED** (see D8: company account may buy own ticker) |
| W-SELL | `engine.js:1447` `sellStock` | UI `app.js:909` | cash, holdings, realized P/L | company / personal | yes | commit | `investmentSale` | NODE+WEBKIT | asserted | `stock-sale-save-atomicity` (+WebKit) | same | **VERIFIED** |
| W-FOUNDER-SALE | `expansion.js:390` `sellFounderShares` | UI `app.js:920` | founderShares, personalCash, ratios, history | personal | yes | commit | n/a (personal) | NODE+WEBKIT | asserted | `founder-share-sale-save-atomicity` (+WebKit) | same | **VERIFIED** |
| W-INVESTOR | `expansion.js:417` `acceptInvestorOffer` | UI `app.js:900` | sharesOut, companyCash, offer status, capitalSurplus, ratios | company | yes | commit | `equityFinancing` | NODE+WEBKIT | asserted | `investor-offer-save-atomicity` (+WebKit) | same | **VERIFIED** |
| W-INVESTOR-AUX | `expansion.js:403/434` refresh / decline offers | UI `app.js:900` | `investorOffers` (refresh uses RNG) | company (non-cash) | **no** | direct `save()`, result ignored | none | none | not asserted | functional only | — | **GAP** (P2) |
| W-IPO | `engine.js:1672` ← `pe-fund.js:1009` ← `pe-network-sourcing.js:138` (TX) ← `difficulty-scenario-balance.js:116` (TX, outermost) | UI `app.js:898` | stockPrice, sharesOut, founderShares, cash, publicCompany, ticker, own market row, capitalSurplus | company + personal | yes (outer) | commit; **base emits `change` before commit** | `equityFinancing` | NODE+WEBKIT | asserted | `parent-ipo-save-atomicity` (+WebKit) | same | **VERIFIED** (P2 note D7: early emit) |
| W-SHARE-SWAP | `ma-deal-room.js:118` via `closeMADeal` | UI `app.js:911` | sharesOut, externalShareholderRatio (additive), subsidiaries, goodwill, capitalSurplus | company | yes | commit | `acquisition` + `equityFinancing` | NODE+WEBKIT | asserted | `ma-share-swap-save-atomicity` (+WebKit) | same | **VERIFIED** atomicity; **GAP** correctness D3 (founder ratio stale) |
| W-SHARE-SWAP-LEGACY | `engine.js:1718` `acquireTarget(..,'shareSwap')` | no production caller (tests only) | as above | company | **no** | direct save | yes | none | — | functional | — | **GAP** (dormant) |
| W-MBO | `expansion.js:585` `executeMBO` | UI `app.js:920` | companyCash, holdings, market suspended/private | company | yes | commit | `investmentPurchase` | NODE (SF/RL/HY) | — | `execute-mbo-save-atomicity` | Test shards only | **GAP** (no WebKit) |
| W-DEFENSE | `expansion.js:591` `activateDefense` | UI `app.js:920` | companyCash, competitorOwnedRatio, reputation, log | company | yes | commit | `headOfficeExpense` | NODE (SF/RL/HY) | — | `activate-defense-save-atomicity` | Test shards only | **GAP** (no WebKit; D4 ratio fork REPRO) |
| W-DIV-SET | `shareholder-returns.js:32/36` `setDividend` (overrides dead `engine.js:1697`) | UI `app.js:899`, activism accept | dividendPerShare, own market dps/yield, returns history | company | yes; `capacity()`→`buildStatements` writes derived finance cache **before** the TX | commit | declaration only | **none** (no SF/HY) | — | `shareholder-returns`, `phase2-dividend-reconciliation`, `dividend-corporate-tax` (functional) | Test shards | **GAP** |
| W-BUYBACK | `shareholder-returns.js:33/37` `buyback` (overrides dead `engine.js:1701`) | UI `app.js:899`, activism accept | companyCash, treasuryBuybackShares, stockPrice, own row, treasuryStock, ratios | company | yes (same pre-TX cache note) | commit | `otherFinancing` + reconciliation evidence | NODE (mirror fault only + finance-throw; RL/HY) | — | `save-storage-commit-atomicity:247-261`, `player-own-share-conservation`, `phase2-buyback-reconciliation` | Test shards | **GAP** (partial fault set, no WebKit) |
| W-DIV-PAY | `engine.js:~2312` + `shareholder-returns.js:38` wrapper | weekly | personal/company cash, returns history | company + personal | WK | week commit; wrapper `emit('week')` inside TX (D7) | dividend rows | generic week rollback only | — | `phase2-dividend-reconciliation`, `dividend-corporate-tax` | Test shards | **GAP** (no dividend-specific fault/HY/WebKit; #951 adds split+payment WebKit) |
| W-ACTIVISM-ACCEPT | `shareholder-activism.js` `acceptShareholderProposal` | module UI | inner buyback/dividend, reputation, pressure, campaign completion | company | **yes** — one outer `runTransaction` (#957, merged `8f2e50fc`); the capital-return writer nests inside | one commit | via inner writer | NODE (all harness fault kinds, pending, nested; RL/HY) + WEBKIT | asserted (no host RNG) | `shareholder-activism-accept-save-atomicity` (+WebKit), `shareholder-activism-split-integration` (#951 × #953) | `stock-split-atomicity` (all events) | **VERIFIED** (third pass; was GAP — P1 #953) |
| W-ACTIVISM-NEG/REJ | `shareholder-activism.js` `negotiate`/`rejectShareholderProposal` | module UI | campaign, commitments | company governance | **yes** — `runTransaction` (#957) | one commit | none | NODE (save-false / save-throw rollback, RL/HY, post-split) | — | `shareholder-activism-accept-save-atomicity`, `shareholder-activism-split-integration` | Test shards; WebKit covers accept only | **GAP** (NODE only; no negotiate/reject WebKit) — was P1/P2 #953 |
| W-DECLINE-BUYOUT | `completion.js:148` `declineInboundBuyoutOffer` | UI `app.js:926` | competitorOwnedRatio (+0.025, no ratio recompute) | company | **no** | direct save, result ignored | none | none | — | none | — | **GAP — P1 #955 (REPRO: ratios sum 1.025, no rollback)** |
| W-FORCE-EARNINGS | `parity.js:82-84` via UI `app.js:927` | UI (also weekly `parity.js:104` in WK) | stockPrice, own row price/marketCap, trust, pressure, guidance | company | weekly: WK; **UI: no** | UI: direct `engine.save()` | none | none | **UI consumes simulation RNG (REPRO)** | weekly only | — | **GAP — P1 #955** |
| W-NEW-COMPANY | `completion.js:155-159` (+`pe-fund.js:1093`) `foundNewCompanyAfterBuyout` | UI `app.js:927` | replaces `g` wholesale (all equity fields) | company / personal | **no** | direct save, ignored; wrapper mutates after save | — | none | — | functional | — | **GAP — P1 #955 (REPRO 2026-10-12: failed save returns true with live new company vs durable sold company; on success the pe-fund founded-investment write after the save is lost on reload); fix PR #965** |
| W-SPONSOR | `player-crisis-actions.js:56` `requestSponsorInjection` | `player-crisis-ui.js:189` | sharesOut, cash, ratios | company | yes (CODE) | commit | yes | reload only | — | `player-crisis-actions-test` | Test shards | **GAP** (no SF/HY/WebKit) |
| W-TURNAROUND-ACCEPT | `player-crisis-turnaround-fund.js:124/133` | `player-crisis-ui.js:195` | sharesOut, cash, ratios | company | yes (CODE) | commit | yes | reload only | — | `player-crisis-turnaround-fund-test` | Test shards | **GAP** |
| W-TURNAROUND-SETTLE | `player-crisis-turnaround-fund.js:174/186` | weekly | sharesOut (ratchet) | company | WK | week commit | yes | NODE (finalize-throw rollback) | — | `player-crisis-turnaround-ratchet-week-rollback-test` | Test shards | **GAP** (no WebKit) |
| W-MA-EQUITY-RAISE | `ma-acquisition-financing.js:334-338` `executeFinancing` | `closeMADeal` | sharesOut, ratios (inline fallback) | company | custom shadow-state boundary (clone → replaceState → save → restore), not `runTransaction` | explicit wrapper save | financing events | NODE partial (`save-storage-commit-atomicity:214`; equity-leg coverage unverified) | — | `ma-acquisition-financing-*`; WebKit happy path only | `comprehensive-ma` | **GAP** |

### 2.2 VC / PE / M&A / subsidiary stakes

| ID | Location (installed) | Callers | Writes | Boundary | Save | Ledger | SF / RL / HY | Tests | Gate | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| W-VC-INITIAL | `engine.js:1467` `investStartup` | UI `app.js:910` | cash, `ownedCompany/ownedPersonal`, DD fields | yes | commit | `investmentPurchase` (company) | NODE+WEBKIT | `vc-initial-investment-save-atomicity` (+WebKit) | `vc-funding-atomicity` | **VERIFIED** |
| W-VC-FOLLOW-ON | `engine.js:1491` `participateStartupFundingRound` | UI `app.js:910` | cash, round contributions, history | yes | commit | `investmentPurchase` | NODE+WEBKIT | `vc-follow-on-save-atomicity` (+WebKit) | `vc-funding-atomicity` | **VERIFIED** |
| W-VC-SECONDARY | `expansion.js:505` `sellStartupSecondary` | UI `app.js:910` | cash, stakes zeroed | yes | commit | `investmentSale` | NODE+WEBKIT | `vc-secondary-sale-save-atomicity` (+WebKit, red probe) | `vc-secondary-atomicity` | **VERIFIED** |
| W-MAKE-SUB | `engine.js:1511` `makeSubsidiary` | UI `app.js:910` | startup→subsidiary, `subsidiaries` push | **no** | direct save, ignored | none | none (REPRO: returns true on mirror reject, storage unchanged) | functional | — | **GAP — P1 #954** |
| W-MA-ACQUIRE | `pe-acquisition.js:164` → `ma-board-approval.js:31` → `ma-acquisition-financing.js:369` → `ma-deal-room.js:118` | UI `app.js:911`, `ma-portfolio-summary-ui.js:18`, `executive-secretary.js:48` | cash, financing, subsidiaries, goodwill, targets | custom shadow boundary (financed) / TX (cash) | wrapper save with rollback | `acquisition` | NODE partial (mirror/enqueue/emit/quota + RL/HY in `save-storage-commit-atomicity`) | WebKit happy path only | `deal-room`, `comprehensive-ma` | **GAP** (no WebKit save-failure, no explicit SF/ST) |
| W-MA-SALE | `engine.js:1729` `sellMASubsidiary` | UI `app.js:911`, `ma-portfolio-summary-ui.js:26` | cash, subsidiaries, goodwill, gain (RNG) | yes | commit | `assetSale` | NODE+WEBKIT | `ma-subsidiary-sale-save-atomicity` (+WebKit) | `deal-room`, `comprehensive-ma` | **VERIFIED** |
| W-PE-FUND-ACQ | `pe-acquisition.js:91/164` `closeFundAcquisition` | via `closeMADeal` | fund capital/portfolio | yes | commit | fund waterfall | NODE+WEBKIT | `pe-fund-acquisition-save-atomicity` (+WebKit) | `pe-acquisition-atomicity` | **VERIFIED** |
| W-PE-EXIT | `pe-network-sourcing.js:152` → `pe-acquisition.js:200` → `exitPortfolioCompany` | UI `app.js:940`; `pe-ui-adapter.js:405-408` calls the module directly inside `runTransaction` | fund cash/distributions | yes (both routes) | commit | fund waterfall | NODE (both routes) + WEBKIT (engine route) | `pe-portfolio-exit-save-atomicity` (+WebKit) | `pe-acquisition-atomicity` | **VERIFIED** atomicity; adapter route skips network registration (behavioural, P2) |
| W-PE-TO-PARENT | `pe-portfolio-operations.js:987` `acquirePEPortfolioCompany` | `pe-ui-adapter.js:409` | cash, subsidiaries, fund deal | yes (CODE) | commit | yes | none | functional | — | **GAP** |
| W-PE-LEGACY-CREATE | `expansion.js:600` `createPEDeal` | UI `app.js:921` (`app.js:636`) | cash, `peDeals`, subsidiaries (RNG) | **no** | direct save, ignored | `acquisition` | none (REPRO: save-throw keeps −20,000,000 durable) | functional | — | **GAP — P1 #954** |
| W-PE-LEGACY-EXIT | `pe-value-creation.js:299` → `expansion.js:604` | UI `app.js:921` (`app.js:646`) | cash, P/L, deal status, subsidiary removal | **no** | direct save, ignored | `assetSale` | none (REPRO: save-throw keeps +19,081,707 durable) | functional | — | **GAP — P1 #954** |
| W-PE-LEGACY-TRANSFER | `pe-value-creation.js:340` → `expansion.js:603` | UI `app.js:921` | company/personal cash, owner account | yes | commit | `acquisition` | reload only | functional | — | **GAP** |
| W-ANGEL | `expansion.js:605/606` | UI `app.js:922` | personalCash, `angelInvestments` | **no** | direct save | none | none (REPRO) | none | — | **GAP — P1/P2 #954** |
| W-SUB-IPO | `subsidiary-ipo-preparation.js:59/60` → `engine.js:1518` | UI `app.js:910`, `ma-portfolio-summary-ui.js:26`, prep UI `:69` | sub ownership −15%, book, cash, ticker (RNG) | yes | commit | `investmentSale` | none (tests use a stub `runTransaction`) | `subsidiary-ipo-preparation-test`, `finance-subsidiary-ipo-test` | — | **GAP** |
| W-SUB-IPO-STAKE | `subsidiary-ipo-secondary-sale.js:22` | module UI | cash, ownership, book, `cumulativeProfit` | yes (CODE) | commit | `investmentSale` **without `assetEffect`** (unverified ledger concern) | none (stub engine) | `subsidiary-ipo-secondary-sale-test` | — | **GAP** (ledger to verify) |
| W-SUB-MARKET-RENDER | `listed-subsidiary-market.js:43-45` `catchUp` → `distributeQuarterlyDividend`, reached from `ensure()` via `snapshot()` / `allSnapshots()` in `renderSection` (venture tab render) as well as `normalize` and the module actions | render / load / actions | `companyCash`, `sub.subsidiaryCash`, `parentDividendsReceived`, `marketPriceIndex`, valuation, `dividendIncome` ledger event | **no** — the module has no `advanceWeek` hook, so a due quarterly parent dividend is booked at render time outside any transaction | not saved by the render; persisted by the next unrelated save | `dividendIncome` | none | functional | — | **GAP — P2 #966** (REPRO 2026-10-12: no weekly catch-up; venture-tab render booked +39,000,000 parent dividend outside any transaction; idempotent, reload converges; fix needs an Owner decision on timing) |
| W-SUB-OTHER | `listed-subsidiary-control-actions.js:22` (TOB/squeeze-out), `listed-subsidiary-market.js:51` (buy/sell stake, dividend policy), `listed-subsidiary-follow-on-offering.js:23`, `subsidiary-relisting-options.js:20`, `group-restructuring-candidates.js:27`, `internal-venture-business.js:101/104/113` | module UIs | subsidiary ownership/cash | yes (CODE) | commit | yes | none (TOB test uses a stub engine) | functional | — | **GAP** |

### 2.3 Weekly and load paths

| ID | Location | Writes | Boundary | Evidence | Verdict |
|---|---|---|---|---|---|
| W-WEEK-MARKET | `engine.js:1836-1838` `updateMarket` | all prices (floor `Math.max(10,…)`), own stockPrice/issuedShares/marketCap, priceHistory | WK | CODE + generic `week-transaction-atomicity` / `transaction-regression` | **GAP** — boundary verified by CODE only; no writer-specific fault / HY / WebKit test (generic week tests use a private company) |
| W-WEEK-COMPETITOR | `engine.js:2102-2103` `updateCompetitors` | competitorOwnedRatio, ratios | WK | CODE; generic week tests use a private company | **GAP** |
| W-WEEK-STARTUPS | `engine.js:1840-1867` `updateStartups` → open/close round, write-off, `listStartup` (stakes → holdings, RNG) | stakes, holdings, ledger | WK | CODE + `startup-funding-round-test` | **GAP** — boundary verified by CODE only; no writer-specific fault / HY / WebKit test |
| W-WEEK-PE / MA / PMI | `pe-fund.js:1019`, `pe-portfolio-operations.js:996`, `pe-deal-supply.js:548`, `pe-network.js:167`, `ma-deal-room.js:122`, `updateSubsidiaries` wrappers | fund / deal / subsidiary state | WK (nested TX) | CODE | **GAP** — boundary verified by CODE only; no writer-specific fault / HY / WebKit test |
| W-WEEK-EXPANDED | `expansion.js:798` `updateCapitalMarketsExpandedWeekly`; margin liquidation `personal-stock-margin.js:163` | `ownershipHistory`, personal holdings | WK | CODE + `microcap-listings-test`, `personal-stock-margin-test` | **GAP** — boundary verified by CODE only; no writer-specific fault / HY / WebKit test |
| W-WEEK-CAPALLOC | `capital-allocation-score.js:33/36` | stockPrice | WK (weekly); direct method has no TX/save but no production UI caller | CODE | GAP (low) |
| W-LOAD | defaults `engine.js:271-273`, `normalizeHoldingMap` `:387-394`, `normalize`→`updateOwnershipRatios` `:805`, `expansion.js:251/277`, save-v9 migration | normalization | outside TX (load) | CODE + save-v9 / migration suites | acceptable idempotent normalization — **but not a no-op** where live ratios are stale (D3/D4) |

UI bypass check (CODE): no `app.js` or D UI handler writes share / ownership fields directly; all call engine or module methods. Out of domain but noted: `app.js:903` `workforce-invest` writes `companyCash` + `finance.event` directly from the UI.

## 3. New defects (reproduced, filed, **not fixed**)

| Issue | Severity | Summary | Evidence |
|---|---|---|---|
| #953 | P1 | Activism accept completes the campaign after the inner buyback commit, outside any transaction; reload re-opens the proposal and a second accept executes a second buyback (treasury 10,000 → 19,920, cash spent twice). Negotiate / reject never save. **Fixed on main by #957 (merged `8f2e50fc`).** | REPRO (Node) |
| #954 | P1 | Legacy `createPEDeal` / `exitPEDeal`, `makeSubsidiary`, angel create/exit save outside `runTransaction`: return `true` on save rejection with storage unchanged; save-throw throws while keeping the mutation durable. | REPRO (Node) |
| #955 | P1 (items 1–2); item 3 suspected in the first pass, **reproduced in the second pass (§3b)** | `declineInboundBuyoutOffer` (ratios sum 1.025, no rollback), UI force-earnings (consumes simulation RNG outside a transaction), `foundNewCompanyAfterBuyout` (wholesale `g` replace, save ignored). | REPRO (1, 2), CODE (3) |

Lower-severity findings recorded here only (no Issue yet; candidates for Owner triage):

- **D3** (P1 correctness, CODE): share swap (`ma-deal-room.js:118`, `engine.js:1723`) increases `externalShareholderRatio` additively without `updateOwnershipRatios`; `founderOwnershipRatio` stays at the pre-dilution value until the next week / reload, and same-week buyout payouts use it. Not reproduced in this audit.
- **D4** (P2, REPRO): `activateDefense` lowers `competitorOwnedRatio` without recomputing ratios — live external ratio 0.52, after reload 0.61 (sum 0.91 live).
- **D7** (P2, CODE): `emit('week')` / IPO `emit('change')` fire inside an uncommitted transaction.
- **D8** (P2, REPRO): `buyStock(ownTicker, …, 'company')` skips `playerShareAcquisitionCapacity`; 50,000 own shares bought into `companyStocks` with no treasury accounting.
- **D9** (P2, CODE): own market row `issuedShares` / `marketCap` and the IPO-time `shareholders` map go stale after dilution until the next `updateMarket`.
- **Render-time writer** (first pass CODE; **second pass REPRO, filed as P2 #966**, see §3b): `listed-subsidiary-market.js` books due listed-subsidiary parent dividends (`companyCash` + `dividendIncome`) from `ensure()` during venture-tab rendering, outside any transaction and without a save (W-SUB-MARKET-RENDER).
- `refreshInvestorOffers` / `declineInvestorOffer` direct saves (P2); `setDividend` / buyback write derived finance cache before entering the transaction (P2); `sellSubsidiaryIPOStake` posts `investmentSale` without `assetEffect` (ledger, unverified).

## 3b. Remediation status — second pass (2026-10-12, after #952 / #956 merged)

Verdicts in §2 describe **main** and stay unchanged until a fix merges; a fix PR with green CI is not a VERIFIED writer. Evidence levels: NODE = Node test on the shared fault harness (`tests/helpers/transaction-fault-case.js`, merged in #952), WEBKIT = real-WebKit test run in CI, REPRO = reproduced on main before the fix.

| Writer | Defect | Fix PR | RED on main | GREEN evidence | WebKit | Verdict on main → expected after merge |
|---|---|---|---|---|---|---|
| W-SPLIT (dividend) | split multiplied per-share dividends; activist / governance per-share terms stale | #951 | REPRO (payout ×2; accept total ×2 / ×6; false commitment breach) | NODE 37 cases | WEBKIT 12/12 (job 114813605895: 10 dividend + 2 activist accept) | economic defect fixed → VERIFIED (atomicity already VERIFIED) |
| W-SPLIT (floor) | no post-split price floor | #960 (Draft, stacked on #951) | REPRO (19.98 / 1:2 accepted) | NODE (boundaries, ratios, overflow, at-floor fault matrix) | WEBKIT 8/8, WebKit 26.5 (job 114844972880) | economic defect fixed after #951 |
| W-ACTIVISM-ACCEPT / NEG / REJ | completion outside the transaction; double buyback after reload; responses unsaved | #957 | REPRO (all 9 fault kinds; treasury 10,000→19,920) | NODE 49 cases | WEBKIT 6/6, WebKit 26.5 (job 114817583864) | GAP → VERIFIED candidate (Node + WebKit) |
| W-PE-LEGACY-CREATE | save outside transaction | #958 | REPRO | NODE 43 cases | NOT RUN | GAP → GAP (WebKit missing) |
| W-PE-LEGACY-EXIT (+ premium wrapper) | save outside transaction; premium valuation kept | #959 | REPRO | NODE 64 cases | NOT RUN | GAP → GAP (WebKit missing) |
| W-MAKE-SUB | save outside transaction | #961 | REPRO | NODE 22 cases | NOT RUN | GAP → GAP (WebKit missing) |
| W-ANGEL (create / exit) | save outside transaction | #962 | REPRO | NODE 43 cases | NOT RUN | GAP → GAP (WebKit missing) |
| W-DECLINE-BUYOUT | ratios sum 1.025; save outside transaction | #963 | REPRO | NODE 43 cases (sum = 1, live = reload) | NOT RUN | GAP → GAP (WebKit missing; founder + competitor > 1 edge case left to Owner) |
| W-FORCE-EARNINGS | UI path outside transaction consuming simulation RNG | #964 | REPRO | NODE (8 applicable fault kinds; `notify` not applicable, proven) | NOT RUN | GAP → GAP (WebKit missing; forced off-schedule earnings is an Owner gameplay decision) |
| W-NEW-COMPANY | false success; post-save wrapper write lost; root identity | #965 | REPRO | NODE 22 cases + root identity | NOT RUN | GAP → GAP (WebKit missing) |
| W-SUB-MARKET-RENDER | render-time economic writer, no weekly catch-up | — (#966) | REPRO | — | — | GAP (P2, Owner decision) |

Outside this audit's share / ownership / dividend scope, noted for the next audit (CODE only, not reproduced): the personal real-estate writers `buyPersonalRealEstate` (`expansion.js:607`) and `sellPersonalRealEstate` (`expansion.js:608`) mutate personal cash, the holding, mortgage / tax settlement and status, then call `save()`/`emit()` outside a transaction — the same pattern as #954. They belong to a personal-assets writer audit, not to Track A's equity matrix.

Track A completion conditions after the second pass:

| # | Condition | Status |
|---|---|---|
| 1 | Writer list completeness | Partial (pattern sweep; adjacent out-of-scope direct-save writers noted above) |
| 2 | State destinations | Met (CODE) |
| 3 | Save / rollback boundary | Met (CODE); 10 fix PRs open |
| 4 | Node regressions registered | Improving (fix PRs add harness tests), **not met** on main |
| 5 | WebKit need / evidence | **Not met** (#954 / #955 writers Node-only) |
| 6 | Accounting / ownership invariants | **Not met** on main (#963 open; founder + competitor > 1 edge case; D3 / D4) |
| 7 | Unresolved P0/P1 recorded | Met (#953–#955 with PRs; #966 P2) |
| 8 | Executable CI gate | Partial (path filters: `js/shareholder-activism.js` added by #957; others still missing) |
| 9 | Missing writers explicit | Met |
| 10 | Independent diff audit | **Not met** (same agent session; Codex automated review only) |

**Track A verdict: still BLOCKED.**

## 3c. Remediation status — third pass (2026-10-13, main `8f2e50fc`, after #951 / #957 merged)

Evidence levels as in §1. A fix PR with green CI is **not** a VERIFIED writer on main; only merged fixes change §2. WEBKIT below = real WebKit 26.5 (Playwright, iPhone 13 emulation, real IndexedDB) in GitHub Actions; physical iPhone: **NOT RUN** for every row.

| Writer | Fix PR | State | Node | WebKit (writer-specific) | Verdict on main |
|---|---|---|---|---|---|
| W-SPLIT (dividend / activist / governance) | #951 | **merged** `00cb15fb`; main CI 42 success / 8 skipped / 0 failure | 37 cases | 12/12 (job 114813605895) | VERIFIED |
| W-ACTIVISM-ACCEPT | #957 | **merged** `8f2e50fc` | 49 + 68 integration cases (#951 × #953 cases A–C) | accept 9/9 incl. dividend after a 1:2 split (job 115038267509) | VERIFIED |
| W-ACTIVISM-NEG/REJ | #957 | **merged** | save-false / save-throw, post-split | NOT RUN (accept only) | GAP |
| W-SPLIT (price floor) | #960 | open (retargeted to main) | boundaries, ratios, overflow, at-floor faults | 8/8 (job 114844972880, before retarget) | defect open on main |
| W-PE-LEGACY-CREATE | #958 | open | 43 cases | 22/22 (job 115033796121) | GAP |
| W-PE-LEGACY-EXIT (+ premium) | #959 | open | 64 cases | 33/33 (job 115035068045) | GAP |
| W-MAKE-SUB | #961 | open | 22 cases | 11/11 (job 115035650583) | GAP |
| W-ANGEL (create / exit) | #962 | open | 43 cases | 22/22 (job 115036468697) | GAP |
| W-DECLINE-BUYOUT | #963 | open | 43 cases | 22/22 (job 115052640419) | GAP |
| W-FORCE-EARNINGS | #964 | open | 8 applicable fault kinds (`notify` not applicable) | 11/11 through the real market-tab button (job 115052659642) | GAP |
| W-NEW-COMPANY | #965 | open | 22 cases + root identity | 12/12 through the real legacy-tab flow, root held across success and rollback (job 115052671424) | GAP |
| W-SUB-MARKET-RENDER | — | Issue #966 | — | — | GAP (severity raise to P1 proposed; Owner decision) |

Merged-tree integration (local, NODE only, never pushed): main + #957 + #960 + #958 + #959 + #961 + #962 + #963 + #964 + #965 + #970. The registration-list conflicts resolve mechanically. The `js/expansion.js` conflict between #959 and #962 does **not**: a keep-both resolution re-adds the pre-fix `exitPEDeal` / `createAngelInvestment` / `exitAngelInvestment` after the fixed ones, and the later non-transactional definitions would win. Those PRs must be merged one at a time with the conflict resolved by hand and re-tested. With that resolution, 24 suites pass (all writer tests, save-compat, save-v9 migration, transaction regression, accounting invariants, week, finance ledger).

New findings in this pass (all pre-existing on main, none introduced by the fix PRs):

| Issue | Severity | Summary | Evidence |
|---|---|---|---|
| #971 | P1 (P0 candidate) | `updateSubsidiaries` quarterly VC / M&A subsidiary dividend credits `companyCash` with no ledger event; the quarter-week standalone close fails (`P2-CLOSE-BS-IDENTITY 263,152.52`), so a company holding a VC subsidiary cannot pass week 13 | REPRO (Node, production writers, confirmed twice) |
| #968 | P1 (P0 candidate) | `foundNewCompanyAfterBuyout` leaves `finance.openingCash` at the fresh-state default (8,000,000 vs `companyCash` 50,000,000); the next weekly close throws, so the refounding route cannot advance | REPRO (Node) |
| #969 | P2 | success `notify` toasts are emitted inside `runTransaction` before the commit outcome; on a soft save failure the player sees a success toast for a rolled-back action | REPRO (browser logic run in Chromium; WebKit NOT RUN for this observation) |
| #966 (update) | P2 → P1 proposed | render-booked listed-subsidiary dividend can block the next week (`P2-CLOSE-WEEKLY-CASH`); `ensureSub` rescales the listing valuation on every render; render frequency changes valuation by tens of percent; two quarterly dividend writers per listed subsidiary | REPRO (Node, subagent); see the #966 comment |
| — (no Issue yet) | P2, Owner decision | founder + competitor ownership can exceed 1: competitor stake is clamped to 0.49 independently of the founder ratio and buybacks raise the founder ratio; production hostile declines + buyback reach founder 0.7595 + competitor 0.49 (external clamps at 0, never negative). #963 improves main (sum 1.49 → 1.096) but cannot fix it without an ownership-model change, which belongs to the stopped P3-4 cutover | REPRO (Node) |

Track A completion conditions after the third pass:

| # | Condition | Status |
|---|---|---|
| 1 | Writer list completeness | Partial (pattern sweep) |
| 2 | State destinations | Met (CODE) |
| 3 | Save / rollback boundary | Met (CODE); #953 fixed on main; 8 fix PRs still open |
| 4 | Node regressions registered | Improving; **not met** on main (open PRs) |
| 5 | WebKit need / evidence | Writer-specific WebKit now exists and passes for every #954 / #955 writer, but **only in unmerged PRs**; **not met** on main |
| 6 | Accounting / ownership invariants | **Not met** (#971, #968 newly reproduced; founder + competitor > 1; D3 / D4) |
| 7 | Unresolved P0/P1 recorded | Met (#954, #955, #966, #968, #971) |
| 8 | Executable CI gate | Partial (writer path filters proposed in CI-only PR #972; save-storage budget timeout CI-only PR #970; both awaiting Owner approval) |
| 9 | Missing writers explicit | Met |
| 10 | Independent diff audit | **Not met** (same agent session; Codex automated review only) |

**Track A verdict: still BLOCKED.** P3-4 Ownership Authority Cutover remains STOPPED; Phase 4 not started.

## 4. CI gate observations

- `ma-acquisition-financing.yml` `pull_request.paths` omits modules that sit on audited writer chains: `js/difficulty-scenario-balance.js` (outermost IPO wrapper), `js/pe-fund.js`, `js/pe-value-creation.js`, `js/play-runtime-compat.js`, `js/shareholder-returns.js`, `js/shareholder-activism.js`, `js/ma-board-approval.js`, `js/ma-acquisition-financing.js`, `js/save*.js`, `js/finance.js`, `js/subsidiary-*.js`. A PR touching only those does not run the atomicity WebKit jobs; the push filter covers some via globs (`ma-*`, `save*`, `subsidiary-*`, `finance.js`) but not `pe-fund.js`, `pe-value-creation.js`, `difficulty-scenario-balance.js`, `play-runtime-compat.js`, `shareholder-*.js` — those rely on the nightly schedule. Changing the filters is a separate CI PR (proposal only).
- Node atomicity tests run in the canonical Test shards on every PR (no path filter).
- Every WebKit atomicity test drives the engine through `page.evaluate`; none goes through a UI click.

## 5. Track A completion conditions

| # | Condition | Status | Evidence |
|---|---|---|---|
| 1 | Writer list completeness | **Partial** | Three independent grep sweeps (CODE). Not a proof: dynamic writes (e.g. `Object.assign` with computed keys, wholesale `g` replacement) are found by pattern only. |
| 2 | State destinations per writer | **Met (CODE)** | §2 "Writes" columns. |
| 3 | Save / rollback boundary | **Met (CODE)**; tested for VERIFIED rows only | §2. |
| 4 | Required Node regression tests registered | **Not met** | 30+ GAP rows without SF/RL/HY tests (§2). |
| 5 | WebKit need decided with evidence | **Not met** | No WebKit for MBO, defense, setDividend, buyback, activism, dividend payment, sponsor/turnaround, subsidiary IPO, PE→parent, financed M&A failure paths. |
| 6 | Accounting / ownership invariants | **Not met** | Ratio sum ≠ 1 reproduced (#955, D4); stale founder ratio (D3). |
| 7 | Unresolved P0/P1 recorded | **Met** | #953, #954, #955 (+ D3 listed). |
| 8 | Executable CI gate | **Partial** | `ma-economic-gate` covers the atomicity jobs; path-filter gaps in §4; branch protection is off, so gates are advisory. |
| 9 | Missing writers / untested paths explicit | **Met** | §2 GAP rows, §3. |
| 10 | Independent diff audit | **Not met** | This audit and its sub-sweeps were produced by the same agent session; no independent reviewer. |

**Track A verdict: BLOCKED** (conditions 1, 4, 5, 6, 8, 10 not met). Track A completion must not be claimed; P3-4 Ownership Authority Cutover remains STOPPED.

## 6. Local verification performed for this audit (Node 22, main production code)

- Reproductions: the scripts behind #953 / #954 / #955 and D4 / D8 (Node harness, `tests/fixtures/pe-fund-acquisition-faults.js` `inject`).
- Re-run green on this base: `stock-split-save-atomicity`, `stock-split-price-history`, `investor-offer`, `phase2-buyback-reconciliation`, `phase3-ownership-reconciliation`, `player-own-share-conservation`, `dividend-corporate-tax`, `phase2-dividend-reconciliation`, `preferred-shares-dividends`, `shareholder-returns`, `execute-mbo-save-atomicity`, `activate-defense-save-atomicity`.
- Not run locally: WebKit (no local WebKit; CI evidence only), physical iPhone (none).

## 7. Recommended order of remediation (each its own PR, Owner approval required)

1. #953 activism accept/negotiate/reject → one outer transaction + Node/WebKit tests (duplicated cash effect).
2. #954 legacy PE create/exit, `makeSubsidiary`, angel → `runTransaction` + tests on the shared harness (#952).
3. #955 decline-buyout ratio + transaction; force-earnings UI path (Owner decision on RNG use); `foundNewCompanyAfterBuyout`.
4. D3 / D4 ratio recomputation (economic correctness; needs an Owner decision on whether to repair live saves — no automatic save repair).
5. Coverage: `setDividend`, buyback full fault set, dividend payment, MBO / defense WebKit, subsidiary IPO and listed-subsidiary writers (replace stub-engine tests with the real boundary).
6. CI path filters (§4) in a dedicated CI PR.
