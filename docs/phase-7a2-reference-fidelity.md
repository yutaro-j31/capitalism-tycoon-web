# Phase 7A-2 — Reference fidelity pass

This pass moves the production D-style shell closer to the approved reference image without changing game state, accounting, progression, save keys, or save schema.

## Visual changes

- denser dark navy and gold top command bar
- stronger company identity and KPI hierarchy
- reference-style notification rail in the top-right command area
- tighter left strategic navigation and bottom dock
- larger city workspace with higher-contrast roads, water, buildings, and location markers
- additional city depth through coastline lighting, road shadows, and varied building heights
- clearer marker hover, focus, and selected states
- more compact white analytics cards with restrained elevation feedback
- darker right-side location detail panel with clearer active tabs, metrics, status bars, and primary actions
- responsive fallbacks for tablet and iPhone widths
- reduced-motion support for players who disable interface animation
- forced-colors support that preserves navigation selection, map labels, status bars, tabs, and keyboard focus

## Compatibility

- CSS-only runtime change
- `SAVE_KEY` remains `capitalism_tycoon_web_v1`
- save version remains 9
- no formulas, balance, accounting, migrations, progression, or randomness changes