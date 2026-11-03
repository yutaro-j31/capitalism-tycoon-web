# I serial baseline: isolated hosted Node22/24 evidence

The I profile added in #1292 has metadata and synthetic controls, but full I8
resource/output/process evidence remains unmeasured because the local Node/procfs
PID namespaces do not agree. This experiment collects one serial pass per hosted
Node version at fixed source555ca4042f183ba01aebb4c1df06be094fdf09bb (main after
#1292). It does not rerun an unchanged successful HEAD or qualify a moving main.

The existing optional `parallel-process-diagnostic` Node22/24 job keeps its runner,
90-minute timeout, fail-fast false, contents-read permission and14-day always-upload
artifact policy. Its job gate accepts only the two explicit PR branches:

- `ci/parallel-shard-process-diagnostic`: preserves the existing E source20dcfe71
  checkout and E33 serial/two diagnosis. Both E steps are branch-guarded.
- `ci/i-serial-resource-evidence`: checks out the fixed I source with credentials
  persistence disabled, retains metadata-only I8 preflight, then runs full I8
  serial with byte-exact stdout/stderr retained. All three I steps are guarded.

No new job, runner setting, canonical dependency, production variable, matrix,
timeout or main/schedule/dispatch execution is introduced. Other PRs do not run
this optional job. Existing process-group fault controls and runner integrity
regressions run first on the selected hosted Node; those are separate controls,
not parallel I workloads. E #1203 remains Owner-held and E2 needs separate approval.

[Metadata manifest](ci-evidence/i-serial-source-555ca404.json) records all8 invocation
identities, digest, seen628 metadata contract, runner hash and unqualified shared
pattern scan. It was built from an exact clean checkout with test bodies executed0.
No exhaustive write/dependency audit or runtime PASS is implied by this manifest.

Hosted full execution must pass unchanged PID identity/failure/timeout/signal/
output-buffer/residue gates, all8 counts, retained raw bytes, diagnostic sampled
system-memory bound<=50% physical, final groups empty including zombies, and
tracked source/HEAD pin before/after. I parallel levels remain empty; one serial
pass has outputParity=null. Reports retain actual Node/host/source identity,
per-command sampled RSS/CPU and longest invocations.100ms sampling may miss peaks;
host in-use memory includes unrelated activity. Different hosts prevent a causal
Node speedup claim. This is not I2/I4 qualification or cgroup/job attribution.

After execution, fetch both Node jobs/artifacts, retain run/attempt/HEAD/job/source/
Node/host references and verify full reports,8 raw output records, counts, resource
and final-group evidence. Keep failed/unstarted cases and cross-Node raw differences
as unresolved evidence; do not normalize or label them parity PASS. Workflow or
aggregate success alone is not this evidence audit. Both hosted I jobs and full
applicable final-HEAD CI/review must be read before the experiment PR can merge.
If a diagnostic fails, preserve artifacts and investigate; do not ritual-rerun a
passing HEAD or weaken gates to obtain a result. Production I stays serial, J/C2
and E/K1 remain unchanged, and #1282's K cross-Node raw gap remains NOT_FIXED.
