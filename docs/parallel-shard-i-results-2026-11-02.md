# Retained I serial evidence — 2026-11-02

Workload source555ca4042f183ba01aebb4c1df06be094fdf09bb, diagnostic PR#1294
HEAD e2005c628aaf3a15c10aca842372444adea2dfd8, Test4488/run41396713243/attempt1.
The diagnostic merge e12408a00c9be27b65ce97517c87a79a4ebe3c11 has parents
555ca404/e2005c6 (Git commit API verified). Target source and diagnostic source
are separate. Both optional Node jobs and the complete workflow succeeded.

| Node / job / artifact | CPU / logical CPUs | serial wall | sampled system in-use peak |
|---|---|---:|---:|
|22.23.4 /125119496622 /13120603173|AMD EPYC9V74 /4|1332.817s|4680MiB|
|24.22.1 /125119496678 /13120399249|AMD EPYC7763 /4|1633.568s|4889MiB|

Both report physical16759443456bytes. Each complete I8 serial pass has8passed,
0failed/aborted/notStarted, retained8raw output records, namespace identity
consistency, trace8, empty final groups including zombies and tracked source clean.
Both meet the unchanged sampled-memory<=50% physical diagnostic criterion.
These are sampled host/process-group observations, not cgroup attribution or a
true continuous peak. CPU hardware differs: this is not a causal Node comparison,
repeatability claim, I2/I4 prediction or production qualification.

The three longest invocations in both observations were competitor-product-counter-
reachability (273.202s/340.350s), exploration-style (243.992s/307.723s) and industry-
event-response-plans-reachability (223.345s/245.480s). Full labels/metrics remain
in the raw reports. Their timings are not the complete workflow's causal critical
path. All16 stdout/stderr streams match byte-for-byte **for this pair**. There
was only one I pass per Node; report.outputParity=null still means no within-Node
comparison, and no repeat/parallel output stability is inferred. K's separate
#1282 raw-output difference remains unresolved.

## Offline evidence and regression

The complete three original JSON files per Node (full I, metadata preflight and
process fault controls) are retained as canonical base64 plus per-file hashes in
[the compressed archive](ci-evidence/i-serial-hosted-2026-11-02.json.gz).
Archive64503bytes, SHA256:
`dd5cad52a591da4727642fc3de65327324b0c82a347c221099974bc54bd5592b`.
The original downloaded ZIPs were independently checked against the GitHub API
artifact digests before safe extraction (exact3files each, no traversal/symlink):
Node22 e4e77e707ffc5b6032409c8c96ae0b8504eb2ce3bb22791db76d54569f0127fb;
Node24 b26229146f565577de0391c712af01ba742af502a00d284ddb5d6e29d506a149.
The archive keeps all six original file byte sequences and transport digest/ID
references, not the ZIP containers. Those external provenance checks are recorded
here; offline replay cannot authenticate GitHub or a caller-supplied hash.

```sh
node scripts/parallel-shard-i-evidence-audit.cjs docs/ci-evidence/i-serial-hosted-2026-11-02.json.gz dd5cad52a591da4727642fc3de65327324b0c82a347c221099974bc54bd5592b docs/ci-evidence/i-serial-source-555ca404.json
node scripts/parallel-shard-i-evidence-audit-test.cjs
```

The audit checks the separately retained source manifest, raw hashes/lengths,
canonical8invocations, counts/signals/reasons, resource bounds, process identity/
spawn/final coverage, metadata/control evidence and derived longest-command summary.
Artifact Node labels and all three contained report Node versions must agree;
swapping both artifacts' labels/filenames cannot pass just because both Node
versions are still present pair-wide. Run/attempt/commit provenance fields must be
well-formed, with distinct positive artifact/job IDs and ZIP digests. This checks
internal provenance consistency, not live API membership/authenticity; external
GitHub checks remain necessary. It validates retained evidence consistency, not
exhaustive write/dependency safety.
The point memory-capacity snapshot remains supplementary raw metadata; it is not
used as a replacement for run memory/process evidence. CLI exit0 means retained
serial evidence verified; a valid cross-Node byte difference gives exit2/review-
required, invalid/incomplete evidence exit1. No normalization or failure masking.

Existing required process-diagnostic self-tests replay the archive and corruption
controls (missing bytes, SIGKILL/ENOBUFS/timeout, zombies, memory excess, lost trace,
unsafe namespace, disabled positive fault controls, forged parity and archive/file
hash changes). This executes no I workload. Production I stays serial; J/C2 and
E/K1, E#1203 HOLD, Owner gates and all required CI remain unchanged. Later Work A
source changes require a fresh source comparison, not reuse as latest-main proof.
