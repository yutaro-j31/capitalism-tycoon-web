# P3-7 LP commitment source evidence — partial read-only slice

`phase3PeFundInterests.projectLPCommitments(rawState)` observes `peFirm.funds[].lps`
without invoking ensure, normalization, fundraising previews, settlement or saves.
Depends on #1026 and adopted #998/#995 contracts; new explicit Owner merge approval
is required. This is not full P3-7, Phase3 F Exit or a Phase13 authority cutover.

Fund IDs and LP type labels locate source observations, not legal LP/person IDs.
`committedAmount` is a commitment only. Even when its exact Number sum matches
`lpContributed`, individual paid capital, fund units, economic/voting fractions,
beneficial identity and wealth remain null. Paid distributions are not receivables.
No LP source row may be counted as a founder asset or added to GP wealth.

Duplicate fund/within-fund type labels, malformed own fields, accessors/exotic
containers, unknown lifecycle, missing legacy LP arrays and invalid capital totals
leave reconciliation unproven. Explicit empty LP arrays with positive declared LP
capital report a mismatch. Source numbers are never clamped, normalized or repaired;
floating discrepancies remain observable. Completeness/wealth/command flags are false.

The existing GP/portfolio API and shared economic-read-model are unchanged. This
opt-in observation is not a canonical snapshot token, named paid-LP allocation or
source-identity adoption. Those remain dependency-specific Stage F work. Tests use
the existing installed-engine harness; no duplicate financial simulation fixture.
