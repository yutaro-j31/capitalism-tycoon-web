# Phase 6A-4B: creditor negotiation mobile UI

This increment exposes the Phase 6A-4A deterministic creditor-negotiation engine in the existing crisis-response screen.

The UI shows up to three recommended requests with the active loan name, outstanding principal, requested condition change, expected benefit, approval probability, and cooldown. It supports principal-payment deferral, maturity extension, and interest-rate reduction.

Every request requires explicit confirmation. The selected action and loan are re-resolved at click time, so stale, inactive, or cooled-down targets cannot execute. Rendering and cancellation are state-neutral. All mutations are delegated to `executeCrisisCreditorNegotiation(type, loanID)`.

The module is isolated from the existing crisis panel renderer and appends its section only while the crisis panel exists. Existing founder-capital, emergency-loan, asset-disposition, and operating-cost controls remain unchanged.

The save key remains `capitalism_tycoon_web_v1`; the save version remains 9; the UI adds no persistent fields or runtime randomness.
