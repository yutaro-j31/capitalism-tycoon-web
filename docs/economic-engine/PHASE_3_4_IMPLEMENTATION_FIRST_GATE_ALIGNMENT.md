# Economic Engine — Phase 3 / Phase 4 implementation-first contract and gate alignment

**Owner decision:** 2026-10-16 — IMPLEMENTATION FIRST. **Effective scope:** Economic Engine Phases 3 and 4; applies to every AI/developer.
**Status:** Owner-approved change to **sequencing of broad validation**. This document grants **no** Phase 4 Entry, writer cutover, save migration, debt policy decision, banking Entry or unconditional merge.
**Authoritative roadmap:** [Implementation-First Roadmap v2](ECONOMIC_ENGINE_IMPLEMENTATION_FIRST_ROADMAP.md) (PR #1017; check that it actually merged). Original [Economic Engine Roadmap](ECONOMIC_ENGINE_ROADMAP.md), [dependency graph](ECONOMIC_ENGINE_DEPENDENCY_GRAPH.md), approved [Phase 3 Entry](PHASE_3_ENTRY_CONTRACT.md) and scoped contracts remain binding for invariants and financial rules. Proposed Phase 4 design/Entry/Exit files in PR #981 are **not** main until merged; reconcile their gate wording with this addendum before adopting them.

## 1. Two completion levels, plus a non-waivable transaction-safety gate

1. **Slice safety gate — S (at each executable PR):** tests/CI/review appropriate to the changed capability, including every existing permanent gate required by the installed code. S is not deferred. A financial writer/cutover must demonstrate complete installed writer family, legal-owner attribution, accounting conservation, save-false/throw and rollback, durable IndexedDB/fresh reload where affected, old-v9 saves/compaction, replay/idempotency, determinism, and relevant real WebKit. Failures block the *affected executable* capability.
2. **Phase functional checkpoint — F:** required phase-specific functions are implemented or explicitly disabled/dispositioned, merged and integrated; every enabled executable slice passed its own S gate; tests in the canonical CI registry still run; exact status of blocked/unsupported functions and deferred Q work is recorded. F means "functional", **not** "fully audited / release-ready".
3. **Economic Engine quality campaign — Q (after all required Phase 0–16 functional work):** broad independent A–L style cross-repository audits, huge multi-seed/property/fuzz matrix, full writer cross-family campaign, 50–1,000-year play/AI stress, performance/load, balance calibration, final repeat of comprehensive fault matrices and full release acceptance. These are deferred **only where not a safety prerequisite for activating a specific writer or feature**.

Legacy documents calling Phase 3 P3-12 or Phase 4 Exit "PASS" are **not** automatically satisfied by F. Record a new `PHASE_3_F_EXIT` or `PHASE_4_F_EXIT` separately from `Q_ACCEPTED`. The legacy phase-wide exhaustive review/A–L **may be scheduled in Q** by this Owner timing decision; targeted independent review of actual executable-authority diffs, required permanent acceptance suites, and specifically approved source-of-truth gates **may not** be deferred.

## 2. What changes and what does not

| Validation / authorization | During Stage F | Stage Q | Rule |
|---|---|---|---|
| Source, contract, identity and unsupported-evidence check | Per touched slice | Cross-domain repeat | Unknown issuer/beneficial/voting/loan identity fails closed |
| Unit/contract/determinism test | Required for touched feature | Broad permutations | No production RNG drift from a pure read |
| Monetary conservation / entity account split | Required for financial execution | Full entity matrix | No transfer of fund/personal cash via company writers |
| Save false/throw, rollback, receipts, IDB and old-v9 proof | Required for modified/activated writer/save family | Exhaustive every-command sweep | Do not merge known asset loss/duplication |
| Complete installed writer inventory | Required for **family authority cutover** | Whole-repository audit | Includes wrappers, raw helpers, weekly hooks, shadow and load/refound paths |
| Existing required CI / applicable iPhone WebKit | Required | Retested in full | Pending/failed != PASS; actual device != emulator |
| Targeted independent diff/cutover audit | Required for affected authoritative writer | Full independent A–L / integrated audit | Document reviewer limitation truthfully |
| Repeated full-repository audit of *unrelated* systems | Not required | Required | Do not redo unchanged proof without a causal reason |
| Massive simulation / Monte Carlo / 100–1,000-year sweep | Only a bounded, slice-specific reproduction when needed | Required within measured budget | Preserve existing permanent harness and registered tests |
| Multi-industry optimization, economy balance and 1,000-company scale | Not required for ordinary slice PR | Required or Owner-dispositioned | No release claim at F |

**Critical exception:** a P0/P1 with global persistence or accounting contamination blocks further dependent executable integrations until isolated/remediated. Otherwise the scope-specific P0/P1 blocks that writer, while unrelated pure/read-only or safely isolated work continues. An "implementation first" label is not risk acceptance.

## 3. Phase 3 work contract (P3-4…P3-12)

**Unchanged approval:** existing Owner-approved P3-0…P3-12 scope and 1%, 3%, >1/3, >1/2, ≥2/3, ≥90% Control Ladder; separate 5%/20% markers; no entitlement alone executes an action.

- **P3-4 controlled adoption:** remains **STOPPED** until its specific source/writer adoption, atomicity, save, exact registered/beneficial holdings and direct/helper/installed-chain evidence satisfy the approved P3-3 contract and Owner cutover decision. Do not invent unowned/unallocated holders, invent historical transactions, or label the whole phase safe. Work on a distinct pure feature may continue if it does not activate/write P3-4 authority.
- **P3-5 external equities / P3-6 M&A subsidiaries / P3-7 PE / P3-8 VC:** first deliver pure family adapters and alias/holder/source evidence; **no** Phase 9/10/13/14 settlement, no new registry writer, and no conversion of ratios/metadata into voting or fund ownership. Reuse the cross-slice proposal PR #995 and per-slice PRs #996–#999 only **after** checking their actual merged state and dependencies.
- **P3-9 entitlement:** pure fail-closed policy projection, exact threshold tests and supported issuer evidence. No management command implied.
- **P3-10 command and UI:** executable only after an explicit effect/permission/issuer/denominator/payer/accounting/transaction contract, backend/UI parity, writer authority where applicable, relevant real WebKit and command-level Owner approval. Pure scaffolding does not authorize the actual command.
- **P3-11 founder wealth:** read-only economic-vs-voting ownership dedup, listed/private valuation and null/unsupported evidence; no switch to personalNetWorth/credit/progression consumers without separate cutover.
- **P3-12 F acceptance:** compile the exact merged capability list, S results, scope-specific ECO invariant proofs, Phase 0.5/1/2 permanent gates, deterministic/reload/old save/CI where relevant and issuer-family unsupported list; execute targeted independent audit for cutovers. Record `PHASE_3_F_EXIT` **only** after those are true and Owner accepts the functional checkpoint. The **expanded** full Phase 3 A–L sweep, large seed/century/whole-world simulations and nonessential untouched-family exploratory audit move to Q. Historical P3-12 proposal PR #1003 is *not* itself implementation evidence.

**If P3-4 remains blocked**, Phase 3 F cannot be declared complete by renaming the blocked capability to "deferred" without explicit Owner removal of scope. This addendum does not approve such removal.

## 4. Phase 4 Entry and execution contract

Formal Phase 4 production Entry **still requires a separate explicit Owner decision**. This addendum is **not** that decision. Phase 4's proposal in PR #981 is not an adopted contract until actually merged/reconciled.

- **Before Phase 4 Entry:** P4-0 architecture/design/Writer Matrix, independent review of the proposal, fixture planning and clearly isolated pure exploration where already authorized. No live debt writer, debt state root, new accrual booking or source-of-truth cutover.
- **Eligibility for Owner Phase 4 Entry:** Owner-accepted `PHASE_3_F_EXIT` supported by merged code and local S evidence; P3-4 authority requirements satisfied for any relevant enabled family; verified current main CI (including applicable WebKit), stable save9 and legal-entity identity, known debt P0/P1 dispositions, Owner decisions on proposed debt accounting/product/legacy data policy. *Full engine-wide Q is **not** an Entry prerequisite.* An earlier Phase 4 proposal's phrasing "formal P3-12 exit" should be interpreted as the accepted F Exit **only after this gate alignment is incorporated in that proposal and the Owner explicitly approves Phase 4 Entry**.
- **After Entry:** execute the dependency path from PR #981's Phase 4 plan: P4-1 schema → P4-2 read adapter → P4-3 reconciliation → P4-4/a/b accrual taxonomy and legacy compatibility → P4-5…P4-11 pure operations/schedules/credit/metrics/receipts → P4-12 adoption contract → separately authorized per-family executable adoption → P4-F functional checkpoint. Split one concern per PR.
- **For pure calculations/readers:** frozen deterministic output, legacy alias handling, read purity, zero posting/save/RNG mutation and focused cases + applicable CI. A global loan-writer audit is **not** required on each pure PR.
- **For each adopted debtor/creditor writer:** exact borrower/lender identity, payable versus principal ledger, no duplicate generic/specialist repayments or interest, no invented refinance cash, whole installed writer closure, atomic commit/save rollback, actual durable IDB and applicable WebKit. No double issuer/founder account attribution. No all-debt blanket cutover.
- **P4-F acceptance:** merged, enabled, dependency-complete functional coverage; scoped audit, actual green S evidence for each executable writer and known unsafe capabilities blocked; ledger/alias ownership correct. Broad full-phase/all-family matrix, expanded fault campaigns and 100–1,000-year/scale scenarios go to Q.

**Known overlapping work:** PRs #989/#990/#1010/#1015 are debt write-safety changes and #1011/#1012 diagnostic RED proposals as of 2026-10-16; verify merge/CI and scope against current main. A draft with fix code is not PASS. Phase 3 PRs #995–#1003, #1009 and #1016 may change state; never assume an old snapshot.

## 5. Consistency with old gate wording and pending proposals

This is an **approved sequencing addendum**, not a rewriting of accepted monetary or legal obligations. When an older gate requires extensive all-systems tests for a phase label:

1. Keep the existing named gate/result historically intact; never falsify past evidence or remove a test.
2. Add a separate `F_EXIT`/local `S_PASS` milestone rather than claim `FULL_EXIT_PASS` or `Q_ACCEPTED`.
3. Specific safety acceptance requirements in P3-3/P3-4, Phase 0.5/1/2, debt adoption and PR CI remain strict. Do not use new scheduling to bypass those.
4. Before merging PR #981 or PR #1003, update its Entry/Exit wording or record a clear reference to this addendum; keep *proposal* status and no implied authorization. If this addendum is not merged, the older formally merged contract continues to control; report the discrepancy.
5. A downstream phase can begin preparations permitted by the dependency graph; it cannot activate a dependent writer before the prior approved capability and explicit Entry/migration decisions.

## 6. Unified AI-agent task and quality-gate checklist

```text
MODE: F_IMPLEMENT | Q_AUDIT
PHASE_SLICE: P3-x | P4-x
MAIN_SHA_AND_CHECK_TIME: <verified>
PR_OVERLAP: <number/status and which files or authority overlap>
AUTHORITY: READ_ONLY | LEGACY_WRITER | PROPOSED_CUTOVER | APPROVED_CUTOVER
OWNER_APPROVAL: <decision or NOT_AUTHORIZED>
GATE_S: PASS | FAIL | BLOCKED | NOT_APPLICABLE, with tests/CI and actual final HEAD
GATE_F: IN_PROGRESS | F_EXIT_ACCEPTED | BLOCKED (never auto-PASS)
GATE_Q: NOT_STARTED | IN_PROGRESS | Q_ACCEPTED
UNMERGED_DOCS_USED: <PR numbers labeled PROPOSAL>
KNOWN_P0_P1: <affected paths, disposition>
DEFERRED_TO_Q: <named campaigns only; no skipped safety prerequisite>
NEXT_INDEPENDENT_READY_SLICE: <target and dependency>
```

Every agent must update the authoritative tracker only with **merged** evidence and exact CI/head/main SHA. One authority family/one writer owner, one concern/PR, no conflicting agent edits. No rerunning unrelated CI merely for ritual. User's request to adopt this documentation does not grant unlimited autonomous production merges, source-of-truth cutover or Phase 4 Entry.
