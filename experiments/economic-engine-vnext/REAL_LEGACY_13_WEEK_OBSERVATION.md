# Economic Engine vNext — SPIKE-3.7 real legacy observation runner

**Owner:** regular ChatGPT ONLY, [Issue #1038](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1038).
**Parent:** read-only crosswalk draft #1049, stacked on #1048, #1047, #1042, #1041, #1039.
**Evidence status:** extraction harness implemented, **actual full-game execution is NOT verified**.

## The actual gap this addresses

The earlier 13-week fixture uses synthetic, cash-only retail operations. The legacy comparison checked fabricated, finance-schema-compatible records. These tests are useful but **they do not establish legacy game parity**.

The repository's production `tests/harness`, full index script composition, real `TycoonEngine.configure`, `simulationRng.reseed`, `openStore` and `advanceWeek` can supply genuine observations from a reproducible **disposable test game**, without touching production writers or importing any user's personal save.

## New files

- `legacy-13week-capture.cjs` — accepts a supplied disposable engine and selected store identity, advances exactly 13 weeks, snapshots per-week company cash, finance cash effects, full store rows, other rows, inventory book and source provenance. No file I/O or original save import.
- `legacy-13week-headless.cjs` — Node executable using `tests/harness`, fixed host RNG + explicit simulation RNG seed, company configuration, founder capital contribution, one real ramen store, 13 actual week advances; prints machine-readable JSON to stdout. Does not invoke a production browser or saved state.
- `legacy-13week-capture.test.cjs` — 15 mock-engine contract tests covering 13-week step order, store categories, noncash COGS/rent handling, malformed rows, missing/duplicated row evidence, cash diagnostics and no-save behavior.

## Run in a complete checkout

```bash
node experiments/economic-engine-vnext/legacy-13week-capture.test.cjs
node experiments/economic-engine-vnext/legacy-13week-headless.cjs > /tmp/vnext-legacy-13week-observation.json
node -e "const o=require('/tmp/vnext-legacy-13week-observation.json');console.log(o.compareToSyntheticFixture)"
```

Record the exact git SHA, Node version, exit codes, and sanitized output SHA. Source files should be checked out from the vNext draft branch; do not run on an old main-only checkout missing the experiment scripts. All state is created under the test harness's isolated browser/storage context. There is no import of the user's personal SAVE_KEY or durable IndexedDB content.

## Evidence classification

- The CLI reports actual weekly store-level finance rows, broad financial events, cash delta vs posted cash effect, inventory book and selected store ID. Game weeks may start at 2 rather than 1 since production advanceWeek increments before posting.
- The crosswalk labels **UNSUPPORTED** for supply inventory noncash COGS, rent, maintenance or other unimplemented semantic categories. This is a vNext gap, not an automatic current-game P0/P1.
- **EVIDENCE_BLOCKED** means missing/duplicated store categories or provenance problems. The runner exits nonzero to prevent treating incomplete evidence as a financial match.
- **MATCH** on fabricated rows or on a synthetic fixture with different real-world demand assumptions is NOT a parity claim. Only a source-matched, comparable observation can establish numerical parity.
- Company cash delta versus summed finance rows is diagnostic and can reflect other corporate and procurement events. Never attribute the difference to the selected ramen store without source proof.

## Current validation and environmental limit

Previous experiments had 168/168 PASS on **GitHub-fetched files evaluated in a V8 CommonJS harness**. The new mock observer test passed 15/15 using the same type of harness. These are NOT Node binary or full production browser results.

The current local sandbox has Node.js v22.16.0, but `git ls-remote` to github.com fails because DNS resolution is disabled. GitHub connector access does not mount a full repository checkout into this filesystem. Consequently the real legacy engine **has NOT** been advanced for 13 weeks in this conversation and there is no credible observed parity result yet. The commands above are prepared for an execution environment with a checkout.

## Next gates

1. Execute the real headless runner on the full checked-out repository and capture the actual immutable evidence.
2. Investigate EVIDENCE_BLOCKED without modifying current finance writers.
3. Scope separate **experimental** inventory procurement, accrual COGS, rent, maintenance and quarterly tax adapters based on genuine legacy records.
4. Run direct Node, injected durable IndexedDB/storage failure and real WebKit tests before any production cutover request.
5. All branches/files under `experiments/economic-engine-vnext/` remain **regular ChatGPT only**. Work and Claude Code continue present Phase 3/4 tasks; no experimental PR is approved for main merge.
