# Economic Engine vNext — segregated execution proof runbook

**Owner:** regular ChatGPT only. Tracking issue: #1038. No vNext merger, production writer, old save, or Phase 3/4 changes are authorized by this document.

## Why this exists

The existing mainline release gate `tests/workflow-path-filter-contract-test.js` requires exactly **seven** files beneath `.github/workflows/`. Creating `.github/workflows/vnext-isolated-proof.yml` on the vNext stacked implementation branches made the count **eight**, causing `release-readiness` to fail on experimental PRs #1054, #1058, #1059, #1063 and #1064. The actual experimental Node suites and the disposable legacy 13-week run previously passed independently, but this did NOT make the entire CI green.

**Do not weaken the seven-workflow contract.** Keep all vNext production-independent Draft implementation branches limited to `experiments/economic-engine-vnext/`; do not commit the isolated GitHub Actions workflow into any of their heads, nor merge it into main.

## Independent verification branch

The self-contained GitHub Actions workflow is preserved in a separate **non-mergeable verification branch**:

`experiment/economic-engine-vnext-po-provenance-ci-20261021`

This branch was forked at #1064 original tested-code SHA `3a6cbf9e47afeca312ffac74583e41b6c82ea5f4`. Unlike implementation branches, it intentionally retains the eighth workflow file; this is a **disposable CI laboratory branch and must never be submitted for mainline merge**. It runs the experimental test suites directly under Node 22, the genuine disposable legacy 13-week engine observation, an SHA-256-pinned source finance bridge and source PO graph, and retains short-lived evidence artifacts. Any `release-readiness` check on this laboratory branch is not a substitute for the separate implementation PR gate.

### Code identity and evidence

After the workflow is removed from implementation PR branches, the dedicated verification branch has a **different Git commit SHA**. Never claim that a green verification branch is an exact-HEAD green check for an implementation PR. For each proof, verify that **all executable paths in `experiments/economic-engine-vnext/` (excluding only this informational runbook if needed)** have identical Git blob SHAs between the tested verification branch and the targeted implementation PR. Document the tested commit SHA, comparison result, Node version, test count and links to successful jobs. A new code change on an implementation branch requires synchronizing the verification branch and rerunning the tests before making new code-evidence claims.

The real 13-week legacy fixture, 138 source store finance rows, 13 original receipt digests and 37 purchase-order ancestry links are observational evidence only. `SOURCE_ALIGNED_PARTIAL` and `SOURCE_GRAPH_PARTIAL` are **not** source-to-vNext legal-entity ledger parity. Never invent counterparties or opening inventory/AP or assert durability/WebKit/old-save compatibility without further independent proof.

## Standard review and gate

1. For each implementation PR check latest HEAD/base, the seven-workflow mainline `release-readiness`, all required checks, relevant review threads and diff scope.
2. Verify no workflow file was added, changed or deleted in the PR's stacked diff. All ordinary PR checks must pass (excluding provider-defined skips) before eligibility for any merge.
3. Check prior historical direct-Node results but do NOT label them exact SHA results after the workflow removal.
4. Independently compare test/source blob SHAs against the verification branch and perform actual Node/legacy validation there.
5. Maintain all vNext PRs as Draft, unmerged to main, without explicit later Owner cutover/merge approval.

For a local complete checkout with Node installed:
```sh
for t in core equity store unified 13-week legacy-crosswalk legacy-13week-capture legacy-observation-analysis inventory-ap operating legacy-week-bridge legacy-source-graph; do
  node "experiments/economic-engine-vnext/$t.test.cjs"
done
node experiments/economic-engine-vnext/legacy-13week-headless.cjs > /tmp/vnext-13week.json
node experiments/economic-engine-vnext/legacy-week-bridge-cli.cjs /tmp/vnext-13week.json
node experiments/economic-engine-vnext/legacy-source-graph-cli.cjs /tmp/vnext-13week.json
```

This runbook is documentation-only. It does not make the ordinary GitHub Actions workflows run experimental tests on implementation PRs. Keep that gap visible in the gate reports.
