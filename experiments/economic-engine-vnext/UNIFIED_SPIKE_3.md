# Economic Engine vNext — SPIKE-3 unified entity-aware general ledger

**Owner:** regular ChatGPT only, per [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).  
**Stack:** SPIKE-0 #1039 → SPIKE-1 #1041 → SPIKE-2 #1042 → SPIKE-3 (this draft PR).  
**State:** isolated experimental prototype. **NOT production-ready, not a Phase 3/4 writer/cutover, not save v9 migration**.

## Architectural question

Can we eliminate the SPIKE-1 **supplemental paid-in equity ledger** and record a full share subscription and a later store week in **one canonical financial state** owned by the SPIKE-2 core journal, while preserving both company and personal financial integrity?

**SPIKE-3 answer (narrow): yes, for cash-paid issuance and cash-basis store settlement in a bounded set of test scenarios.** This is not a claim that arbitrary transaction types are unified. Existing SPIKE-1's old \`equity.cjs\` is kept untouched for backward experiment regression; use **\`unified.cjs\`** to evaluate the replacement architecture. The earlier supplemental equity book is not referenced by the new \`unified.cjs\`.

## One operation, one source of financial truth

For 10 ordinary shares × **100 minor units/share** (¥1/share), amount=1000 minor units (¥10):

| Legal entity | Canonical account | Posting (minor units) |
|---|---|---:|
| Founder | \`founder:cash\` | -1,000 |
| Founder | \`founder:investment:company-ordinary\` | +1,000 |
| Company | \`company:cash\` | +1,000 |
| Company | \`company:paid-in:company-ordinary\` | -1,000 |

Every legal entity balances by itself and globally. \`core.journal\` owns these four postings **and** the immutable operation ID/receipt. Share-class metadata (issuer, authorized shares, votes/share) and the associated positions/issuance records serve as **nonfinancial authority**, verified against the same journal. There is **no** supplemental \`equityBalances\` book.

For the next store week, the existing SPIKE-2 \`store.planStoreWeek\` writes sales/materials/wages postings to that **same** \`core.journal\` and balances map, with a separate stable week receipt. Example: company starts with 10,000 minor units cash; share capital adds +1,000, then weekly cash operating profit adds +2,000 → cash closes at 13,000 minor units. \`core\` capital remains -1,000, founder investment +1,000, and operating revenue/expenses reflect exactly the store journal.

## Source-of-truth and validation contracts

- \`createUnifiedState(coreGenesis,shareClasses)\` permits only a fresh unmodified core genesis. It declares issuers/share classes with positive authorized shares and voting weight.
- \`planIssue / admitIssue\`: safe integer share counts and prices, BigInt multiplication before safe-integer conversion, no cash-free paid-in capital, no duplicate receipt, no oversubscription, no self-subscription, no insolvent subscriber. On adapter rejection/throw, neither issued shares nor company/founder cash changes.
- \`planWeek / admitWeek\`: the same unified object carries ongoing \`store.planStoreWeek\` state without modifying the capitalization metadata. On adapter rejection/throw, share ownership survives unchanged.
- \`validateUnifiedState\` replays and reconciles issued shares, holder cost basis, issuer paid-in capital, **exact four posted legs**, receipt ↔ journal identity, no unauthorized new investment/capital journal posting, and per-entity balance across *every* core journal operation in the unified state.
- **Direct SPIKE-0 raw \`transfer\` is intentionally prohibited** from unified states: its two cash legs are globally balanced but not per-entity double-entry and have no declared financial meaning. Valid core loan draw/repayment with matching asset/liability legs remain balanced and are allowed.
- \`snapshot\` reports share/vote ratios using exact string rational fractions, not rounded floating-point percentages.

### Why this differs from SPIKE-1

SPIKE-1 previously staged a \`core.planOperation(type='transfer')\` and updated a separate \`equityBalances\` collection to reconcile investor/issuer capital. This created two places to keep in agreement. SPIKE-3 writes all four legs to \`core.balances\` **under one operation**; share metadata is validated against the ledger rather than maintaining another financial amount authority.

## Validation evidence

To run these in a checkout containing all stacked experimental branches:

\`\`\`sh
node experiments/economic-engine-vnext/core.test.cjs
node experiments/economic-engine-vnext/equity.test.cjs
node experiments/economic-engine-vnext/store.test.cjs
node experiments/economic-engine-vnext/unified.test.cjs
\`\`\`

**Evidence from this session:** all **107 tests** of fetched exact GitHub code and test files passed in a **V8 CommonJS-compatible harness** with Node-style assertion shims: SPIKE-0 15, SPIKE-1 25, SPIKE-2 31, SPIKE-3 36. These are **not** actual Node process executions for the new SPIKE-3 branch. Actual Node, current PR HEAD CI, persistent IndexedDB, fresh-context hydration, WebKit/iPhone, and saveVersion-9 migration must be checked separately and cannot be inferred from this result.

The 36 SPIKE-3 tests cover both operation orders, company/founder/other investors, two voting classes, cap validation, cash conservation, receipt idempotency, multi-event journal, callback reject/throw, replay and tamper detection, unsupported raw transfer and balanced loan preservation. Internal account insertion order differs between operation orders, so tests compare **account/value tuples sorted by account**, not JSON object key order; the financial result is the same.

## Remaining architectural blockers and next gate

1. This code does **not** replace SPIKE-0's raw transfer or SPIKE-1's prior supplemental ledger. Those old experimental APIs remain runnable but are **not authorized** in unified mode. A later dedicated replacement and old-test compatibility strategy is necessary before asserting a fully unified engine.
2. The generic \`core.planOperation(type='journal')\` is low-level and accepts synthetic balanced book transactions. This is not a security or business-authorization policy; in production only **trusted event adapters** may author postings.
3. Persistence remains **mock synchronous callback admission**. A partially committed IndexedDB write followed by callback failure is not reversed. Durable commit/checkpoint, migration, concurrent tab, pending flush and recovery need a dedicated fault harness and new design.
4. Full replay validation is O(journal size), suitable only as a proof. No 100–1,000 company scaling, archive compaction, performance or memory benchmark.
5. No inventory asset/stockout, demand/pricing, credit sales, taxes, actual balance sheet, M&A, PE/VC partnership/beneficial chain or legal ownership transfer implemented here.
6. **Checkpoint to continue:** actual Node process on the exact SPIKE-3 tree; establish 13-week two-entity gameplay fixture and comparator with existing production; then decide if a **single-entity-aware event/settlement architecture** plus persistent transactional storage can outperform the existing incremental migration.

**No mainline changes or merges in this draft.** Work and Claude Code continue Phase 3/4; do not modify, rebase, merge, or close this experiment except with new explicit Owner authorization in #1038.
