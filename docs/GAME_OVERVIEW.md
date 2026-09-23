# Game Overview — Capitalism Tycoon Web

> **This file is a status summary of the docs it links to, not a substitute for them.**
> Detail lives in the linked files/sections; this file only summarizes. If this file and a
> linked primary source disagree, **trust the primary source, not this file**, and report the
> discrepancy to whoever is driving this PR, or to the user, so it can be fixed here. This file
> is expected to drift as work lands — treat any staleness you find as a bug to flag, not as
> evidence against the primary source.

## 1. What the game is

資本主義ポケット TYCOON / Capitalism Tycoon Web. Primary product/UX reference: **Coffee Inc 2**.
Capitalism / Capitalism Lab inform the deeper economic, operating, and capital-allocation
systems. Originated as a Swift Playgrounds project; this repo is the browser migration
(`js/data.js` line 7: `// Generated from the supplied Swift Playgrounds project.`).

Two legitimate founding routes (`CLAUDE.md` §1):

1. **Store/operator route** — start with an operating business (e.g. ramen), deepen operations,
   build HQ functions, then diversify.
2. **Investment-company route** — start without owning a store, use company capital for
   investment/capital allocation, then expand into HQ functions, M&A, etc. Must use company
   cash/holdings/ledger, never personal, and does not unlock unrelated systems for free.

See `docs/FOUNDING_ROUTE_REBALANCE_DESIGN.md` for the route-rebalancing design history.

## 2. Ending conditions

`js/completion.js`'s `ENDING_DEFS` (lines 34-41) defines six endings, each with its own
`check(g,e)` condition: `listed_founder` (IPO), `conglomerate` (5+ subsidiaries),
`global_tycoon` (company value ≥¥1兆), `capital_king` (personal net worth ≥¥1兆),
`philanthropist` (foundation reputation ≥80 and endowment ≥¥10億), `serial_founder` (3+
companies founded and exited). Achieved endings are recorded in `endingRecords` and
`unlockedEndings` (line 162). See `docs/gameplay-systems-roadmap.md` §8F.4 for status —
this is implemented, not a roadmap gap (§7 note below).

## 3. The five pillars

The current operating-depth strategy deepens five pillar businesses rather than spreading
shallow mechanics across every business type (`CLAUDE.md` §1):

- `ramen`, `conveni`, `gym`, `productVentures` (IT company), `realEstateAgency`

Non-core business data (from the original six: ramen/cafe/conveni/apparel/gym/appStudio)
remains for save/data compatibility only. Master economics (price/unit cost/base demand/store
cost) live in `js/data.js` starting at line 12 (ramen) and line 40 (conveni), with gym and
realEstateAgency further down the same file.

Each pillar has a structurally distinct economic model, not a palette-swapped clone:

- **ramen**: softmax discrete choice with same-market cannibalization (`js/market.js`)
- **conveni**: chain-scale procurement discount and dominant-strategy same-prefecture
  clustering, plus 4-tier private-brand development (`js/convenience-merchandising.js`)
- **gym**: membership-stock model (`js/gym-membership-model.js`)
- **realEstateAgency**: lumpy brokerage pipeline — most weeks run at a loss between deal
  closings (`js/real-estate-agency-pipeline.js`, `js/real-estate-agency-credit-line.js`)
- **productVentures**: product-lifecycle state machine (`js/product-lifecycle.js`)

`market.js`/`supply.js`/`workforce.js` being ramen-focused is an intentional staged state
(`CLAUDE.md` §1), not evidence the investment-company route is unsupported.

## 4. PE mode

Fund formation runs through 4 gates (Exit → GP commit → LP raise → terms) — see
`docs/PE_MODE_DESIGN.md` §3 for the full flow. All T1-T26 tasks are implemented; the full task
list with commit SHAs is in `docs/PE_MODE_TASKS.md`. `docs/PE_MODE_TASKS.md`/`docs/PE_MODE_DESIGN.md`
stopped tracking new PE work after T26 (2026-08-13); everything below this point is tracked here
instead.

**Post-T26 feature additions (PR #705-#716)**: the Exit
Decision Center (`previewPEPortfolioExitScenarios()`, #706) compares the current sale against two
bounded hold scenarios (+26/+52 weeks) by replaying the exact weekly portfolio-company/fund
calculators on a cloned state — read-only, no RNG. An IPO exit route (#707) was added alongside
the original sale route, with its own eligibility gate (`IPO_EXIT_MIN_SCORE`, `IPO_EXIT_MIN_HOLD_WEEKS`)
and listing discount (`IPO_EXIT_DISCOUNT`). A buyer book (#708) adds secondary-buyout and
strategic-sale offers, each with its own price factor, reusing `js/pe-rivals.js`'s existing
roster/eligibility logic rather than inventing new buyer entities. An interactive Sourcing Desk
(#709) surfaces network-referral and monopoly-sourcing state for direct player action. A
Fundraising Book (#711) makes LP promise acceptance a per-LP player choice (`promiseDecisions`)
instead of an implicit accept-all/decline-all; LP promise compliance (#712) is then derived
automatically from real fund activity (deal tier mix, reporting shortfalls) rather than a manual
toggle. Multi-fund management (#713) lets deal supply and DD draw from the union of every
currently-investing fund, with the specific vehicle frozen onto the deal at DD time
(`deal.fundID`). Exit attribution (#714) decomposes each exit's value creation into
entry-pricing/operations/exit-multiple/market/route-pricing components that reconcile exactly to
gross proceeds minus acquisition price, paired with a derived LP-feedback label — both read-only
and display-only. Proprietary sourcing (#715) adds a long-horizon (13-week response,
capped-below-50% success probability), player-initiated outreach path to non-for-sale companies
that shares the existing weekly network-action budget. #716 makes exclusive-sourcing status
explainable in the UI without changing its underlying mechanics.

**Confirmed settings** (`docs/PE_MODE_DESIGN.md` §2 table): Fund I size ¥28-30億, 4 bids/year,
slots 2→8, team cap 60, DD budget 3 deals/year + partner-count/4, hold period 4yr (fund I) / 3yr
(fund II+), **fund cap ¥1兆円** (lowered from an initial ¥5兆円 design — §12 walks through why
¥5兆円 couldn't be absorbed by the deal-size bands in §15, and §16.5 "矛盾1" records the
implementation-time contradiction that forced the change). §12's own later subsections
("天井後の問題" through "100年の物語構造") still narrate the pre-change ¥5兆円 model as
historical record; a note at the top of that span points back to §2/§16.5 for the current
value. Personal-asset yield cap of 3%/year is **confirmed not implemented** (§12, "個人資産の
利回りは年3%が上限" subsection) — it conflicts with existing real-estate (4.9-6.5%) and sports-
team (42-43%) yields and was deliberately left as an unfixed cross-system balance issue.

**UI**: Phase 1 (core UI) and Phase 2 (holdings/Exit UI) are both complete
(`docs/PE_MODE_DESIGN.md` §7 for the screen-by-screen design).

**PE management bridge status** (which pillar businesses can be actively managed once PE owns
them, vs. falling back to the fully abstract generic EBITDA model) — `js/management-context.js`
lines 28-39, `resolvePortfolioManagementCapability()`:

| Business | Status |
|---|---|
| gym | Complete (original bridge, #655→#656→#658) |
| conveni | Complete — engine layer (PR #670: detached runtime pattern against `js/convenience-merchandising.js`, unmodified) + UI layer (PR #671: `pe-ui-adapter.js`'s `portfolioManagementDetails()`, `pe-ui.js`'s `manageView()` guard generalized) |
| realEstateAgency | Complete — engine layer (PR #673: detached runtime pattern against `js/real-estate-agency-pipeline.js`, unmodified; the price lever is intentionally a no-op since the pipeline never reads `business.price`) + UI layer (PR #681: `actionsEnabled` turned on, the inert price control hidden/rejected instead of exposed) |
| ramen | Complete — engine + UI layer in one PR (#677: detached runtime pattern reusing `market.js`'s pure allocation kernel extracted in PR #676; `actionsEnabled` turned on in the same PR, so there is no separate ramen UI-connection PR the way conveni/realEstateAgency/productVentures have one) |
| productVentures | Complete — engine layer (PR #679: detached bridge against the product/lifecycle kernels extracted in PR #678) + UI layer (PR #680: `actionsEnabled` turned on) |

`js/app.js`'s legacy business-agnostic `renderPePortfolio()`/`renderPeFundFormation()`
verification screen (`#screen`, `case 'pe-portfolio'` in `renderScreen()`) is **not dead code**.
`js/pe-ui-adapter.js`'s `getPEUIData()` only lets the D UI shell take over `#screen` when
`state.peFirm?.unlocked` is true (`active=state.selectedTab==='pe-portfolio'`, and
`js/pe-ui.js`'s `render()` explicitly declines to touch `#screen` whenever `!model.unlocked`).
Before the player's first Exit (`peFirm.unlocked===false`), the D UI shell backs off entirely, so
this legacy screen is what actually renders and stays visible — showing "PEファンドの組成には
Exit経験が必要です" and an empty portfolio list. `renderMA()`'s "買収先の経営（PE）" button has
no `peFirm.unlocked` gate, so any player can reach this screen before ever unlocking PE; this was
confirmed both by reading the gating logic directly and by reproducing it against a fresh
pre-unlock game state via `tests/harness.js`'s full `loadGame()`. Once PE is unlocked, the D UI
shell does take over `#screen` unconditionally whenever `selectedTab==='pe-portfolio'`, confirmed
by the real-browser `tests/pe-ui-screen-ownership-webkit-test.js`. So the legacy screen is the
only UI shown during the pre-unlock window, not an unreachable leftover — removing it without
also addressing that window would regress this button to a dead end.

The PE portfolio-company "出店" lever is connected to the production D UI in PR #719.
`js/pe-ui-adapter.js` dispatches the player action to the existing
`js/pe-portfolio-operations.js` `expandPortfolioStore()` writer, while the management screen
shows the canonical expansion cost (5% of enterprise value), post-action portfolio cash, and
cash-insufficient state before execution. The legacy `case 'pe-portfolio-expand'` path remains
for the pre-unlock verification screen; the D UI path reuses the same production writer rather
than introducing a second expansion implementation.

The Sourcing Desk also previews the effect of **one additional network contact** without mutating
state: projected Trust, monopoly probability, Referral unlock/inspection depth, and Referral
competition multiplier are calculated from the existing canonical network/referral functions.
The actual sourcing outcome remains governed by the saved `lastSourcingCycle` diagnostics and
the unchanged deterministic production sourcing path.

## 5. Microcap mode

Runs independently of PE mode: deterministic small-cap listings spawn over an 8-18 week window
with 4 archetypes (speculative 55%, steady 28%, quality 12%, breakout 5% — see
`docs/MICROCAP_MODE_DESIGN.md` §3.2). Implemented via PR #648, after fixing a prerequisite order-
quantity-cap bug (#645, §5 of that doc). Remaining, non-blocking: archetype ratios need
recalibration against the real weekly engine rather than the standalone model used to design
them, and the listing valuation-range distribution is not yet settled (§6 of that doc).

## 6. Technical foundation

Core invariants (`CLAUDE.md` §2, full list there — do not treat this as exhaustive):
`SAVE_KEY=capitalism_tycoon_web_v1`, `saveVersion=9`, backward save compatibility,
deterministic simulation (no `Math.random()` in production sim paths), UI never consumes
simulation RNG, complete company/personal asset separation, iPhone Safari is the priority
client, no direct push to `main`, no force-push, one concern per PR.

D UI (`CLAUDE.md` §3) is the production visual language — the MutationObserver count and
external-enhancer budget (currently 79) are test-guarded; extend existing hooks rather than
adding new observers where possible.

The production map (`CLAUDE.md` §4) is Canvas 2D city + local sprites + DOM marker overlay +
pannable world — Phase 2 is the only production renderer; do not reintroduce the old DOM/SVG
map.

`js/` currently holds 203 modules. Canonical CI runs across shards A-H
(`tests/run-all-shards.json` assigns B-H explicitly; unassigned tests fall into shard A) — see
`tests/run-all.js` for the full registered test list rather than a count here, since it changes
with every PR that adds tests.

3-pool cash separation (`CLAUDE.md` §2): `fund.cash`, `company.cash`, `personalCash` are
independent, plus a 4th pool for PE portfolio companies (`deal.portfolioCompany.cash`, written
only by `settlePortfolioOperatingWeek()` in `js/pe-portfolio-operations.js`). The conservation
identity `personalCash_after + fund.cash === personalCash_before + fund.lpContributed`
(`docs/PE_MODE_TASKS.md` T21) holds across LP contribution/distribution flows.

## 7. Current development status (as of this PR)

**Recently completed** (this session):

- **ramen's "death spiral" bankruptcy bug — fixed (PR #669, main `b8cfabfd`)**. Root cause:
  `js/supply.js`'s `isImmediatePaymentOrder()`/order creation computed `paymentDueWeek` from the
  order week rather than the arrival week, so any supplier with `leadTimeWeeks ≥
  paymentTermsWeeks` (including the default `balanced_wholesale`) got zero real post-arrival
  cash-flow float. This fed a procurement-blocked → inventory-shortage → sales-collapse spiral
  that bankrupted multiple independent economic scenarios around week 236-242. Fix: (1)
  `paymentDueWeek` now anchors on the arrival week (`js/supply.js` line 38,
  `paymentDueWeek:n(g.week)+lead+terms`); (2) `balanced_wholesale.paymentTermsWeeks` raised 2→3
  (`js/supply.js` line 19) — the combination is numerically equivalent to the raw terms=3
  supplier value that a parameter sweep had shown was the minimum needed to clear all affected
  scenarios with zero regression to healthy ones.
- **gym startup-loan default spiral — fixed (PR #667, main `a68cdc60`)**. A gym startup loan
  above a measured ~¥4.6-4.69M financing requirement structurally exceeded what a single store
  could service, leading to covenant default and then a frozen, interest-only balance that
  caused a second bankruptcy later. Reserve-proportional financing was measured across 4 formula
  variants and found to have zero effect, so it was not used. Fix (`js/bank-loans-covenants.js`):
  `gymStartupQuote()` now gates new-loan eligibility at
  `GYM_STARTUP_ELIGIBILITY_REQUIRED_MAX` = ¥4,600,000 (line 17); a defaulted loan gets a
  dedicated `serviceGymStartupWorkout()` repayment path instead of being permanently frozen.
- **conveni's PE management bridge — complete** (PR #670 engine layer, PR #671 UI layer; see §4
  table above).
- **realEstateAgency's PE management bridge — complete** (PR #673 engine layer, PR #681 UI layer;
  see §4 table above).
- **ramen's PE management bridge — complete** (PR #677 engine + UI layer in one PR, built on the
  pure allocation kernel extracted in PR #676; see §4 table above).
- **productVentures's PE management bridge — complete** (PR #679 engine layer built on the
  product/lifecycle kernels extracted in PR #678, PR #680 UI layer; see §4 table above).
- **company recall crisis — minimum core complete** (PR #699). See
  `docs/gameplay-systems-roadmap.md` §8F.3.
- **overseas repatriation — minimum core complete** (PR #702). See
  `docs/gameplay-systems-roadmap.md` §8F.2.
- **PE mode Exit Decision Center, IPO exit, buyer book/Secondary Buyout, interactive Sourcing
  Desk, Fundraising Book, automated LP promise compliance, multi-fund management, exit
  attribution, proprietary sourcing, and exclusive-sourcing explainability — all complete**
  (PR #705-#716). See §4 above for the detailed breakdown.

All five pillars now have a complete PE management bridge (`resolvePortfolioManagementCapability()`
returns `actionsEnabled:true` for all of ramen/gym/conveni/productVentures/realEstateAgency —
§4 above).

**Not yet started**: Microcap archetype recalibration against the real engine (§5 above); further
pillar-specific operating depth beyond the current five (`market.js`/`supply.js`/`workforce.js`
staying ramen-centric is intentional per §3 above, not a gap).

## 8. Where to look next

- Gameplay system-by-system status: `docs/gameplay-systems-roadmap.md`
- PE mode design, settings, and task history: `docs/PE_MODE_DESIGN.md`, `docs/PE_MODE_TASKS.md`
- Microcap mode design: `docs/MICROCAP_MODE_DESIGN.md`
- Founding-route rebalancing history: `docs/FOUNDING_ROUTE_REBALANCE_DESIGN.md`
- Project-wide rules, invariants, and known pitfalls: `CLAUDE.md`
- Do **not** use `docs/DEVELOPMENT_ROADMAP.md` — it is a retired saveVersion-8-era plan
  (`CLAUDE.md` §1).
