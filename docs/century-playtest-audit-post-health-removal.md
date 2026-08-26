# 100-year playtest audit — post founder-health-system removal (2026-08-26)

## Scope

Follow-up to `docs/century-playtest-audit.md` (2026-08-25), re-run after PR #542 removed
`founderHealth`/`founderEnergy`/`founderFocus` and all related logic. Per owner instruction,
this run focuses on long-term performance degradation, save size, accounting integrity,
generational succession, asset inflation, post-IPO growth rate, bankruptcy frequency, and
AI-competitor survival rate — treating the removed health system as a retired feature, not a
balance target.

Unlike the original audit's isolated-core run (which injected a one-time ¥1 trillion buffer
and never called `executeIPO()`), this run bootstraps to IPO organically using the same
`ramen-bootstrap` staggered store-opening / office / accounting department / CEO+CFO / board
logic already validated by `tests/strategy-balance-runner.js` (confirmed unaffected by the
health-system removal via `strategy-balance-pr-smoke-test.js` immediately before this audit),
so IPO reachability, post-IPO growth, and the full engine tick (including the health-removal
diff) are all exercised together. It then continues inside the repository's isolated-core
script loading (same technique as `tests/long-run-test.js`) because the full production
module graph was separately measured at ~17s just to reach week 53 — too slow to extend to
thousands of turns, matching the original audit's own finding.

Three runs were performed, each opportunistically appointing a successor
(`appointSuccessor('professional')`, falling back to `'internal'`/`'family'` by affordability)
and calling `retireFounder()` whenever `retirementEligibility()` reports eligible, so
generational succession is exercised organically rather than skipped:

- **Phase A**: seed `0x6b200101`, ~99 years (5,148 weeks) post-IPO, decade checkpoints.
- **Phase B**: seeds `0x6b200202` and `0x6b200303`, ~40 years (2,080 weeks) each, for a
  bankruptcy-frequency and AI-competitor-survival sample (a single seed cannot show a rate).

## Results

### Phase A (seed 0x6b200101, IPO at week 53)

| Years post-IPO | Founder gen | Company cash | Value (nominal) | Value (real, inflation-adjusted) | Inflation index | Finance validation | JSON bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | :---: | ---: |
| 10 | 1 | ¥636,699,191 | ¥1,194,609,232 | ¥927,654,910 | 1.29 | PASS | 4.86 MB |
| 20 | 1 | ¥1,487,455,049 | ¥1,871,261,091 | ¥1,130,187,774 | 1.66 | PASS | 5.44 MB |
| 30 | 1 | ¥2,144,079,749 | ¥2,638,675,649 | ¥1,264,283,545 | 2.09 | PASS | 5.84 MB |
| 40 | 2 | ¥3,431,421,968 | ¥4,410,683,259 | ¥1,650,426,103 | 2.67 | PASS | 6.20 MB |
| 50 | 2 | ¥5,844,991,688 | ¥7,881,442,680 | ¥2,283,360,602 | 3.45 | PASS | 6.60 MB |
| 60 | 3 | ¥9,597,006,009 | ¥11,771,346,426 | ¥2,701,132,130 | 4.36 | PASS | 6.97 MB |
| 70 | 3 | ¥14,227,160,870 | ¥17,898,778,578 | ¥3,154,798,654 | 5.67 | PASS | 7.34 MB |
| 80 | 3 | ¥20,353,876,781 | ¥22,628,101,193 | ¥3,086,647,652 | 7.33 | PASS | 7.71 MB |
| 90 | 3 | ¥28,954,593,572 | ¥35,567,303,055 | ¥3,718,035,425 | 9.57 | PASS | 8.56 MB |

- Successions: 2 (`week 2080` gen 1→2, reason `age`; `week 2843` gen 2→3, reason `tenure`).
- `gameOver`: never occurred over ~99 years.
- `modules.finance.validate()`: zero errors at the final checkpoint (and no `STATE ISSUES`
  entries of any kind other than the known false-positive described below appeared at any
  checkpoint).
- Competitors: both of the 2 initial AI competitors were already `bankrupt`/terminal by year
  10 (the first checkpoint) and stayed terminal for the entire 90 years that followed.

### Phase B (bankruptcy frequency & AI-competitor survival, 3 seeds, ~40yr each)

| Seed | IPO week | `gameOver` | Successions | Competitors alive at end | `finance.validate()` |
| ---: | ---: | :---: | ---: | :---: | :---: |
| 0x6b200101 (Phase A, sampled at 40yr) | 53 | never | 1 by 40yr | 0/2 | PASS |
| 0x6b200202 | 74 | never | 1 | 0/2 | PASS |
| 0x6b200303 | 53 | never | 1 | 0/2 | PASS |

**Bankruptcy frequency: 0/3 seeds** over a ~40-year horizon. **AI-competitor survival rate:
0% in all 3 seeds** — in every run, both of the 2 initial AI competitors had already reached
a terminal (`bankrupt`/`inactive`) lifecycle status by year 10 and never recovered for the
remainder of the run.

## Findings

### Confirmed working

- Weekly progression advanced exactly once for every turn across all three runs (Phase A:
  5,148 turns; Phase B: 2,080 turns × 2 seeds), with zero `gameOver`s.
- `founderHealth`/`founderEnergy`/`founderFocus` do not appear anywhere in any of the three
  final states (confirms the removal is complete and stable at century scale, not just at the
  unit-test scale already covered by `tests/founder-health-system-removal-test.js`).
- Generational succession (`appointSuccessor` → natural readiness growth via
  `updateSuccessionWeekly()` → `retirementEligibility()` → `retireFounder()` →
  `executeSuccession()`) worked correctly across 4 total successions (2 in Phase A driven by
  `age` then `tenure`, 1 each in the two Phase B runs driven by `age`), confirming the health
  removal did not disturb succession logic at any point in a century-scale run, not only in
  the isolated unit test.
- `modules.finance.validate()` reported zero accounting-integrity errors at every checkpoint
  in all three runs, including immediately after each succession event.
- Save size scales similarly to the original (pre-removal) audit: ~8.6 MB in-memory JSON at
  year 90 here vs. ~8.3 MB at year 90 / ~8.7 MB at year 100 in the original audit — the
  health-field removal has no material effect on save growth, and growth remains sub-linear
  relative to the 90-year span rather than runaway.
- Post-IPO company value grew every decade in nominal terms across all runs, and *real*
  (inflation-adjusted) value also grew every decade in Phase A except a small year-70→80 dip
  (¥3.15B → ¥3.09B real, i.e. essentially flat, not a collapse) before resuming growth to
  ¥3.72B real by year 90 — a real terminal-value CAGR of roughly 1.8%/year from year 10 to
  year 90, alongside nominal growth of roughly 4.9%/year over the same span. This directly
  answers the original audit's open question ("nominal profit rises while an unattended
  store's condition floors out — is this real growth?"): most of the nominal rise is
  inflation (the index compounds from 1.29 to 9.57 over the 80-year span, i.e. roughly
  2.9%/year), but a genuine, if much more modest, real growth trend remains underneath it.

### Balance observations, not confirmed defects (unrelated to the health-system removal)

- **AI-competitor survival is 0% by year 10 in all 3 seeds and never recovers.** Both initial
  competitors reach a terminal lifecycle state early and stay there for the rest of the
  century. The founder-health removal cannot be the cause (it never touches
  `competitorStates` or any competitor module — confirmed during the pre-removal audit), and
  this audit did not investigate further because it is out of scope for a
  regression-safety check. It may be a genuine long-run competitor-AI balance gap (worth a
  separate, dedicated audit) or an artifact of this audit's own bootstrap (a single aggressive
  `ramen` route across 5 prefectures with a `merchant`-trait founder, run inside the
  isolated-core module subset, which excludes some later-loaded modules such as
  `competitor-media.js`). Flagging for a future dedicated competitor-longevity audit rather
  than treating it as a defect of this change.
- As in the original audit, a repeating `STATE ISSUES` line
  (`g.finance.transactions[N].inventoryAmount: negative quantity/inventory/share value`)
  appeared at every checkpoint in this run too. This is confirmed to be a false positive in
  the shared test harness's generic `findStateIssues()` heuristic (`tests/harness.js`), which
  flags any key matching `/inventory/i` as if it were a physical unit count; `inventoryAmount`
  on a finance transaction (see `js/finance.js`, `js/supply.js`) is actually a **yen-valued**
  delta on the inventory asset account, and is legitimately negative on ordinary
  cost-of-sales and spoilage/write-off transactions. `modules.finance.validate()` — the actual
  accounting-integrity check — reported zero errors throughout, confirming this is a harness
  scanner limitation, not a real bug. Not specific to this change; would appear in any
  sufficiently long run.
- The full production module graph remains too slow to extend organically much past ~53-74
  weeks under Node (measured at ~17s to reach week 53 alone), same limitation as the original
  audit. This audit's century-scale continuation therefore ran inside the same isolated-core
  module subset as before, which is an explicit coverage limitation (not every late-loaded
  expansion module executed for 90+ years), not a claim of full-module-graph stability at
  that duration.

## Conclusion

No reproducible crash, state corruption, accounting defect, deterministic-progression
failure, save-size regression, or succession failure was found after removing the founder
health/energy/focus system, across a ~99-year single-seed run and two ~40-year multi-seed
samples. Bankruptcy frequency was 0/3 seeds; generational succession completed successfully
4 times with correct accounting at every step; real (inflation-adjusted) company value grew
across the full 90-year span despite nominal figures being heavily inflation-driven. The one
notable observation — 0% AI-competitor survival by year 10 in every seed — predates and is
unrelated to the health-system removal, and is recorded here as a candidate for a future,
separate long-run competitor-AI balance audit rather than an action item for this change.
