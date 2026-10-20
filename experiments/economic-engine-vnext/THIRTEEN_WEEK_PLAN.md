# Economic Engine vNext — 13-week deterministic baseline fixture (SPIKE-3.5)

**Owner:** regular ChatGPT ONLY, [#1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).  
**Dependency:** draft SPIKE-3 [#1047](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1047), based on SPIKE-2 #1042 → SPIKE-1 #1041 → SPIKE-0 #1039.  
**Status:** **TEST-ONLY PREPARATION**, no economic engine changes; HOLD on new engine feature implementation until #1047’s required checks and its relevant direct tests have actually completed. No main merge without separate Owner authorization.

## What this fixture answers

Can the existing SPIKE-3 unified **cash-paid share issuance** + **cash-basis store settlement** process a deliberately bounded 13-week game session while retaining:
- an entity-aware, balanced **single journal** for company, founder, investor, customer, supplier and employee;
- two independent shareholder subscriptions and unchanged beneficial shareholder equity across all operating weeks;
- stable deterministic event IDs, strict at-most-once receipts and exact cash transfer conservation;
- no added monetary amounts on persistence **admission** failure;
- verifiable weekly revenue/expense/profit and closing positions, independently computed outside the engine.

**What it does not answer:** the fixture is wholly **synthetic**, not a real production gameplay parity test. It has no legacy engine input-output mapping, no price/demand/random simulation, taxation, inventory/cost of goods timing, long-term save v9 migration or durable browser persistence. Merely passing this test would not prove a new economic engine is production-ready.

## Files

- \`fixtures/13-week-retail.json\` — fixed source data and independent numeric expected results, explicit \`unit: "JPY-0.01"\`.
- \`13-week.test.cjs\` — 31 standalone scenario tests; **test input and assertions only**. It does not modify the economic reducers, register itself in the required CI suite, or touch production.

### Reference economics

Cash balances and profits below are displayed in **whole JPY** for readability. The JSON and code use integer **0.01 JPY minor units**.

| Item | Reference amount |
|---|---:|
| Company opening cash | ¥2,500 |
| Founder cash subscription | ¥300 |
| Investor cash subscription | ¥400 |
| Total 13-week retail sales | ¥8,550 |
| Material purchases expensed immediately | ¥3,780 |
| Wages paid | ¥2,300 |
| **13-week operating profit** | **¥2,470** |
| **Company closing cash** | **¥5,670** |
| Shares outstanding, ordinary | 500 |
| Founder / Investor ordinary shares | 300 / 200 |
| Total expected journal receipts | 15 |

The 13-week sequence includes **week 8 with an operating loss of ¥140**. Two founder/investor subscriptions (week 0) and exactly 13 store-week receipts must reconcile to 15 journal entries. No external client, consumer or supplier balance may be invented or go negative in the fixture.

Independent reference calculation (with amounts in integer minor units):

\`\`\`text
sales=855000
materials=378000
wages=230000
profit=855000-378000-230000=247000
companyClosingCash=250000+30000+40000+247000=567000
customerClosingCash=2000000-855000=1145000
supplierClosingCash=378000
employeeClosingCash=230000
founderClosingCash=500000-30000=470000
investorClosingCash=400000-40000=360000
companyPaidIn=-70000
investments={founder:30000,investor:40000}
\`\`\`

## Tests and acceptance distinctions

Run **directly in actual Node.js** in a checkout of this draft branch:

\`\`\`sh
node experiments/economic-engine-vnext/core.test.cjs
node experiments/economic-engine-vnext/equity.test.cjs
node experiments/economic-engine-vnext/store.test.cjs
node experiments/economic-engine-vnext/unified.test.cjs
node experiments/economic-engine-vnext/13-week.test.cjs
\`\`\`

Check that all 5 processes exit 0. This experimental suite is **not registered in mainline canonical CI**; an all-green GitHub PR does **not** automatically constitute evidence that these five commands ran. The test must be run against the **exact branch HEAD** and recorded on its PR with commit hash.

**Evidence so far:** five test files and their source dependencies were independently fetched at this branch, then executed in a V8 CommonJS-compatible harness with Node strict assertion shims: **15 + 25 + 31 + 36 + 31 = 138/138 PASS**. This is **not actual Node execution**, and it makes **no** claims about IndexedDB, WebKit, old save, production gameplay parity, or durability after partially committed storage.

Coverage: 13 contiguous weeks, reference spreadsheet-like arithmetic, two subscriptions, journal order and uniqueness, entity balance, store P&L and cash projection, week-8 loss, deterministic replay, reject-and-retry after save false/throw, duplicate prevention, shareholder preservation and tamper detection.

## Known blockers before a GO decision

1. **PR #1047 dependency:** finish its head-appropriate CI and execute actual Node for SPIKE-3’s 107 tests. If there is a failure, fix that narrower experiment first; the test-only fixture is not a feature-enabling bypass.
2. **Storage:** \`admitIssue\` / \`admitWeek\` use synchronous mock callbacks. Real IndexedDB write failure, post-write throw, rollback/reload and multi-tab outcomes are unproven.
3. **Finance schema:** SPIKE-3 intentionally forbids unqualified raw \`transfer\`; loan issuer source, stock trading/secondary sale, taxes, inventory, accrual, and balance sheet are incomplete.
4. **Week chronology:** the SPIKE-2 \`store.planStoreWeek\` currently checks uniqueness, **not** contiguous weekly progression. This fixture uses sequential weeks but does **not** assert that skipped or out-of-order weeks are rejected. Decide whether chronology belongs to the event scheduler vs the ledger before implementing.
5. **Issuer/share structure:** one company, one share class, two paid-in equity subscriptions. It does not model liquidation rights, preferred capital, conversion, subsidiaries, indirect beneficial ownership, PE/VC claims or founder refounding.
6. **Numerical scale and runtime:** tests are deliberately small; no 100–1,000 companies or repeated long-run history, and replay validation is still O(history).
7. **Legacy comparison:** no matching legacy financial output. Next independent step is to build a mapping from actual legacy store-week operations to this same scenario, **without** assuming that cash-basis materials expense equals inventory accounting.

## Boundary and next gate

This PR must be **Draft** and based on the experimental SPIKE-3 branch, with **only new fixture/test/docs** in \`experiments/economic-engine-vnext/\`. This document creates **no new technical or merge authorization**. The current Phase 3/4 Work/Claude Code tracks continue unaffected and must not edit, close, merge or rebase these vNext PRs. Their work is not blocked by pending vNext CI. Only regular ChatGPT carries forward vNext unless the Owner explicitly changes #1038.

When PR #1047 verification passes, use this prepared fixture as the foundation for the later genuine legacy comparison and then determine whether durable storage integration is worth exploring.
