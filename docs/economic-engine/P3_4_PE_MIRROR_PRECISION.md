# P3-4 G30 — PE mirror normalization precision (#1259)

Status: scoped correction candidate; not family closure or authority approval.
Verified base: `c17b76d84f9b97e2691ce706ccebf61be69dd68b`, tree
`49cadd15d680ad0e7d4256badd2512fcab3c96a5` (2026-11-01 JST).

The earlier unexplained +41.2372418-yen resynchronization delta in
[P3_4_FC_G30_PE_MIRROR_CALLER_BOUNDARY.md](P3_4_FC_G30_PE_MIRROR_CALLER_BOUNDARY.md)
is reproducible with the existing PE test's generated company acquisition (seed 181),
expanded weekly update, save and reload. Before reload:

| Field | Source / synchronized mirror | Reloaded mirror on base |
| --- | --- | --- |
| Ownership | 0.7091832888661884 | 0.709183 |
| Total valuation | 142542986.08656812 | 142542986 |
| Legal PE stake value | 101089103.67767972 | 101089062.440438 |
| Company value | 2000999103.6776798 | 2000999062.440438 |

The PE source retains its ownership and currentValuation. Four generic subsidiary
`ensure()` routines round the mirror ownership to six decimals; the restructuring
candidate routine additionally rounds its total valuation to whole yen. Their installed
normalization chain changes a projection without a legal stake transaction. Resyncing
from the unchanged deal restores the difference. Cash and receipt counts do not change
in this witness. This establishes a projection defect; consequential settlement loss,
exploitability and a confirmed integrity P1 are not established by this witness.
No tolerance or economic policy exception has been approved.

## Correction boundary

Only defaulting of `valuationManagedBy === 'pe'` subsidiary projections preserves the
existing finite/clamped ownership and valuation precision. Non-PE normalization,
settlement rounding, IPO/secondary/follow-on terms, accounting policy (#976), cash,
ledger, save schema, RNG and PE source writers retain their current rules. This does
not reconstruct missing mirrors, repair arbitrary damaged saves or adopt a new authority.
All four owners must be corrected: fixing only the last normalizer cannot recover
precision lost earlier in the chain or protect direct exported ensure callers.

## Targeted evidence

- Existing registered `pe-dual-ownership-test.js`: new exact-precision assertion is
  RED on base (0.709183 instead of 0.7091832888661884), GREEN with the correction.
  Covers each ensure, non-PE rounding controls, installed normalize, all three compaction
  profiles, two save/reload cycles and zero company-value delta on forward resync.
  Existing tests/assertions remain. Ledger receipts and simulation RNG do not change
  during the normalization witness; ordinary finance snapshot rebuilding is permitted.
- Existing four adjacent Node suites (restructuring candidates, synergy allocation,
  relisting options and follow-on offering), plus secondary-sale and restructuring
  progress suites: PASS locally. Static, text safety and registration contract: PASS.
- Existing `pe-create-deal-save-atomicity-webkit-test.js` now includes valuation in its
  economic view and a precision scenario comparing the unnormalized committed source
  against reload and fresh native-IDB-only hydration. It retains every previous fault
  case. The existing M&A workflow already invokes this file and filters its path;
  no workflow or Work B file changed.
- Local WebKit attempted but BLOCKED before launch by missing system libraries.
  Browser download succeeded; dependency installation failed with setgroups/seteuid
  permission errors. No local WebKit/native-IDB PASS claimed. Exact-head hosted browser
  execution is required; generic iPhone acceptance does not replace this scenario.
- Review: author SELF/SAME_MODEL only. No independent financial review obtained.

## Remaining gate

HOLD correction merge until final-head CI, the targeted browser evidence and genuinely
distinct financial review or explicit narrow Owner authorization. #1258 proves a
separate IPO/secondary identity tuple and does not close this valuation issue.
P3-4 family closure, cutover, P3-12 acceptance, Phase 3 Exit and Phase 4 Entry remain open.
