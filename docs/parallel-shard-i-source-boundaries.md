# I source boundary inventory — 2026-11-02

`node scripts/parallel-shard-i-boundaries.cjs ROOT FULL_SOURCE_SHA` records I's
8 canonical invocations without executing their workload. The source checkout
must match the pin and be clean, including untracked files, before and after.
The existing intercepted shard enumerator supplies invocation identities.

The inventory resolves simple `node tests/file.js` npm scripts and direct Node
entries, follows literal relative CommonJS requires through depth 2, and records
source hashes, line-numbered lexical candidates and unresolved/depth boundaries.
A command's files are bounded to 128; source reads reject paths/symlinks outside
the selected root. Cyclic references are visited once. No script body is evaluated.
The normal required write-audit controls now invoke its synthetic regression test.

## Fixed-source observation

[Retained JSON](ci-evidence/i-source-boundaries-f124d17d.json) is pinned to
`f124d17d3533f9ade7a135d42056bd208dcf404d`, with I enumeration digest
`0b26dd22cdd1b2e25b2de8b9181952607415b145c271e7d6fa5925af4f0d917e`.
All 8 entries resolve; the npm entry resolves to
`tests/digital-portfolio-profitability-test.js`.

Every invocation reaches `tests/harness.js`, whose `new vm.Script` and
`runInContext` calls mark dynamic code outside this literal-require inventory.
The reload-fork test also directly calls `runInContext` twice. Depth boundaries
remain on the VC writeoff, subsidiary relist and PE transfer fixture paths.
These describe truncated traversal edges, even if a target was also reached by
another route; they are not counts of distinct missing files.
The included files contain no matched filesystem/port/child-process candidate;
that is only a lexical result over this limited file set, not absence of writes.

## Interpretation and next evidence

This is a regex inventory, not an AST, dependency-closure proof or runtime audit.
Comments/strings can produce hits. Aliases, computed requires, imports, directory
module resolution, external packages, dynamically loaded index.html scripts,
native code and workers are not resolved. A shell-composed npm script is retained
as unresolved rather than interpreted. No `ok`/safety PASS is emitted;
`dependencyClosureVerified`, `sharedWriteSafetyQualified`,
`parallelExecutionQualified` and `productionAuthorized` remain false.

Use this inventory with the existing npm preload controls and retained Node22/24
serial process/memory evidence to scope the next runtime observation. Before any
I parallel qualification, account for dynamic harness code and the omitted
fixture edges, actual writes/ports and descendant coverage, and memory contention.
No I workload rerun, economic test edit, production parallelism, runner or
workflow change is included here. Existing Owner holds remain in force.
