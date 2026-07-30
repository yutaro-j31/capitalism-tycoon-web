# Real-estate rent pricing invariants

- Market rent is derived deterministically from property value, condition and target occupancy.
- Asking rent is clamped to supported strategies from 85% to 120% of market rent.
- Asking-rent changes are blocked while an active tenant contract exists.
- Higher asking rent deterministically reduces applicant demand; discounted rent can add applicants.
- Vacancy opportunity loss is analytical only and never subtracts cash or recognizes accounting profit/loss.
- Vacancy weeks reset to zero when an active tenant exists.
- Company and personal ownership remain separated.
- Weekly processing is idempotent and uses neither `Math.random` nor `Date.now`.
- Existing saves normalize missing pricing and vacancy fields without changing `SAVE_KEY` or effective `saveVersion=9`.
