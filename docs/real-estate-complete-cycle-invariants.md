# Real Estate Complete Cycle Invariants

## Scope freeze

This milestone completes the planned real-estate expansion and freezes new real-estate feature work after merge. Later changes are limited to defects, balance, compatibility and integration fixes unless the product roadmap is explicitly reopened.

## 1. Financing

- Property-backed loans are separated by owner: company loans use company cash; personal loans use personal cash.
- Approval requires both LTV and DSCR thresholds.
- Fixed and variable rates are deterministic.
- Weekly debt service separates interest and principal.
- Prepayment, refinancing, delinquency and default preserve non-negative balances.

## 2. Rival real-estate companies

- Rival actions are derived from seed, week and rival ID.
- Rivals may acquire, renovate or sell but never use player cash or assets.

## 3. Macro economy

- Policy rate, inflation, land, construction and rent indices are deterministic and bounded.
- No `Math.random` or `Date.now` affects simulation results.

## 4. Events and insurance

- Disaster and regulation events are deterministic.
- Losses are charged only to the property's owner cash account.
- Insurance recovery is included in net-loss calculation and event history.

## 5. Endgame

- REIT, urban redevelopment and overseas vehicles require minimum property value.
- Vehicles reference existing properties and do not duplicate player cash or property value.

## Compatibility and safety

- `SAVE_KEY=capitalism_tycoon_web_v1` and effective `saveVersion=9` remain unchanged.
- Existing saves normalize lazily through `realEstateCycle` defaults.
- Weekly processing is idempotent for the same week.
- Histories are capped at 260 entries.
- Production loader inherits the launch token and fails closed.
- iPhone controls and dashboards remain mobile-first.
