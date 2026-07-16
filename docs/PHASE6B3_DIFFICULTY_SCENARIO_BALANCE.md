# Phase 6B-3: Difficulty and Scenario Balance

## Scope

This phase verifies progression across Easy, Normal, Hard, Free Play, and Standard Scenario after the Phase 6B-2 industry calibration.

## Difficulty profiles

| Difficulty | Company cash | Credit | Crisis grace | Rule |
| --- | ---: | ---: | ---: | --- |
| Easy | ¥12,000,000 | 70 | 4 weeks | Current business demand receives a one-time 1.10 multiplier |
| Normal | ¥8,000,000 | 60 | 3 weeks | Phase 6B-2 baseline |
| Hard | ¥6,000,000 | 50 | 2 weeks | No demand or credit support |

The Easy multiplier is tracked by `easyDifficultyDemandVersion`. It multiplies the current value, preserving earlier demand improvements, and cannot run twice after save or reload.

## Accounting compatibility

The former setup flow changed Easy and Hard cash after finance opening balances were created at ¥8,000,000. Phase 6B-3 repairs only this known ¥8,000,000 legacy signature. The delta is applied to opening cash, assets, equity, retained earnings, and existing weekly snapshots. Arbitrary custom opening balances are not modified.

Save version 9 and `capitalism_tycoon_web_v1` remain unchanged.

## Scenario profiles

### Free Play

Free Play has no IPO deadline, score, or grade.

### Standard Scenario

Standard Scenario targets an IPO by week 208. Checkpoints occur at weeks 52, 104, 156, 196, and 208. Passing week 208 records an overdue state but does not end the game. IPO completion records the week, score, and grade.

| IPO week | Grade |
| --- | --- |
| 78 or earlier | S |
| 79–104 | A |
| 105–130 | B |
| 131–156 | C |
| 157–208 | D |
| 209 or later | E |

The score declines linearly from 100 at week 52 to 0 at week 208. Scenario metadata is included in weekly summaries and news. Economic formulas and random-number use remain identical between Free Play and Standard Scenario.

## Permanent matrix

The regression suite runs 90 isolated cases:

- ramen, cafe, leveraged convenience store, leveraged real-estate agency, and leveraged web agency;
- three difficulties;
- two scenario profiles;
- three deterministic seeds;
- up to 208 organic weeks.

Each case uses production APIs for borrowing, store opening, office setup, accounting, executive hiring, board setup, weekly progression, and IPO.

Every case must avoid bankruptcy, produce at least 52 reports, operate at least three stores, remain finance-valid and serializable, and preserve its starting cash and credit profile. Bootstrap routes remain debt-free. Leveraged routes must use actual borrowing.

Easy and Normal must reach IPO in all seeds. Hard must reach IPO in at least two of three seeds per strategy. A Hard non-IPO case is accepted only when it remains cash-positive, retains at least ¥100,000,000 company value, earns at least ¥7,000,000 trailing annual profit, and misses only the ¥10,000,000 profit gate.

Free Play and Standard Scenario pairs must have identical economic results.

## Final calibrated result

- 44 of 45 unique economic cases reach IPO.
- 88 of 90 scenario rows reach IPO.
- No case goes bankrupt.
- All 45 Free/Standard pairs have identical economic outcomes.
- Easy is never slower than Normal for the same strategy and seed.
- Normal is never slower than Hard.

The only non-IPO economic case is one Hard convenience-store seed. It operates five stores, remains cash-positive, exceeds ¥100,000,000 in company value, and misses only the trailing annual profit requirement.

## Unchanged systems

This phase does not change Normal or Hard demand, save version, save key, runtime randomness, market formulas, supply, workforce, competitors, accounting formulas, valuation, IPO proceeds, M&A, or the 52-report IPO gate.
