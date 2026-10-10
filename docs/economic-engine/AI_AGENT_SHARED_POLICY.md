# Capitalism Tycoon Web — Shared AI Economic Development Policy

**Scope:** Economic Engine / Phase 3 and later economic migration work.  
**Status:** Proposed on an isolated documentation PR; becomes repository policy only when reviewed, Gate-accepted, and merged.  
**Owner intent:** Every AI (ordinary ChatGPT, ChatGPT Work, Codex, Claude Code, or successor) follows the SAME evidence, authorization, sequencing, and reporting rules. The selected model does not alter the contract.

## 1. Source of truth and entry procedure

- Root `AGENTS.md` is the cross-agent router and safety baseline; `CLAUDE.md` defines project/runtime invariants. This document is the scoped economic-development policy. Read only the relevant contract sections, not all historical documents.
- The normative economic design is `docs/economic-engine/ECONOMIC_ENGINE_ROADMAP.md`, `ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md`, Phase 0–3 contracts, and the exact approved issuer/slice contract. For current progress and Owner decisions use GitHub issues #909 and #922 and merged PR evidence; a chat recap or old SHA is not authoritative.
- At EACH task start verify current remote main SHA, open/draft PRs and overlapping branches, issues/Owner permissions, current CI/workflows, actual runtime entry points, and test registration. Never base new work solely on the SHA printed here. Never overwrite another worker's branch or modify active diagnostic PRs.
- Explicit current Owner task instructions and per-finding approvals control the work. A general request to accelerate development does NOT approve new P0/P1 fixes, source-of-truth cutovers, irreversible migrations, or a merge.
- Work without GitHub permissions or actual executable tests is limited to design, read-only auditing, review, and an honest handoff. Do not claim unexecuted tests, WebKit, device testing, or commits.

## 2. Architecture choice: staged Economic Core replacement, NOT a full-game rewrite

Retain the playable game, production UI, save-v9 compatibility, the deterministic harness, already-cut-over Phase 1/2 ledger/accounting, existing runTransaction, and PR #915 common persistence checkpoint. Follow the approved **Strangler / Observe → Shadow → Cutover → Projection → Retire** strategy from roadmap §9.

Target transaction shape:

    existing UI / legacy engine / weekly call
      → explicit economic command for an APPROVED issuer/operation
      → one transaction/validation/commit boundary
      → existing economic operation + legal-entity ledger
      → compatible save + UI projections

- For each cut-over economic fact: exactly ONE authoritative writer. No independent registry plus writable legacy mirror, duplicate settlement, silent auto-reconciliation, or shadow-mode mutation. Legacy adapters may remain read-only until their specifically approved phase.
- Consolidate multiple entry routes (including raw UI helpers and installed prototype wrappers) at the transaction boundary while preserving route-specific normal outcomes, event order, save count, notifications/network behavior, pricing, RNG order, and accounting. A blind UI-to-engine reroute is not a safe refactor.
- No sweeping rewrite of the entire engine, weekly tick, storage backend, or save format. Evaluate replacement vs targeted adapters using a concrete file/dependency/test/old-save risk estimate before seeking any larger Owner decision.
- Keep strict separation of company, founder/personal, fund, subsidiary and LP/GP/co-invest accounts. No economic posting merely for ownership registry adoption. Preserve SAVE_KEY=capitalism_tycoon_web_v1 and saveVersion=9, deterministic simulationRng, exact share/asset conservation and iPhone Safari as the priority client.
- New economic operations should use the approved command/transaction boundary; direct cash/share/fund writer additions need a separately documented exception and tests.

## 3. Two independent audit tracks — do not gate P3-4 on 277 raw candidates

**Track A — P3-4 issuer-family cutover (critical path):** Start from `PHASE_3_P3_3_CONTRACT.md`. Scope the approved single-common-share-class player company (and only explicitly approved issuer families). Inventory every actual mutation or replacement path for issued, treasury, original founder, personally purchased own-company shares, issuer/generation identity and related cash/receipts: app/engine UI, installed wrappers, inactive base/direct helpers where reachable, shareholder actions, IPO/investor/stock split/M&A share swap/financing, weekly ratchet/margin raw sales, load/import/export, shadow replace, recovery, reset/re-founding and save compaction. Group call sites by economic operation and true commit owner; **prove each bypass and whole-state replacement reaches the same authority**, not merely that its source mentions runTransaction. Never activate a capability over partially adopted facts. P3-4 requires complete Track A coverage and slice-specific approval, runtime failure injection, parity, CI and independent audit.

**Track B — broader economic integrity (parallel register, separate gate):** PE/VC/fund operations, other issuers, property, banking, and unrelated economic methods retain their later-phase settlement authority. Document genuine P0/P1 integrity risks and run targeted fault probes, but do not demand blanket verification of every broad candidate as a P3-4 prerequisite. A confirmed severe defect can independently block safe release/work pending its Owner decision; do NOT silently exclude known P1s to reopen P3-4.

As of the 2026-10-10 diagnostic Draft #935, 617 installed methods produced **277 overinclusive candidates**: VERIFIED 12 / SUSPECT 72 / UNTESTED 187 / BLOCKED 6. These are NOT 277 distinct economic writers and NOT a percentage-complete or P3-4 Gate denominator. Deduplicate by **economic effect + actual commit owner + issuer family**, preserving a call-site/alias map; mark out-of-scope candidates separately with evidence. A label is VERIFIED only with method/reachable-path and executable test evidence.

## 4. Current stop boundary — refresh it before doing anything

- Phase 3 tracker #909: P3-0 through P3-3 completed; P3-4 Ownership Authority Cutover remains STOPPED.
- Issue #922 / diagnostic Draft #935: **PE-PORTFOLIO-EXIT-ATOMICITY-001 is P1 CONFIRMED** in BOTH installed engine and primary PE UI helper routes. #935 is diagnostic-only; DO NOT MERGE. Its Node and real WebKit RED results are failure evidence, not Gate PASS. Correction awaits specific Owner authorization.
- Existing **stockSplit P3-4-007** save-failure atomicity is a distinct unresolved blocker; #921 repaired split history only, not this atomicity defect.
- Do not carry stale statuses forward: confirm current commits/PRs/issues and move resolved blockers only with merged regression and final gate evidence.
- The current request authorizes cross-agent governance documentation and scoped architecture/audit planning; it does **not** retroactively authorize either outstanding P1 production fix or the ownership authority cutover.

## 5. Owner's standing five-step work order — RETAINED

The previously approved #922 sequencing is not discarded or superseded by this architectural clarification. **Scope optimization modifies HOW work is performed, not its priority or authorization.**

1. **Immediate: P3-4-007 stockSplit save P1 correction**, 1 concern / 1 isolated production PR, subject to independently re-confirmed specific Owner authorization and no competing active PR. #921 repaired split history only. Verify installed UI/engine path, false/throw/post-save boundaries, existing PR #915 checkpoint, full state/storage rollback, normal-parity, Node/real WebKit and applicable CI/independent diff gates. A newly confirmed separate P0/P1 still observes the Owner stop boundary; do not construe priority as permission to ignore it.
2. **Parallel when safe: P3-4 Writer Matrix read-only bulk audit.** Inspect all potential economic writers' actual save/exception/transaction/rollback boundaries as a read-only inventory, but deduplicate by economic effect, issuer family, actual writer/commit owner and all entry/bypass aliases. Complete Track A first for P3-4 issuer adoption; retain Track B separately rather than falsely requiring all 277 broad candidates to pass before Track A cutover. New confirmed P0/P1 requires evidence and an Owner decision before production correction; do not proceed with unapproved fixes.
3. **After audit: Shared Transaction Fault Harness.** Design the minimal common fixture/injector/oracle with evidence from the inventory, then build a standalone **test-only** PR when its exact scope and authority are approved. Preserve existing canonical registrations/assertions; changes to permanent CI contract require their own approval.
4. **Only after explicit Owner approval: limited auto-fix authority.** Propose exact eligible same-class defects, excluded scope, proof requirements, mutation and merge permissions, stop and audit gates; do not self-authorize automatic production fixes/merges. Existing AGENTS.md merge restriction and #922 per-finding stop rule remain binding unless explicitly superseded by a reviewed Owner decision.
5. **Spare capacity: Phase 4+ read-only advance design.** Prepare dependency and Acceptance/entry contracts only; no later-phase authoritative implementation or settlement migration before prerequisites and Owner gates.

**Separate newly confirmed blocker:** PE-PORTFOLIO-EXIT-ATOMICITY-001 affects both engine and primary PE UI helper routes. It remains P1 CONFIRMED and unapproved for production correction, with diagnostic Draft #935 unmerged. This does NOT silently change the Owner's order by putting PE Exit before P3-4-007. If Owner separately authorizes PE Exit correction, implement both routes as a narrow concern with existing runTransaction/#915 checkpoint and explicit per-route normal event/save/network parity, coordinating non-overlapping branches and the stop policy.

**P3-4 authoritative cutover remains STOPPED.** Before it can start, close applicable blockers and prove the **entire enabled issuer-family writer graph** (including installed UI, raw helper and whole-state replacement paths), old save compatibility, one authoritative state owner and the slice-specific adoption contract. Subsequent implementation/merge requires its own permission and final Gate evidence.

Keep 1 concern / 1 PR. No overlapping write branches or direct pushes to main. Do not merge diagnostic Draft #935. No automatic merging without existing explicit authorization and successful final-head gates.

## 6. Verification and Gate labels

For each affected transaction entry path: healthy fixture prerequisite, real final installed method, before/after live + ledger + separate accounts, save(false/throw), mirror/IDB enqueue rejection and post-save exceptions, pending/in-flight ordering, rollback of full live/localStorage/cache/pending/durable states, flush/reload/fresh durable-only hydration and healthy recovery save; duplicate/idempotency, deterministic RNG and normal-path parity. Include profits/losses/carry, sale/IPO, company/personal/fund and WebKit **when relevant**. Explicitly identify cases not executed.

Use Node fake IDB and actual WebKit IndexedDB as **different evidence classes**. Do not infer physical iPhone validation from emulation. Preserve all original relevant assertions, canonical shard/runner registration, and event-specific CI execution. A green workflow never proves a diagnostic script that is not registered/executed. Report SUCCESS, failure, cancellation, pending, not-run and scope-SKIPPED separately. No timeout inflation to conceal regression, fake skips, or legacy save repair.

Gate PASS requires the actual scoped tests and applicable canonical CI on the final PR head, independent diff/authority audit with zero unresolved P0/P1, and applicable post-merge verification; without a merge, report PR gate only. Never claim Phase 3 completion from a single remediation's Gate PASS.

## 7. Agent selection on EVERY report

Every work result and handoff MUST include:

- **Current responsible AI:** ordinary ChatGPT / Work / Codex / Claude Code (name actual environment, no impersonation).
- **Recommended next AI:** ordinary ChatGPT or Work, with a one-line reason.
- **Repository main SHA, active branch/PR, scope/approval, changes, tests actually executed, CI status, blocker, next permitted action.**

Default decision:
- **Ordinary ChatGPT:** architecture choices, P3-4 scope trimming, model/contract review, repository read-only inventory, Owner-boundary decisions and independent result evaluation. May execute changes only if actual permissions/testing and approved gates exist.
- **ChatGPT Work:** multi-step repository implementation, real local Node/WebKit fault execution, permanent tests, PR repair, CI review and bounded merge workflow after specific Owner approval.
- **Codex / Claude Code:** optional implementation or separate independent audit if supplied the same policy/issue evidence; no different authority or criteria.
- When Work unavailable use ordinary ChatGPT for feasible connected tasks and prepare a precise Work handoff for work that cannot actually be executed here. Do not promise background execution.

## 8. Done criteria for THIS policy change

Review the PR diff for documentation-only scope and consistency with AGENTS, CLAUDE, roadmap §9, #909, #922 and #935; validate links and source claims. No economic production, save, RNG, CI, test harness, or diagnostic PR changes. Policy is only active on main after approved merge; if still a PR, hand each agent its PR link and ask it to read the proposed policy explicitly.
