# C hosted final-process evidence — 2026-10-31 JST

PR #1242 exactHEAD `920ef59964afb29edab3e1a520af88ae8ab84dbe`, Test4377 [run41148541040](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/41148541040) completed SUCCESS, including both C diagnostic jobs. Immutable workload source **`d10a971eb99fb4111fd3a169ba9c34ccb7a81971`**; Node22.23.4 job124379272544/artifact13023074032, Node24.22.1 job124379272518/artifact13023380720.

| Node / host | physical MiB / logical CPUs | serial wall s | parallel2 wall s | sampled peak in-use MiB serial/2 | system busy% serial/2 |
|---|---|---:|---:|---|---|
|22.23.4 / EPYC7763|15983.05078125 /4|1642.177|862.647|2603/2354|28.87/56.85|
|24.22.1 / Xeon6973P-C|15982.05859375 /4|991.604|514.591|2351/2778|27.51/54.32|

All four rounds are25 enumerated/passed, failed/aborted/notStarted0, executed25 at each round. The clean pinned source independently enumerates25 commands, seen628 in its contract, full digest `01ba9573fd09e0bb0ac6de70925cdd1793567c1773679e20a404465f2f0b0593`; all ordered labels/commands/args and runner SHA match. Source is tracked-clean before and after, outputParity/ok true, rescue absent. Per-command wall/CPU/RSS, original flags and byte captures are preserved, not inferred from job success alone.

Sampled whole-host in-use maxima are16.29% on22 and17.38% on24 (each own physical-memory denominator), below50%. Serial-wall/parallel2-wall measured ratios are1.904/1.927 for these same-host/source pairs. These are single fixed-order diagnostic trials, not repeated medians or test-sum/wall ratios. Different CPU hosts do not isolate a Node-version performance effect. No end-to-end production CI speedup promise follows.

## Direct process and byte evidence

Both Linux controls and full existing process integrity regressions passed. Independent artifact inspection checked Node PID/self/numbered stat identity, same PID namespace links, start ticks and pgrp,25 unique traced command roots per round, root spawn PID=pgrp, exit0/signalnull, original leftoverProcesses=false, no reasons/timeouts/failure/rescue, and clean classifications. Every final known process-group listing after the recorded0/100/2000ms observations is **empty including zombies**. This is100 command-group instances across two rounds/two Nodes. Decoded stdout/stderr Base64, lengths, SHA256, stdout line/PASS counts match report measurements for every command.

Within each Node, all25 stdout/stderr byte captures match between serial and2. **Across Node22/24, stdout25/25 and stderr25/25 also match**. No normalization, output/hash waiver or residue-flag suppression was needed. These direct listings close the missing-evidence question for this experiment, not retroactively for historical production runs.

Observed scope is the known detached command groups; it does not prove absence of arbitrary escaped groups, native activity or every process on a shared host. Sampled memory is not an unsampled transient bound. Local PID/procfs-inconsistent measurements remain unqualified. Historical E local leftover cause is still unconfirmed and is a separate matter.

## Durable original reports

[Complete C evidence gzip](ci-evidence/c-process-hosted-2026-10-31.json.gz) stores all4 original full/control reports byte-for-byte (all intermediate traces, final groups and every output capture), relative filenames, Base64/SHA256, source/PR/run/job/artifact identities and a derived audit summary. Schema `c-full-process-evidence-v1` is separate from the K archive format; the K-only archive CLI must not be used as a C verifier. The independent C audit compared clean-source command/contract/runner expectations, decoded original streams, all counts/flags/metrics/spawn/classification/final groups and within/cross-Node bytes. `productionSettingsChanged=false` describes this experiment, not a new enabling permission.

Compressed158841 bytes, JSON924726 bytes, deterministic gzip mtime0. Gzip SHA256 `f33b04eaa4f82191c804c5b328855baa7e0589b5fb46e13c1db987f269b592ce`; JSON SHA256 `572b6ef4ba5dba68380528e17c437252869043716dc79025bb6bf066af182734`. Restoration/file hashes/parsed original report equality were actually rechecked before publication.

```python
import base64, gzip, hashlib, json, pathlib, tempfile
blob = pathlib.Path('docs/ci-evidence/c-process-hosted-2026-10-31.json.gz').read_bytes()
assert hashlib.sha256(blob).hexdigest() == 'f33b04eaa4f82191c804c5b328855baa7e0589b5fb46e13c1db987f269b592ce'
pack = json.loads(gzip.decompress(blob))
out = pathlib.Path(tempfile.mkdtemp(prefix='c-evidence-'))
for node in pack['nodes']:
    assert isinstance(node['artifactId'], int) and node['artifactId'] > 0
    for file in node['files']:
        name = pathlib.PurePosixPath(file['path'])
        assert len(name.parts) == 1 and not name.is_absolute() and name.name not in ('.', '..')
        data = base64.b64decode(file['base64'], validate=True)
        assert hashlib.sha256(data).hexdigest() == file['sha256']
        target = out / str(node['artifactId']) / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
print(out)
```

## Strict offline replay

The retained C pack can now be audited without the earlier scratch audit script:

```sh
node scripts/parallel-shard-c-evidence-audit.cjs --archive SOURCE_ROOT docs/ci-evidence/c-process-hosted-2026-10-31.json.gz f33b04eaa4f82191c804c5b328855baa7e0589b5fb46e13c1db987f269b592ce d10a971eb99fb4111fd3a169ba9c34ccb7a81971
```

`SOURCE_ROOT` must be a clean checkout at the explicit full source SHA. Only contract-mode enumeration is executed there; no C test workload or process-group signalling is performed. Expectations come from that source's runner, ordered commands, digest and contract seen count, not from the archive's derived summary. The reviewed gzip hash is supplied independently. The command checks the C-specific schema, source pin, two distinct positive artifact IDs, exactly two allowed files per Node, canonical Base64, every original file hash, both control identities and Node versions. Bounded decompression (16MiB) and private extraction with cleanup on both success and failure prevent arbitrary artifact paths or retained temporary files.

The full reports must independently satisfy Node22/24 identity, runner/contract/command/count consistency, original flags, memory/CPU metrics, byte captures and every command trace/classification. All three post-run observations must cover the same25 traced groups and contain no members, including zombies. Within-Node parity is mandatory. Exit0 means verified evidence; exit1 means invalid/incomplete evidence or source/namespace/integrity failure; exit2 means otherwise valid evidence with cross-Node output differences requiring review. No byte normalization or residue waiver is applied, and every result retains `productionAuthorized=false`.

The existing short mandatory diagnostic `--self-test` also runs the new offline controls. They restore the actual retained pack, exercise corrupt counts/hashes/outputs, SIGKILL/ENOBUFS/timeout/residue flags, PID mismatch, missing/changed groups including zombies, over-budget memory, wrong archive/schema/source/path/file coverage and a bounded-decompression negative control. Internally consistent output mutations prove within-Node mismatch rejection and cross-Node review status. These controls do not rerun C or convert a PID-inconsistent local environment into hosted safety evidence. Workflow jobs, dependencies, timeouts, shard settings and the canonical C25/K29/E33 execution lists are unchanged.

## Merge and gate boundaries

#1242 merged as **`12e1149e46a8d117d315dae8180e4a8ea875adcc`** after exact finalHEAD Test4377 SUCCESS22 applicable/5 nonapplicable skipped, Codex completed/no findings/threads0, complete Linux artifact audit and current main d20 integration tree `66ff62d483019b1771abe2491c498826cb8e60a3` with diagnostic/workflow/iPhone/archive controls and all-existing-jobs YAML-equivalence/diff PASS. Actual merged tree matches. Main d20 Test4378 was still in_progress, never called PASS; new-main Test4380/run41153479998 pending at first check. This docs-only evidence PR still needs finalHEAD CI/review.

Work A1241 merged only L ma-share-swap test/economic docs versus the pin;1243 continues that L scope and is untouched. Selected production/registry/fixtures/runner/package inputs remain unchanged; full dynamic dependency closure is not claimed. Existing production C26 successful Test observations remain separate and retain their historical final-listing limitation; do not count these four diagnostic rounds as four more production runs. No new production variable/allowlist changes: J/C2,E/K1, E1203 held for Owner final merge and separate E2; K enabling separately needs Owner. H/I remain READ_ONLY with I's historical~4.4GB caution. This evidence does not resolve the historical local E cause or authorize any financial writer change.
