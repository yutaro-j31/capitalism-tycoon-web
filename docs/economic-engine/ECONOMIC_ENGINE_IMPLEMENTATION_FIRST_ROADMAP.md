# Economic Engine — Implementation-First Development Roadmap (v2)

**Owner policy:** 2026-10-16 — **FUNCTIONAL COMPLETION FIRST / COMPREHENSIVE QUALITY AFTERWARD**  
**Repository:** `yutaro-j31/capitalism-tycoon-web`  
**Baseline observed when authored:** `400338a25cbc57b7c2a80b4191296d3505f09ba5` (never assume this stays current)  
**Status:** Owner-directed implementation-sequencing policy; **NOT** an authorization for any source-of-truth cutover, economic redesign, Phase 4 Entry, banking product-policy choice, or unconditional merge.  
**Audience:** any agent with an actual repository environment (ChatGPT, ChatGPT Work, Claude Code, Codex, other agents, human developers).  
**Relationship to legacy roadmap:** this document is the operative **sequencing, validation-budget, and handoff policy**. `ECONOMIC_ENGINE_ROADMAP.md` and `ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md` remain the detailed economic specification and phase/dependency inventory. Existing approved contracts, identity/accounting requirements, owner gates, and permanent tests remain binding. Where an old document calls for repeated *nonessential exploratory full-system audits during implementation*, this newer Owner policy defers those audits to Quality Completion. It **does not** waive a specifically required save-atomicity, writer-adoption, source-of-truth, CI, old-save, accounting, WebKit, or cutover safety proof.

---

## 1. Executive decision and completion model

Build the complete planned Economic Engine **before** investing in broad, repeated exploratory audits, 100–1,000-year simulation campaigns, massive multi-seed matrices, and comprehensive balance calibration.

Two separate completion milestones:

1. **F — Functional Complete:** all required Phase 0–16 capabilities are implemented/connected or explicitly dispositioned by Owner; their dependency-specific local acceptance tests and applicable CI pass; existing gameplay and saves remain operable. Each phase can be marked `FUNCTIONAL` without claiming that the whole engine is regression-free or release-ready.
2. **Q — Quality Complete:** after F, freeze feature scope, then execute cross-system financial-integrity auditing, failure/fault campaigns, multi-seed/long-run simulations, mobile performance tests, calibration, fixes, and final regression on the integrated codebase. Only Q can support an Engine `RELEASE READY` claim.

Important nuance: **"implement first" does not mean "merge known-corrupting code now and fix it later."** Required safety checks stay in the individual implementation PR. If an actual P0/P1 affects a proposed executable writer, that writer stays blocked until fixed or isolated; unrelated pure/read-only slices may progress. Never silently mark an incomplete phase `PASS`.

### Development work that continues during F

- Implement one reviewable concern per PR and integrate the vertical slice.
- Run focused unit/contract tests; relevant deterministic/accounting tests; and save-failure/rollback/old-save tests **when the change touches their authority**.
- Keep the existing permanent Phase 0.5/1/2 gates and applicable canonical CI; check real iPhone WebKit jobs when browser/save/UI behavior changes.
- Fix known P0/P1 in the touched path or keep that capability disabled; preserve exact evidence in issues.
- Confirm the final installed JS wrappers, legal-entity payer/owner, and complete writer-family coverage **before an authoritative cutover**. Mere read-only projection does not require a global writer audit.

### Work deliberately postponed until Q

- Repository-wide repeated exploratory writer audits unrelated to the affected slice.
- Routine large new property/fuzz matrices for every feature; expanded cross-system combinatorial campaigns.
- 50–1,000-year mass simulations across many seeds and AI personalities (except targeted runs needed to diagnose a detected failure).
- Large-scale balance calibration, parameter search, high-density scale optimization, broad UI polish unrelated to a changed feature.
- Re-auditing untouched feature families on every PR. Prior acceptance evidence is retained, not re-created without a causal reason.

Do not remove, skip, weaken, rename-out, or unregister tests to achieve this policy. Do not claim unexecuted tests are green.

## 2. Source-of-truth and precedence

1. Latest explicit Owner decision (**this 2026-10-16 sequencing decision included**).
2. Actual latest `origin/main`, installed code, merged PRs, current CI results.
3. `AGENTS.md` and `CLAUDE.md` mandatory repository constraints.
4. Approved scoped contracts (e.g. `PHASE_3_ENTRY_CONTRACT.md`, `PHASE_3_P3_3_CONTRACT.md`, Phase 4 entry contract when merged and approved).
5. `ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md` and original `ECONOMIC_ENGINE_ROADMAP.md` for architecture and economic rules.
6. Open/draft PRs and audit reports **as proposals/evidence, never as already merged truth**.
7. Conversation history and model assumptions, last.

If a scoped contract has a stronger safety prerequisite, satisfy it. If the new timing policy and an older specific acceptance checklist appear inconsistent, **amend the checklist in its own docs PR with explicit evidence/authorization** rather than secretly bypassing it.

## 3. Non-negotiable invariants (F and Q)

- `SAVE_KEY=capitalism_tycoon_web_v1`, `saveVersion=9`; backward-compatible old saves and compaction/reload.
- Deterministic persisted `simulationRng.seed`; stable iteration/tie-break, no `Math.random()` or uncontrolled wall-clock in production economic simulation; rendering consumes zero simulation RNG.
- Distinct company, founder-person, subsidiary, PE-fund, VC-vehicle, property/SPV, and later banking legal-entity ownership/cash. Company investment is not personal investment.
- Monetary conservation, balanced multi-leg postings, debt principal vs interest distinction, no fabricated cash/asset, no duplicate shares/beneficial interest/transaction receipts.
- Failed committed operations and `save() === false` never return success or survive live state, storage mirrors, queued/durable IndexedDB, reload, or fresh-context hydration.
- Single authoritative economic writer per adopted entity/family. Read-only adapters cannot migrate settlement authority by implication. Unknown holder/class/lender/rights/identity remains unsupported (fail closed).
- Share voting Control Ladder: **1%, 3%, >1/3, >1/2, >=2/3, >=90%**, with exact command-specific eligibility; separate 5% disclosure / 20% equity-method signals. Threshold does not automatically authorize management actions.
- Founder own-company value: listed market price × uniquely held shares; private issuer Equity Value × economic ownership × 0.70, no double count. Ending: personal net worth ¥1 trillion.
- No premature Phase 9/10/13/14 settlement migration from Phase 3; no Phase 11/12 group optimization in Phase 4; no Bank balance-sheet authority before formal Banking Entry.
- iPhone Safari/real WebKit production path remains supported; never claim physical-device proof from desktop emulation.

## 4. Stage F — function-by-function execution roadmap

Phases retain their **original dependencies**. A row's "done" means the listed functional capability is delivered with **minimum relevant acceptance**, not comprehensive engine-wide quality certification.

| Phase | What the next agent delivers | Local F gate / handoff target |
|---|---|---|
| 0 Specification | Existing entity, tick, operation, invariant, Control Ladder and monetary contracts | Historical accepted foundation; do not redo. |
| 0.5 Headless harness | Existing seed provenance, exact replay, invariants, save forks and failure probes | Keep permanent harness working; reserve extended scenario matrix for Q. |
| 1 Entity-aware Operations/Ledger | Existing immutable operation/posting, legal-account attribution and atomic transactions | Historical Phase 1 evidence; no rewrite. |
| 2 Standalone Accounting | Existing standalone close, debt/dividend/buyback/fixed-asset reconciliation | Historical Phase 2 evidence; retain accepted gates. |
| **3 Ownership & Control** | P3-4 controlled writer adoption; P3-5 external holdings; P3-6 subsidiary/M&A edges; P3-7 PE; P3-8 VC; P3-9 entitlement; P3-10 approved commands/UI; P3-11 founder wealth read model; P3-12 acceptance | No guessed voting rights, no second writer, no Phase 9+ settlement. P3-4 gate may block its own authority while pure P3-5… adapters proceed on separate branches. |
| **4 Debt instruments** | P4-1 schema, P4-2 debt adapter, P4-3 reconciliation, accrual/operation contracts and pure schedules, P4-9 credit states, P4-10 cost-of-debt inputs; P4-11 receipt storage, P4-12 family adoption plan, then approved per-family writer migration and P4-F close | **Phase 4 production Entry NOT presumed approved**; `#981` is a proposal. Pure design/isolated preparation can proceed where separately permitted. No double repayments or synthetic refinanced cash. |
| 5 Aggregate industry | Demand/capacity/price/cycle observations and industry-level operating signals over the existing store/business model | Do not double-count detailed production or invalidate existing stores; bounded deterministic transitions. |
| 6 Shared base valuation | Pure observation → cost-of-equity + after-tax cost-of-debt/capital weights → WACC → EV → equity-value snapshot | Immutable, explainable valuation snapshot; no same-period feedback cycle. |
| 7 Capital-allocation kernel | Candidate generation, feasibility, deterministic scoring, scheduling and opportunity costs | No executable candidate without the exact underlying authoritative settlement capability. |
| 8 AI allocator | Shared deterministic utility weights/personality, stable tie-break, bounded top-K/cadence, next-period execution | No per-tick LLM or unbounded O(N²) M&A search. |
| 9 Public securities/actions | Issuance, dilution, dividends, buybacks, treasury and corporate-action settlement migrated by family | Exactly one securities writer; owning company and shareholder perspectives reconcile. |
| 10 M&A | Private cash deals first if ready; share swap/public/hostile types only after their Phase 9 prerequisites | Cash/debt/ownership/goodwill and consideration settle once with rollback. |
| 11 Legal-entity treasury | Parent/sub/fund-compatible intercompany dividend, capital, loan, repay and allowed sweep settlement | No unrestricted access to subsidiary/fund cash; no consolidated optimization yet. |
| 12 Consolidation + liquidity | Standalone-to-consolidated reconciliation, intercompany eliminations, NCI/equity-method views, then group liquidity | Group planning never rewrites standalone books. |
| 13 PE | Fund/GP/LP/coinvest, calls, portfolio, NAV/DPI/TVPI, distributions/carry/exits on shared authority | Fund cash not manager/founder cash; double-beneficial ownership prohibited. |
| 14 VC | Vehicle/startup positions, rounds/dilution/follow-on, IPO and acquisition exit links | Known beneficial rights only; no duplicate IPO stakes or proceeds. |
| 15 Real estate | Owner/property/SPV capital and debt, operating yields, capital-allocation adapter | Mortgage/loan mirrors not double counted; company/personal ownership separate. |
| 16 Banking | **Only after banking-specific Owner Entry:** legal bank account/entity, deposit liabilities, lending, servicing, defaults/recoveries, capital/liquidity and relevant consolidation | Approved playable banking vertical slice, compatible safe monetary envelope; no implied regulatory promise. |

### Exact starting point as of the snapshot

- Main when checked: `400338a25cbc57b7c2a80b4191296d3505f09ba5`; refresh it every time.
- `#909` tracks Phase 3: P3-0 through P3-3 checked complete; P3-4 through P3-12 **not** checked complete in the tracker. Do not infer completion from a draft or an open PR.
- Phase 3 read-only design PRs `#995–#1003` were open when checked; PR `#1009` (WebKit MBO test) and draft `#1016` (personal VC refounding fix) were also open. Verify current status before picking a task.
- `#981` (Phase 4 architecture/docs) was open; its proposed P4-1…P4-F slices are **not** proof of implementation or Phase 4 Entry. Debt remediation PRs `#989/#990/#1010/#1015` and test PRs `#1011/#1012` were open when checked; inspect overlaps.
- Immediate execution strategy: finish or safely isolate affected P3-4 writer atomicity issues, then implement the approved **pure/read-only** P3-5/6/7/8/11 slices and P3-9 entitlement; wire P3-10 only under its issuer-command contract; close Phase 3's honest F gate. Prepare Phase 4 pure specs independently but **do not** activate debt production authority before approved Entry.

### Phase F dispatch rule

Select the **first uncompleted, authorized and dependency-ready slice** with no overlapping active PR. Do not block an unrelated safe read-only task merely because a different writer family has an open P1; also do not mark a blocked authority family complete. If the next production dependency truly cannot advance, deliver a separately scoped pure module/adapter/design slice or report the exact blocker.

## 5. Phase F verification budget — minimum, not zero

| Change risk | Tests required before PR/merge eligibility | Defer to Stage Q |
|---|---|---|
| Docs/design only | Source/link/contradiction check, clear unmerged/unknown labels, relevant docs CI if applicable | Simulation, runtime WebKit unless docs CI specifically demands it |
| Pure calculation/read model | Focused valid/invalid boundary cases, input immutability, deterministic equality, zero RNG/save mutations, applicable CI | Large seed sweep and all-sector fuzz |
| New economic writer or authority cutover | Exact account/identity/ledger invariants, relevant writer call-sites, save-false/throw and rollback, old save + compaction/reload + real IDB/hydration when touched, replay/idempotency, focused cross-family tests, applicable full CI/WebKit, scoped independent diff audit | Broad independent audit of **unrelated** writers, high-volume Monte Carlo |
| UI integration | Command permission identical to backend, iPhone viewport/WebKit interaction, no unauthorized direct execution | Whole-application UX audit |
| CI or test harness | Relevant workflow contract, actual affected event/jobs and test registration; no fake green/skip | Unrelated economic long-run |
| Bug fix P0/P1 | Reproduce RED against correct base, smallest fix, GREEN regression, adjacent failure cases and actual CI | General re-audit of entire repository |

No PR may claim PASS while applicable checks are failed/pending/skipped without justified applicability, or while newly introduced P0/P1 are unresolved. A failed external infrastructure job is recorded and diagnosed, not silently ignored.

**Per-phase F checkpoint**: list merged slices, exact SHA, targeted pass evidence, intentionally deferred tests, unsupported capability, and remaining P1/P2. This checkpoint is **not** an engine-wide clean audit.

## 6. Stage Q — integrated quality campaign AFTER F

Enter Q only with an Owner-reviewed Functional Completion manifest and a feature freeze (exceptions: critical fixes). Run in the following order, maintaining deterministic reproduction of every failure:

| Q wave | Integrated tests and outputs | Acceptance principle |
|---|---|---|
| Q0 Inventory/freeze | Final source-of-truth/writer graph, capability matrix, versioned scenario/seed catalog and canonical test inventory | No missing authoritative writer or falsely enabled capability |
| Q1 Invariants | All entity ledger, net cash/asset/debt/issued-share conservation, beneficial identity, consolidation/eliminations, idempotency and non-finite checks | Zero unexplained invariant breaks |
| Q2 Failure injection | Each live financial operation: save false/throw, post-save, queued mirror/IDB faults, real fresh browser hydration, concurrent/retry/replay/compaction | Zero committed phantom transaction or failed-commit residue |
| Q3 Cross-domain journeys | Stocks→M&A→debt→subsidiary→treasury→PE/VC→real estate→banking, controls and redemption/liquidation | All sources/payees and receipts reconcile end-to-end |
| Q4 Deterministic stress | Stratified seed matrix, many AI profiles, multiple business/financing routes, 50/100/1,000-year scenarios where bounded and meaningful; minimized reproductions | Same persisted seed/state/actions → same semantic result; no observed invariant errors |
| Q5 Performance/mobile | 100→250→500→1,000 company scale study, physical iPhone Safari p50/p95, memory, serialization/save size, backgrounding and long-run stability | Budgets based on actual device evidence; 1,000 companies is an architecture feasibility target unless separately made mandatory |
| Q6 Balance/calibration | Rates, demand/supply, bankruptcy, concentration, valuation, PE/VC returns, money sinks, founder progression | Owner-approved target ranges; fixes made through separate dedicated PRs |
| Q7 Regression/release | Replay failing seeds, old/compacted saves, full applicable CI/WebKit, independent review and final main revalidation | Only here label Economic Engine `QUALITY COMPLETE / RELEASE READY` |

100–1,000-year simulations must have bounded runtime/data size; duration is a scenario choice, not an evidence-free promise. Current harness deepAudit default is **2,600 weeks (50 years)**; 100 years requires **5,200 weeks** by explicit configuration. Preserve full provenance (seed, initial save fingerprint, action log, final hash, first diff, exact commit).

A caught bug gets: failing deterministic fixture → severity/affected authority → isolated fix PR → focused GREEN + previously accepted gates → replay in Q matrix. Never patch balances or change fixtures just to hide a mismatch.

## 7. Autonomous AI-agent runbook (model- and environment-neutral)

**Every new session:**

1. Read `AGENTS.md`; read `CLAUDE.md` sections relevant to this task; this roadmap; the original dependency graph and exact phase contract. Refresh remote `main` SHA, issue tracker, active PRs, latest applicable CI; inspect final loaded module/wrapper path.
2. Record `PHASE`, `SLICE`, `MODE` = `F_IMPLEMENT` or `Q_AUDIT`, exact source of truth, dependencies, authority state, touched files, expected tests, non-goals. Do not reuse old "main" references as current.
3. If overlap: continue/fix same task's active PR if authorized, otherwise choose the next independent ready slice. Do not duplicate an existing PR, change another agent's branch, or edit unrelated Phase 3/4 shared files simultaneously.
4. Implement **one concern/one PR**, preserving older runtime authority unless the exact migration family was approved. Keep output reviewable; avoid giant rewrites.
5. Execute the minimum risk-based checks from §5. Fix self-introduced problems and replay focused tests. If no executable environment, **do not** state tests ran; prepare patch/PR or a precise handoff with the unverified boundary.
6. Inspect diff, test additions and changed-file list, create branch and PR (if access permits). Record actual final HEAD checks. **No direct push to main or force push.** Merge only with valid explicit Owner authorization and all relevant gates; default repository policy prohibits unilateral merge.
7. Update the relevant issue/phase tracker with exact merged facts only. Leave concise resume data per §8. Then pick next non-conflicting task.

**Owner approval boundary:** uncertain economic policy, new debt-accounting taxonomy, writer authority cutover, opening balance migration, changes to save semantics, Banking Entry, legal/governance rights, dangerous P0/P1 risk acceptance, and merge privileges beyond the current explicit grant must not be invented by an agent. Approvals to **design** do not equal approvals to **execute**. Autonomous targeted implementation does not authorize a premature migration.

**On a new P0/P1**: preserve RED reproduction and severity; block only the affected executable capability/PR unless the failure contaminates global persistence/accounting. Continue unrelated safe slices if permitted. Never bury or "defer" a demonstrated asset-loss/duplication bug behind a green CI.

## 8. Mandatory handoff block for any agent

Put this machine-readable-ish block into the PR description or tracker update and replace placeholders with *verified* facts:

```text
REPOSITORY: yutaro-j31/capitalism-tycoon-web
MODE: F_IMPLEMENT | Q_AUDIT
ROADMAP: docs/economic-engine/ECONOMIC_ENGINE_IMPLEMENTATION_FIRST_ROADMAP.md
MAIN_SHA_VERIFIED: <40-char SHA + time>
PHASE/SLICE: <P3-5 etc.>
STATUS: NOT_STARTED | IN_PROGRESS | BLOCKED | PR_OPEN | MERGED | F_COMPLETE | Q_COMPLETE
SOURCE_OF_TRUTH: <exact old/new writer, read-model or docs; approved boundary>
DEPENDENCIES: <merged SHA / issue / formal Owner gate>
OVERLAPPING_OPEN_PRS: <numbers, or NONE VERIFIED>
BRANCH/COMMIT/PR: <exact refs>
FILES_CHANGED: <paths>
INVARIANTS: <specific conservation / save / RNG / legal-entity effects>
TESTS_RUN: <commands and actual PASS/FAIL; skipped/not-run clearly labeled>
CI_FINAL_HEAD: <exact head; applicable job status; real WebKit if needed>
DEFERRED_TO_Q: <cross-system audit, scale, simulation, balance tasks>
KNOWN_P0_P1: <issue, affected capability, owner disposition>
BLOCKER/OWNER_DECISION: <exact required decision, or NONE>
NEXT_READY_SLICE: <smallest independent authorized task>
```

A `F_COMPLETE` report is never a substitute for the later `Q_COMPLETE` report. The current phase tracker and merged GitHub code, **not this snapshot**, decide what is actually finished.

## 9. Coordination of multiple agents

- Assign **one writer owner per area**, and one PR at a time per overlapping authority family. Other agents may do read-only specs, tests or disjoint pure adapters on their own branches.
- Stable shared interfaces are proposed once, then consumed by feature PRs; do not independently create rival ledgers/debt/ownership sources.
- Different AI vendors have no preferred ownership rights: any agent can design, code, run tests, open PRs or independently audit **if the actual environment permits**. Agent identity is not a gate.
- An "independent review" is a review of actual HEAD diff and evidence, preferably by a distinct model or human; if unavailable, document limitation and use Owner decision rather than falsely claiming independent verification.
- For open designs `#981` / `#995–#1003`, verify and reconcile before merging; do not import draft claims as main authority.
- Old accepted tests continue to run where applicable. This policy changes **when exhaustive new testing occurs**, not the definition of a truthful CI result or an implemented feature.

## 10. Definition of the final handoff

Stage F delivery: all in-scope phases have honest `F_COMPLETE` records, gameplay integration paths exist, remaining unsupported/risky features explicitly listed and approved as deferred/disabled, migration status clear, test registry intact, and Owner authorizes Quality Campaign Entry.

Stage Q delivery: consolidated report of exact reproducible test matrices, root causes/fixes, final merged SHA, P0/P1 closure, approved P2 exceptions, save and WebKit/physical iPhone evidence, performance budgets, market/game-balance sign-off, and Owner release decision.

**Operational summary:** **Build the engine completely; protect the data while building; then audit the integrated engine deeply.**
