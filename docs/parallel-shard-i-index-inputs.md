# I dynamic harness input inventory — 2026-11-02

`node scripts/parallel-shard-index-inputs.cjs ROOT FULL_SOURCE_SHA` reads the
pinned clean checkout's index.html and local script inputs without compiling or
executing the game. Its lexical extraction follows tests/harness.js: ordered
script elements, attributes, local src without query/fragment for resolution,
and inline bodies. The required I boundary controls now compare this inventory
against the real harness extractor on the current checkout, using metadata only.

[Retained inventory](ci-evidence/i-index-inputs-ef1e02f1.json) fixes source
`ef1e02f1bf756c0dd30e15035bb0ca1bc070e28d`. It records index and harness SHA256,
script order/start lines/attributes, raw src, resolved relative paths, byte sizes
and SHA256 of all 227 lexical inputs. No code bodies are copied into the report.
This extends the prior literal-require inventory's identified dynamic harness
boundary. Both local and inline source edits become observable hash changes.

Local src must name an existing file under the selected root, including after
realpath/symlink resolution. Empty, external/protocol-relative, absolute or
escaping paths reject the report; the source pin and clean state are checked
before and after. No HTML DOM parser, URL decoding or general JavaScript import
resolution is attempted. The regression fixtures cover query/fragment stamps,
case/attribute forms, CRLF line numbers, duplicate script invocations, inline
code, content changes and root/symlink escapes. Throwing source bodies prove that
the extractor does not execute them.

This is the harness's full lexical input list before options such as headless or
isolatedLegacyIndex filtering and code transforms. It is not a claim that every
script executes in each I test. Nested dynamic imports, eval-generated inputs,
external/native/worker code and runtime writes/ports are not qualified. Hashes
identify sources, not read-only behavior; shared-write and parallel safety flags
remain false. Type/module attributes are recorded as the harness sees them,
including any non-JavaScript script elements; this is not browser load semantics.

Next runtime evidence must bind any write/resource observations to these inputs
and the omitted fixture paths, preserve output bytes/process checks, and retain
unknown descendant coverage. I full-workload timing evidence remains separately
pinned to its original source. This change neither reruns that workload nor
changes production parallelism, runner settings, workflows or economic tests.
