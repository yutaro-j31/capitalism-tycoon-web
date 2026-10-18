# Phase 3 P3-6 — indirect economic path diagnostic (dependent slice)

**Status:** implementation proposal on `feat/phase3-indirect-economic-paths`; Gate S and final-head CI pending. Base: `feat/phase3-subsidiary-composition` (#1024 head). No merge authorized.

## Scope and authority

`phase3IndirectEconomicPaths.traceIndirectEconomicInterest(source, rootId, targetId)` accepts a read-only `relationships` collection with explicit current/observed direct edges and finite known economic fractions. Only the canonical `relationship-only` asset role is accepted; alias and unresolved roles remain unknown. It returns the product for one unambiguous path; it returns unknown with a reason for cycles, multi-path aggregation, missing source evidence, duplicate edge IDs, duplicate parent-child pairs, missing targets, invalid IDs, numeric precision underflow or bounded graph limits.

This function is a **diagnostic**, not a canonical ownership attestation. It does not verify that its caller obtained `relationships` from a trusted read-model or that the source snapshot token is valid. Do not use its `status: known` output to authorize a command, prove voting control, compute complete founder wealth, or replace the P3-6 canonical snapshot. A trusted upstream canonical source selection is a prerequisite to any future integration beyond opt-in diagnostics.

No cash, debt, ledger, state, save, IndexedDB or RNG writer is added. No P3-4 cutover, P3-10 executable commands or Phase 4 entry is authorized. This slice is stacked on #1024 and remains unmergeable without an explicit Owner decision.

## Focused verification

The focused Node suite checks a unique two-edge product, v9 JSON reload, deterministic ordering, frozen output and frozen input, no source mutation, strict historical exclusion, duplicate evidence, cycles, multi-paths, incomplete or forged fields, accessor non-execution and an adversarial parent/child ID pair collision. Additional bounded path-length, deterministic source-order, maximum-path, isolated-cycle and array-index accessor cases are included.

The initial published source at `4ae87e4a` failed the collision test; this slice fixes that false positive with a collision-free tuple key `JSON.stringify([parent,child])`. Source roles must equal `relationship-only`; other roles are unknown.

## Integration prerequisites

- Verify latest main and #1024; preserve stacked PR base and one-feature/one-PR rule.
- Register the module in `index.html` and the focused test in `tests/run-all.js` and shard K of `tests/run-all-shards.json`.
- Run focused Node test, syntax/static, shard matrix and canonical registration checks, then independent diff review and final-head CI.
- Create a dependent PR against `feat/phase3-subsidiary-composition` after checking branch head and existing PR inventory.
- Do not merge #1019–#1024 or this slice without explicit Owner authorization.

## 2026-10-18 recovery and traversal bound

Recovered remote `54132ce1`, merged current main without rewriting history. The path-count cap alone did not bound dead-end DAG traversal: a 16-layer diamond without the target returned PATH_UNPROVEN only after enumerating all branches. Added a 16,384-visit budget; overflow returns GRAPH_LIMIT with no paths or fraction. The regression was executed RED on recovered code, then GREEN after the fix. Existing depth/edge/path budgets remain unchanged.

This is one diagnostic slice stacked on #1024; canonical restructuring, trusted snapshot integration and full P3-6 remain incomplete. Independent reviewer not executed in this recovery session; prior review evidence is not relabelled as current independent approval. Owner merge approval is absent.

Recovery also detected an omitted module-load-order fixture entry. Added only the new script immediately after economic-read-model, preserving every existing script and order; installed module-split test rerun required.

Final-HEAD automated review reported exotic-prototype acceptance. Added RED/GREEN fixtures for class/custom-prototype source containers, arrays, rows and fraction records, with null-prototype records retained. Validation checks native intrinsic constructor/prototype data descriptors across realms without invoking constructors or accessors. This correction remains a candidate until published-HEAD CI/review conditions are satisfied.
