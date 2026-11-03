# K historical evidence source drift

`node scripts/parallel-shard-k-source-drift.cjs BASELINE_ROOT BASELINE_SHA CURRENT_ROOT CURRENT_SHA` compares two exact, tracked-clean source checkouts. Both full40-character SHA pins are required. It reuses the existing K evidence auditor's metadata-only enumeration and `TEST_SHARD_CONTRACT=1` path, requiring all29 invocations at each source. The Node metadata children run; **K test bodies do not run**.

The report separates command digest equality, registry seen count and runner SHA256 equality from committed input changes. It compares every tracked entry's Git object ID, type and mode, preserving added/deleted files and mode changes. Renames appear as deletion/addition; no semantic rename or dependency inference is attempted. NUL-separated tree records retain filenames containing tabs. `changedDirectInputs` is the union of simple relative Node entry-file paths at both sources. This file set does not deduplicate command invocations; all29 command identities remain in the existing digest. Opaque/flag-first/non-Node invocations are reported as unresolved commands. Missing/nonregular direct files are reported separately.

`otherTrackedChanges` retains **all** remaining tracked changes, including docs, shared production code, fixtures and tooling; none is declared irrelevant to runtime. Untracked files, environment, installed dependencies, native/worker/dynamic imports, filesystem state, OS and host resources are outside this comparison. It does not establish full dependency closure, archive authenticity, output parity, residue, memory headroom or parallel safety. `runtimeExecuted`, `dependencyClosureVerified`, `evidenceRequalified` and `productionAuthorized` always remain false, even if the two trees match. Exit0 means the comparison completed, not that historical safety evidence qualifies the current source. Invalid pins, dirty tracked checkouts or an incomplete K29 enumeration exit1. Review every reported change before deciding the scope of future authorized validation.

## Retained comparison, 2026-11-02 JST

[The retained report](ci-evidence/k-source-drift-9223004d-b3f56a1c.json) compares hosted refresh source `9223004d0bd2e9b0ebb435edf599d01b72020fd0` with main `b3f56a1c8db5b99c02859ef55a03e46428b92c8d` after #1274. Both have K29, registry seen628, command digest `4754f096494cac2753f5d41d59afe3790e70962fa10c8f4b028b6d6c12aaf5ef` and runner SHA256 `78428e0273b7a6aabcdd03f4934b755a20da1966c757450ac0c22984f63c0a27`. Those equalities do **not** imply byte-identical workloads.

Three direct K test inputs changed:

- `tests/phase3-founder-wealth-test.js`
- `tests/phase3-listing-observations-test.js`
- `tests/phase3-pe-fund-interests-test.js`

The report also retains64 other tracked changes with their before/after objects and modes. Unresolved commands/files are empty for this particular comparison, which is not a dependency-completeness claim. No economic source or Work A PR is edited by this tool.

The [historical K refresh results](parallel-shard-k-refresh-results-2026-10-31.md) and [evidence auditor](parallel-shard-k-evidence-audit.md) remain historical. Node22/24 serial/2/4 timings and memory/write observations belong to their recorded source and hosts. The known raw cross-Node stderr difference remains a review gap; it is not normalized by this comparison. No fresh current-source stdout/stderr, memory, port, process or speedup evidence is supplied. K production enabling still requires separate Owner approval; J/C2 and E/K1 remain unchanged, E #1203 stays held.

Regression controls use a private temporary Git repository and29 throwing workload stubs. They prove unchanged trees, same-contract/different-input source, indirect/docs retention, mode changes, deletion, tab filenames, command argument drift, incomplete enumeration rejection, dirty/wrong pin rejection and actual CLI parity. They join the existing required K evidence self-test chain. No workflow, runner, parallelism, archive or production economic behavior is changed.
