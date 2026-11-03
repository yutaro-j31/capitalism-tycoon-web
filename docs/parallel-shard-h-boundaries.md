# H declared shared-write boundaries (read-only)

This tool checks a declared grouping; it never schedules phases, runs H test bodies,
changes the production runner or qualifies H parallel execution. The catalog covers
only the two known **direct canonical invocations**, not all indirect/npm/native
writers. Every other invocation remains unqualified even after a successful audit.

```
node scripts/parallel-shard-h-boundaries.cjs manifest CLEAN_SOURCE_ROOT FULL_SHA
node scripts/parallel-shard-h-boundaries.cjs audit CLEAN_SOURCE_ROOT FULL_SHA PLAN_JSON
```

The source must match the explicit full SHA with clean tracked files and no existing
lazy-load scratch target. The two catalogued writer files must match their pinned
SHA256 values in the tool. Changed files/absent invocations require catalog review;
this is selected evidence, not exhaustive dynamic dependency closure. Existing
metadata enumeration creates only its private temporary capture; no H workload runs.

A plan carries sourceSha, enumerationDigest and an array of nonempty phase arrays.
Each entry is a canonical invocation **index**, so repeated command identities and
compound npm invocations are preserved, not deduplicated. Every index must occur
exactly once, and each catalogued writer must occupy a singleton phase. Declared
phases are assumed sequential by this metadata check; an executor would still need
separate enforcement and failure/crash-containment proof. The remaining group is
not an instruction or permission to run its members concurrently.

Local source3e18399645323c14ff663361ff02875702bf5308 enumerates54 H invocations,
digest042169a86d6b26f831438660daf8c3fa212efd7a1be0f35e31507f1f455d636a.
Indices18/19 are lazy-load-recovery and static-asset-cache-coherence; their protected
paths are js/_scratch-lazy-load-negtest.js, css/d-ui-map-phase2-markers.css and
prototypes/map-world-preview.js. The candidate has group sizes1/1/52. A plan mixing
a known writer with another invocation is rejected even if complete coverage remains.

Exit0 means only known-writer declaration boundaries passed. Output always retains
catalogExhaustive=false, parallelExecutionQualified=false, productionAuthorized=false;
52 other invocations, memory/ports/processes and dynamic write behavior are unqualified.
Unit controls use metadata enumeration/synthetic pins and join the existing required
write-audit self-test. No workflow/job/step/registration/timeout/parallel setting changes.
J/C remain2, E/K remain serial, H/I production changes and E#1203 remain Owner-held.

[Retained manifest, declared plan and scoped result](ci-evidence/h-declared-boundaries-3e183996.json)
preserves all54 invocation identities and the two source fingerprints for that pin.
The required metadata controls replay the declaration; they do not turn this record
into runtime safety evidence. A separate clean-source CLI invocation produced this
manifest, accepted its complete candidate and rejected a complete co-grouped writer
plan with exit1. The source checkout remained clean throughout.
