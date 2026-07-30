# Real Estate Rent Performance Invariants

- Market rent, asking rent and realized contract rent are reported separately.
- Collection rate is `collected / (collected + missed)` and never changes cash.
- Revenue leakage is vacancy opportunity loss plus missed rent; it is analytics-only.
- Company and personal properties remain separable by owner filter.
- Weekly snapshots are idempotent and capped at 260 rows.
- Legacy saves normalize missing counters without changing `saveVersion`.
- No `Math.random` or `Date.now` is used.
- UI loading fails closed through `__capitalismTycoonRealEstateRentPerformanceFailed`.
