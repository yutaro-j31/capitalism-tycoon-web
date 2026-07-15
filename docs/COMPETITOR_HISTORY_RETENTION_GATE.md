# Competitor history retention gate

This regression gate protects Phase 5A competitor saves from unbounded action-history growth before Phase 5B adds longer-lived multi-market history.

## Invariants

- `competitorActions` retains only the newest 160 actions.
- Each competitor `actionHistory` remains capped at 20 entries.
- Retention keeps the newest records rather than the oldest records.
- JSON save/restore preserves the bounded history.
- Restored state contains no serialized `NaN` or `Infinity` markers.
- `competitor.validate()` remains read-only and succeeds before and after save/restore.

## Scope

This PR adds a release gate only. It does not change competitor decisions, balance, market calculations, save version, or player-visible UI.
