# Property insurance loss and claim invariants

- Insurance payouts require a deterministic recorded incident.
- The incident is derived only from property ID, week and current finite state.
- Casualty loss is recognized when the incident occurs.
- Insurance proceeds are recognized only when the pending claim is submitted.
- A claim cannot be submitted twice or for a different incident type.
- Company and personal cash remain separate.
- Premium, casualty loss and insurance payout use distinct finance ledger idempotency keys.
- Save normalization accepts older saves without pending incidents.
- History remains capped at 500 entries.
