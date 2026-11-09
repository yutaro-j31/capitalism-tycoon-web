# Read-only CI timing analysis

## Multiple-run overlap without inferring a runner quota

`node scripts/parallel-shard-ci-overlap.cjs COLLECTION.json [AS_OF_ISO]` reads a collection `{ "snapshots": [{ "run": RUN, "jobs": JOBS_RESPONSE }], "asOf": "..." }`. Each entry uses the same complete run/jobs metadata accepted by the single-run tool, plus repository full name and matching positive `run_attempt` fields on run and jobs. The optional retained `asOf` makes offline replay deterministic; an explicit CLI argument overrides it. Fetch all job pages for each included run before creating the collection. The supplied runs are an explicit subset, not a complete repository/account inventory.

The tool rejects repeated run snapshots/attempts, duplicate job IDs across runs, mixed repositories, mismatched attempts, partial job pagination and invalid chronology. It reuses the existing single-run classifier and timing checks. Only completed-success intervals and observed `in_progress` intervals enter overlap, with running intervals censored at the observation time. Queued placeholder starts and missing starts never become execution. Terminal failed/cancelled/neutral/unknown jobs are omitted from overlap conservatively, even when timestamps are present, and their states remain separately counted. Their consumption is not zero; it is outside the conservative metric. Skipped jobs also do not count. Tied finishes occur before starts using half-open intervals. Output retains a peak timestamp/job/run witness and distinguishes job overlap from simultaneous runs.

`maximumObservedEligibleJobOverlap` and `observedEligibleJobSeconds` cover only those intervals. They are not a quota, billing estimate, speedup prediction or release gate. `capacityQuota=null` and `completeRepositoryCoverage=false` are explicit even for completed successful samples. Missing workflows, other repositories, prior attempts and omitted terminal states prevent inferring account/organization capacity. A pending workflow stays pending independently of successful jobs. Existing required timing self-tests invoke the new controls; no workflow job, dependency, timeout, main-push policy or shard variable changes.

[Retained API metadata subset](ci-evidence/ci-overlap-2026-10-31.json) contains all78 returned jobs of three independently fetched Test run snapshots, with analysis-relevant original fields (no logs/steps); `total_count` and IDs were not reduced. Offline replay uses observation2026-10-31T05:02:46.070Z. All three runs have20 successful jobs and6 nonapplicable skips:

| Test / run | source | event | 12-shard elapsed median | job creation→start median | run creation→first job | run→aggregate completion |
|---|---|---|---:|---:|---:|---:|
|4386 /41159875620|1bb4d6d5|push|1375.5s|311.5s|72s|3260s|
|4387 /41162384114|cb71d308|pull_request|1603s|65s|0s|2162s|
|4389 /41168421553|1b703df9|push|1466.5s|8.5s|1s|2013s|

These are three within-run medians, not repeated measurements on the same source/CPU. Across this explicit subset there are60 eligible intervals/52255 observed job-seconds and a maximum20 simultaneously observed jobs at03:01:37Z spanning runs41159875620/41162384114. The output's20 job IDs identify the witness. This supplies direct cross-run overlap evidence; it **does not confirm a20-runner quota** or show which scheduler constraint caused any queue. E and K remain production-serial, J/C2 unchanged. The separate C production observations retain their historical lack of independent final-group listings; no safety gate is inferred from timing metadata.

`node scripts/parallel-shard-ci-timing.cjs RUN.json JOBS.json [AS_OF_ISO]` consumes GitHub run metadata and the complete jobs response (`total_count` and `jobs`). No network, workflow mutation, rerun, cancellation, variable setting or test workload is performed. Fetch all pages first; truncated pages, duplicate IDs, wrong-run jobs and impossible executable-job chronology reject the input. Output is metadata analysis, **not a release gate or CI-success certificate**.

Run SHA/id/event and observation time are retained. Workflow status/conclusion and each job's raw status/conclusion remain separate from aggregate `test`, canonical12-shard coverage and timing availability. Queued/in-progress runs are pending even if an inconsistent metadata conclusion says success. Cancelled, failed, skipped, neutral and unknown jobs have separate counts; only successful canonical shard jobs enter successful timing medians, with sample counts. A missing timestamp stays null, never zero. A completed run containing pending job metadata is flagged rather than silently considered a complete snapshot.

`jobCreationToStartSeconds` measures GitHub job creation to reported start, not a proven pure runner-capacity queue. `runCreationToStartSeconds` is a separate interval. Aggregate elapsed from run creation and the interval after the last successful canonical shard are reported only when their required timestamps/coverage exist. An aggregate-success job does not make a still-running workflow successful (e.g. the extra K diagnostic jobs). Last shard completion is observed metadata, not proof of a causal counterfactual critical path under different scheduling.

Queued jobs can have placeholder started_at; it is ignored for timing. Real #4345/#4352 data also contains skipped jobs whose reported start/creation is later than completion. Skipped jobs never executed, so their start is excluded, while the raw reported start remains visible. Their placeholder interval is not a workload failure or a zero-duration success. Missing executable intervals and skipped intervals do not contribute to overlap. Running intervals are right-censored at AS_OF; use an observation time appropriate to the captured snapshot. Metadata precision/staleness limits apply.

## Time before GitHub creates jobs

Job creation-to-start alone can omit a long interval before GitHub creates any job. The analyzer now also returns:

- `runCreationToFirstObservedJobCreationSeconds` / `firstObservedJobCreatedAt`: earliest **known API job creation**, not an inferred workflow-admission timestamp or proof of its cause.
- `observedJobCreationCount` / `returnedJobCreationCoverageComplete`: creation timestamp coverage of the jobs **returned in this complete snapshot**, not proof that every future job has been created. No jobs or all creation times missing gives null timing and false coverage; partial missing times retain the earliest known observation with false coverage.
- Each row's `runCreationToJobCreationSeconds`, plus successful canonical `successfulShardRunCreationToStart` (samples/median). For known executable timestamps, run-to-job-creation + job-creation-to-start equals run-to-start; setup/dependencies/concurrency/runner delay cannot be causally separated just from that equality.

Queued jobs may be created without starting. Their creation observation is valid metadata, while their placeholder start still does not enter success timing samples. Pending/cancelled/failed workflow and job classification remains unchanged. All new fields are additive; no workload, workflow setting, network call or release gate is changed.

Complete API responses captured2026-10-31 04:03:47–48 JST reproduce the omitted interval (complete pagination of the then-returned jobs, not all future jobs):

| Test / run | state at snapshot | run→first observed job creation | successful-shard job→start median | successful-shard run→start median | successful shards |
|---|---|---:|---:|---:|---:|
|4358 /41089002951|success|1111s|96.5s|1215.5s|12|
|4360 /41104701943|success|1s|25s|49s|12|
|4362 /41106869138|pending|1394s|null|null|0|
|4361 /41105378256|pending|1s|320s|503s|8|

The8/0-sample pending observations are explicitly partial and will change; they are not final medians or successful workflow runs. In4358, run creation16:20:35Z and first job creation16:39:06Z span1111s, matching previous main4356's completion/updated time16:39:06Z. Existing workflow concurrency group `test-${{ github.event.pull_request.number || github.ref }}` with main cancel=false strongly suggests waiting behind the previous main run. This is a correlation with the configured policy, not direct internal scheduler evidence or proof of runner shortage. PR groups are separate and cancel=true. No concurrency/main-push/dependency/runner-capacity changes are proposed.

New synthetic controls preserve the same job queue/execution metrics while adding1111s before job creation, verify additive intervals, reject invented starts for queued jobs, and retain nulls/coverage for missing/empty snapshots. The required contract job already runs this self-test, so this patch does not add workflow work. FinalHEAD hosted CI/review remains separate from local PASS.

Maximum observed job overlap covers only this workflow snapshot, with finish events before starts at identical timestamps. It conservatively counts completed-success and observed in-progress intervals only. Terminal failed/cancelled/neutral/unknown/skipped jobs are excluded even if their timestamps exist; their diagnostic row timings and state counts remain available. Exclusion may undercount actual runner occupancy, but avoids treating cancellation placeholders as confirmed execution. This single-run metric now uses the same eligibility rule as the cross-run overlap tool. It is not the repository/account/organization runner quota, does not include other workflows and cannot confirm the earlier~20-runner hypothesis. No serial speedup is computed from test sums/wall; no main-push reduction, contract dependency change or capacity assumption follows from this tool.

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

## Exact-attempt identity

Single-run timing analysis requires a positive integer `run.run_attempt` and a
matching `job.run_attempt` on every job. Missing or mixed attempt metadata rejects
the input even when all run IDs, job names and timestamps are otherwise plausible.
The summary retains `runAttempt`. This brings single-run provenance in line with
the existing cross-run overlap auditor; it does not change any timing/state rule.
Use the recorded attempt's jobs endpoint, fetch every page and retain the observation
time. `runCreationTo*` still uses the original workflow `created_at`; it is not
relabelled as the start of a rerun attempt. A normalized connector response that removes attempt/creation metadata is
not a substitute for the raw API fields. Rerunning an old run does not make jobs
from its previous attempt evidence for the new attempt.

[Retained attempt-specific API field projection](ci-evidence/ci-run-attempt-2026-11-01.json)
records run41294566245/attempt1, all26 returned jobs, source URLs and an observation
time. It retains the analyzer inputs, not full job step/actor metadata. The short
required self-test replays this completed snapshot and rejects a deliberately changed
job attempt. This is a metadata consistency control, not a rerun of the workload or
proof that a mixed-attempt response occurred in GitHub production.

## Cross-run pre-start observations

The collection analyzer now returns `preStart` both per run and for the supplied
subset. `startedJobs` / `observedDelaySeconds` count and sum creation-to-start
intervals only for completed-success or in-progress jobs with both timestamps.
`unstartedJobs` / `censoredAgeSeconds` count and sum age since creation, censored at
`asOf`, for known queued/waiting/pending/requested statuses without an observed start.
Terminal non-success jobs, missing creation/start evidence and unknown statuses are
counted in `omittedJobs`; a running job missing its start is not invented queue time.
Zero-second intervals remain samples. These counters partition the observed jobs;
zero samples do not certify that no other waiting jobs exist.

Pre-start seconds are distinct from eligible execution seconds. They may include
approval/dependency/scheduler waiting and are **not proof of ready-to-run demand or
runner scarcity**. Censored ages are unfinished observations, not completed queue
durations. Sums include overlapping job intervals: do not divide them by wall time
and call the result serial speedup, capacity or a causal critical path. Existing
conservative execution eligibility, quota=null and partial-coverage markers remain.

[Retained two-run input projection](ci-evidence/ci-prestart-snapshots-41303594585-41315187678.json)
preserves exact attempt metadata, all returned job records as an input-field
projection (not full step/actor metadata), source API URLs and `asOf`.
It contains run41303594585 and run41315187678 at their recorded source SHAs, not a
claim about the latest main or all concurrent workflows. The required self-test
replays this metadata; no workload is rerun and no production setting is changed.

This retained subset has39 started observations and12 omitted skipped jobs. Its
creation-to-start sum is6232 job-seconds (3754 and2478 per run), **not** elapsed
workflow time. The second run separately records1730 seconds before its first job
was created. No unstarted sample was present in this particular snapshot; synthetic
queued/approval-waiting controls exercise censoring without inventing live data.


## Duration of observed overlap

`parallel-shard-ci-overlap.cjs` now adds `observedActivity` to the existing
collection summary. It integrates the same conservative, half-open eligible
execution intervals, grouped by timestamp. `byJobCount` and `byRunCount` report
wall seconds at each concurrent job/distinct-run count, sorted by count.
`activeSeconds` is their union, not the sum of job durations; `crossRunSeconds`
counts wall seconds with at least two distinct supplied runs active. Multiple
jobs from one run do not count as cross-run activity. Running intervals end at
the retained `asOf`, so pending observations remain censored.

`firstObservedStart`, `lastObservedEnd` and `spanSeconds` bound only the eligible
intervals. `uncoveredSeconds` and zero-count bins describe **internal gaps in this
supplied subset**, never idle runner time. Other workflows and omitted terminal
non-success/missing-start jobs may occupy runners. With no positive eligible
interval there are no bins, bounds/span/uncovered are null, and active/cross-run
seconds are zero. Zero-length intervals and tied finish/start events invent no
overlap. Coverage remains false and quota remains null. These are observations,
not physical utilization, billing, cancellation causes or achievable speedup.

Reproduce without rerunning CI:

```sh
node scripts/parallel-shard-ci-overlap.cjs docs/ci-evidence/ci-prestart-snapshots-41303594585-41315187678.json
```

The retained two-run input above yields an eligible span of11236.341 seconds
(2026-11-01T11:49:32.000Z through14:56:48.341Z), union activity2987.341 seconds,
internal uncovered time8249 seconds and cross-run activity0 seconds. Its
job-count distribution is: 0→8249s, 1→247s, 2→172s, 3→70s, 4→155s, 5→151s,
6→79s, 7→75s, 8→220s, 9→251s, 10→121s, 11→137s, 12→894.341s, 13→415s.
The distinct-run distribution is0→8249s and1→2987.341s. This retained snapshot
is not current-main evidence and does not establish repository-wide inactivity.
Existing required timing self-tests cover gaps, ties, same-run concurrency,
censored running/omitted jobs, no eligible evidence, subsecond intervals,
order invariance and conservation of span/job-seconds.

## Pending final aggregate after all canonical shards

Three additive fields describe the final `test` gate while a workflow is still
pending. `pendingAggregatePostShardObservationSeconds` is age since the last
successful canonical shard ended, censored at `asOf`, only when all 12 shard
successes/end times and a unique pending aggregate are present.
`aggregatePendingWithoutStartAgeSeconds` is that aggregate's age since API job
creation when it has no observed execution start. Queued placeholder starts do
not count. A running aggregate retains the former age but has no unstarted age.
Neither metric is a completed duration or evidence of occupied runner time.

`aggregateCreationOffsetFromLastShardSeconds` separately records the signed
creation offset; negative values mean the aggregate was created before the last
shard ended, not a negative queue duration. Missing/ambiguous aggregate or
incomplete canonical end coverage leaves the relevant field null. A completed
run containing pending jobs remains flagged as inconsistent and gets no ongoing
pending age. Existing completed aggregate metrics and overlap rules are unchanged.

[Retained API projections](ci-evidence/aggregate-wait-2026-11-02.json) include all
26 returned jobs for each attempt1 snapshot, original analyzer-required fields,
source URLs and individual observation times. On 2026-11-02 at 21:52 JST:

| run | source | successful shards | aggregate state | post-shard pending age | unstarted aggregate age | creation offset |
|---|---|---:|---|---:|---:|---:|
|41438867867 (main push)|f124d17d|12|pending|590.066s|589.066s|1s|
|41439426090 (PR #1302)|8a8b37c7|12|pending|267.256s|267.256s|0s|

These snapshots establish a pending final gate despite successful test shards;
they do not establish scheduler cause, concurrency cancellation, account quota,
future completion time or CI success. Both workflows stay pending in the replay.
No workflow dependency, required job, runner setting, production parallelism,
rerun or cancellation changes. Synthetic controls and the retained replay are
invoked by the existing required timing self-test.

## Job wait overlapping other runs' observed execution

The collection report adds `preStartOtherRunExecution` for the subset and each
run. `completedWait` covers job creation to an observed start. `censoredAge`
covers known unstarted jobs from creation to the retained observation time.
Both partition their job-seconds by whether at least one eligible execution
interval from a different supplied run overlapped the wait. Execution is
counted once per waiting job even if multiple other jobs or runs execute
together. Same-run-only activity, ties at interval boundaries, and terminal
non-success placeholder execution contribute no overlap.

Replay the [three retained Test attempts](ci-evidence/ci-wait-cross-run-2026-11-09.json)
with `node scripts/parallel-shard-ci-overlap.cjs docs/ci-evidence/ci-wait-cross-run-2026-11-09.json`.
The snapshot preserves 76 returned job records and the original timing fields,
captured at 2026-11-09 10:44:45 JST.

| Run | State at capture | Completed wait, job-seconds | During other-run execution | Unstarted age, job-seconds | During other-run execution |
|---|---|---:|---:|---:|---:|
| 42538763152 (#1356) | success | 13,972 | 279 | 0 | 0 |
| 42542487065 (#1358) | pending | 13,614 | 3,723 | 0 | 0 |
| 42546684395 (main) | pending | 674 | 674 | 3,293.978 | 3,293.978 |

The sums count each job's wait separately. Only the supplied execution intervals
are visible, so uncovered seconds do not establish idle runners and overlapping
seconds do not establish runner scarcity or scheduler cause. Workflow states
remain separate from the queue metrics. No workflow rerun is needed.
