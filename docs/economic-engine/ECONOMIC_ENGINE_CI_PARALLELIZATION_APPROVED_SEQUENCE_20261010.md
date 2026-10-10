# Economic Engine CI Parallelization — Owner-Approved Development Sequence

Decision date: 2026-10-10
Repository: `yutaro-j31/capitalism-tycoon-web`
Authoring basis: Owner-approved order after Claude Code independent read-only M&A/PE/VC CI audit and ordinary ChatGPT architecture review.

> **Authority:** Owner approved **the development order and design direction only**. This record does **not** authorize a new CI implementation PR/push, a change to permanent test contracts, a merge, a reduction in coverage, a PE Exit production correction, or P3-4 Ownership Authority Cutover. These actions require their own explicit Owner decisions.

## Source and status snapshot

- Source: Claude Code's 2026-10-10 independent read-only report *Economic Engine CI 並列化・分割設計（M&A / PE / VC）*, supplied by Owner. Predictions remain predictions until measured on a future PR.
- GitHub independently rechecked during this decision: main `cf5e37dc498e074719126b2b856a9e86d19a93b3`; [PR #939](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/939) is merged; [PR #937](https://github.com/yutaro-j31/capitalism-tycoon-web/pull/937) remains OPEN, HEAD `f588a994505a5a7f3db1fcb150c9137a228a0092`.
- The dedicated `stock-split-atomicity` job with a 15-minute budget is on **PR #937 only** and is **not yet on main**. Main's `deal-room` budget is 25 minutes, `comprehensive-ma` is 45 minutes.
- GitHub state is time-sensitive; re-fetch origin/main, Open PRs, checks and merge permissions before work. [Issue #922](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/922) owns writer/CI audit, [Issue #909](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/909) owns Phase 3 progress.

## Approved order

| Step | Work | Recommended lead | Start condition and decision |
| --- | --- | --- | --- |
| **1** | Complete PR #937 P3-4-007: Node/real WebKit/whole applicable PR Gate, clean diff, then request **separate merge approval** | **ChatGPT Work** | Continue current work. Do not merge without explicit Owner approval. |
| **2** | Split four PE/VC WebKit regression scripts into **three static family jobs**, preserving all cases and event coverage, in a new **independent CI-only PR** | **Claude Code** (Work fallback) | **After PR #937 merges**, rebase on latest main and request separate Owner permission for CI modifications and PR publication. |
| **3** | Run and audit the new CI structure: time, runner queue, artifacts, all applicable Gate checks, PR/main/schedule/manual event coverage, clean HEAD diff | **Claude Code** | After step 2 implementation approval; report measured results separately from estimated benefits; merge requires separate permission. |
| **4** | Parallelize the long `test:strategy-balance` in a standalone `comprehensive-ma-balance` job (stage 3a) | **Claude Code or Work**, one owner at a time | After step 2/3 measurement and a new scope-specific CI PR approval. **Do not remove duplicate runs.** |
| **5** | Reconsider matrix jobs after the shared Fault Harness and growth in economic families | **Ordinary ChatGPT** for architecture, Work/Claude for later approved implementation | Optional future stage, **not** a current cutover blocker or CI PR authorization. |

The existing Owner economic priority remains unchanged: first P3-4-007; parallel read-only Track A/B writer coverage; then shared Fault Harness after audit; limited fixes/automation only with approval; Phase 4+ design only in spare capacity. The confirmed PE Exit P1 needs its **own Owner approval** and diagnostic Draft PR #935 must remain unmerged.

## Step 2 — proposed static job layout (not implemented)

Workflow: `.github/workflows/ma-acquisition-financing.yml`.

| Proposed new job | WebKit scripts relocated to it | Claude Code measurement |
| --- | --- | --- |
| `pe-acquisition-atomicity` | `tests/pe-fund-acquisition-save-atomicity-webkit-test.js` | ~3m24s |
| `vc-secondary-atomicity` | `tests/vc-secondary-sale-save-atomicity-webkit-test.js` | ~4m08s |
| `vc-funding-atomicity` | `tests/vc-follow-on-save-atomicity-webkit-test.js`, `tests/vc-initial-investment-save-atomicity-webkit-test.js` | ~5m07s together |
| `stock-split-atomicity` | Already in PR #937, **do not duplicate** | ~5m50s full job |

**Relocation, never deletion:** The four scripts currently executed inside both `deal-room` and `comprehensive-ma` are moved into the new family jobs only when those new jobs are proven mandatory and cover every previously covered event. All other commands and regression cases must stay intact.

**Mandatory invariants and evidence:**

1. **Event-by-event coverage:** PR, main push, scheduled run, and manual dispatch in both `deal-room` and `comprehensive` modes. Present a before/after table listing the actual script responsible for each event. A skipped mandatory new job cannot be counted as PASS.
2. **Job identity:** `deal-room` retains PR/manual-deal-room eligibility, Node20, timeout25, original artifacts; `comprehensive-ma` retains push/schedule/manual-comprehensive eligibility, Node22, timeout45, original Node commands and its job concurrency. Existing `stock-split-atomicity` remains bounded at 15 minutes.
3. **Environment parity:** When moving scripts formerly run under main's Node22 `comprehensive-ma` into Node20 family jobs, demonstrate that their economic oracle and real IndexedDB/WebKit results are equivalent. Do not assume Node version does not matter.
4. **Artifacts:** Unique per-family `MA_DEAL_ROOM_ARTIFACT_DIR` and artifact name, `if: always()`, `if-no-files-found: error`, retention 30 days; preserve all previous artifacts and ensure remaining original upload paths still receive files.
5. **Contract strength:** Update `tests/workflow-path-filter-contract-test.js` to test *event/test coverage* rather than literal presence of the PE script in both original jobs. Preserve existing exact PR/main path sets, forbidden job conditions, pinned Playwright, evidence uploads, and add positive new-job assertions. Run `tests/test-registration-contract-test.js` and `tests/workflow-browser-timeout-contract.js`.
6. **Gate integrity:** All applicable family jobs must count toward merge readiness; verify GitHub required-check configuration or document access limitations and escalate. Consider a dedicated aggregate check if required. Do not allow the legacy `deal-room` alone to mask failure of moved suites, and do not introduce serial `needs` that eliminates concurrency without justification.
7. **Regression protection:** No browser case reductions, test suppression, Node canonical shard removal, IDB fault assertion weakening, PR/main workflow trigger narrowing, unapproved timeout increases, or main direct push. Keep other existing CI and Phase 0.5/1/2 Acceptance intact.

Claude Code estimated **PR M&A elapsed 17.5 min → approximately 6–7 min**, and main `comprehensive-ma` **22.6–33.7 min → approximately 13–22 min**; both **are unverified projections**, exclude runner queue and potentially increase total runner minutes ~20–25%. Validate with exact CI results and distinguish job time from queue wait.

## Step 4 — Strategy Balance parallelization (separate PR)

After stage 2/3: split `npm run test:strategy-balance` into a separate `comprehensive-ma-balance` job, retaining applicable event predicates, Node22, bounded timeout, the pre-existing test command, and concurrency/cancellation semantics. Claude measured 837 seconds **locally**; this is **not an authoritative hosted-runner duration**.

Removing any redundant M&A-vs-Strategy test invocation (**stage 3b**) is a *different concern requiring distinct Owner authorization and same-SHA/event/required-check equivalence proof*. Do not bundle duplicate removal with the parallelization PR. Similarly, the optional `test:progression-balance` move requires explicit scoped approval.

## Stage 5 and other non-goals

- Matrix jobs only after separately approved common Fault Harness and verified required-check/matrix-leg contracts.
- No in-job concurrent shell execution of real IDB fault suites; no reduction in real WebKit fault cases.
- Browser binary cache experiments, duplicate Strategy removal, PE Exit remediation, stock-split DPS/price-floor economic-rule changes, and runTransaction semantic changes are **out of scope**.

## Acceptance and recording policy

Each future PR must produce a precise one-concern diff, normal/fault regression and deterministic replay proof where applicable, Node/static/contract Gate, actual WebKit/IDB results, complete before/after event/script mapping, retention of artifacts, all applicable check statuses, independent final-HEAD clean-checkout audit and measured runtime comparison. Existing main and PR checks are different and neither substitutes for the other; SKIP/CANCELLED/TIMEOUT/PENDING are not PASS.

**Permissions and stop:** CI change/push and merge need separate Owner authorizations. An unexpected confirmed P0/P1 requires evidence, stop and Owner review. P3-4 Ownership Authority Cutover stays STOPPED.

**Next recommended AI:** Work for #937 and its Gate; Claude Code for first family-job CI-only proposal/implementation **after #937 merge and separate authorization**; ordinary ChatGPT for independent architecture/Gate and Owner approvals.
