# CI timing baseline — 2026-10-27

Measured with `scripts/ci-metrics.js` (read-only; uses the GitHub CLI's existing authentication). This file separates **measurements** from **hypotheses**; nothing here is a guarantee about the current `main` or future runs.

## Reproduce

```sh
# live (needs `gh auth login` or GH_TOKEN; one API call per run, so 120 runs takes several minutes)
node scripts/ci-metrics.js --max-runs 120 --save-raw raw.json --json report.json --md report.md
# offline replay of a saved capture
node scripts/ci-metrics.js --input raw.json --md report.md
```

Definitions: **queue wait** = job `created_at` → `started_at`; **execution** = `started_at` → `completed_at`; **wall time** = run `created_at` → last job `completed_at`. Skipped jobs are never timed; a missing, unparsable or negative span is `n/a`, never estimated. Execution statistics use successful jobs only. A push run is attributed to a PR only from its merge/squash commit subject (flagged *inferred*); a pull-request run falls back to its branch name because GitHub drops the PR link once the head branch is deleted. Job dependencies (`needs`) are not in the API, so the "critical path" below is the last-finishing job / last-finishing shard of each run, not a computed DAG path.

## Scope

- workflow `Test` (`.github/workflows/test.yml`), the 120 most recent **completed** runs at capture time: created 2026-10-23T00:04Z … 2026-10-27T00:28Z
- 118 success, 1 failure, 1 cancelled; events: 69 `pull_request`, 46 `push` (main), 4 `schedule`; wall time is computable for 119 of the 120 (the cancelled run has no completed job)
- other workflows (`ma-acquisition-financing.yml`, `strategy-balance.yml`, …) are **not** covered by this capture
- the 120 runs span roughly 52 PR branches

## Measurements

### Workflow wall time (run created -> last finishing job)

| event | n | mean | median | p90 | min | max |
|---|---:|---:|---:|---:|---:|---:|
| pull_request | 69 | 38.9 | 40.2 | 50.9 | 24.1 | 67.5 |
| push | 46 | 34.8 | 33.0 | 44.8 | 26.5 | 57.7 |
| schedule | 4 | 35.5 | 33.9 | 43.6 | 27.7 | 46.6 |

### Delay before the first job starts

| n | mean | median | p90 | min | max |
|---:|---:|---:|---:|---:|---:|
| 119 | 0.5 | 0.0 | 0.0 | 0.0 | 17.4 |

### Jobs: queue wait (created -> started) vs execution (started -> completed)

| job | jobs | skipped | untimed | non-success | queue n | queue median | queue p90 | queue max | run n | run median | run p90 | run max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Phase 0.5 Extended Acceptance | 119 | 115 | 0 | 0 | 4 | 0.0 | 0.0 | 0.0 | 4 | 33.8 | 37.1 | 37.4 |
| test-shard-* | 1380 | 0 | 0 | 2 | 1380 | 5.0 | 13.2 | 25.9 | 1378 | 20.4 | 24.9 | 27.3 |
| release-readiness | 119 | 50 | 0 | 1 | 69 | 4.6 | 11.6 | 16.8 | 68 | 19.5 | 19.9 | 20.8 |
| iPhone WebKit Smoke | 119 | 69 | 0 | 0 | 50 | 0.0 | 0.7 | 9.6 | 50 | 6.2 | 10.9 | 21.0 |
| iPhone Acceptance Playthrough | 119 | 4 | 0 | 0 | 115 | 0.1 | 11.9 | 19.8 | 115 | 4.5 | 16.2 | 17.4 |
| Phase 0.5 Acceptance Smoke | 119 | 4 | 0 | 0 | 115 | 0.0 | 8.8 | 18.7 | 115 | 0.8 | 0.9 | 1.0 |
| capital-allocation | 119 | 4 | 0 | 0 | 115 | 0.0 | 7.6 | 19.3 | 115 | 0.6 | 0.6 | 0.7 |
| competitor-ai | 119 | 4 | 0 | 0 | 115 | 0.0 | 8.8 | 16.0 | 115 | 0.2 | 0.2 | 0.6 |
| test-shard-contract | 119 | 4 | 0 | 0 | 115 | 0.0 | 10.0 | 19.4 | 115 | 0.1 | 0.2 | 0.3 |
| product-innovation | 119 | 4 | 0 | 0 | 115 | 0.0 | 8.7 | 15.5 | 115 | 0.1 | 0.1 | 0.4 |
| test | 119 | 4 | 0 | 1 | 115 | 0.0 | 0.7 | 15.1 | 114 | 0.1 | 0.1 | 0.1 |
| test-shard-${{ matrix.shard }} | 4 | 4 | 0 | 0 | 0 | n/a | n/a | n/a | 0 | n/a | n/a | n/a |

### Shards

| shard | queue median | queue max | run n | run median | run p90 | run min | run max |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 5.3 | 25.9 | 114 | 19.4 | 20.0 | 10.7 | 21.2 |
| B | 5.2 | 22.3 | 115 | 23.3 | 23.9 | 12.6 | 27.1 |
| C | 4.7 | 23.1 | 115 | 24.8 | 25.7 | 13.5 | 26.6 |
| D | 4.6 | 23.0 | 115 | 23.1 | 24.1 | 13.2 | 25.4 |
| E | 3.9 | 22.8 | 115 | 23.0 | 23.5 | 13.0 | 24.0 |
| F | 5.5 | 21.3 | 115 | 20.3 | 21.1 | 11.4 | 26.2 |
| G | 4.3 | 20.0 | 115 | 21.1 | 22.6 | 11.6 | 25.0 |
| H | 5.5 | 21.1 | 115 | 23.7 | 24.4 | 13.9 | 25.5 |
| I | 4.7 | 25.9 | 115 | 18.5 | 22.8 | 12.2 | 23.6 |
| J | 5.4 | 25.7 | 115 | 25.9 | 26.6 | 13.9 | 27.3 |
| K | 5.5 | 24.9 | 114 | 17.9 | 24.7 | 9.9 | 25.9 |
| L | 5.3 | 25.8 | 115 | 20.9 | 21.9 | 11.7 | 22.6 |

### Last finishing job per run (the run's critical-path end; dependencies are not in the API)

- test: 115
- Phase 0.5 Extended Acceptance: 4

### Critical shard (the last shard to finish in each run)

| metric | n | mean | median | p90 | min | max |
|---|---:|---:|---:|---:|---:|---:|
| queue wait | 115 | 9.0 | 7.6 | 16.2 | 0.0 | 25.8 |
| execution | 115 | 24.3 | 24.3 | 26.4 | 18.8 | 27.3 |
| spread of shard start times | 115 | 8.4 | 7.9 | 15.1 | 0.0 | 23.9 |

- last shard counts: A=2, B=6, C=15, D=15, E=8, F=4, G=1, H=15, I=6, J=36, K=2, L=5

### Pull-request CI

- PRs (or PR branches, when GitHub dropped the PR link) with pull_request runs: 52
- runs per PR: median 1, max 3
- distinct head SHAs per PR: median 1, max 3
- cancelled runs: 0, re-attempted runs: 0

### main push re-validation after merge

- push runs mapped to a PR: 47 (47 via commit message, inferred)

| n | mean | median | p90 | min | max |
|---:|---:|---:|---:|---:|---:|
| 46 | 34.8 | 33.0 | 44.8 | 26.5 | 57.7 |

### Reading the numbers (measured facts only)

- A PR's required CI takes a median of 40.2 min (p90 50.9, max 67.5). The post-merge `main` push run takes a median of 33.0 min (p90 44.8); it repeats the full 12-shard suite.
- The run ends when the slowest shard ends. For that critical shard, queue wait has median 7.6 min (p90 16.2, max 25.8) and execution median 24.3 min (p90 26.4). Shard start times within one run are spread over a median of 7.9 min (p90 15.1).
- Shard medians range from 17.9 min (K) to 25.9 min (J); J was the last shard in 36 of 115 runs, C/D/H in 15 each.
- Median CI runs per PR branch is 1 (p90 2, max 3), and no run in the sample was re-attempted; repeated CI cycles per PR are not the main cost in this sample.
- `release-readiness` (median 19.5 min execution) and `iPhone Acceptance Playthrough` (median 4.5 min, p90 16.2) are never the last-finishing job in this sample.

## Bottleneck classification (hypotheses, to be confirmed by Task 2 work)

| class | evidence | status |
|---|---|---|
| RUNNER_QUEUE | critical-shard queue median 7.6 / p90 16.2 min; shard start spread median 7.9 min | measured; cause not established (plan limit, overlapping runs, or runner pool — the concurrent-run count is not in this capture) |
| TEST_EXECUTION | critical-shard execution median 24.3 min | measured; per-test timings not yet collected |
| SHARD_IMBALANCE | shard medians 17.9–25.9 min | measured; ideal rebalancing of medians would cut the critical execution by roughly 2–3 min (estimate from the medians above) |
| DUPLICATE_VALIDATION | `main` push repeats the whole suite, median 33.0 min per merge, 46 runs in 4 days | measured volume; whether the duplication is removable needs Owner decision and a safety analysis |
| ENVIRONMENT_SETUP | WebKit jobs are not last-finishing in any run | not on the critical path in this sample |
| WORKFLOW_DEPENDENCY | shards `needs` the contract job; contract-job queue p90 10.0 min | observed, not analysed |

## Not measured here

Human review/approval waiting, Codex review latency, fixes per PR (commit counts), other workflows, GitHub plan concurrency limits, per-test timings inside shards.
