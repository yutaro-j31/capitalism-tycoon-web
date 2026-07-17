# Phase 7A-1: D UI game shell

## Goal

Adopt the selected D concept as the production UI direction without changing the simulation engine, save format, balance formulas, or existing feature actions.

## Added presentation layer

- premium dark-navy and gold visual tokens
- five-metric top KPI bar
- left strategic navigation rail
- complete command menu for every existing game section
- bottom utility dock
- responsive desktop, tablet, and iPhone layouts
- D-style city workspace for the map tab
- deterministic store, tenant, and office markers
- weekly profit chart, mission tracker, and company news overlays
- selected location context drawer
- collapsible access to the original tenant, office, and property lists

## Compatibility rules

- `SAVE_KEY` remains `capitalism_tycoon_web_v1`
- save version remains `9`
- the D shell reads the existing engine instance through `player-engine-bridge.js`
- the D shell never writes directly to local storage
- existing `data-action` values remain the source of all game operations
- existing tabs and screens remain mounted and usable
- marker placement is deterministic and contains no runtime randomness
- remote JavaScript, fonts, maps, and image dependencies are not introduced

## Responsive behavior

Desktop uses the full D layout with a left rail, center map, overlay cards, right context drawer, and bottom dock. Compact desktop collapses the rail to icons. On iPhone, primary navigation moves to a fixed bottom rail, the map and cards stack vertically, and the full command menu preserves access to every game feature.

## Verification

- static D shell contract
- JavaScript extraction and module-order contract
- desktop WebKit interaction test
- iPhone 13 WebKit interaction test
- navigation to existing business and settings screens
- map marker selection and context drawer rendering
- screenshots retained as CI artifacts
