# P3-7 — recovered fund capital and proceeds evidence

Status: partial read-only implementation proposal, not Phase completion. Depends on #1025; #998 and #1019–#1024 are already merged. Merge remains conditional on final-HEAD CI, independent review, unresolved findings and the applicable Owner safety conditions.

Recovered source commits `872e3a14` and `8d32a536` are preserved as ancestors. `projectPEFundInterests(rawState)` exposes GP capital ratio only when size − GP = LP matches the installed createFund writer exactly. Portfolio funding fractions describe economic proceeds participation, never legal equity, votes or founder title to portfolio assets. External coinvest stays external. Paid GP/LP distributions, carry and fees are historical observations, never another receivable added to personal cash.

New recovery work registers the browser module after the indirect diagnostic, records its exact load-order fixture, rejects duplicate module registration, and registers a focused test in canonical shard K. The test includes a real installed createFund result, frozen input/output, v9 JSON reload, unchanged company/personal/RNG fields, duplicate fund/deal IDs, bad totals, exits/settlements/closed funds and getter non-execution.

Authority boundary: standalone diagnostic only. It does not verify a common identity snapshot token, identify individual LP beneficial owners, reconcile per-LP terms, model conversion-to-subsidiary aliases, value NAV/carry or establish complete ownership. No integration into the canonical subsidiary composition or wealth/control consumer is claimed. Unknown/missing source totals fail closed; zero is never invented for missing capital evidence. `complete`, `commandEligible` and `wealthComplete` remain false; all wealth values and legal/voting shares remain null.

No persisted root, migration, normalization, save, ledger, economic writer, cash movement or simulation RNG call. Fund creation/acquisition/distribution writers are unchanged. No P3-4 cutover, P3-10 executable command or Phase4 production Entry.

Verification: see final PR/handoff for actual executed tests and CI. Independent final-diff review and GitHub CI remain distinct from local checks. This session's local second pass is same-agent review, not independent certification. Functional omissions remain Stage F tasks; broad integrated campaigns remain Stage Q.

## Applied review corrections

Automated review found that processFundsWeek marks a fund closed at its term while active deals remain saleable. Current portfolio participation follows deal status/settlement and valid source allocation independently of term closure. Fund capital and GP manager relationships also remain current while a validated active participation or positive source cash remains; settled empty funds are non-current. The original closed status is retained, and no NAV entitlement is created. Regressions executed RED, then GREEN, including an installed processFundsWeek deadline transition and subsequent deal exit. These corrections are included in this revision; final-HEAD CI and independent re-review are separate pending gates. Any further candidate must remain outside an active PR while its CI is queued/in progress, per AGENTS.md.
