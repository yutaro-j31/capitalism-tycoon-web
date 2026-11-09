# Optional I serial resource profile

The process diagnostic now accepts `--full-shard I`. It supports only serial
concurrency1 over all8 I invocations, including the npm digital-profitability
entry. No I parallel levels are launched, no canonical workflow/configuration is
changed, and production I parallelism still needs Owner approval. Existing C/E/K
profiles and their parallel/output/resource gates remain unchanged.

First prepare a separate clean checkout at a full40-character source SHA. The
diagnostic and target must use identical runner source. Inspect the execution
contract without running I test bodies:

```sh
node scripts/parallel-shard-runner-process-diagnostic.js --full-shard I --plan-only --root CLEAN_ROOT --source-sha FULL_SHA --report OUTSIDE_ROOT/i-plan.json
```

`iSerialPlan` retains all8 indexed commands, digest, metadata-only contract line,
source pin and shared-state pattern scan. That scan is not an exhaustive write or
dependency audit. `planValidated=true` / `ok=null` means metadata preflight only;
`runtimeExecuted=false`, output parity=null and qualification/authorization=false
must not be reported as I workload PASS. This path requires no PID-namespace
qualification because it launches no test bodies/process groups and sends no
signals. It does execute the registry's metadata-only Node enumerator.

On a Linux environment with matching Node/procfs PID identity, run the optional
serial workload using retained bytes:

```sh
node scripts/parallel-shard-runner-process-diagnostic.js --full-shard I --retain-output --root CLEAN_ROOT --source-sha FULL_SHA --report OUTSIDE_ROOT/i-serial.json
```

The existing identity guard, all-command counts/failure gates, output capture
hash/length checks, process cleanup and rescue-failure behavior remain. I also
requires the same diagnostic50%-of-host-physical sampled memory bound used by
C/K, trace coverage8 and empty final groups including zombies, with tracked
source clean before/after. `iSerialSummary` records wall time, sampled system
memory and the three longest invocations with sampled process-group RSS/CPU.
Sampling100ms can miss peaks; host in-use memory includes other activity. Do not
sum per-command peaks into concurrent memory demand, infer a cgroup limit, claim
a causal CI critical path, or extrapolate I2/I4 safety/speedup. One serial pass
has no comparison: outputParity remains null. Retained raw bytes are available
for future explicitly scoped comparisons; source/Node/host provenance still matters.

Local metadata validation at source94aaee741c6dd8af5ca15193931c4723667518f1
found I8, seen628, digest0b26dd22cdd1b2e25b2de8b9181952607415b145c271e7d6fa5925af4f0d917e,
and no configured shared-state scan matches. Local Node24 PID namespace evidence
was inconsistent, so no I test body was run or runtime safety claimed. Required
self-tests use synthetic runner controls and reject failed/partial/parallel
summary input; C2/E2/K2+4 policy assertions remain, with I parallel levels empty.
