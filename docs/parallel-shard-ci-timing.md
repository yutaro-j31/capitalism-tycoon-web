# Read-only CI timing analysis

`node scripts/parallel-shard-ci-timing.cjs RUN.json JOBS.json [AS_OF_ISO]` consumes GitHub run metadata and the complete jobs response (`total_count` and `jobs`). No network, workflow mutation, rerun, cancellation, variable setting or test workload is performed. Fetch all pages first; truncated pages, duplicate IDs, wrong-run jobs and impossible executable-job chronology reject the input. Output is metadata analysis, **not a release gate or CI-success certificate**.

Run SHA/id/event and observation time are retained. Workflow status/conclusion and each job's raw status/conclusion remain separate from aggregate `test`, canonical12-shard coverage and timing availability. Queued/in-progress runs are pending even if an inconsistent metadata conclusion says success. Cancelled, failed, skipped, neutral and unknown jobs have separate counts; only successful canonical shard jobs enter successful timing medians, with sample counts. A missing timestamp stays null, never zero. A completed run containing pending job metadata is flagged rather than silently considered a complete snapshot.

`jobCreationToStartSeconds` measures GitHub job creation to reported start, not a proven pure runner-capacity queue. `runCreationToStartSeconds` is a separate interval. Aggregate elapsed from run creation and the interval after the last successful canonical shard are reported only when their required timestamps/coverage exist. An aggregate-success job does not make a still-running workflow successful (e.g. the extra K diagnostic jobs). Last shard completion is observed metadata, not proof of a causal counterfactual critical path under different scheduling.

Queued jobs can have placeholder started_at; it is ignored for timing. Real #4345/#4352 data also contains skipped jobs whose reported start/creation is later than completion. Skipped jobs never executed, so their start is excluded, while the raw reported start remains visible. Their placeholder interval is not a workload failure or a zero-duration success. Missing executable intervals and skipped intervals do not contribute to overlap. Running intervals are right-censored at AS_OF; use an observation time appropriate to the captured snapshot. Metadata precision/staleness limits apply.

Maximum observed job overlap covers only this workflow snapshot, with finish events before starts at identical timestamps. It is not the repository/account/organization runner quota, does not include other workflows and cannot confirm the earlier~20-runner hypothesis. No serial speedup is computed from test sums/wall; no main-push reduction, contract dependency change or capacity assumption follows from this tool.

## Validation — 2026-10-31 JST

Short required-contract self-tests cover successful medians, partial/cancelled exclusion, queued placeholder starts, skipped reversed placeholders, missing times, aggregate success with pending workflow, duplicate shard names, failures/neutral/unknown classification, tied intervals and malformed/paginated/wrong-run/duplicate/chronological records. Fixtures are synthetic, not CI performance observations. One added short self-test is the only existing-workflow change; all prior jobs/steps/timeouts/needs/variables remain unchanged.

The CLI/module was also checked against freshly retrieved actual run/job metadata:

| Test | workflow state | successful shard samples | creation-to-start median | job elapsed median | run-to-aggregate |
|---|---|---:|---:|---:|---:|
|4345 /41055453325|success|12|1399.5s|1358s|4546s|
|4349 /41068610757|cancelled|0|null|null|null|
|4352 /41070752147|pending at capture|11|326s|1234s|null|

The pending snapshot's11 samples are not the eventual full-run median. #4345 reproduces previously audited23m19.5s/22m38s/75m46s; its skipped placeholders are handled without masking executable chronology defects. Local Node24 tests/workflow contracts/syntax/YAML/diff pass; final-HEAD hosted CI and review remain separate gates.

## Handoff

Starting main0d2b6026 includes Work A's merged refounding/buyback tests; its Test4352 remained active. #1229 exacte9f28dee fullCI4350/Codex no findings/threads0 and current-main data integration gate passed, merged3759a6e3. New-main CI is not claimed complete. Active economic branches/Owner-held PRs are untouched; Work B uses an isolated branch/worktree and CI-only files. Existing #1171 null-status/signal/error serial defect remains fixed in main, not reimplemented.

J/C2,E/K1 remain; C18 previously qualified observations are retained until newer complete runs are independently audited. Historical C final-group listing limitation and E local leftover cause remain. E1203 stays Owner-held with separate final merge/enabling decisions. K raw write/output evidence is merged through1229; cross-Node one-byte task_queues stack-frame difference is classified, not normalized. No E/K production enabling. Next: verify current-main and this exactHEAD CI/review, use complete metadata snapshots for queue/overlap evidence, distinguish observed delays from unverified capacity hypotheses.
