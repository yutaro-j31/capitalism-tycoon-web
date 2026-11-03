# K fixed-source evidence — 2026-11-02 JST

Source **daa5236d2483a9dbd1b208bb6b84e44d88a39762**, diagnostic #1278 exact HEAD **420c368b13dc221b9ee6ff7a24b59f1de6b8ada6**, [Test4457/run41349262829](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/41349262829). Both hosted jobs succeeded; both complete K29/four-pass sets passed the unchanged within-Node byte-output, memory, process/final-group and API-write audit. This is a frozen checkpoint, not current-main or production qualification.

| Node / host (4 logical CPUs each) | Clean serial | Audited serial | Audited2 | Audited4 | System in-use peak MiB (same order) |
| --- | ---: | ---: | ---: | ---: | --- |
| 22.23.4 / AMD EPYC7763 | 1687.646s | 1743.947s | 887.644s | 937.143s | 2390 / 2368 / 2705 / 3176 |
| 24.22.1 / AMD EPYC9V45 | 938.337s | 935.328s | 515.688s | 504.590s | 2481 / 2520 / 3037 / 3881 |

Both report physical16759443456bytes. These are single sequential observations on different hosts. Node22's2 was49.499s shorter than4; Node24's4 was11.098s shorter than2, with844MiB higher observed system in-use memory. No repeated speedup, Node-version causal effect, host equivalence, runner quota or whole-CI saving follows. Peak system in-use includes host background usage and is not process-only memory. The longest individual command remains full-index-weekly-validate-208w. Production K remains1.

## Raw parity gap remains open

Strict `auditPair` and the archive builder exit **2 / cross-node-output-review-required**. In `tests/player-crisis-turnaround-ratchet-week-rollback-test.js` stderr (2613bytes each), exactly one byte differs at zero-based offset1707: ASCII3→4, the Node-internal stack location `task_queues:103:5`→`task_queues:104:5`. Within each Node all four passes are byte-exact. Every other compared raw stdout/stderr byte matches across Nodes. The raw streams are preserved, not normalized.

[#1282](https://github.com/yutaro-j31/capitalism-tycoon-web/issues/1282) records this confirmed P2 diagnostic formatting/parity gap as **NOT_FIXED / DEFERRED_WITH_EVIDENCE**, owned by Work B, with revisit before K production enabling or a strict cross-Node parity claim. It is not a reproduced economic integrity failure; this evidence does not change any economic writer. Merging the diagnostic-only collection workflow under #1055 does not waive the raw-parity or separate Owner production gate.

## Preserved artifacts and replay

- Node22 [job124975694155](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/41349262829/job/124975694155), artifact13104021850, ZIP SHA256 `94b280fdab0fcc1d17b579d607ced4888a3365aba24020f216938b3b0798b199`.
- Node24 [job124975694118](https://github.com/yutaro-j31/capitalism-tycoon-web/actions/runs/41349262829/job/124975694118), artifact13102886181, ZIP SHA256 `894445cd4c665974bf19dd5500c60a5fc24fb8b22090136f685f45c8639d79c7`.
- Both ZIP digests were checked against GitHub API metadata, branch/head/run and89 regular files each. Original full reports, namespace controls, output bytes and3×29 per-PID API logs per Node are retained in [the complete archive](ci-evidence/k-current-source-hosted-2026-11-02.json.gz).
- Gzip SHA256 **`34cb96d26ea87f471dfc0996d8c1cfab35f234bcd62066fd2c46df8f7b223c8c`**,254540bytes. Built with the tested #1280 builder exact778a0751, using its strict restoration/audit path. The separate [source manifest](ci-evidence/k-refresh-source-daa5236d.json) retains the independently collected source expectation.

Replay against a clean source checkout: `node scripts/parallel-shard-k-evidence-audit.cjs --archive SOURCE_ROOT docs/ci-evidence/k-current-source-hosted-2026-11-02.json.gz 34cb96d26ea87f471dfc0996d8c1cfab35f234bcd62066fd2c46df8f7b223c8c daa5236d2483a9dbd1b208bb6b84e44d88a39762`. Expected exit2 is preserved; exit0 is not claimed. Required short regression replays the hash-pinned complete evidence with the source manifest and asserts the exact unnormalized raw gap. This replay runs no K test bodies.

A metadata-only comparison from daa5236d to main675a624d (after diagnostic merge) found the same K29 contract/runner but a changed founder-wealth direct test and7 other tracked inputs. Thus this experiment already does not qualify the moving main dependency set. Namespace/sample/API observer limits remain; Node hooks do not prove native/worker/sanitized-child completeness. E historical local residue cause remains unknown. J/C2, E/K1, H/I production hold, E #1203 hold and all separate Owner approvals remain unchanged.
