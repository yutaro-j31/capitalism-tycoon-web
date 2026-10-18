# P3-7 — recovered fund capital and proceeds evidence

Status: partial read-only implementation proposal. No merge authorization or Phase completion. Depends on #1025 (and #1019–#1024); #998 contract adoption remains required before merge.

Recovered source commits `872e3a14` and `8d32a536` are preserved as ancestors. `projectPEFundInterests(rawState)` exposes GP capital ratio only when size − GP = LP matches the installed createFund writer exactly. Portfolio funding fractions describe economic proceeds participation, never legal equity, votes or founder title to portfolio assets. External coinvest stays external. Paid GP/LP distributions, carry and fees are historical observations, never another receivable added to personal cash.

New recovery work registers the browser module after the indirect diagnostic, records its exact load-order fixture, rejects duplicate module registration, and registers a focused test in canonical shard K. The test includes a real installed createFund result, frozen input/output, v9 JSON reload, unchanged company/personal/RNG fields, duplicate fund/deal IDs, bad totals, exits/settlements/closed funds and getter non-execution.

Authority boundary: standalone diagnostic only. It does not verify a common identity snapshot token, identify individual LP beneficial owners, reconcile per-LP terms, model conversion-to-subsidiary aliases, value NAV/carry or establish complete ownership. No integration into the canonical subsidiary composition or wealth/control consumer is claimed. Unknown/missing source totals fail closed; zero is never invented for missing capital evidence. `complete`, `commandEligible` and `wealthComplete` remain false; all wealth values and legal/voting shares remain null.

No persisted root, migration, normalization, save, ledger, economic writer, cash movement or simulation RNG call. Fund creation/acquisition/distribution writers are unchanged. No P3-4 cutover, P3-10 executable command or Phase4 production Entry.

Verification: see final PR/handoff for actual executed tests and CI. Independent final-diff review and GitHub CI remain distinct from local checks. This session's local second pass is same-agent review, not independent certification. Functional omissions remain Stage F tasks; broad integrated campaigns remain Stage Q.

## Review correction candidate

Automated final-HEAD review found that processFundsWeek marks a fund closed at its term while active deals remain saleable. The correction derives current portfolio participation from the deal status/settlement and valid source allocation, independently of fund term closure. The fund-level capital row still reports its closed status; no NAV entitlement is created. Closed-plus-active regression executed RED, then GREEN, including an actual installed processFundsWeek deadline transition and subsequent deal exit. Candidate remains outside the active PR until queued/in-progress HEAD CI finishes per AGENTS.md.
