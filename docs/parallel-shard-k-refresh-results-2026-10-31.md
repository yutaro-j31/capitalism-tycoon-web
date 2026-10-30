# K changed-source Linux evidence — 2026-10-31 JST

PR #1234 exactHEAD `3acba79a45017fe6cb399d39af769b28bacd3c7a`, Test4361 [run41105378256](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/41105378256) completed SUCCESS, including both diagnostic jobs. Workload pin **`9223004d0bd2e9b0ebb435edf599d01b72020fd0`** incorporates Work A's actual same-week split/snapshot tests. Jobs124233631291(Node22.23.4)/124233631393(Node24.22.1), artifacts13005762683/13004808134. Historical165d evidence remains separate; these are fresh changed-source results, not an unchanged rerun.

| Node / host | clean serial s | audited serial s | audited2 s | audited4 s | sampled peak in-use MiB (clean/serial/2/4) |
|---|---:|---:|---:|---:|---|
|22.23.4 / Xeon Platinum8573C|1388.253|1395.377|737.781|749.660|2401/2436/3268/3098|
|24.22.1 / EPYC9V74|1319.355|1314.103|678.633|668.600|2538/2539/3055/3958|

Both have4 logical CPUs; physical memory is15982.05859375MiB on22 and15983.05078125MiB on24. Their own denominators give sampled maximum20.45%/24.76% (<=50%). These are whole-host sampled in-use peaks, not sum of child RSS or an unsampled transient bound. Different CPU hosts do not isolate Node-version performance. Single fixed-order trials are not repeated medians or an isolated instrumentation-overhead experiment.

Audited serial/2 ratios are1.891/1.936, comparing measured trials on the same host/source with write observation, not clean production speedup.4 is11.879s slower than2 on22 and10.033s faster on24. Peak memory is lower at4 than2 in this22 sample, higher on24; neither universal monotonicity nor a4-production recommendation follows. System busy% (clean/serial/2/4) is22:28.95/28.91/57.46/83.20,24:27.57/27.51/54.51/82.07. Preserve per-command CPU/RSS/wall in the archive; do not call test-sum/wall a serial speedup.

## Integrity and output classification

All29 commands pass each of4 rounds per Node (232 successful executions): enumeration digest `4754f096494cac2753f5d41d59afe3790e70962fa10c8f4b028b6d6c12aaf5ef`, ordered labels/commands/args and own-source contract seen628 match. No failed/aborted/notStarted/signal/reason/timeout/rescue, every original leftoverProcesses=false, namespace identity consistent. Final process groups are empty including zombies;174 audited roots have initialized raw JSONL coverage matching reports and no non-initialization Node API events. This is observed API coverage, not proof about every native/syscall/worker/sanitized child. Full hosted process/abnormal/timeout/write controls passed on both versions. Local PID/procfs-inconsistent results remain unqualified; they do not override these hosted measurements or explain historical E local residue.

Every within-Node stdout/stderr capture is byte-identical across clean/audited serial/2/4, including the changed snapshot command. Its clean/serial/2/4 wall milliseconds are22:4053.022/4128.706/4381.261/7757.044 and24:3880.138/3879.067/4173.177/7087.228. Old snapshot payload/timing was not reused.

The offline auditor validates raw output hashes/bytes/line/PASS counts, original flags, metrics, exact source/contract/runner, PID trace/classification/final groups and every raw log. It returns **exit2 cross-node-output-review-required**, not an all-hashes-equal PASS. Cross-Node stdout29/29 and stderr28/29 match. The only stderr difference is `tests/player-crisis-turnaround-ratchet-week-rollback-test.js`, both2613 bytes, one byte at zero-based1707: runtime frame `node:internal/process/task_queues:103:5` on22 versus104:5 on24, within the deliberate IDB enqueue rejection rollback error. Raw bytes were inspected anew; hashes equal the earlier classified pair:

- 22: `38c77360043860f51872789e7dcac5970d5cbffe6674eef69dfcc799be14a435`
- 24: `6e72056b379d257cd3fd2d861560cee7fa3d8b59e1ec21eb8ddf85727058a8ae`

The difference is manually classified with direct evidence; no normalization/hash waiver/exit-code change was introduced. Historical **E local leftover cause remains unconfirmed**, a separate question.

## Complete durable archive and replay

[Full evidence JSON gzip](ci-evidence/k-refresh-hosted-2026-10-31.json.gz) preserves **178 original files byte-for-byte**: two full diagnostic reports, two full control reports,174 per-PID raw JSONL files. Unlike the earlier normalized archive, this one preserves every intermediate trace and every output capture, and can reconstruct the exact input files for the auditor. Each file has relative path, Base64 and SHA256 plus node artifact/job/run/PR identifiers. Gzip mtime0; compressed253142 bytes, JSON1739776 bytes.

Gzip SHA256 `cbd0dbbde22ab5907d2d605e00cdb37db273722eaefe1d8f0c2850a3080aab63`; JSON SHA256 `409fd441652a967eaeb9f2189ab140b2f42256bb1c5438f0357dab796147b759`. Restoration was actually tested into a separate scratch directory: all178 file hashes matched, and replay returned the same exit2/sole difference after all within-Node checks. No network or K workload was needed for replay.

Example restoration into a new empty directory (then use each artifactId subdirectory as ARTIFACT22/24, its full-k-node report, and the explicit922 source pin with `parallel-shard-k-evidence-audit.cjs`):

```python
import base64, gzip, hashlib, json, pathlib, tempfile
blob = pathlib.Path('docs/ci-evidence/k-refresh-hosted-2026-10-31.json.gz').read_bytes()
assert hashlib.sha256(blob).hexdigest() == 'cbd0dbbde22ab5907d2d605e00cdb37db273722eaefe1d8f0c2850a3080aab63'
archive = json.loads(gzip.decompress(blob))
out = pathlib.Path(tempfile.mkdtemp(prefix='k-evidence-'))
for node in archive['nodes']:
    for entry in node['files']:
        relative = pathlib.PurePosixPath(entry['path'])
        assert not relative.is_absolute() and '..' not in relative.parts
        data = base64.b64decode(entry['base64'], validate=True)
        assert hashlib.sha256(data).hexdigest() == entry['sha256']
        target = out / str(node['artifactId']) / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
print(out)
```

## Integration and remaining gates

#1234 was merged as **`142c38e77b1f5b13200663367128effef0860ff6`** only after exact finalHEAD Test4361 SUCCESS22 applicable checks/4 nonapplicable skips, Codex completed/no findings/threads0, complete hosted audit and current main754 integration tree `a13ee6772cf3669908ae26d20ac7f720d7de27b3` with focused auditor/write/workflow/iPhone/diff PASS. Main754's Test4362 remained queued, not relabeled PASS. Actual merge tree matches the integration tree. New-main Test4366/run41120002733 is pending at first observation, not postmerge success. This docs-only evidence PR still needs its own finalHEAD CI/review.

Work A's merged1233 changes only A competitor-stake-float + economic docs versus922; K direct files and selected production/registry/fixtures/runner/package inputs remain unchanged. Active1235(A)/1237(B) tests/docs are not edited or merged by Work B. Full dynamic source closure is not claimed. No production E/K activation follows: J/C2,E/K1 preserved, E1203 held for Owner final merge and separate E2 approval; K enabling separately requires Owner. H/I stay READ_ONLY. #1236 metadata timing PR has no overlapping files, its CI remains active so no push or premature merge. Latest main/HEAD/Owner/CI must be refreshed next cycle.
