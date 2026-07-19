# Phase 8A-1: Competitor strategic AI and market-share rivalry

## Goal

Move competitor behavior from isolated tactical actions toward a persistent strategy loop that remembers market-share changes and reacts to the player's growth.

## Added behavior

- Each competitor receives a persistent target market share, aggression level, adaptability level, current stance, target market, and bounded planning history.
- Each ramen market stores up to 104 weekly observations of player share, competitor shares, share changes, leader, concentration, market potential, and player average price.
- Competitors compare every active presence and select the highest-priority market deterministically.
- Strategic stances are attack, defend, capacity expansion, margin harvesting, turnaround, and hold.
- The strategic layer uses the existing action pipeline for price changes, brand investment, quality investment, and capacity expansion.
- Existing pending actions take priority, so the strategic layer does not create duplicate projects or spend cash twice.
- Emergency replanning is available after a large market-share swing; normal planning uses an eight-week cadence.

## Compatibility

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`.
- Save version remains 9.
- Existing saves are normalized lazily by `competitor.ensure` without a format-version increase.
- Market history is capped at 104 weeks and plan history at 52 entries.
- No UI files, accounting formulas, player balance values, or random-number behavior are changed.

## Validation

The focused regression verifies market-share capture, player and competitor momentum, deterministic target selection, strategic action creation, same-week idempotency, bounded histories, finite state, pure validation, and save-version compatibility.
