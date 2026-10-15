# Track A — Writer Authority audit: shares, ownership, dividends (#922)

Status: **read-only audit. Verdict: BLOCKED** (see §5). No production, test, CI or save-format change.
Base: first pass on main `35866030c4f47e47d1aac9dc1d4415365b412fb0` (2026-10-12; §1–§7). Second pass on main `9d2a9ddba666b1817b3848d5389b73d6d154e33d`, after #952 (shared fault harness) and #956 merged: §3b records the current evidence and **supersedes** the first-pass evidence where they differ (W-NEW-COMPANY is now reproduced; the render-time writer is reproduced and filed as #966). Third pass on main `8f2e50fcdfcb44d712f956ebb2750610c4db426e` (2026-10-13), after #951 and #957 merged: §3c supersedes §3b where they differ. Fourth pass on main `ee4f37f561fe326545deed96a127d0a032ebcb24` (2026-10-14): §3d supersedes §3c where they differ. Fifth pass on main `3ceb67c2b012921b6fdef8f6027a92ffa48b1a49` (2026-10-14), after #980 and #983 merged: §3e supersedes §3d where they differ. Sixth pass on main `6250aef7c7b81c149305e9a47175af63df96212f` (2026-10-14), after #965 merged: §3f supersedes §3e where they differ. Seventh pass on main `98ad2bae72db77b2e5229fe5e70153e921b85630` (2026-10-14), after #963, #991 (#988) and #986 merged and #964 closed as superseded: §3g supersedes §3f where they differ. Eighth pass on main `743d08d1867f453fe09c61e1fd5312c846cfc1eb` (2026-10-15), after #992 (D3) and #993 (D4, competitor purchase) merged: §3h is the current status (remaining unverified writers, WebKit gaps, independent-audit scope, P3-4 blockers) and supersedes §3g where they differ. §2 verdicts describe main and change only when a fix merges.

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
| W-SHARE-SWAP | `ma-deal-room.js:118` via `closeMADeal` | UI `app.js:911` | sharesOut, ratios via `engine.issueSharesToExternalHolders` (`engine.js:1841`: founder and competitor keep their share counts, diluted over issued − treasury; new shares external), subsidiaries, goodwill, capitalSurplus | company | yes | commit | `acquisition` + `equityFinancing` | NODE+WEBKIT | asserted | `ma-share-swap-save-atomicity`, `ma-share-swap-ownership-ratios` (+WebKit both) | `stock-split-atomicity` (all events), same | **VERIFIED** atomicity; **VERIFIED** correctness (eighth pass: D3 fixed by #992, merged `d0802d88`; main WebKit job 116271164874) |
| W-SHARE-SWAP-LEGACY | `engine.js:1723` `acquireTarget(..,'shareSwap')` | no production caller (tests only) | as above (same dilution helper since #992) | company | **no** | direct save | yes | none | — | functional, `ma-share-swap-ownership-ratios` (ratios) | — | **GAP** (dormant; atomicity) |
| W-MBO | `expansion.js:585` `executeMBO` | UI `app.js:920` | companyCash, holdings, market suspended/private | company | yes | commit | `investmentPurchase` | NODE (SF/RL/HY) | — | `execute-mbo-save-atomicity` | Test shards only | **GAP** (no WebKit) |
| W-DEFENSE | `expansion.js:609` `activateDefense` | UI `app.js:920` | companyCash, competitorOwnedRatio, reputation, log | company | yes | commit | `headOfficeExpense` | NODE (SF/RL/HY) | — | `activate-defense-save-atomicity` | Test shards only | **GAP** (no WebKit; §3 D4 ratio fork still REPRO on main `743d08d1`, see §3h — #993 fixed the weekly purchase only) |
| W-DIV-SET | `shareholder-returns.js:32/36` `setDividend` (overrides dead `engine.js:1697`) | UI `app.js:899`, activism accept | dividendPerShare, own market dps/yield, returns history | company | yes; `capacity()`→`buildStatements` writes derived finance cache **before** the TX | commit | declaration only | **none** (no SF/HY) | — | `shareholder-returns`, `phase2-dividend-reconciliation`, `dividend-corporate-tax` (functional) | Test shards | **GAP** |
| W-BUYBACK | `shareholder-returns.js:33/37` `buyback` (overrides dead `engine.js:1701`) | UI `app.js:899`, activism accept | companyCash, treasuryBuybackShares, stockPrice, own row, treasuryStock, ratios | company | yes (same pre-TX cache note) | commit | `otherFinancing` + reconciliation evidence | NODE (mirror fault only + finance-throw; RL/HY) | — | `save-storage-commit-atomicity:247-261`, `player-own-share-conservation`, `phase2-buyback-reconciliation` | Test shards | **GAP** (partial fault set, no WebKit) |
| W-DIV-PAY | `engine.js:~2312` + `shareholder-returns.js:38` wrapper | weekly | personal/company cash, returns history | company + personal | WK | week commit; wrapper `emit('week')` inside TX (D7) | dividend rows | generic week rollback only | — | `phase2-dividend-reconciliation`, `dividend-corporate-tax` | Test shards | **GAP** (no dividend-specific fault/HY/WebKit; #951 adds split+payment WebKit) |
| W-ACTIVISM-ACCEPT | `shareholder-activism.js` `acceptShareholderProposal` | module UI | inner buyback/dividend, reputation, pressure, campaign completion | company | **yes** — one outer `runTransaction` (#957, merged `8f2e50fc`); the capital-return writer nests inside | one commit | via inner writer | NODE (all harness fault kinds, pending, nested; RL/HY) + WEBKIT | asserted (no host RNG) | `shareholder-activism-accept-save-atomicity` (+WebKit), `shareholder-activism-split-integration` (#951 × #953) | `stock-split-atomicity` (all events) | **VERIFIED** (third pass; was GAP — P1 #953) |
| W-ACTIVISM-NEG/REJ | `shareholder-activism.js` `negotiate`/`rejectShareholderProposal` | module UI | campaign, commitments | company governance | **yes** — `runTransaction` (#957) | one commit | none | NODE (save-false / save-throw rollback, RL/HY, post-split) | — | `shareholder-activism-accept-save-atomicity`, `shareholder-activism-split-integration` | Test shards; WebKit covers accept only | **GAP** (NODE only; no negotiate/reject WebKit) — was P1/P2 #953 |
| W-DECLINE-BUYOUT | `completion.js:152` `declineInboundBuyoutOffer` | UI `app.js:931` (only caller; no nested production caller) | competitorOwnedRatio (+min(0.025, remaining external float)), ratios recomputed, trust, history, news | company | **yes** (`runTransaction`) | one commit-time save; decline notice emitted once after the outermost commit (a nested call drops it — known P2, #969) | none | SF (8 kinds × nested × hostile/friendly) + pending + RL + HY | no host RNG | `decline-buyout-ownership-save-atomicity` (Node + WebKit) | `stock-split-atomicity` (all events) | **VERIFIED** (seventh pass: #963 merged `4a7e20c6`; ratios sum to 1; main WebKit job 116062799056). Was GAP — P1 #955 |
| W-FORCE-EARNINGS | `parity.js:85` `runEarningsEventsIfNeeded` | weekly only (`parity.js:115`, `false`, in WK); market-tab 「決算イベントを確認」 is now the read-only `view-earnings` (`earningsSummary()`) | stockPrice, own row price/marketCap, trust, pressure, guidance (weekly path only) | company | WK | week commit | none | read-only view: no state / save / RNG / event change (Node + WebKit); weekly path byte-identical to the previous main over 60 weeks | weekly: simulation RNG inside WK; forced calls draw nothing | `earnings-confirm-read-only` (Node + WebKit), `simulation-rng`, `simulation-long-run-reload-fork` | `stock-split-atomicity` (all events) | **VERIFIED** (seventh pass: #991 merged `3393bbf9` — Owner option A for P1 #988: `runEarningsEventsIfNeeded(true)` refused for listed and unlisted companies, the button is read-only; main WebKit job 116120820287). The transaction wrapper PR #964 closed as superseded |
| W-NEW-COMPANY | `completion.js` `foundNewCompanyAfterBuyout` (+`pe-fund.js` wrapper: outer `runTransaction`, base nested) | UI `app.js:927` | rebuilds the state inside the same root object (all equity fields); the new company's book opens at the founder's contribution (#983) | company / personal | **yes** (`runTransaction`, root identity kept on success and rollback) | one commit-time save; success notice emitted once after the outermost commit | opening book = contribution (#983); no free transfer of the sold company's active company PE deals | SF (8 rollback kinds, nested and not) + pending writes + RL + HY; a throwing notice listener runs after the commit | no host RNG; deterministic retry | `found-new-company-save-atomicity` (Node + WebKit), `refounding-ledger` (Node + WebKit) | `vc-secondary-atomicity` | **GAP — P1 #955 (REPRO 2026-10-12: failed save returns true with live new company vs durable sold company; on success the pe-fund founded-investment write after the save is lost on reload); fix PR #965**. Fifth pass: the refounded ledger (#968) is fixed on main by #983 (`3ceb67c2`, NODE + WEBKIT). **Sixth pass: VERIFIED** — #965 merged `6250aef7` (one `runTransaction`, root identity, founded investment in the commit, success notice after the commit; NODE fault matrix + reload + fresh hydration; WEBKIT on main job 115775723281) |
| W-SPONSOR | `player-crisis-actions.js:56` `requestSponsorInjection` | `player-crisis-ui.js:189` | sharesOut, cash, ratios | company | yes (CODE) | commit | yes | reload only | — | `player-crisis-actions-test` | Test shards | **GAP** (no SF/HY/WebKit) |
| W-TURNAROUND-ACCEPT | `player-crisis-turnaround-fund.js:124/133` | `player-crisis-ui.js:195` | sharesOut, cash, ratios | company | yes (CODE) | commit | yes | reload only | — | `player-crisis-turnaround-fund-test` | Test shards | **GAP** |
| W-TURNAROUND-SETTLE | `player-crisis-turnaround-fund.js:174/186` | weekly | sharesOut (ratchet) | company | WK | week commit | yes | NODE (finalize-throw rollback) | — | `player-crisis-turnaround-ratchet-week-rollback-test` | Test shards | **GAP** (no WebKit) |
| W-MA-EQUITY-RAISE | `ma-acquisition-financing.js:334-338` `executeFinancing` | `closeMADeal` | sharesOut, ratios (inline; competitor not diluted on main — fix PR #994 open, §3h) | company | custom shadow-state boundary (clone → replaceState → save → restore), not `runTransaction` | explicit wrapper save | financing events | NODE partial (`save-storage-commit-atomicity:214`; equity-leg coverage unverified) | — | `ma-acquisition-financing-*`; WebKit happy path only | `comprehensive-ma` | **GAP** |

### 2.2 VC / PE / M&A / subsidiary stakes

| ID | Location (installed) | Callers | Writes | Boundary | Save | Ledger | SF / RL / HY | Tests | Gate | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| W-VC-INITIAL | `engine.js:1467` `investStartup` | UI `app.js:910` | cash, `ownedCompany/ownedPersonal`, DD fields | yes | commit | `investmentPurchase` (company) | NODE+WEBKIT | `vc-initial-investment-save-atomicity` (+WebKit) | `vc-funding-atomicity` | **VERIFIED** |
| W-VC-FOLLOW-ON | `engine.js:1491` `participateStartupFundingRound` | UI `app.js:910` | cash, round contributions, history | yes | commit | `investmentPurchase` | NODE+WEBKIT | `vc-follow-on-save-atomicity` (+WebKit) | `vc-funding-atomicity` | **VERIFIED** |
| W-VC-SECONDARY | `expansion.js:505` `sellStartupSecondary` | UI `app.js:910` | cash, stakes zeroed | yes | commit | `investmentSale` | NODE+WEBKIT | `vc-secondary-sale-save-atomicity` (+WebKit, red probe) | `vc-secondary-atomicity` | **VERIFIED** |
| W-MAKE-SUB | `engine.js:1511` `makeSubsidiary` | UI `app.js:910` | startup→subsidiary, `subsidiaries` push | **no** | direct save, ignored | none | none (REPRO: returns true on mirror reject, storage unchanged) | functional | — | **VERIFIED** (fourth pass: #961 merged `1d2a2d83`; NODE + WEBKIT on main `ee4f37f5`, job 115638242602) |
| W-MA-ACQUIRE | `pe-acquisition.js:164` → `ma-board-approval.js:31` → `ma-acquisition-financing.js:369` → `ma-deal-room.js:118` | UI `app.js:911`, `ma-portfolio-summary-ui.js:18`, `executive-secretary.js:48` | cash, financing, subsidiaries, goodwill, targets | custom shadow boundary (financed) / TX (cash) | wrapper save with rollback | `acquisition` | NODE partial (mirror/enqueue/emit/quota + RL/HY in `save-storage-commit-atomicity`) | WebKit happy path only | `deal-room`, `comprehensive-ma` | **GAP** (no WebKit save-failure, no explicit SF/ST) |
| W-MA-SALE | `engine.js:1729` `sellMASubsidiary` | UI `app.js:911`, `ma-portfolio-summary-ui.js:26` | cash, subsidiaries, goodwill, gain (RNG) | yes | commit | `assetSale` | NODE+WEBKIT | `ma-subsidiary-sale-save-atomicity` (+WebKit) | `deal-room`, `comprehensive-ma` | **VERIFIED** |
| W-PE-FUND-ACQ | `pe-acquisition.js:91/164` `closeFundAcquisition` | via `closeMADeal` | fund capital/portfolio | yes | commit | fund waterfall | NODE+WEBKIT | `pe-fund-acquisition-save-atomicity` (+WebKit) | `pe-acquisition-atomicity` | **VERIFIED** |
| W-PE-EXIT | `pe-network-sourcing.js:152` → `pe-acquisition.js:200` → `exitPortfolioCompany` | UI `app.js:940`; `pe-ui-adapter.js:405-408` calls the module directly inside `runTransaction` | fund cash/distributions | yes (both routes) | commit | fund waterfall | NODE (both routes) + WEBKIT (engine route) | `pe-portfolio-exit-save-atomicity` (+WebKit) | `pe-acquisition-atomicity` | **VERIFIED** atomicity; adapter route skips network registration (behavioural, P2) |
| W-PE-TO-PARENT | `pe-portfolio-operations.js:989` `acquirePEPortfolioCompany` | `pe-ui-adapter.js:409` | cash, subsidiaries, fund deal | yes (CODE) | commit | yes | none | functional | — | **GAP** (atomicity CODE only); seventh pass: refused for a sold company (#986 merged `98ad2bae`, preview `reason:'company-sold'` and execution-time recheck; NODE + WEBKIT, main job 116144067435) |
| W-PE-LEGACY-CREATE | `expansion.js:600` `createPEDeal` | UI `app.js:921` (`app.js:636`) | cash, `peDeals`, subsidiaries (RNG) | **no** | direct save, ignored | `acquisition` | none (REPRO: save-throw keeps −20,000,000 durable) | functional | — | **VERIFIED** (fourth pass: #958 merged `69ee8695`; NODE + WEBKIT on main `ee4f37f5`, `pe-acquisition-atomicity` job 115638242270) |
| W-PE-LEGACY-EXIT | `pe-value-creation.js:299` → `expansion.js:604` | UI `app.js:921` (`app.js:646`) | cash, P/L, deal status, subsidiary removal | **no** | direct save, ignored | `assetSale` | none (REPRO: save-throw keeps +19,081,707 durable) | functional | — | **VERIFIED** (fourth pass: #959 merged `6303cccf`; NODE + WEBKIT on main `ee4f37f5`, job 115638242270) |
| W-PE-LEGACY-TRANSFER | `pe-value-creation.js:344` → `expansion.js:621` | UI `app.js:926` | company/personal cash, owner account | yes | commit | `acquisition` | reload only | functional | — | **GAP** (no SF/HY); seventh pass: a sold company's company-account transfer / exit / create / initiative are refused with no state, save, RNG or ledger change, founder's personal PE actions and refounded company actions kept (#986 merged `98ad2bae`; NODE + WEBKIT, main job 116144067435) |
| W-ANGEL | `expansion.js:605/606` | UI `app.js:922` | personalCash, `angelInvestments` | **no** | direct save | none | none (REPRO) | none | — | **VERIFIED** (fourth pass: #962 merged `89be3642`; NODE + WEBKIT on main `ee4f37f5`, job 115638242602) |
| W-SUB-IPO | `subsidiary-ipo-preparation.js:59/60` → `engine.js:1518` | UI `app.js:910`, `ma-portfolio-summary-ui.js:26`, prep UI `:69` | sub ownership −15%, book, cash, ticker (RNG) | yes | commit | `investmentSale` | none (tests use a stub `runTransaction`) | `subsidiary-ipo-preparation-test`, `finance-subsidiary-ipo-test` | — | **GAP** |
| W-SUB-IPO-STAKE | `subsidiary-ipo-secondary-sale.js:22` | module UI | cash, ownership, book, `cumulativeProfit` | yes (CODE) | commit | `investmentSale` **without `assetEffect`** (unverified ledger concern) | none (stub engine) | `subsidiary-ipo-secondary-sale-test` | — | **GAP** (ledger to verify) |
| W-SUB-MARKET-RENDER | `listed-subsidiary-market.js:43-45` `catchUp` → `distributeQuarterlyDividend`, reached from `ensure()` via `snapshot()` / `allSnapshots()` in `renderSection` (venture tab render) as well as `normalize` and the module actions | render / load / actions | `companyCash`, `sub.subsidiaryCash`, `parentDividendsReceived`, `marketPriceIndex`, valuation, `dividendIncome` ledger event | **no** — the module has no `advanceWeek` hook, so a due quarterly parent dividend is booked at render time outside any transaction | not saved by the render; persisted by the next unrelated save | `dividendIncome` | none | functional | — | **VERIFIED** (fourth pass: #974 merged `ec3ca0b0`; catch-up and parent dividend only inside the week; render / load read-only; legacy-lag guard; listing base fixed at IPO / relisting; NODE + WEBKIT, job 115638242512) |
| W-SUB-OTHER | `listed-subsidiary-control-actions.js:22` (TOB/squeeze-out), `listed-subsidiary-market.js:51` (buy/sell stake, dividend policy), `listed-subsidiary-follow-on-offering.js:23`, `subsidiary-relisting-options.js:20`, `group-restructuring-candidates.js:27`, `internal-venture-business.js:101/104/113` | module UIs | subsidiary ownership/cash | yes (CODE) | commit | yes | none (TOB test uses a stub engine) | functional | — | **GAP**, partly covered (fourth pass): group-restructuring sale / liquidation / merge / integration accounting fixed by #977 (`ee4f37f5`, NODE + WEBKIT); group capital allocation exactness fixed by #980 (`799878b1`, NODE + WEBKIT); TOB / follow-on / relisting / internal-venture writers still without writer-specific fault tests |

### 2.3 Weekly and load paths

| ID | Location | Writes | Boundary | Evidence | Verdict |
|---|---|---|---|---|---|
| W-WEEK-MARKET | `engine.js:1836-1838` `updateMarket` | all prices (floor `Math.max(10,…)`), own stockPrice/issuedShares/marketCap, priceHistory | WK | CODE + generic `week-transaction-atomicity` / `transaction-regression` | **GAP** — boundary verified by CODE only; no writer-specific fault / HY / WebKit test (generic week tests use a private company) |
| W-WEEK-COMPETITOR | `engine.js:2142` `updateCompetitors` → `engine.js:2124` `buyCompetitorStake` | competitorOwnedRatio, named `ownedPlayerShares`, competitor cash | WK | NODE (rule, malformed / legacy, composite share swap / buyback / personal own-ticker, 120-week sum = 1, determinism, reload) + WEBKIT (in-transaction purchase, 12 weekly commits, reload, fresh IDB) — `competitor-stake-float` | **GAP** (save-fault) — purchase rule NODE + WEBKIT (eighth pass: #993 merged `743d08d1`; float from P3-2 `ownershipReconciliation`, 49 % aggregate cap, whole shares, unknown ownership → zero fill, no new RNG), but no writer-specific save-fault rollback / HY test: `competitor-stake-float` stubs `save`, the WebKit test covers successful commits only, and the generic week rollback tests use a private company, so the purchase never runs in them |
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

## 3d. Remediation status — fourth pass (2026-10-14, main `ee4f37f5`)

Merged since the third pass (each with main CI green after merge): #958, #959, #960, #961, #962 (#954 / price floor), #970 and #972 (CI only), #973 (#971), #974 (#966), #977 (#975). §2 verdicts above were updated for the merged writers. WEBKIT = real WebKit 26.5 (Playwright, iPhone 13 emulation, real IndexedDB) in GitHub Actions; physical iPhone: **NOT RUN** for every row.

| Writer / defect | Fix | State | Node | WebKit | Verdict on main |
|---|---|---|---|---|---|
| W-PE-LEGACY-CREATE / EXIT | #958 / #959 | merged | writer fault matrix | `pe-acquisition-atomicity` on main (job 115638242270) | VERIFIED |
| W-MAKE-SUB, W-ANGEL | #961 / #962 | merged | writer fault matrix | `vc-funding-atomicity` on main: makeSubsidiary 11/11, angel create / exit 22/22 (job 115638242602) | VERIFIED |
| W-SPLIT (price floor) | #960 | merged `f755de4b` | boundaries, ratios, at-floor faults | `stock-split-atomicity` on main (job 115638242292) | VERIFIED |
| VC / M&A subsidiary quarterly cash (#971) | #973 | merged `4114df55` | quarters 13–52, 60 weeks, faults | `vc-secondary-atomicity` | fixed |
| W-SUB-MARKET-RENDER (#966) | #974 | merged `ec3ca0b0` | weeks 17–60 render read-only, legacy-lag guard, IPO / relisting base | 11/11 (PR job 115585938361; main job 115638242512) | VERIFIED |
| Group-restructuring disposals (#975) | #977 | merged `ee4f37f5` | sale / liquidation / negotiated / listed / merge / integration, legacy fractional book, 13 weeks; PE-managed subsidiaries refused (Owner-approved) | 24/24 (PR job 115627626327) | fixed |
| Group capital allocation floors cash / book (#978) | #980 | **open**, Final Gate technical PASS, Owner approval pending | VC / M&A / fractional book, 9 fault kinds | 15/15 (PR job 115646414493) | GAP until merged |
| W-NEW-COMPANY ledger (#968) | #983 | **open**, Final Gate technical PASS except Codex (usage limit), Owner approval pending | store / digital / PE deals, 13 weeks | store and digital ×2 (PR job 115656698873) | GAP until merged |
| W-NEW-COMPANY atomicity (#955) | #965 | open; to be synced to main after #983 (conflict resolution recorded in #983) | — | — | GAP |
| W-DECLINE-BUYOUT, W-FORCE-EARNINGS | #963 / #964 | open (unchanged by Owner instruction) | — | — | GAP |

New findings in this pass:

| Issue | Severity | Summary | Status |
|---|---|---|---|
| #976 | Owner decision | listed-subsidiary quarterly dividend recognises profit already booked weekly; A / B / C compared over 52 / 100 weeks (design audit comment on #976) | no economic change |
| #978 | P1 | group capital allocation floors company cash and book without a ledger row; any fractional-cash game fails the next close | fix PR #980 |
| #979 | Investigation | legacy saves already broken by pre-#977 disposals; one-time repair design only, no automatic migration (Owner decision) | open |

Track A completion conditions after the fourth pass:

| # | Condition | Status |
|---|---|---|
| 1 | Writer list completeness | Partial (pattern sweep) |
| 2 | State destinations | Met (CODE) |
| 3 | Save / rollback boundary | Improved: #954 writers and #966 merged; #955 (#963 / #964 / #965) still open |
| 4 | Node regressions registered | Improved on main; open PRs #963 / #964 / #965 / #980 / #983 |
| 5 | WebKit need / evidence | Improved on main (all #954 writers, listed-subsidiary quarter, disposals); still missing for open PRs and several subsidiary writers (§2 W-SUB-OTHER) |
| 6 | Accounting / ownership invariants | **Not met**: #978 and #968 open; founder + competitor > 1; D3 / D4; #976 decision pending |
| 7 | Unresolved P0/P1 recorded | Met (#955, #968, #978; #976 / #979 recorded) |
| 8 | Executable CI gate | Met for the audited writer modules (#972 merged); new tests registered with path filters |
| 9 | Missing writers explicit | Met |
| 10 | Independent diff audit | Partial: Codex automated review for #974 / #977 / #980; #983 reviewed by an independent agent because Codex hit its usage limit |

**Track A verdict: still BLOCKED.** P3-4 Ownership Authority Cutover remains STOPPED; Phase 4 production development not started.

## 3e. Remediation status — fifth pass (2026-10-14, main `3ceb67c2`)

Merged since the fourth pass, each by Owner approval with main CI green after merge (42 success / 8 skipped / 0 failed): #980 (#978, merge `799878b1`) and #983 (#968, merge `3ceb67c2`). Evidence levels are kept separate: **review** (Codex automated review on GitHub, or a same-session subagent audit — the latter is *not* an external independent review), **NODE** (canonical shards), **WEBKIT** (real WebKit 26.5, iPhone 13 emulation, real IndexedDB, GitHub Actions), **iPhone** (physical device: NOT RUN for every row).

| Writer / defect | Fix | State | Review | Node | WebKit | Verdict on main |
|---|---|---|---|---|---|---|
| Group capital allocation floors cash / book (#978) | #980 | merged `799878b1` | Codex: no findings | VC / M&A / fractional book, exact cash and book, 9 fault kinds + pending, 13 weeks | 14/14 on main (job 115675782799, artifact 11869049646) | fixed |
| W-NEW-COMPANY ledger (#968) | #983 | merged `3ceb67c2` | Codex **NOT RUN** (usage limit); same-session subagent audit: no defects | store / digital / with PE; PE owner × status matrix (company / personal / legacy × active / exited); production `acceptBuyoutOffer` end to end; no host RNG draws; 13 weeks; reload; fresh hydration | store and digital ×2 on main (job 115691151076, artifact 11871551628) | fixed (ledger only) |
| W-NEW-COMPANY atomicity (#955) | #965 | **open**; synced to main, HEAD `55ded6c2`; Final Gate reported; merge requires a separate Owner approval | Codex on `55ded6c2`: no major issues (two P2 findings on earlier heads fixed: success toast only after the commit; founded investment = the contribution actually made); same-session subagent audits: no defects | 8 rollback fault kinds nested and not nested, pending save-false / save-throw, no success toast without a commit, notify listener fault after the commit, root identity, single commit, opening book = contribution, founded-investment normalization, 13 weeks | 12/12 through the real legacy-tab flow, no success toast on any rollback (PR job 115721067700, artifact 11875681292) | GAP until merged |
| W-DECLINE-BUYOUT, W-FORCE-EARNINGS | #963 / #964 | open (unchanged by Owner instruction) | — | — | — | GAP |

Owner-approved rule recorded with #983: at a sale, active company-owned PE deals stay with the sold company — `companyValue()` already prices each as its PE subsidiary (valuation × ownership = deal value) and the founder is paid that value. Exited company deals (history), personal deals and legacy deals (no `ownerAccount`, read as personal) are carried to the new company unchanged. The new company's opening cash and opening equity equal the founder's contribution; personal cash falls once by that amount.

Correction to §3d condition 10: the #983 review recorded there as "an independent agent" was a subagent of the same session, not an external independent review.

New findings in this pass:

| Issue | Severity | Summary | Status |
|---|---|---|---|
| #985 | P2 | `transferPEDealToCompany` / `exitPEDeal` remain callable on deals of a sold company after refounding (REPRO: personal cash +29,792,183) | open, not fixed |
| — | cross-cutting | other `runTransaction` commands still emit their success toast inside the transaction, so a failed save can leave it on screen (state is rolled back). Fixed for refounding in #965 (Codex P2); not changed elsewhere | recorded; Owner decision for a cross-cutting change |

Track A completion conditions after the fifth pass:

| # | Condition | Status |
|---|---|---|
| 1 | Writer list completeness | Partial (pattern sweep) |
| 2 | State destinations | Met (CODE) |
| 3 | Save / rollback boundary | Improved; #955 (#963 / #964 / #965) still open |
| 4 | Node regressions registered | Improved on main (#980, #983); open PRs #963 / #964 / #965 |
| 5 | WebKit need / evidence | Improved on main (capital allocation, refounding ledger); still missing for open PRs and several subsidiary writers (§2 W-SUB-OTHER) |
| 6 | Accounting / ownership invariants | **Not met**: founder + competitor > 1; D3 / D4; #976 decision pending; #979 legacy saves |
| 7 | Unresolved P0/P1 recorded | Met (#955; #976 / #979 / #985 recorded) |
| 8 | Executable CI gate | Met for the audited writer modules; new tests registered with path filters |
| 9 | Missing writers explicit | Met |
| 10 | Independent diff audit | Partial: Codex automated review for #974 / #977 / #980; #983 had no Codex review (usage limit) and only a same-session subagent audit |

**Track A verdict: still BLOCKED.** P3-4 Ownership Authority Cutover remains STOPPED; Phase 4 production development is NOT AUTHORIZED.

## 3f. Remediation status — sixth pass (2026-10-14, main `6250aef7`)

Merged since the fifth pass, by Owner approval with main CI green after merge (43 success / 10 skipped / 0 failed): #965 (#955 W-NEW-COMPANY atomicity, merge `6250aef7`). Evidence levels as in §3e: **review** (Codex on GitHub; a same-session subagent audit is *not* an external independent review), **NODE**, **WEBKIT** (real WebKit 26.5, iPhone 13 emulation, real IndexedDB, GitHub Actions), **iPhone** (physical device: NOT RUN for every row).

| Writer / defect | Fix | State | Review | Node | WebKit | Verdict on main |
|---|---|---|---|---|---|---|
| W-NEW-COMPANY atomicity (#955) | #965 | merged `6250aef7` | Codex: no major issues on the merged head (two P2 findings fixed: success notice after the commit; founded investment = contribution made); two same-session subagent audits: no defects | 8 rollback fault kinds nested and not nested, pending writes, root identity, single commit, opening book = contribution, 13 weeks | 12/12 on the PR (job 115721067700); main job 115775723281 success | **VERIFIED** |
| W-DECLINE-BUYOUT (#955) | #963 | **open**, Final Gate reported at `e049c521`; merge needs a separate Owner approval | Codex: P1 (stake capped at the remaining external float) and P2 (decline notice after the commit) fixed; one P2 left open as an Owner decision (a notice for a *nested* call needs an engine-level deferral queue; no production caller nests) | 8 fault kinds × nested × hostile/friendly, pending writes, ratios sum to 1 (incl. founder-owned and 1% float), notice count/order, post-commit notice fault | 22/22 (job 115802566585) | GAP until merged |
| W-FORCE-EARNINGS (#955) | #964 | **open**, Final Gate reported at `9ad9d3e5`; merge needs a separate Owner approval | Codex: no major issues | applicable fault kinds + pending, RNG rolled back with the state, single render | PASS through the real market-tab button (job 115817570711) | GAP until merged |
| W-PE-LEGACY-TRANSFER / company exit / company create / company initiative / W-PE-TO-PARENT after a sale (#985, P2) | #986 | **open**, Final Gate reported at `0ef889d3`; merge needs Owner approval | Codex: no major issues | refusals change nothing (live, mirror, cache, durable, saves, RNG); personal actions allowed; refounding re-opens; legacy save; parent acquisition refused | 6/6 in `pe-acquisition-atomicity` (job 115828303834) | GAP until merged |

Findings recorded in this pass:

| Item | Severity | Summary | Status |
|---|---|---|---|
| #985 | P2 (kept) | five PE writers let a sold company pay (transfer +31.8M to personal cash, company exit, create, initiative, parent acquisition with 246M GP carry); ledger stays valid and no route raises net worth beyond an equal-value swap or the external-exit amount, so it is an authority defect, not P1 | fix PR #986 |
| Success notice before commit (cross-cutting) | Owner decision | read-only inventory: ~95 command sites in ~40 files emit a success/info notice inside a transaction (class A), 14 inside the weekly transaction (class C); ~22 became false-on-failure when wrapped by #915–#962. Fixed per writer only for refounding (#965) and buyout decline (#963). Recommended shared fix: engine-level deferral queue (notice after the outermost commit, dropped on rollback; `fail()` stays immediate), with the harness `notify` fault becoming a post-commit contract — needs Owner approval before any change | not changed |
| CI transient failures | — | shard H 30-min cap once (rerun 21.5 min PASS); strategy-balance child process 180 s cap once (local ~70 s, identical output; next head PASS); iPhone playtest `play.html` navigation cancelled once (next head PASS); one real failure fixed (Phase 0.5 writer inventory after a code change, regenerated with `--refresh-writers`) | recorded |

### Phase 3 completion readiness (checklist only — Phase 3 is **not** complete)

Sources: `PHASE_3_ENTRY_CONTRACT.md` (staged implementation, P3-12 row), `PHASE_3_P3_3_CONTRACT.md` (P3-4 adoption requirements, verification), `ECONOMIC_ENGINE_ROADMAP.md` (Phase 3 exit criteria), this document §5.

| Step | Status per the repository |
|---|---|
| P3-0 entry contract | done (#910) |
| P3-1 read-only identity/holding projection | done (#911) |
| P3-2 read-only issued = treasury + outstanding, founder counted once | done (#912; correction #913) |
| P3-3 issuer-family adoption and writer contract | doc done (#914); not an authority cutover |
| P3-4 player-company ownership cutover | **STOPPED**; only atomicity corrections exist (P3-4-001..008: #915–#921 and #937; Track A writer fixes: #951–#965) |
| P3-5 .. P3-11 (listed holdings, subsidiary/M&A, PE, VC adapters, Control Ladder, command/UI integration, founder wealth projection) | not started (no evidence) |
| P3-12 permanent acceptance / exit review | not started |

| Exit Gate item | Status |
|---|---|
| Roadmap exit: one ownership foundation represents listed shares, subsidiaries, PE, VC and founder ownership | **Not met** (P3-5..P3-8, P3-11 not started) |
| Approved issuer-family coverage | **Not met** (P3-4 stopped) |
| ECO-010 / ECO-011 | read-only diagnostics only; §5 condition 6 not met (founder + competitor > 1 on main until #963 merges; D3 / D4) |
| Save V9 / SAVE_KEY / old-save compatibility | held by every PR (no format change, no migration; #979 repair stays investigation-only) |
| Determinism | held per PR (no new RNG; transaction rollback restores RNG; strategy / Phase 0.5 / determinism contracts green) |
| Accounting invariants | per-writer validate at once and 13 weeks for fixed writers; Track A condition 6 not met |
| Required WebKit gates | jobs `stock-split-atomicity`, `pe-acquisition-atomicity`, `vc-funding-atomicity`, `vc-secondary-atomicity` (+ `ma-economic-gate`); still missing for MBO, defense, setDividend, buyback, activism, dividend payment, sponsor/turnaround, subsidiary IPO, financed M&A failure paths (§5 condition 5) |
| Independent A–L audit | **Not met** (Codex per PR; same-session audits are not independent) |
| Physical iPhone | product baseline accepted (Gate C complete, #787 — `ECONOMIC_ENGINE_ROADMAP.md`); per-writer physical-iPhone runs for the Track A atomicity fixes: **NOT RUN** (CI real-WebKit evidence only) |

Ownership Authority Cutover prerequisites (P3-3 "P3-4 writer-adoption requirements" 1–6 and verification list) remain unmet: one authority per fact with every writer and bypass path reaching it, pre-validate then commit in one outer transaction (now true for the §2 VERIFIED writers only), exactly-once cash/ledger, replay without new RNG, eligibility separate from effects, and tests over all writers/bypasses. Open P0/P1 blocking exit: #955 until #963 and #964 merge; D3 (founder ratio stale after a share swap) and founder + competitor > 1 belong to the stopped cutover.

**Track A verdict: still BLOCKED.** Phase 3 completion is **not** declared; P3-4 Ownership Authority Cutover remains STOPPED; Phase 4 production is NOT AUTHORIZED.

## 3g. Remediation status — seventh pass (2026-10-14, main `98ad2bae`)

Merged since the sixth pass, one at a time by Owner approval, each with main CI complete after the merge. Evidence levels as in §3f.

| PR | Concern | PR head | Merge (main) | Tree (merge-test of head into main, computed before merge = main tree after merge) | Main CI after merge | Main WebKit |
|---|---|---|---|---|---|---|
| #963 | #955 W-DECLINE-BUYOUT ratios + atomicity | `e049c521` | `4a7e20c6` | `e1da470f` | 42 success / 8 skipped / 0 failed | `stock-split-atomicity` job 116062799056 (hostile buyout decline step success) |
| #991 | #988 (P1, Owner option A) read-only 「決算イベントを確認」; forced earnings refused | `1f71e73d` | `3393bbf9` | `17c5d28e` | 42 / 8 / 0 | job 116120820287 (earnings confirm read-only step success) |
| #986 | #985 (P2) sold-company company-account PE actions fail closed | `79260414` (`0ef889d3` + main) | `98ad2bae` | `8a6d2997` | 42 / 8 / 0 | `pe-acquisition-atomicity` job 116144067435 success |

Closed without merge: #964 (W-FORCE-EARNINGS transaction wrapper). After #991 its only production change wrapped the forced path that #991 removes; the weekly path already runs inside `advanceWeek`'s transaction; its "one tap = one committed event" contract contradicts the approved read-only spec. Recorded on #964.

| Writer / defect | Review | Node | WebKit | Verdict on main |
|---|---|---|---|---|
| W-DECLINE-BUYOUT (#955) | Codex: P1 (stake capped by remaining external float) and P2 (notice after the commit) fixed; P2 nested-call notice **accepted by the Owner as a known limitation, unresolved** (thread left open on #963; recorded on #969; only caller is the UI) | 8 fault kinds × nested × hostile/friendly, pending, ratio sum = 1, live = reload | 22/22 on the PR; main job 116062799056 | **VERIFIED** |
| W-FORCE-EARNINGS / #988 | Codex: one P2 (countdown after IPO) fixed in `1f71e73d`, re-review on the merged head: no findings; same-session subagent audit (not independent): no P0/P1 | RED on the previous main (forced call returned `true`; the two replaced determinism tests failed); GREEN: 50 views + 50 forced calls unchanged (listed, profit/loss), unlisted refused, 2,000 uses then founder / personal sale at the unchanged price, formal quarters at +13/+26 deterministic, legacy save, IPO countdown | 5 taps × latest-result / no-result views, no live/mirror/cache/durable change, no save, no event; main job 116120820287 | **VERIFIED** |
| #985 sold-company PE authority | Codex: no major issues (on `0ef889d3`); the merged head only adds main | five company-account actions refused with no state/save/RNG/ledger change (direct writer calls); parent acquisition preview `company-sold` and refused at execution after a pre-sale eligible preview; personal create/exit/initiative allowed with company cash untouched; refounding re-opens; legacy save | 6/6 on the PR; main job 116144067435 | **VERIFIED** (authority); §2 W-PE-TO-PARENT / W-PE-LEGACY-TRANSFER atomicity rows stay GAP |

Issue state on GitHub at this pass: #955 closed by the #965 merge (09:16 UTC), before #963 and #991 merged; all three of its writers are now resolved on main; #988 closed by #991; #985 closed by #986; #954 still **open** although all four of its writers are fixed on main (#958 `69ee8695`, #959 `6303cccf`, #961 `1d2a2d83`, #962 `89be3642`) — closing it is an administrative step; #969 open (P2, success notice inside transactions incl. the nested-call limitation); #976 open (Owner decision; option C is design only); #979 open (investigation only).

**Open P0/P1 at this pass:** no open P0. No open P1 writer defect in §3 (the remaining P1 items are closed or fixed on main). Not P1-labelled but blocking the Phase 3 exit: D3 (founder ratio stale after a share swap, §2 W-SHARE-SWAP) and D4 (founder + competitor > 1). D4 is fixed for the decline path by #963 but, by CODE reading, still reachable through the weekly `engine.js` `updateCompetitors` stake purchase (`competitorOwnedRatio + qty/sharesOut`, capped at 0.49 only) — not re-reproduced in this pass.

**Known P2 (not blocking this pass):** #969 success notice before commit (cross-cutting; a shared deferral queue is approved as the target design, production implementation not approved); nested-call notice for `declineInboundBuyoutOffer` / `announceFoundedCompany`; W-INVESTOR-AUX; IPO early `change` emit (D7); the market card countdown `weeksUntilNextEarnings()` can differ from the read-only view right after an IPO (display only; unchanged because it also feeds advisor text written into state).

### P3-4 Ownership Authority Cutover — why it stays BLOCKED (STOPPED)

1. D3 / D4 ratio correctness (economic correctness; any repair of live saves needs an Owner decision — no automatic save repair).
2. Writer Authority Matrix still has GAP rows on ownership writers: W-SHARE-SWAP correctness, W-MBO / W-DEFENSE (no WebKit), W-DIV-SET / W-BUYBACK / W-DIV-PAY (partial or no fault sets), W-SPONSOR / W-TURNAROUND-*, W-MA-EQUITY-RAISE, W-SUB-IPO / W-SUB-IPO-STAKE / W-SUB-OTHER, weekly W-WEEK-* rows (CODE only).
3. WebKit gates missing for those rows (§5 condition 5).
4. No single ownership registry authority: P3-3 adoption requirements 1–6 (one authority per fact with every writer and bypass reaching it; pre-validate then one outer commit; exactly-once cash/ledger; replay without new RNG; eligibility separate from effects; tests over all writers/bypasses) are unmet.
5. Independent A–L audit not performed (Codex per PR; same-session audits are not independent).
6. Branch protection: **unverified** (the API returns 403 to this session; no evidence either way), so CI gates are treated as advisory evidence only.

### P3-5 .. P3-12 dependencies (none started)

The *Nature* column restates `PHASE_3_ENTRY_CONTRACT.md` (staged implementation table). The contract lists each slice's concern and acceptance boundary but states **no** inter-slice dependencies or ordering permissions; the *Depends on* and *Can start before P3-4?* columns are this audit's own inference, for an Owner decision, not contract text.


| Slice | Nature | Depends on | Can start before P3-4? |
|---|---|---|---|
| P3-5 external listed holdings adapter | read-only adapter (no quote / Phase 9 settlement cutover) | P3-1 identities (done) | yes, as a read-only projection with no persisted root and no writer change |
| P3-6 subsidiary / M&A relationship adapter | read-only adapter (acquisition / cash writers keep authority) | P3-1; D3 must not be masked (share swap ratio) | yes (read-only); must report stale ratios, not hide them |
| P3-7 PE ownership adapter | read-only adapter (no fund/deal settlement change) | P3-1 | yes (read-only) |
| P3-8 VC ownership adapter | read-only adapter (unknown voting stays unknown) | P3-1 | yes (read-only) |
| P3-9 Control Ladder eligibility projection | read-only projection | P3-5..P3-8 inputs; D4 (ratios) for the player company | preparation only (projection without new actions) |
| P3-10 command / UI integration for one issuer family | **writer change** | P3-4 cutover for that family, P3-9 | **no** |
| P3-11 founder wealth read-only projection | read-only (consumers unchanged until a separate cutover) | P3-2 (done), P3-5..P3-8 for indirect interests | preparation only |
| P3-12 permanent acceptance / exit review | gate | all of the above, ECO-010/011/012/015/016/017/021, independent A–L audit | **no** |

**Track A verdict: still BLOCKED.** Phase 3 completion is **not** declared; P3-4 Ownership Authority Cutover remains STOPPED; Phase 4 production is NOT AUTHORIZED.

## 3h. Remediation status — eighth pass (2026-10-15, main `743d08d1`)

Merged since the seventh pass, one at a time by Owner conditional approval, the second only after main CI for the first completed. Evidence levels as in §3f. The Phase 0.5 writer inventory was regenerated in #992 (`ma-deal-room.js` no longer writes ratios directly).

| PR | Concern | PR head | Merge (main) | Tree (merge-test of head into main = main tree after merge) | Main CI after merge | Main WebKit |
|---|---|---|---|---|---|---|
| #992 | D3 share-swap ownership ratios (`issueSharesToExternalHolders`) | `d2139124` | `d0802d88` | `b575b387` | 42 success / 9 skipped / 0 failed (Pages publication-attestation finished before the Pages deployment; one failed-job rerun passed) | `stock-split-atomicity` job 116271164874 (share swap ownership ratios step success) |
| #993 | D4 competitor stake purchase from the external float (`buyCompetitorStake`) | `6673c297` (synced with main after #992; test registration merged as a union) | `743d08d1` | `e6653644` | all push-triggered workflows success, 0 failed (Pages publication-attestation again finished before the Pages deployment; one failed-job rerun passed) | `stock-split-atomicity` job 116299892888 (D3 and D4 competitor stake steps success) |

| Writer / defect | Review | Node | WebKit | Verdict on main |
|---|---|---|---|---|
| W-SHARE-SWAP correctness (D3) | Codex: no major issues; same-session subagent audit (not independent): no P0/P1 | RED on the previous main (`competitor keeps its share count: 210000 != 190000`; live sum 1.0909, reload 1); GREEN through `closeMADeal`, `completeTargetAcquisition`, an outer transaction, the legacy `acquireTarget`; treasury / competitor / founder 100 % / competitor 49 %; reload, fresh hydration, determinism; save-fault harness asserts dilution on every retry | rejected save rolls ratios back; exact dilution; reload; fresh context | **VERIFIED** |
| W-WEEK-COMPETITOR (D4 weekly purchase) | Codex: one P1 (personal own-ticker shares counted as float) and five P2 (malformed / null quantities, missing ticker binding, third-party aliases wrongly rejected, present-null stake or ratio) all fixed before merge; re-review on the merged head: no major issues; same-session audit P1 fixed | RED on the previous main (sum 1.01 by week 74; named +5,000 vs ratio +4,750 shares; purchases past 49 %); GREEN: rule, malformed / legacy / unknown-ownership zero fill, composite share swap → purchase, personal own-ticker → purchase, production buyback → purchase, cap reached, zero float, 120 weekly commits with sum = 1, 60-week determinism, reload | in-transaction purchase (fill 5,000 then 0), 12 weekly commits, reload, fresh context | **GAP** (rule fixed and verified; atomicity under save faults not tested for this writer — §1 requires it) |

### Remaining ownership-ratio writers (re-evaluated on `743d08d1`)

| Writer | State on main | Evidence | Next step |
|---|---|---|---|
| W-MA-EQUITY-RAISE (`ma-acquisition-financing.js:336-338`) | public offering adds shares; founder and external ratios recomputed, **competitor ratio not diluted** (competitor shares 190,000 → 194,000 in the PR's RED run) | REPRO (Node, PR #994) | PR #994 reuses `issueSharesToExternalHolders`; cash / debt / proceeds / capital surplus unchanged; Final Gate reported at `7ac82961` (CI 29 / 10 / 0, WebKit job 116305403668, Codex: no major issues, tree `0fd59972`); merge needs a separate Owner approval |
| W-DEFENSE (`expansion.js:609`) — §3 **D4 as first recorded** | lowers `competitorOwnedRatio` without recomputing ratios: live sum 0.95, reload external 0.0632 → 0.1132 (founder 0.7368, competitor 0.2 → 0.15, poison pill) | REPRO (Node, this pass) | not fixed by #993 (which fixed the weekly purchase that the seventh pass also called D4); P2, unchanged since the first pass; a fix needs an Owner decision (which holder the released stake goes to) |
| W-TURNAROUND-SETTLE (`player-crisis-turnaround-fund.js:186`) | ratchet adds shares and calls `updateOwnershipRatios` only; competitor would not be diluted if it can run after an IPO | CODE (whether the ratchet can settle after an IPO is **unverified**; fund acceptance and sponsor / investor offers refuse after an IPO) | verify reachability before any change |
| Named competitor holdings vs aggregate ratio | not synchronised by stock split (named not rescaled), defense (ratio only), decline buyout (ratio only); a D4 fill advances both by the same filled quantity but does **not** reconcile an existing discrepancy (the decline-path test keeps named 5,000 while the earlier aggregate stake stays unattributed) | CODE + NODE (`competitor-stake-float`) | P2; the aggregate ratio is the authority (#992); no automatic save repair |
| `issueSharesToExternalHolders` hardening | uses `treasuryBuybackShares` without a finite check (NaN on a corrupt state) and does not clamp the competitor to 0.49 (dilution only lowers it) | CODE (same-session audit of #994) | P2, no reachable production path found |
| `playerShareAcquisitionCapacity` | ignores competitor holdings | CODE | P2 (Owner triage) |

### WebKit gaps on ownership writers after this pass

W-MBO, W-DEFENSE, W-ACTIVISM-NEG/REJ, W-BUYBACK (partial fault set), W-DIV-SET / W-DIV-PAY, W-SPONSOR / W-TURNAROUND-*, W-SUB-IPO / W-SUB-IPO-STAKE / W-SUB-OTHER, W-PE-TO-PARENT / W-PE-LEGACY-TRANSFER atomicity, and the CODE-only weekly rows (W-WEEK-MARKET / STARTUPS / PE / EXPANDED / CAPALLOC). W-MA-ACQUIRE / W-MA-EQUITY-RAISE have a WebKit happy path on main and a financed-closing ratio WebKit test in #994; no WebKit save-failure test for the financed boundary.

### Independent audit scope (unchanged requirement, narrowed inputs)

Every review in this pass is Codex per PR plus same-session subagent audits (not independent). An independent A–L audit should cover at least: the ownership ratio authority (aggregate ratio vs named holdings vs P3-2 `ownershipReconciliation`), all share-issuing writers (share swap, M&A equity raise, IPO, investor / sponsor / turnaround, split), the competitor purchase float rule, W-DEFENSE, and the M&A financing shadow-state boundary.

### §5 completion conditions at this pass (§5 itself is the first-pass table, kept for history)

| # | Condition | Status at the eighth pass |
|---|---|---|
| 4 | Required Node regression tests registered | **Not met** — GAP rows remain (§2), including the W-WEEK-COMPETITOR save-fault set |
| 5 | WebKit need decided with evidence | **Not met** — list above |
| 6 | Accounting / ownership invariants | **Not met** — D3 and the weekly purchase are fixed; remaining: W-DEFENSE ratio fork (REPRO), W-MA-EQUITY-RAISE (#994 open), founder + competitor > 1 through a buyback (`playerShareAcquisitionCapacity` ignores the competitor; CODE, not re-reproduced in this pass) |
| 7 | Unresolved P0/P1 recorded | **Met** — none open (#953, #954, #955 closed or fixed on main) |
| 1, 8, 10 | Writer list completeness / executable CI gate / independent diff audit | unchanged from §5 (Partial / Partial / Not met) |

Next steps (replacing §7 items 1–4, which are done on main: #957; #958 / #959 / #961 / #962; #963 / #965 / #991; #992 / #993): (1) #994 Owner decision; (2) Owner decision on the W-DEFENSE released stake and the named-vs-aggregate holding sync; (3) save-fault and WebKit coverage for the GAP rows above, one writer per PR; (4) independent A–L audit.

**Open P0/P1 at this pass:** no open P0; no open P1. D3 and the weekly-purchase part of D4 are fixed on main. Remaining ownership items are P2 (above) and the open W-MA-EQUITY-RAISE fix (#994).

### P3-4 Ownership Authority Cutover — still BLOCKED (STOPPED)

Restated for this pass (supersedes §3g items 1–2; items 3–6 of §3g remain as written): (2) GAP rows on ownership writers — W-WEEK-COMPETITOR (save-fault / HY only; rule NODE + WEBKIT), W-MBO / W-DEFENSE (no WebKit), W-DIV-SET / W-BUYBACK / W-DIV-PAY (partial or no fault sets), W-ACTIVISM-NEG/REJ (no WebKit), W-SPONSOR / W-TURNAROUND-*, W-MA-EQUITY-RAISE / W-MA-ACQUIRE (financed failure paths), W-SUB-IPO / W-SUB-IPO-STAKE / W-SUB-OTHER, W-SHARE-SWAP-LEGACY (dormant, atomicity), and the CODE-only weekly rows W-WEEK-MARKET / STARTUPS / PE / EXPANDED / CAPALLOC; W-SHARE-SWAP is no longer a GAP. (1) ratio correctness narrows to: W-MA-EQUITY-RAISE (#994 pending), W-DEFENSE ratio fork, the turnaround ratchet reachability check, and the named-vs-aggregate holding sync (P2, Owner decision; no automatic save repair). P3-5..P3-8 read-only adapters stay independently workable (§3g table); P3-6 must report, not hide, any stale ratio left by the writers above. Shared notification queue: design only (#969). Phase 4 production: NOT AUTHORIZED.

## 4. CI gate observations

- `ma-acquisition-financing.yml` `pull_request.paths` omits modules that sit on audited writer chains: `js/difficulty-scenario-balance.js` (outermost IPO wrapper), `js/pe-fund.js`, `js/pe-value-creation.js`, `js/play-runtime-compat.js`, `js/shareholder-returns.js`, `js/shareholder-activism.js`, `js/ma-board-approval.js`, `js/ma-acquisition-financing.js`, `js/save*.js`, `js/finance.js`, `js/subsidiary-*.js`. A PR touching only those does not run the atomicity WebKit jobs; the push filter covers some via globs (`ma-*`, `save*`, `subsidiary-*`, `finance.js`) but not `pe-fund.js`, `pe-value-creation.js`, `difficulty-scenario-balance.js`, `play-runtime-compat.js`, `shareholder-*.js` — those rely on the nightly schedule. Changing the filters is a separate CI PR (proposal only).
- Node atomicity tests run in the canonical Test shards on every PR (no path filter).
- Every WebKit atomicity test drives the engine through `page.evaluate`; none goes through a UI click.

## 5. Track A completion conditions

*First-pass table (2026-10-12), kept for history. The current status is in the latest remediation pass (§3h).*

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

*First-pass order, kept for history: items 1–4 are done on main; the current next steps are in §3h.*

1. #953 activism accept/negotiate/reject → one outer transaction + Node/WebKit tests (duplicated cash effect).
2. #954 legacy PE create/exit, `makeSubsidiary`, angel → `runTransaction` + tests on the shared harness (#952).
3. #955 decline-buyout ratio + transaction; force-earnings UI path (Owner decision on RNG use); `foundNewCompanyAfterBuyout`.
4. D3 / D4 ratio recomputation (economic correctness; needs an Owner decision on whether to repair live saves — no automatic save repair).
5. Coverage: `setDividend`, buyback full fault set, dividend payment, MBO / defense WebKit, subsidiary IPO and listed-subsidiary writers (replace stub-engine tests with the real boundary).
6. CI path filters (§4) in a dedicated CI PR.
