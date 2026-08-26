# 100-year playtest audit (2026-08-25)

## Scope

This audit exercised a deterministic normal-difficulty ramen route for 5,200 weekly turns (100 years). The century run used the repository's isolated engine load so that the core simulation could be completed locally in a bounded time. It opened one Fukuoka ramen store and supplied a one-time ¥1 trillion company and personal liquidity buffer; the finance opening balances were rebuilt immediately afterward so the buffer did not create an accounting mismatch. Autosave and per-week validation were disabled only in the runner, while finance validation, finite-state inspection, and JSON serialization were checked every 520 weeks.

A separate full-module, organic normal route was played through IPO and continued for 10 years. It opened three ramen stores, reached IPO in week 53 without borrowing, and retained all production module wrappers. This second run is the balance-oriented reference; the injected century run is a stability and long-duration trend audit, not evidence that starting progression is balanced.

## Results

| Elapsed years | Week | Annual profit | Last store profit | Store condition | Finance validation | State issues | Raw JSON bytes |
| ---: | ---: | ---: | ---: | ---: | :---: | :---: | ---: |
| 10 | 521 | ¥16,240,613 | ¥346,598 | 40 | PASS | 0 | 4,552,457 |
| 20 | 1,041 | ¥35,059,609 | ¥746,541 | 40 | PASS | 0 | 5,193,298 |
| 30 | 1,561 | ¥33,257,327 | ¥812,272 | 40 | PASS | 0 | 5,661,170 |
| 40 | 2,081 | ¥66,069,399 | ¥1,408,460 | 40 | PASS | 0 | 6,099,636 |
| 50 | 2,601 | ¥70,836,067 | ¥574,715 | 40 | PASS | 0 | 6,537,589 |
| 60 | 3,121 | ¥137,898,009 | ¥2,332,986 | 40 | PASS | 0 | 6,979,005 |
| 70 | 3,641 | ¥195,359,556 | ¥4,099,723 | 40 | PASS | 0 | 7,419,332 |
| 80 | 4,161 | ¥190,826,031 | ¥4,097,882 | 40 | PASS | 0 | 7,857,653 |
| 90 | 4,681 | ¥348,603,900 | ¥7,109,485 | 40 | PASS | 0 | 8,293,497 |
| 100 | 5,201 | ¥281,429,928 | ¥6,945,655 | 40 | PASS | 0 | 8,734,521 |

The full-module organic checkpoint at year 10 (week 573 because IPO setup consumed the first 52 weeks) had ¥345,366,718 company cash, ¥503,836,618 company value, ¥28,820,255 trailing annual profit, four competitors, 5,018 retained finance transactions, and a valid finance ledger. No game-over, failed week advance, non-finite value, serialization error, or accounting failure occurred in either run.

## Findings

### Confirmed working

- Weekly progression advanced exactly once for all 5,200 century-run turns.
- The state stayed finite and JSON-serializable at every decade checkpoint.
- Finance validation passed at every decade checkpoint after the liquidity buffer was represented in opening balances.
- The store remained operational and profitable through year 100; long-run macro variation remained visible rather than collapsing to a constant result.
- The organic normal route still reached IPO in week 53 without mandatory debt, so the century stability setup did not replace the progression check.

### Balance observations, not confirmed defects

- An unattended store reaches the condition floor of 40 by year 10 and stays there, yet nominal weekly profit rises materially over the century. Inflation, demand, brand, and macro growth can explain part of this, but a future interactive century balance pass should compare renovation strategies and real (inflation-adjusted) profit before changing formulas.
- Raw in-memory JSON grows from about 4.6 MB at year 10 to 8.7 MB at year 100. Production uses save compaction and IndexedDB for late saves, so raw size alone is not a save failure. A production-browser century run should nevertheless verify IndexedDB write, reload, and compact-save behavior at the 100-year endpoint.
- The full production module graph is expensive to advance thousands of turns under Node. The complete graph was therefore audited organically for 10 years, while the full 100-year duration used the isolated core. This is an explicit coverage limitation, not a claim that every late-loaded expansion received 100 years of execution.

## Conclusion

No reproducible crash, state corruption, accounting defect, deterministic progression failure, or immediate balance blocker was found. The two follow-up risks are long-horizon real-profit calibration for a minimum-condition store and a browser-level 100-year IndexedDB reload check. Neither should be changed from this audit alone because the current evidence does not prove incorrect production behavior.
