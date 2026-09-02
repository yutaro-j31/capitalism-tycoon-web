# Phase 1 Daytime Map Assets

## Purpose
Prototype local sprite assets for the Capitalism Tycoon Web Tokyo mini-district.

## Integration target
Canvas 2D static city layer + DOM/SVG interactive overlay.

## Important
- Daytime only.
- Transparent PNG.
- Do not replace these with procedural SVG/Canvas box buildings.
- Do not use Math.random or simulation RNG for selection.
- `anchor`, `footprint`, and `scaleClass` in sprites.json are Phase-1 defaults and should be tuned from actual Canvas screenshots.
- Keep the original sprite sheet only as source/reference; runtime should use individual files for Phase 1.

## Categories
- 5 office
- 5 commercial
- 3 residential
- 1 industrial
- 1 Tokyo landmark
