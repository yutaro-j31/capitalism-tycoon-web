# P3-4-008 — successful stockSplit corrupts persisted price history (P1)

Base main: `22d546ff7e012d83a6fddc34b180a7a4032ac8ea` (#920). Discovered while fulfilling Owner-authorized P3-4-007 normal-behavior/history parity requirements. Production remains unchanged; P3-4-007 implementation and Ownership Authority Cutover are stopped under the Owner's explicit new-P0/P1 or save-data-corruption stop condition.

## Confirmed cause and effect

`engine.normalizeStockPriceHistory` and IPO/market initialization use records `{week,price}`. The installed `expansion.stockSplit` instead maps `x=>x/ratio`. Dividing a record produces NaN; normal save JSON serialization stores null. No injected storage or event error is needed. Normal constructor/static-load normalization discards those null observations and synthesizes recent fallback prices, permanently losing the original historical weeks and prices.

Actual installed command, own-company and external listed fixtures, with both personal/company lots:

| Stage | Price history |
|---|---|
| Before | week9=90, week10=96, week12=100 |
| Correct 1:2 adjustment for comparison | week9=45, week10=48, week12=50 |
| Successful live command | NaN, NaN, NaN |
| localStorage, IndexedDB cache and flushed durable JSON | null, null, null |
| Independent fresh VM hydrate and production load | week11=48, week12=50 |

Both own and external commands return true and save returns true. Personal lot20,000→40,000/company lot3,000→6,000; external split leaves the player-company root issued/founder/root price unchanged. Simulation RNG unchanged. These quantity controls establish an ordinary accepted split, not a refusal/failure fixture. This finding concerns lost price-history data, not a claim of cash loss or split-created wealth.

`node docs/economic-engine/reproductions/p3-4-008-stock-split-history-loss.cjs --assert-defect` verifies both installed families and all storage layers/fresh normalization (exit0 means defect confirmed). `--assert-fixed` is expected RED on this base. The reproduction uses production load order and isolated in-memory IDB transaction completion/fresh VM; no browser or physical-iPhone execution is claimed.

## Scope decision needed

P3-4-007 expressly preserves normal history calculation and is a minimal save/checkpoint-boundary concern. A shared runTransaction wrapper alone cannot prevent this corruption on successful splits. Correctly adjusting `row.price` while preserving week/metadata is a separate behavior correction. Neither silently changing it in the boundary PR nor blessing corrupted normal history as parity satisfies the Owner's conditions.

Proposed next decision: explicitly authorize a separate minimal P3-4-008 price-history correction, then resume P3-4-007 from fresh main. Retain numeric legacy-history handling through the existing normalize contract, valid ratio/quotes/quantities/averages/finance/RNG, SAVE_KEY/saveVersion9 and prior tests. Add own/external object-history tests for repeated split, save/reload/fresh hydration and no nonfinite/null history. Do not reconstruct or auto-repair already lost old-save history. Alternative sequencing must be explicitly approved; no two-concern correction is bundled here.

#920 main final CI is complete:36 applicable successful checks/8 inapplicable skips excluded, including main WebKit and stock-sale fresh IndexedDB regression. That closed gate does not validate stockSplit history. This branch is evidence only; no correction PR, merge or Gate PASS is claimed.
