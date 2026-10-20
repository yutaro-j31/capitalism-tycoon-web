# Local verification before CI

**Owner decision:** 2026-10-20 JST. Adopt the Claude Code proposal to stop using GitHub CI as the development loop, because runner queueing (not test runtime) was the main bottleneck. On 2026-10-20, 10+ of 12 shards of a PR sat `queued` for over 40 minutes.

This document records the decision and the operating procedure. It does **not** relax any merge rule in `AGENTS.md`: a PR still needs green CI on its final HEAD, independent review and the existing Owner conditions before merge.

## Proposal and status

| # | Measure | Status |
|---|---|---|
| 1 | Run the canonical shards locally (`TEST_SHARD=<A–L> node tests/run-all-shard.js`, in parallel) | **Adopted.** See the measurements below. |
| 2 | Select and run the tests a diff can affect: `node scripts/select-affected-tests.js --run` | **Adopted** (this change). |
| 3 | Integration-branch verification: stack the merge candidates locally, verify once, then let CI confirm | **Local part adopted.** Merging on a single CI run of an integration branch instead of each PR's final-head CI changes the merge rule and still needs an explicit Owner decision. |
| 4 | Self-hosted GitHub Actions runner on the Owner's Mac (removes queueing; real Safari/WebKit) | **Owner decision pending.** This would be a separate CI-only PR. |

## Procedure for every agent, before pushing

1. Make the change on a branch based on current `origin/main`.
2. Run `node scripts/select-affected-tests.js --run`, which selects:
   - the always-on contracts (test registration, shard matrix, workflow path filters);
   - the Phase 0.5 / 1 / 2 permanent acceptance gates, the cash writer ratchet and the module-split test whenever any `js/` file changes. Their lexical writer inventories react even to comment text;
   - every changed test;
   - every Node step of a workflow whose path filter matches the diff;
   - every canonical test that loads the changed production module.
   - for a core module (`runtime`, `data`, `engine`, `simulation-rng`, `finance`, `economic-operation`, `economic-settlement`, `save-v9`, `semantic-hash-v2`), every canonical test that boots the game through `tests/harness.js`, directly or through a local helper it requires (for example `ma-acquisition-financing-fixture.js`). That is close to the whole suite, so for a core change run all canonical shards (measure 1) instead.

   Some workflow jobs cannot run here as they are. Their commands are listed as **CI-only** and not run, unless a pull-request job or the canonical suite also runs the same test. A job is CI-only when it:
   - reads `${{ matrix.* }}` (shard runners);
   - downloads artifacts from upstream jobs;
   - has a job-level `if:` that cannot hold on a pull request (another event, or `workflow_dispatch` inputs).

   Tests run by aggregator scripts and declared in `tests/test-execution-registry.json` count as tests, so changing one selects it.

   Use `--broad` to also include workflows guarded by directory-wide filters such as `js/**` (the strategy-balance campaign). Use `--json` for a machine-readable plan.
3. For a large or cross-cutting change, also run all canonical shards locally (measure 1).
4. WebKit tests in the plan are listed but **not run** unless the machine has Playwright WebKit. A Chromium run is not WebKit evidence.
5. Push once. Do not push to a PR whose CI for the current head is queued or in progress (`AGENTS.md` §4), unless a human asks to supersede it.

Report local evidence as **LOCAL**, with the command, HEAD, Node version and result. Report CI separately. Never present one as the other.

## Measurements (2026-10-20)

**LOCAL, canonical shards.** Cloud container with 4 vCPU, Node 22, four shards in parallel (`TEST_SHARD=<X> node tests/run-all-shard.js`), on `8de12935`:

| Shard | Wall time |
|---|---|
| A | 1489 s |
| B | 1810 s |
| C | 1530 s |
| D | 1826 s |

Shards E–L were not completed: the container restarted. Running all twelve locally therefore takes roughly 1.5–2 hours on 4 vCPU. It is a pre-merge check for large changes, not a per-push loop.

**CI, same suite.** Run 39342119711:
- Each shard runs its tests serially, in 10–29 minutes.
- Runner speed varies by about 1.85x between runner images.
- Queueing before a shard starts was often longer than the shard itself.

**LOCAL, affected selection.** For a registration-only merge (8 changed files), the selector picked 19 Node tests and listed 45 WebKit tests. Most of those tests come from workflow path filters, and the plan finished in about the time of its slowest test. For a single production module it typically selects the gates plus that module's tests.
