# Tenant rent accounting invariants

- Successful weekly rent collection increases only the owning account's cash and recognizes matching rental income.
- A missed payment never subtracts cash from the property owner.
- Missed rent increases contract arrears and missed-week counters without recognizing cash income.
- Deposit application reduces the tenant-deposit liability and recognizes only the amount actually applied.
- Company and personal cash remain strictly separated.
- Every weekly rent, arrears, deposit-application, renewal and refund operation is deterministic and idempotent.
- Existing saves normalize missing cumulative fields to finite zero values without changing `saveVersion` or `SAVE_KEY`.
