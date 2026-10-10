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

## 5. Work order and Owner stops

1. First resolve the task's **scope and authority**: docs/architecture review vs confirmed-finding correction vs approved production slice. State the requested done boundary.
2. Governance/prioritization work may proceed as isolated docs/read-only activity while a P1 fix awaits approval. For each new confirmed P0/P1 stop its production correction, archive red reproduction, account/state/storage impact and minimal solution, then request an explicit single-finding Owner decision. Previous approvals are not reusable.
3. When PE Exit is specifically approved, fix **both** engine and UI paths in one narrow concern using existing runTransaction/#915 checkpoint. Preserve normal differences (engine saved→change/network vs adapter saved-only/no-network) unless Owner approves a contract change. Do not merge #935; migrate its executable RED oracles into permanent canonical regressions.
4. Independently address stockSplit P3-4-007 only under its own existing/renewed authorization, preserving earlier history correction.
5. Reconcile **Track A** inventory against actual final installed prototype/wrappers and direct callers, publish a bounded matrix and missing-path list. Use focused fault harnesses for the first approved issuer family.
6. Produce a reviewed **P3-4 adoption contract** specifying source of truth, exact quantities, compatibility representation, migration/old-save evidence, idempotency, shadow/weekly paths, disabled capability behavior, test gates and rollback. Implement cutover ONLY after slice-specific authorization and readiness.
7. Continue later approved slices/Track B separately; never start Phase 9/10/13/14 settlement authority early.

Keep 1 concern / 1 PR. No overlapping write branches or direct pushes to main. No automatic merging without the existing explicit authorization and successful final-head gates.

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
