# Memory capacity provenance for CI diagnostics

`node scripts/parallel-shard-memory-snapshot.cjs` emits a read-only point observation to stdout. It launches no shard, subprocess, sampler or workload. The existing optional C/E/K process diagnostic now retains this observation as `memoryCapacitySnapshot`; its existing `physicalMemoryBytes`, assertions, thresholds, process cleanup and execution allowlist are unchanged. The required process-diagnostic `--self-test` chain covers the new controls without a new workflow/job or canonical test invocation.

The I follow-up in [the H/I report](parallel-shard-hi-readonly-2026-10-31.md) lacks current memory measurements. This helper makes future capacity evidence reproducible, but does **not** supply I workload peaks, per-command/tree usage or a parallel safety gate. I remains unqualified. Existing C/E/K archives are unchanged and do not acquire these fields retroactively.

| Field | Native source | Meaning / limitation |
| --- | --- | --- |
| hostPhysical | `os.totalmem()` | OS-reported physical memory; may exceed the process's resource limit |
| hostFree | `os.freemem()` | OS-reported free memory; not Linux MemAvailable or a test's budget |
| processConstrained | `process.constrainedMemory()` | OS constraint reported by Node/libuv; zero means no constraint or unknown, retained as null/unknown |
| processAvailable | `process.availableMemory()` | Native available-memory estimate for this process at this point; zero is preserved as an observed value |
| selfRss | `process.memoryUsage().rss` | This diagnostic process only, excluding descendants |
| v8HeapLimit | `v8.getHeapStatistics().heap_size_limit` | This process's V8 heap limit, not total RSS or a workload peak |

See the official [Node process API](https://nodejs.org/docs/latest-v22.x/api/process.html#processconstrainedmemory), [availableMemory API](https://nodejs.org/docs/latest-v22.x/api/process.html#processavailablememory), [OS memory API](https://nodejs.org/docs/latest-v22.x/api/os.html#ostotalmem), and [V8 heap statistics](https://nodejs.org/docs/latest-v22.x/api/v8.html#v8getheapstatistics). All values are bytes. Missing APIs, thrown probes and invalid values are retained separately as `unsupported`, `error` or `invalid`, with null bytes; there is no fallback to host free/total. A constrained value of zero does not establish that memory is unlimited. Invalid means negative, nonnumeric, nonintegral or outside the safe integer range. The original native receiver is preserved.

The probes occur sequentially between `startedAt` and `completedAt`. They are not an atomic snapshot, cgroup hierarchy audit, reserved/exclusive budget, available runner-slot count, memory pressure series or peak measurement. No ratio or safe parallelism is derived. `atomicSnapshot`, `peakMeasured`, `processTreeMeasured`, `parallelExecutionQualified` and `productionAuthorized` are always false. Do not sum independent processAvailable observations or subtract a self RSS from host free to claim remaining capacity.

## Local retained observation

[Local evidence](ci-evidence/memory-capacity-local-3e183996.json) records the helper source SHA256, checkout source `3e18399645323c14ff663361ff02875702bf5308`, Node version and raw snapshot. This is a Work scratch environment, **not** a GitHub runner or I test observation. It demonstrates a host/process-limit discrepancy without inferring anything about hosted CI. Reproduce with the CLI above; time-dependent values will differ.

The regression controls cover host64GiB versus constraint8GiB, independent available3GiB, zero/unknown versus observed zero, absent APIs, exceptions, invalid values and native receiver/call count. The process-diagnostic self-test also performs its existing byte-output and C evidence controls. No H/I workload, new C/E/K diagnostic workload, production parallelism change, economic source change or E hold release is included. Future I qualification still requires current source-bound Node22/24 workload evidence, sampled tree/system peaks, enforced memory headroom, output parity, resource conflict and residue checks plus separate Owner approval for production.
