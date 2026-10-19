# vNext vs legacy Economic Engine — parity plan and go/no-go rubric

**Snapshot for the initial comparison:** `2507203f3f0abdcc08262ede91703915e5ba265f`. Never assume it remains current.  
**Status:** proposed test plan, **not an executed feature-parity comparison**.  
**Work separation:** regular ChatGPT experimental track only; mainline Phase 3/4 ownership unchanged.

## Legacy references to inspect

- Production source families: `js/engine.js`, `js/finance.js`, `js/expansion.js`, `js/real-estate-mortgage-refinancing.js`, `js/shareholder-returns.js`, `js/pe-fund.js`, `js/completion.js`.
- Architecture and current gates: `docs/economic-engine/ECONOMIC_ENGINE_ROADMAP.md`, `PHASE_2_ACCEPTANCE.md`, `PHASE_3_ENTRY_CONTRACT.md`, `PHASE_3_4_IMPLEMENTATION_FIRST_GATE_ALIGNMENT.md`.
- Historical regression examples: #734 (rollback), #953 (governance saved separately), #971 (subsidiary dividend missing ledger), #1008 (personal VC lost after refounding), #1013 (unfunded mortgage refinance), #1014 (missing mortgage liability), plus [RCA PR #1037](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/1037).

## Structured comparison

| Representative route | Critical proof | Current vNext | Next evidence needed |
|---|---|---|---|
| Company / founder / bank cash transfer | Separate owner balances, postings sum zero, no negative account | **V8 PASS** for isolated transfer | Actual Node + production comparison |
| Loan draw / principal repayment | One authoritative principal; cash, liability, bank receivable conserve | **V8 PASS** for isolated draw/repay | Rates/interest, maturity, property loan, finance statement parity |
| Store daily/weekly operation | Sales, inventory, cost, wage, tax and profit reconciled by week | **NOT IMPLEMENTED** | Small deterministic operating-week slice + legacy fixture |
| Stock issuance / equity trading | Shares conservation, beneficial ownership, market value vs cash | **NOT IMPLEMENTED** | Share matrix, issuer identities, founder/company portfolios |
| M&A purchase / sale | Buyer/seller cash, subsidiary book, goodwill and transfer receipts | **NOT IMPLEMENTED** | Acquisition and disposal round-trip tests |
| PE / VC / subsidiary lifecycle | Claims and contribution separate by legal entity, no lost founder equity | **NOT IMPLEMENTED** | Multi-entity ownership and refounding fixtures |
| Durable persistence | Save-false/throw/post-durable failure, flush, reload, fresh browser IDB | **NOT IMPLEMENTED** | Real adapter + WebKit/IDB fault harness |
| Legacy save v9 compatibility | Recover existing saved data with no silent assets creation | **NOT IMPLEMENTED** | Read-only v9 projection + explicit migration decision |
| iPhone Safari | Start/render/tap/play, memory/runtime | **NOT IMPLEMENTED** | Browser adapter and real WebKit/physical device |

The first two green entries mean **only small pure-reducer cases**, not full financial product correctness. Existing legacy paths often include additional transactions or data not modeled in the spike.

## Exit rubric for two-week feasibility checkpoint

**CONTINUE vNext** only with evidence for:
1. The same 3–4 selected representative flows have **explicitly scoped** expected results in both engines; no claims beyond implemented fields.
2. Balanced economic postings, owner isolation, loan identity, same-input same-output replay, failed-admission no-change and at-most-once receipts are demonstrated on tested paths.
3. Real Node tests run; separate durable fault tests exist before any browser/production proposal.
4. A quantified worklog records files/complexity, hours/iterations and severity-confirmed regressions for the selected flows, not merely raw GitHub issue counts.
5. Measured integration and save-compatibility risk is bounded enough to warrant additional slices without interrupting mainline.

**STOP or NARROW vNext** if it requires duplicate production writers, changes mainline financial behavior without approval, cannot maintain strict owner/claim identities, or fails to demonstrate credible parity/cost advantage after representative slices.

## Next independent steps

1. Verify newly added `core.cjs` + `core.test.cjs` using **actual Node** in a usable repository execution environment. Preserve command/exit evidence.
2. Design equity and issuer identity records before exposing share trading.
3. Build read-only comparable fixtures from legacy operations and store expected debit/credit deltas.
4. Build a deliberate post-durable-write-failure test before claiming persistence atomicity.
5. Issue a documented Owner go/no-go recommendation; do not merge the experiment into main.
