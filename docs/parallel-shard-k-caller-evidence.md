# K longest test caller evidence — 2026-11-09 JST

The caller diagnostic replays the Node 24 CPU capture for
`tests/full-index-weekly-validate-208w-test.js` at source
`369df100a70cbfc8b42c522cb048603cd4781dde`. The capture and stdout/stderr
record are retained at `0bc48bd542e83c79720704604be9089dcd63344f`. No new
test run or capture was needed. [Pinned capture](https://github.com/yutaro-j31/capitalism-tycoon-web/tree/0bc48bd542e83c79720704604be9089dcd63344f/docs/ci-evidence)

In a clone that has fetched PR #1356, replay the original profile with this
diagnostic. The line argument is the zero-based V8 line. The selector combines
samples at all columns for the specified URL, function and line.

```sh
profile=$(mktemp)
trap 'rm -f "$profile"' EXIT
git show 0bc48bd542e83c79720704604be9089dcd63344f:docs/ci-evidence/k-longest-node24-2026-11-09.cpuprofile.gz | gzip -dc > "$profile"
sha=c5ec9917b9177444ba2518aa4e4ec4853d01a98ec2d73ed9825f3b19a85640c5
node scripts/parallel-shard-cpu-callers.cjs "$profile" "$sha" index.html compare 8591
node scripts/parallel-shard-cpu-callers.cjs "$profile" "$sha" index.html canonicalSerializeV2 8612
node scripts/parallel-shard-cpu-callers.cjs "$profile" "$sha" index.html clone 29182
```

The parser verifies the profile SHA-256, node IDs, sample references, and the
connected tree with one root and one parent per child. It groups the recorded
caller paths closest-first, reports the ten most sampled paths, and counts
samples in omitted paths. Timestamp deltas are unused. A negative delta in this
capture still prevents the original time-weighted report.

The three frame totals match the archived sample-count report out of 465,618
samples. On the pinned source, `loadGame({headless:true, random:()=>0.5})`
from `tests/harness.js` supplies a `scriptMap` for the synthetic `index.html`
URL. For each profiled line, find the last script whose start line is at or
before the one-based profile line. Subtract that start and add one to get
the line within the source file.

| Frame | Samples | Distinct paths | Samples outside top 10 | Largest path |
|---|---:|---:|---:|---|
| `compare` | 82,798 | 36 | 3,848 | 27,148 via the pre-week semantic hash |
| `canonicalSerializeV2` | 58,199 | 27 | 3,355 | 14,260 via the pre-week semantic hash |
| `clone` | 37,707 | 6 | 0 | 36,100 via weekly save flush |

The largest hash paths reach `js/play-runtime-compat.js` through
`semanticHashV2`. That boundary records the pre-week state hash for failure
diagnostics. The largest clone path reaches the same boundary through
`flush`, the save wrappers and `js/save-storage.js` compaction. Another
1,259 clone samples belong to the test's `assertSame` → `comparableState`
path. These are observations from the captured stack tree. The profile
contains no duration estimate for changing those paths, and the source map
does not resolve frames omitted by the profiler.

The dominant observed paths exercise the normal hash and save behavior. Any
test-only optimization must keep those boundaries, the 208-week and reload
assertions, and byte-for-byte stdout and stderr verification.
