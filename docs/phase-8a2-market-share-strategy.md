# Phase 8A-2: Persistent market-share strategy

## Purpose

Phase 8A-1 reacts immediately when the player cuts price, gains share, or expands stores. Phase 8A-2 adds the slower strategic layer: competitors remember market outcomes, set target shares, compare markets, and allocate investment to the highest-priority threat or opportunity.

## Strategic state

Each competitor keeps:

- target market share
- aggression and adaptability
- current stance
- selected market and presence
- threat and opportunity scores
- market-specific signals
- up to 52 planning records

Each market keeps up to 104 weekly records containing player share, competitor shares, weekly changes, market leader, concentration, market potential, and player average price.

## Decision layers

1. The existing rivalry layer handles urgent price wars, brand defense, and capacity races.
2. The strategic layer runs after rivalry processing.
3. Any pending rivalry or ordinary competitor action blocks a duplicate strategic action.
4. Markets are ranked deterministically using share gaps, player momentum, capacity pressure, margins, and market scale.
5. Strategy profile chooses a compatible response through the existing action and project pipeline.

## Responses

- price decrease
- price increase for harvesting
- brand investment
- quality investment
- capacity expansion

Normal replanning occurs every eight weeks. A sharp player gain or competitor loss shortens the cadence to four weeks.

## Compatibility

- Save key remains `capitalism_tycoon_web_v1`.
- Save version remains 9.
- Existing saves receive missing strategy containers through `competitor.ensure`.
- No random-number source is added.
- No UI layout or visual behavior is changed.
- Strategic histories are bounded to prevent long-play save growth.
