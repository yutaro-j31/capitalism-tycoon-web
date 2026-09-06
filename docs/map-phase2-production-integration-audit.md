# Phase 2 map: production integration readiness audit

2026-09. Audit-only pass (branch `audit/map-phase2-production-integration`,
base main `b54ca9f6dd47c7a6d96d0c5708e60410a92099f1`) -- no production code
changed in this pass. Goal: determine the shortest safe path to get the
Phase 2 pannable Canvas + sprite map (`prototypes/map-world-preview.js` +
`prototypes/map-canvas-renderer.js`, currently only reachable via the
standalone `map-phase2-preview.html` dev page) into the actual production
map screen, without regressing anything the current DOM/CSS map already
does.

## 1. Current production map: structure

- **Entry point**: the `map` tab is registered three times
  (`js/app.js` `TABS`, `js/d-ui-shell.js` `PRIMARY_NAV`/`ALL_NAV`). Selecting
  it sets `engine.g.selectedTab='map'`, calls `engine.save()`, then the
  global `render()` (`js/app.js`) rewrites `#app.innerHTML`, dispatching to
  `renderMap()` for the `<main data-screen="map">` content.
- Every `innerHTML` write to `#app` is intercepted by an accessor in
  `js/ui-enhancer-registry.js`, which reruns every registered
  `enhance(context)` -- this is how `js/d-ui-shell.js`'s single enhancer
  (`id:'d-ui-shell'`) gets to redecorate the screen after each full
  re-render (week advance, any action, prefecture change, marker click).
- **`renderMapWorkspace()`** (`js/d-ui-shell.js`) is pure DOM/CSS --
  **no `<canvas>` anywhere**. It wraps the original `renderMap()` output
  (filters/tenant list/office list/property list, from `js/app.js`)
  inside a collapsible `.d-map-directory`, and builds `.d-map-workspace`
  containing `.d-map-stage` > `.d-city-surface` (`.d-water`, `.d-road-grid`,
  `.d-city-blocks` -- 34 `<i>` divs) + `isoCityBuildingsSVG(g)` (inline SVG,
  see below) + marker `<button>`s + `.d-map-overlay` (3 white KPI cards) +
  `.d-context-panel` (selection detail).
- All positioning is **percentage-of-container** (`style="--x:…%;--y:…%"`),
  not tile/isometric coordinates -- structurally unrelated to Phase 2's
  `worldTransform()`/camera/tile system.

### `mapEntities()` (`js/d-ui-shell.js`)

Builds up to 6 store + 6 tenant + 2 office + 6 realestate = 20 entities per
render:

- `store`: read directly from `g.stores` (real engine array). Clean.
- `tenant`/`office`: **scraped from already-rendered legacy DOM buttons**
  (`button[data-action="open-store"]` etc, produced by `js/app.js`'s
  `renderMap()`), not read from `g.tenants`/`g.rentalOffices` directly.
  This is a historical accident of how `mapEntities()` was bolted onto the
  pre-existing directory list, not a deliberate data contract.
- `realestate`: scraped from `button[data-action="buy-property-company"]`
  but cross-referenced against `g.properties` for its display name.
- **There is no `landmark` kind in production at all.** Only 4 marker kinds
  exist today; "landmark" is purely a Phase 2 scenery concept (the
  per-prefecture skyline anchor), never a clickable production entity.

### Marker placement

`js/d-ui-shell.js`: `MARKER_POSITIONS` (10 fixed slots) + FNV-1a `hash(id)`
nudge (±3%/±3%) + a collision-avoidance search over a 9x7 percentage grid
(`markerPosition()`/`markerPositionsCollide()`, from PR #600). Flat 2D
percentage layout over a static-size stage -- no camera, no pan, no tile
grid. **Production map does not pan at all** (`.d-map-stage` is a fixed
`position:relative` box); marker clicks are handled by a single
document-level capturing `click` listener with no tap/drag disambiguation
needed, since nothing drags.

### Selection

`let selectedEntity` (module-level, `js/d-ui-shell.js`), re-resolved
against the current `entities` array each render, consumed by
`selectedDetail(chosen,g)` for the `.d-context-panel` content. Set on
marker click (bypasses the enhancer's memoization key by calling
`runUIEnhancers()` directly). **Phase 2 has no equivalent implementation
at all yet** -- `map-canvas-renderer.js` only has an aspirational comment
about future selection caching; selection/detail-card logic needs to be
built from scratch for the adapter.

### Filters / prefecture

- The map toolbar's filter/legend buttons in `renderMapWorkspace()` are
  **inert placeholders with no handler** in `d-ui-shell.js` itself. Real
  filter logic (`state.mapFilters`, checkbox UI, `applyMapFilters()`) lives
  entirely in `js/iphone-playtest-fixes.js` (the "iPhone compatibility"
  file, though it's unconditional on viewport size despite the name).
- Prefecture selection is the **legacy `<select data-bind="selectedPref">`**
  from `js/app.js`'s `renderMap()`, relocated into `.d-map-directory`.
  Changing it sets `engine.g.selectedPref` and calls global `render()`.
  Current-prefecture state exists redundantly in three places:
  `ui.selectedPref` (in-memory), `engine.g.selectedPref` (persisted), and
  `mapEntities()` re-reading the live DOM select's `.value` -- none of
  these is a single clean "current prefecture" API to subscribe to.

### Procedural city visuals (production's own, separate from Phase 2)

Three independent deterministic-hash "scatter N boxes" generators coexist
purely for decoration:

1. `.d-city-blocks` -- 34 plain `<i>` divs (`d-ui-shell.js`)
2. `isoCityBuildingsSVG()` -- 34 inline-SVG isometric cubes (roof/left/right
   faces, windows, hue-by-zone via `--d-iso-hue`), landed in PR #560,
   documented as "Phase 1" of `docs/ui-redesign-roadmap.md`'s CI2 reskin
3. `.iphone-city-detail` -- 18 more divs, `js/iphone-playtest-fixes.js`'s
   own independent copy

All three use copy-pasted variants of the same FNV-1a `hash()` (a 4th copy
lives in `prototypes/map-canvas-renderer.js`). **Sharpest philosophical
mismatch with Phase 2**: production draws buildings as code-generated
colored polygons; Phase 2's own file header explicitly forbids this
("Buildings are NEVER drawn by this code... a missing asset draws an
obvious dev placeholder, never a stand-in building").

### Save / determinism / RNG

No direct `localStorage`/`SAVE_KEY` access in map code; it only reads the
live in-memory engine snapshot. No writes to simulation state anywhere in
the map rendering path (`mapEntities`, `markerPosition`, `selectedDetail`,
`renderMapWorkspace`, the iPhone map layer). No `Math.random` anywhere;
the only "randomness" is the pure, unseeded FNV-1a hash (confirmed safe --
never consumes the simulation's own RNG stream). Same holds for Phase 2's
own `hash()`.

### registerUIEnhancer / startup

- `d-ui-shell.js` registers exactly one enhancer (`id:'d-ui-shell'`),
  memoized by `renderKey(g)` which **includes `selectedEntity`** -- so a
  marker click can force a fresh `enhanceMap()` pass without a full
  `app.innerHTML` rewrite. The project is at the hard-capped 79/79 external
  enhancer registrations (`tests/startup-runtime-budget-test.js` /
  CLAUDE.md); a Phase 2 adapter must extend this existing hook, not
  register a new one.
- `js/d-ui-shell.js` loads early/mid in `index.html` /
  `tests/fixtures/module-load-order.json`; `js/iphone-playtest-fixes.js`
  loads dead last (it patches DOM the earlier scripts already built).

## 2. Phase 2 readiness classification

| Feature | Class | Notes |
|---|---|---|
| Canvas paint primitives (`paintTerrain`/`paintRoads`/`paintGreenery`/`blitSprites`) | **A** | Pure functions of district/transform/images, no state coupling |
| camera/world/screen transform (`worldTransform`/`withCamera`/`clampCameraToContent`) | **A** | Pure geometry |
| culling (`cullVisible`) | **A** | Pure geometry |
| `worldToScreen` (`transform.toScreen`/`toCss`) | **A** | Pure geometry |
| civic/office.mid/residential.mid/P0/P1 sprites, `CATEGORY_FALLBACK`, `WORLD_NO_REPEAT_RADIUS` | **A** | Pure asset-manifest-driven scenery; never needs production state (see adapter design -- these stay scenery-only) |
| landmark placement | **A** | Deterministic per-prefID; only needs a prefID-naming adapter (trivial), not a structural change. Confirmed: production has no equivalent entity, so this stays a Phase 2-only decorative concept |
| DPR clamp (`resolveDpr`/`MAX_DPR`/`sizeCanvas`) | **A** | Pure utility |
| pan/tap gesture code | **B** | Logic is sound, but currently inline in `map-phase2-preview.html`'s own `<script>`, hardcoded to `#stage`/`#city`/`#overlay` ids -- needs extracting into a module and wiring to production's real container |
| sprite loading/cache (`loadSprites`) | **B** | Loads the whole manifest fresh every call, no cross-mount cache -- needs a module-level cache wrapper so repeated tab-switches don't redecode images |
| overlay marker mechanism (`worldOverlayAnchors`/`PIN_SPECS`) | **B/C** | The anchors-array-to-pin mechanism is reusable; its current content logic (grab an arbitrary building tile of matching zone, unrelated to any real entity) is demo-only and must be replaced (see adapter) |
| filter UI | **B** | Needs replacing the preview's local `filter` variable with real filter state (production's only real filter implementation today lives in the iPhone-only compatibility layer, not the core shell) |
| selection + detail panel | **C** | Does not exist in Phase 2 at all yet; must be built new, informed by production's `selectedEntity`/`selectedDetail()` pattern |
| entity-to-tile mapping (which store/tenant/office/property sits on which tile) | **C** | Does not exist; core of the adapter design below |
| prefecture switching | **C** | Preview hardcodes `PREF_ID='tokyo'`; needs wiring to a single canonical prefecture source (see adapter -- recommend `g.selectedPref` only, not the two redundant mirrors) |
| `map-phase2-preview.html`'s dev-only chrome (measurement table, "approval pending" banner) | **D** | Pure dev-tool scaffolding; not part of what ships. The page itself can stay as a standalone dev preview tool -- it is not "deleted", just not the production artifact |

## 3. Production state adapter design

**Principle**: scenery (terrain/roads/greenery/every building sprite
including civic/office.mid/residential.mid/P0/P1/landmark) stays 100%
Phase 2-internal and deterministic -- it never reads or needs production
state. Only the **overlay layer** (the 4 real marker kinds + selection +
filters + current prefecture) needs a production connection.

```
production source of truth                    map view model              Canvas / overlay
---------------------------                    --------------              ----------------
g.stores (engine array)              ---\
g.tenants (engine array,             ----\
  NOT the current DOM-scrape)         ----\
g.rentalOffices (engine array,        ----\   buildMapViewModel(g, engine)
  NOT the current DOM-scrape)          ---- >   -> { prefID,                -> buildWorldDistrict()
g.properties (engine array)           ----/        entities: [{kind, id,        (unchanged, pure
g.selectedPref (single canonical  ---/               tileX, tileY, label,        scenery)
  source -- see below)                                spriteHint?}],
                                                     selectedEntityId,        -> a NEW placement step
                                                     filters }                   assigns each entity a
                                                                                  tileX/tileY (deterministic
                                                                                  hash, analogous to today's
                                                                                  markerPosition() but in
                                                                                  tile-space, not %-space)

                                                                             -> overlay anchors are read
                                                                                DIRECTLY off the view
                                                                                model's tileX/tileY --
                                                                                NOT derived by scanning
                                                                                building tiles for a
                                                                                matching zone (today's
                                                                                worldOverlayAnchors/
                                                                                PIN_SPECS approach)
```

Per-entity source of truth (correcting production's own DOM-scrape
indirection along the way, per the audit's explicit recommendation):

| entity | adapter reads | today's production reality |
|---|---|---|
| 自社店舗 (store) | `g.stores` | already clean, no change needed |
| 出店候補 (tenant) | `g.tenants` | production currently scrapes rendered DOM buttons instead -- adapter should read the array directly |
| オフィス候補 (office) | `g.rentalOffices` | same DOM-scrape issue as tenant |
| 売買可能不動産 (property) | `g.properties` | already partially clean (name lookup only) |
| ランドマーク (landmark) | none -- Phase 2-internal per-prefecture scenery | production has no equivalent entity at all; stays decorative |
| prefecture | `g.selectedPref` only | production has 3 redundant mirrors (`ui.selectedPref`, `engine.g.selectedPref`, live DOM `<select>.value`); adapter should read the persisted engine field only, and any new prefecture switcher UI should mutate it through the SAME action pathway production's legacy `<select>` already uses, not a new one |
| 選択状態 (selection) | new view-model field, mirroring production's `selectedEntity` pattern (`"kind:rawID"` string) | does not exist in Phase 2 yet |
| filter状態 | new view-model field (ephemeral, module-level, like today's `selectedEntity`/`mapDirectoryOpen` -- no persistence needed) | production's only real implementation is iPhone-only; should be hoisted to a shared place the adapter and any future desktop filter UI both read |

**Invariants the adapter must hold** (verified achievable, nothing above
requires violating them): `buildMapViewModel()` is a pure, read-only
function of `(g, engine)` -- it never writes to `g`/engine fields, and the
tile-space placement hash is the same deterministic FNV-1a family already
used everywhere in this codebase (no `Math.random`, no consumption of the
simulation's own RNG stream).

## 4. Integration method comparison

| axis | A: full replace | B: shell stays, swap background renderer only | C: coexist behind a feature flag, migrate in stages |
|---|---|---|---|
| regression risk | highest -- markers/selection/filters/realestate purchase actions/iPhone layer/3 procedural-city generators all change at once | medium -- background only, existing marker/selection/filter DOM untouched | lowest -- flag off reproduces today exactly; flag on is opt-in and independently verifiable |
| iPhone Safari risk | highest -- untested Canvas pan/tap plus most of `iphone-playtest-fixes.js`'s map patches become dead code simultaneously | medium -- Canvas rendering needs its own WebKit verification, but marker/tap mechanics are untouched | lowest -- staged verification, easy rollback per stage |
| duplicate code | none after the cut, but a bad cut is a one-shot bet | some, temporary (2 of 3 procedural-city generators removed, 1 replaced by Canvas) | most, but deliberate and bounded -- exactly what a flag is for |
| rollback | hard (one large commit) | easy (flag/local revert of the background swap alone) | easiest (flip one flag) |
| testability | low -- many new integration points land together | high -- background renderer testable in isolation | highest -- old and new paths can run through the same test/visual-regression suite side by side |
| DOM reduction | immediate and largest | partial (34+34 decorative nodes collapse into one `<canvas>`; marker DOM count unchanged) | deferred until the final cleanup PR |
| production complexity | drops fast, but the transition itself is the riskiest moment | two coordinate systems (tile-space Canvas vs percentage-space markers) coexist for a while | flag branching + two implementations, for a bounded, deliberate period |
| final cleanup cost | lowest (nothing to clean up) | medium (marker layer still needs migrating later) | highest, but that cost is exactly PR D in the plan below -- it is scheduled, not avoided |

**Recommendation: C**, with B's background-only swap as C's *first* concrete
sub-step. This matches the instruction's own stated preference for staged
migration, and lets DOM reduction/final unification happen once the new
path has already proven itself in production under a flag, rather than
betting the whole screen on one PR.

## 5. Legacy renderer removal timing

Per instruction: the old renderer (`.d-city-blocks`/`isoCityBuildingsSVG`/
marker DOM system) is **not** removed in the first integration PR. It is
removed only in a dedicated final PR (D below), gated on the new path
having, under its flag, already demonstrated: production-state-driven
rendering, working on iPhone WebKit, working selection, working filters,
working pan, working markers, no save-compat impact, and a green canonical
CI run.

## 6. Recommended PR split

1. **PR A -- adapter foundation + flag + Canvas background wiring.**
   New `js/map-phase2-adapter.js` (`buildMapViewModel()` etc, scenery only
   at this stage), a non-persistent flag (recommend a `localStorage`/URL-
   param dev flag, NOT a new `g.*` save field, so it never touches save
   compatibility), `enhanceMap()` branches on the flag to additionally
   mount a `<canvas>` inside `.d-city-surface` when set. Existing
   `.d-city-blocks`/`isoCityBuildingsSVG`/markers stay untouched and
   continue rendering underneath/alongside when the flag is off (default).
   Excludes: markers, selection, filters, iPhone gesture work.
2. **PR B -- marker/selection/filter wiring.** Extends the view model with
   real tile-space entity placement; overlay anchors read directly off it;
   wires selection to (a shared or Phase-2-native) `selectedEntity`/detail
   panel; hoists filter state to a shared location both old and new paths
   can read. Old DOM markers are NOT deleted yet -- both coexist behind the
   flag.
3. **PR C -- iPhone pannable interaction + WebKit hardening.** Extracts the
   preview's pan/tap gesture code into the adapter module, verifies DPR
   clamp/hit-targets/tap-vs-pan separation against production's real
   `iphone-playtest-fixes.js` layer (which must keep working when the flag
   is off, and be reconciled -- not fought -- when it's on), and gets a
   real iPhone WebKit CI run (push/schedule, not PR-gated per this repo's
   own WebKit-job convention) green under the flag.
4. **PR D -- legacy renderer removal.** Only after A-C have run green
   (canonical CI + a real WebKit run) for a period the owner is comfortable
   with: delete `.d-city-blocks`/`isoCityBuildingsSVG`/the three duplicate
   hash-based placement systems/the flag itself, leaving Phase 2's adapter
   path as the only one.

Adjust the exact boundary between A/B if a smaller first PR is preferred
(e.g. ship the flag+canvas mount with zero visible change first, as a
pure infrastructure PR) -- the four-way split above is a starting point,
not a hard requirement.

## 7. P2 props

Deferred per instruction until production integration reaches a stable
point (at minimum through PR C). Rationale accepted: the map already
improved substantially with 47 real building sprites (P0+P1); getting
Phase 2 in front of real players is worth more right now than adding
decoration nobody outside `map-phase2-preview.html` can see yet.

## 8. Candidate issue found during audit (not fixed here, not folded into integration work)

- `css/iphone-playtest-fixes.css`'s zoom transform
  (`transform:scale(var(--iphone-map-zoom,1))`) is applied to
  `.d-city-surface`/`.d-water`/`.d-road-grid`/`.d-city-blocks`/
  `.iphone-city-detail`, but **not** to `.d-map-marker` or
  `.iphone-synthetic-marker`. If confirmed by an actual iPhone/WebKit
  visual check (not done in this audit pass -- static code read only),
  this would mean zooming the map scales the city imagery but leaves
  marker pins at their original position, visually desyncing markers from
  the buildings/streets they're meant to sit on. Flagging as a candidate
  bug report for a separate issue/PR, per instruction not to fix
  discoveries found during this audit inline with integration work.

## 9. PR A implementation notes (actual, vs. section 6's plan)

PR A shipped as `js/map-phase2-canvas.js` (not `map-phase2-adapter.js` as
named in section 6 -- functionally the same module described there).
Two deltas from section 6's suggestion, both stricter than what was
proposed:

- The flag (`phase2MapCanvasEnabled`, read as `?phase2MapCanvas=1/true/on`)
  is **not** written to `localStorage` at all, in-memory override only via
  `setEnabledForDev()` -- section 6 said "recommend a `localStorage`/URL-
  param dev flag"; the actual governing instruction for this PR required
  zero persistence, so the flag resets on every reload by design.
- `prototypes/map-canvas-renderer.js`/`map-world-preview.js` are lazy-
  loaded via runtime `<script>` injection (only on first flag-on render),
  not bundled/rewritten into the new module and not added as static
  `<script>` tags in `index.html` -- `tests/javascript-module-split-
  test.js` treats `index.html`'s script tags as an exact 1:1 inventory of
  `js/*.js`, and the two prototype files live under `prototypes/`.

Everything else in section 6's PR A description (scenery-only, markers/
selection/filters untouched, legacy renderer left in place and just
hidden, not deleted) matches what shipped.

## 10. PR B/C implementation notes (actual, vs. section 6's plan)

PR B shipped `buildMapViewModel()`'s marker/selection/filter extension and
`placeEntityTiles()` (deterministic tile-space placement, reusing
`prototypes/map-canvas-renderer.js`'s `hash()` via the `Base` binding --
no 5th hash implementation) exactly as section 6 described: markers read
directly off the view model's `tileX`/`tileY`, selection reuses
production's `selectedEntity`/`selectedDetail()` pattern (extended with
`rawID`/`name`/raw `store`/`property` references so `selectedDetail()`
needed zero changes), and filter state (`mapFilterKind`) is hoisted to a
shared, non-persistent module-level variable. Legacy DOM markers were kept
generating and CSS-hidden (not deleted) under the flag, matching section
6's staged-migration plan.

PR C shipped one-finger pointer-drag pan and the persistent module-level
camera (`resolveCamera()`), plus discovered and fixed two bugs during
manual QA that section 6 didn't anticipate: (1) gating pan-start on the
canvas element alone silently ignored drags starting on a marker button
(markers are canvas siblings, not descendants); (2) the `pointerleave`
safety net that cancels an abandoned pre-threshold drag was firing on any
element-boundary crossing, not just leaving the map surface, wrongly
canceling drags that started on a small marker. It also confirmed (matching
section 8's candidate bug report) and isolated the flag-on Phase 2 surface
from the legacy `--iphone-map-zoom` transform via a CSS override, without
touching `iphone-playtest-fixes.js` itself.

## 11. PR D: production promotion + legacy removal (final architecture)

PR D executed section 6's PR D exactly as planned: the feature flag and
every legacy renderer/placement path it used to sit beside are deleted
outright (not merely hidden), leaving Phase 2 as the map's only renderer.
Final production data flow:

```
production source of truth
  g.stores / g.tenants / g.rentalOffices / g.properties / g.selectedPref
        |
        v
  buildMapViewModel(g, engine)              js/map-phase2-canvas.js
        |  {prefID, entities:[{id,kind,sourceId,pref,label,...}]}
        v
  placeEntityTiles(entities, prefID)        js/map-phase2-canvas.js
        |  deterministic FNV-1a hash placement (Base.hash, reused --
        |  no new hash implementation), canonical id-sorted resolution,
        |  collision-avoidance linear probe over each entity's eligible
        |  district tiles
        v
  Phase 2 world (buildWorldDistrict)        prototypes/map-world-preview.js
        |  terrain/roads/greenery/civic/office.mid/residential.mid/
        |  P0/P1 sprites/landmark -- scenery only, never reads production
        |  state
        v
  shared camera (resolveCamera)             js/map-phase2-canvas.js
        |  single {x,y} source of truth for both layers below; reset only
        |  on prefecture change; pointer-drag pan mutates it directly
        |
        +--> Canvas paint (render)          js/map-phase2-canvas.js +
        |      terrain/roads/greenery/sprites via the shared camTransform  prototypes/map-canvas-renderer.js
        |
        +--> DOM markers (positionMarkers)  js/map-phase2-canvas.js
               --x/--y set via the SAME camTransform the canvas just used
                 |
                 v
        js/d-ui-shell.js: handleClick() marker click -> selectedEntity
                 |
                 v
        selectedDetail(chosen, g)           js/d-ui-shell.js (unmodified
                                             by the whole A-D sequence)
```

`renderMapWorkspace()` (`js/d-ui-shell.js`) is now a single, unconditional
path: it always emits `.d-city-surface.d-city-surface-phase2` with a
`<canvas class="d-phase2-canvas">`, calls `buildMapViewModel()`/
`placeEntityTiles()`/`render()` unconditionally, and always renders the
filter chip row. There is no `phase2On` branch, no query-string flag
(`?phase2MapCanvas=`), and no `isEnabled()`/`setEnabledForDev()` API left
in `js/map-phase2-canvas.js`.

**Removed** (not hidden -- deleted outright): `mapEntities()` (DOM-scraped
legacy adapter, including its 6/6/2/6 per-kind caps),
`markerPosition()`/`markerPositionsCollide()`/`MARKER_POSITIONS`/
`MARKER_GRID_X`/`MARKER_GRID_Y` (legacy fixed-slot placement),
`isoCityBuildingsSVG()` and the legacy 34-block `.d-city-blocks`
generation (plus `.d-water`/`.d-road-grid`), `css/d-ui-map-buildings.css`
(the isometric-city stylesheet, deleted as a file), the hidden-duplicate-
marker CSS rule (nothing left to hide), and `js/iphone-playtest-fixes.js`'s
legacy per-viewport zoom mechanism (`state.mapZoom`, its zoom-in/zoom-out/
reset buttons, the `--iphone-map-zoom` CSS custom property, and PR C's own
now-moot isolation override for it) and `ensureCityDetail()` (a second,
independent procedural-city layer that would have competed with Phase 2's
Canvas scenery). `js/d-ui-shell.js`'s own `hash()` (FNV-1a) became fully
dead once both of its only callers (`markerPosition()`/
`isoCityBuildingsSVG()`) were deleted, and was removed with them --
consistent with this codebase's rule against duplicate hash
implementations.

**Deliberately retained** (audited, not redundant with Phase 2's 4
production kinds): `js/iphone-playtest-fixes.js`'s competitor synthetic-
marker path (`ensureSyntheticMapEntities()`'s competitor branch,
`handleSyntheticMarker()`) -- competitors are not one of
`buildMapViewModel()`'s 4 kinds (store/tenant/office/realestate), so
nothing in Phase 2 covers them. Also retained in full: `ensureMapChrome()`'s
pref-select/view-toggle/filter/legend chrome
(`.iphone-map-nav`/`.iphone-map-tools`/`.iphone-map-popover`,
`state.mapFilters`/`applyMapFilters()`) -- a separate, still-functioning
navigation layer, not "procedural city" or "DOM-scraped marker placement,"
and out of this PR's scope per the instruction not to do an unrelated full
refactor of `iphone-playtest-fixes.js`.

The Tokyo 17-marker baseline PR B established and PR C confirmed
(tenant 8 + office 3 + realestate 6 = 17 placeable entities in a fresh
game with 0 stores) is unchanged and is now this PR's own fixture contract
(`tests/map-phase2-production-promotion-test.js`), not merely a flag-on
observation.

## 12. Map Framing / Zoom-out Calibration (initial-view pull-back)

Real iPhone playtesting after PR D's merge found the initial map view too
close: `js/map-phase2-canvas.js`'s `DEFAULT_SCALE=0.72` showed only 1-2 of
the world's 7 street-grid block-columns on first paint (measured: ~1.9
block-columns at the iPhone 13 viewport's 374px canvas width, ~2.6 at a
1280x800 desktop's 520px canvas width) -- individually attractive
buildings, but no sense of a city. Under the pre-promotion feature flag
this was reachable only via `?phase2MapCanvas=1` in dev; production
promotion (section 11) made it every player's very first map view.

**Root cause**: `DEFAULT_SCALE` was tuned for a close-up, individual-
building read, not an overview. It is the sole projection scale for both
the Canvas paint (`render()`'s `ctx.setTransform(dpr*transform.scale,...)`)
and marker placement (`withCamera().toCss`, which multiplies by
`transform.scale` too) -- there was and is no separate `camera.zoom` field
(the module-level `camera` stays `{x,y}` only, per PR C's contract).

**Fix**: lowered `DEFAULT_SCALE` from `0.72` to `0.44` -- a pure
projection-scale change, not a new zoom mechanism. Every other paint/
placement/pan code path already reads scale from the resolved `transform`,
so nothing else needed to change to widen the initial view; pan, tap,
selection, filtering, and prefecture switching are all unaffected (same
`tests/map-phase2-canvas-test.js` prefecture-rebuild-once contract and
`tests/map-phase2-iphone-pan-webkit-test.js` pan/rAF-coalescing contract
still pass unmodified). `0.44` was derived by calling the real
`MapWorldPreview.buildWorldDistrict`/`worldTransform`/`STREET_PERIOD` (not
a hand-rederived copy of that geometry) against the measured production
canvas widths, landing both viewports in the "3-5 block-columns visible"
target: ~3.1 block-columns at 374px (iPhone), ~4.3 at 520px (desktop). The
world's content bounding box is roughly 2:1 (width:height), so the full
street-grid height (all 6 block-rows) comfortably fits inside the taller
portrait iPhone viewport at the same scale -- the pulled-back view reads as
a full north-south city extent, not a cropped strip.

**Marker-size rebalance**: pulling the camera back shrinks buildings/tiles
but `.d-map-marker`'s own CSS size (`css/d-ui-reference-fidelity.css`,
58x72px, fixed regardless of viewport) does not scale with the projection
-- at the wider view, markers on nearby tiles started visually
overlapping each other and dominating the now-smaller buildings beneath
them. `css/d-ui-map-phase2-markers.css` (already imported after
`d-ui-reference-fidelity.css` in `css/d-ui-mobile-company.css`, so it wins
the same-specificity cascade tie) now overrides `.d-map-marker` to 48x60px
-- a ~31% area reduction that keeps both dimensions comfortably above the
44px iOS minimum tap target while visibly reducing marker crowding. This
is a CSS-only, viewport-independent change (no new registerUIEnhancer, no
new JS): the 79/79 external enhancer cap and MutationObserver-0 invariant
are both unaffected.

Entity-tile placement itself (`placeEntityTiles()`'s zone-restricted
collision-avoidance linear probe, section "PR B" above) was intentionally
left untouched -- some residual close-tile marker crowding near the
landmark's commercial/CBD core is a pre-existing characteristic of that
placement density (it was always there; the old 0.72 scale simply kept
most of it off-screen), not something this PR's explicitly scale/size-only
mandate extends to redesigning. The existing "no exact tile overlap"
contract (`tests/map-phase2-production-promotion-test.js`) is about tile
placement, not CSS pixel bounding boxes, and is unaffected either way.

New coverage: `tests/map-phase2-framing-zoomout-test.js` pins
`DEFAULT_SCALE`'s pulled-back value, the 3-5 block-column framing bar (with
a negative test proving the pre-PR 0.72 value fails it), the marker-size
override and its cascade-order dependency on `d-ui-reference-fidelity.css`
(with a negative test proving the override is load-bearing), and re-checks
the no-district-rebuild-during-redraw, no-`Math.random`, and SAVE_KEY/
saveVersion invariants this change must not disturb.

## 13. Prefecture-switch canvas lifecycle + last legacy-toolbar removal

Real iPhone playtesting of the merged production map (main
`91ac0bf1a1b39aee49b65765119b0d51e12fa6aa`, after section 12's zoom-out
calibration) found switching prefectures badly broken: a blank/mostly-
background-colour canvas, a giant stretched fragment of the scenery, an
unstable initial framing after the switch, and the legacy `.d-map-tools`
bar (with its dead zoom-out/zoom-in buttons) reappearing at the bottom of
the map. Two independent root causes, fixed together:

**Root cause 1 — canvas backing-store lifecycle.** `js/d-ui-shell.js`'s
`renderMapWorkspace()` rebuilds `.d-city-surface`'s innerHTML wholesale on
every render (prefecture switch included), so a brand-new `<canvas
class="d-phase2-canvas">` element replaces the old one every time.
`js/map-phase2-canvas.js`'s `render()` cached `lastCssW`/`lastCssH`/
`lastDpr` and skipped re-running `Base.sizeCanvas()` (which sets both the
canvas's backing-store `width`/`height` AND its inline CSS `style.width`/
`style.height`) whenever the CSS size matched the *previous* canvas's
last-known size -- comparing only `cssW`/`cssH`, never canvas element
identity. A same-size prefecture switch (the common case, since the
viewport itself doesn't change size) hit that skip on the fresh element:
`css/d-ui-map-phase2-canvas.css`'s `.d-phase2-canvas{width:100%;
height:100%}` still gave it the right CSS *layout* box (so `cssW`/`cssH`
read correctly via `getBoundingClientRect()`), but its *backing store*
bitmap stayed at the browser's HTML canvas default of 300x150 -- a small
fragment of the scenery stretched to fill the much larger real CSS box, or
just the background fill colour, depending on where that tiny 300x150
window happened to land relative to the drawn content. Fixed by adding
`lastCanvasEl` to the cache: the skip now requires the SAME canvas element
AND an unchanged CSS size, so a fresh element (regardless of whether its
CSS size happens to match the old one) always gets `Base.sizeCanvas()`
run. The "same canvas, same size" skip itself is preserved unchanged (a
real pan/select/filter redraw on the SAME element still never resets the
backing store), so PR C's pan-performance contract is untouched.

**Root cause 2 — dead legacy toolbar.** `renderMapWorkspace()` still
generated `.d-map-toolbar` (a decorative "都市ビュー⌄" button + prefecture
name span) and `.d-map-tools` (`◎`/`☷`フィルター/`⌕`凡例/`−`/`＋`) on every
render, even though none of those buttons have ever had a click handler in
this file's `handleClick()` since PR D removed the legacy zoom mechanism
they used to drive -- `.d-map-toolbar` was hidden by a pure CSS rule
(`.iphone-map-enhanced .d-map-toolbar{display:none!important}`, safe
regardless of JS timing), but `.d-map-tools` relied on `js/iphone-
playtest-fixes.js`'s `ensureMapChrome()` enhancer running
`oldTools.hidden=true` on it *after* every rebuild -- a JS-enhancer-
timing-dependent window in which a freshly rebuilt `.d-map-tools` (dead
buttons included) could be visible. That "generate dead markup, then hide
it" pattern is exactly what PR D's production promotion (section 11) was
supposed to have retired; it just hadn't been finished for these two
elements. Fixed by deleting `.d-map-toolbar`/`.d-map-tools` from
`renderMapWorkspace()`'s template entirely (not hiding them harder) --
`js/iphone-playtest-fixes.js`'s real, already-unconditional-on-every-
viewport `.iphone-map-nav`/`.iphone-map-tools`/`.iphone-map-popover`
chrome (filter/legend/view, all wired) is the sole surviving map toolbar
on both desktop and iPhone. The now-vacuous `oldTools.hidden=true` line
and every now-dead `.d-map-toolbar`/`.d-map-tools` CSS selector (across
`css/d-ui.css`, `css/d-ui-map.css`, `css/d-ui-reference-fidelity.css`,
`css/iphone-playtest-fixes.css`) were removed alongside it.

Both fixes are scale/lifecycle/markup-only: no `camera.zoom` field, no
pinch zoom, no new gestures, no change to `DEFAULT_SCALE=0.44` or the
`.d-map-marker` 48x60 hit target from section 12.

New coverage: `tests/map-phase2-prefecture-switch-canvas-lifecycle-test.js`
proves a fresh canvas element always gets its backing store (re)sized even
when its CSS size matches the previous canvas's, that the same canvas at
the same size still skips the resize (the performance contract), that a
full Tokyo→Gunma→Saitama→Tokyo→Gunma→Saitama sequence on fresh canvases
each ends with a correct non-default backing store and `DEFAULT_SCALE`
unchanged at 0.44, that `.d-map-toolbar`/`.d-map-tools`/the dead zoom
buttons are gone from the generated markup, and re-checks the no-district-
rebuild-during-pan, no-placement-rebuild-in-`render()`, marker hit-target,
no-`Math.random`, and SAVE_KEY/saveVersion invariants -- with two negative
tests (reverting the canvas-identity cache; reintroducing `.d-map-tools`)
proving both checks are load-bearing.

## 14. Lazy-load permanent-stuck-loading recovery

A real iPhone on the production URL (after PR #613, main
`14688893980c11a8adb785c9418f0b84ed6e80f8`) hit "出店候補を読み込み中です"
forever on the map screen -- switching prefectures did nothing, the city
never rendered. Confirmed from source, not guessed: `js/map-phase2-
canvas.js`'s `ensureAssetsLoaded()` cached its `assetsPromise`/
`manifestPromise` unconditionally, including on *failure* --
`.catch(()=>null)` resolved `assetsPromise` to `null` forever once set, and
`manifestPromise=manifestPromise||fetch(...)` never retried a *rejected*
`manifestPromise` either (a rejected promise is still truthy). A single
transient failure anywhere in the chain -- a lazy `<script>` failing to
load, the manifest `fetch()` failing, an invalid manifest -- permanently
prevented `assetsReady` from ever being set; every subsequent `render()`
call (prefecture switch, tab re-entry, anything) kept hitting the same
dead cached promise. This bug pre-dates PR #613 (introduced in PR #605,
"gate Phase 2 Canvas background into production map") -- PR #613 didn't
touch `ensureAssetsLoaded`/`manifestPromise`/`assetsPromise` at all (its
only change to this file was adding the third lazy dependency to
`PROTOTYPE_SCRIPTS`) -- but adding that third sequential lazy `<script>`
before the manifest fetch can even start does widen the window a single
real-network transient failure has to land in.

Two independent, complementary gaps let this ship undetected:

- `scripts/pages-deployment-smoke.js`'s `deploymentTargets()` only scanned
  `index.html`'s literal `<script src>`/`<link href>` tags -- the Phase 2
  map's lazy dependencies (3 prototype scripts + the sprite manifest +
  every sprite it references) are intentionally *not* static tags (see
  this file's own PR B section on why), so they were never checked against
  the actual published GitHub Pages bytes at all.
- `tests/iphone-webkit-smoke-test.js` (the only WebKit test that already
  ran against the real published URL) never opens the map tab, so it could
  never have caught this regardless of how the map behaved.

**Fix: bounded-retry state machine.** `js/map-phase2-canvas.js` replaces
the unconditionally-cached promises with an explicit `idle -> loading ->
ready` (or `idle -> loading -> retry* -> error`) state machine
(`loadState`/`loadAttempts`/`loadErrorDetail`, `MAX_LOAD_ATTEMPTS=3`,
`LOAD_RETRY_DELAYS_MS=[500,1500]`): a failed attempt is retried a bounded
number of times via a one-shot `setTimeout` per retry (never
`setInterval`/polling), and once retries are exhausted the state becomes
`'error'` with a stage-tagged diagnostic (`'prototype'` /
`'manifest-fetch'` / `'manifest-validation'`, console-only -- never shown
verbatim to the user). `ensurePrototypesLoaded()` is now idempotent under
a partial-success retry: it only (re)loads whichever of the 3 scripts
hasn't already set its own global, so a script that already succeeded
before a later one failed is never re-fetched/re-executed. `getLoadState()`
and `retryMapLoad()` are new exports; `js/d-ui-shell.js`'s
`renderMapWorkspace()` reads `getLoadState()` when `placed` is `null` and
shows either the existing loading text or, once `state==='error'`, an
explicit `マップの読み込みに失敗しました` message with a real
`.d-map-retry-btn` (>=44px, wired to `retryMapLoad()` via the existing
`data-d-ui-action` click-delegation pattern) -- never an infinite,
unrecoverable "読み込み中".

**Fix: deployment-target coverage.** `deploymentTargets()` now also
extracts `PROTOTYPE_SCRIPTS` directly from `js/map-phase2-canvas.js`'s own
source (regex, the same technique several tests already use to read
constants out of this browser-only file) -- a single source of truth, not
a second hand-maintained list -- plus the sprite manifest and every sprite
it references (split placeholder vs. production the same way
`ensureAssetsLoaded()` does, phase1 vs. phase2 asset directories). This
runs in the existing `verify-published-assets` CI job
(`.github/workflows/pages-deployment-smoke.yml`), so a genuinely
missing/stale published lazy dependency now fails deployment verification
instead of shipping silently.

**Fix: published WebKit map coverage.** New
`tests/published-map-phase2-webkit-test.js` (added to the same CI job,
following the established `published-*-webkit-test.js` pattern/shared
retry helper) opens the map tab on the real published URL, waits
(bounded, `MAP_READY_TIMEOUT_MS=20000`) for the loading placeholder to
resolve, and asserts: no `.d-map-load-error` (the load actually
succeeded), >=1 real marker, and the canvas sampled pixel data shows
real variance (not a flat, unpainted background fill) -- then repeats
across a Saitama→Tochigi→Gunma→Tokyo switching sequence. A test that
merely checks "the page didn't crash" would not have caught the original
incident; this one specifically distinguishes "still loading"/"error"
from "actually rendered."

New coverage: `tests/map-phase2-lazy-load-recovery-test.js` proves a
healthy first attempt reaches `ready`; a first prototype-script failure,
first manifest-fetch failure, and two consecutive manifest-fetch failures
all recover via the bounded retry; an already-succeeded prototype script
is never re-appended on a partial-failure retry; permanent failures at
each stage (manifest fetch, HTTP 500, manifest validation, prototype
script) all reach an explicit tagged `'error'` state within
`MAX_LOAD_ATTEMPTS`, never stuck in `'loading'` forever;
`retryMapLoad()` recovers from `'error'` once the underlying failure
clears and is a no-op while a load is already in progress; the
`js/d-ui-shell.js` error/retry UI wiring and its 44px tap target; no
`setInterval` anywhere in the load path; and the new deployment-target
coverage. Three negative tests: reverting to the old permanent-cache
model leaves the map stuck even though a real retry would have succeeded
(proves the state-machine fix is load-bearing); an index.html-only
extraction misses the lazy prototype scripts and sprite manifest (proves
the deployment-target fix is load-bearing); and a weak "page didn't
crash" check would have passed while the map was permanently stuck
(proves the published WebKit test's specific loading/error assertions
are what actually catch this class of bug).

## 15. Marker Interaction / Decluttering / Placard UX pass

Real-device incident: on the actual production iPhone URL (post PR #613),
markers were visible but tapping tenant/office/realestate markers often
did nothing, and clusters of same-kind markers rendered almost fully
overlapping (indistinguishable pins with no readable label).

**Tap root cause (confirmed by reading the CSS/JS, not guessed).**
`.d-city-surface` (`css/d-ui-reference-fidelity.css`) carried a non-`none`
`filter`, which forces the browser to create an isolated stacking context
for that box (CSS Filter Effects spec). `.d-map-marker`'s own `z-index`
(`css/d-ui.css`) could therefore never out-rank a SIBLING of
`.d-city-surface-phase2`, no matter how high it was set -- z-index only
ever competes within the nearest ancestor stacking context.
`js/iphone-playtest-fixes.js`'s `ensureMapChrome()`/
`ensureSyntheticMapEntities()` append exactly such siblings, on EVERY
viewport (no `@media` gate on any of their selectors, and `ensureMapChrome()`
itself has no user-agent check -- confirmed by reading both files, this is
not iPhone-only): `.iphone-map-nav` (z-index 18, a full-width top strip),
`.iphone-map-tools` (18, bottom-left), `.iphone-map-popover` (19, opens
over the bottom-left corner), and up to 3
`.iphone-synthetic-marker.competitor` markers (11), placed via a
completely separate percentage-based grid with no idea where real markers
actually render. Any real marker whose on-screen position fell under one
of those had its tap silently swallowed. `tests/iphone-playtest-
remediation-test.js` already documents a prior, narrower brush with this
exact hazard (it removed a redundant synthetic PROPERTY marker because it
could land on top of a real marker and "silently make it unclickable") but
left the general z-index ordering unfixed.

**Fix**: moved the `filter` from `.d-city-surface` to `.d-phase2-canvas`
(`css/d-ui-map-phase2-canvas.css`) -- a pixel-identical visual result,
since canvas already paints over everything inside `.d-city-surface` from
its very first placeholder fill onward, so this removes the forced
stacking context without changing anything visible. With that gone,
`.d-map-marker`'s z-index was raised (`css/d-ui-map-phase2-markers.css`,
`z-index:25`) above every one of the iPhone-chrome z-indexes above, so a
real marker now always wins the tap, on every device, deterministically.

**Placard redesign (requirement C)**: the label (`.d-map-marker small`)
used to be `opacity:0` by default, visible only on `:hover`/
`:focus-visible`/`.selected` (states only reachable AFTER the tap it was
meant to guide), and fully `display:none` under `<=820px` (i.e. every
phone). Both overrides are unconditional now. Label content changed from
the raw entity name to a fixed category label
(`js/d-ui-shell.js`'s new `placardLabel()`): tenant -> `テナント募集`,
office -> `オフィス募集`, realestate -> `売物件` (unified across all
`property.kind` values per spec -- a per-kind secondary line was judged
not worth the added density), store -> the store's own name (more useful
than a generic label once a player has more than one store).

**Screen-space decluttering**: new `layoutMarkerPlacards(entities,prefID)`
in `js/map-phase2-canvas.js`, called by `renderMapWorkspace()` right after
`placeEntityTiles()`, on its full UNFILTERED result (so `mapFilterKind`
hiding some markers never reshuffles the ones that stay visible). Pure,
deterministic: entities are processed in canonical (id-sorted) order,
each trying a fixed, precomputed candidate list -- "no shift" first, then
an expanding 8-compass ring search (`PLACARD_RING_COUNT=6` rings x 8
directions = 48 more candidates) -- against a conservative `PLACARD_W x
PLACARD_H` (108x86 CSS px) AABB collision box approximating a marker's
rendered glyph+label footprint. If every candidate collides
(pathological density), the candidate with the LEAST total overlap area
is accepted rather than defaulting back to the identical `{0,0}` position
(spec: never "単純に同じ位置へ重ねない"). This all runs in the SAME
camera-independent world-space `transform.toScreen()` (not
`camTransform.toCss()`, which bakes in the live `camera.x/y` pan offset)
`ensureDistrict()`/`render()` already use for canvas painting -- two
markers' anchors both translate by the identical delta when the camera
pans, so their relative positions (and every collision resolved from
them) are pan-invariant by construction. `positionMarkers()` applies the
camera translation uniformly on top of the resulting offsets every
render, so panning moves every placard by the same delta and never
reshuffles the layout. The resulting `placardOffsetX/Y` are baked into
each marker's `data-phase2-offset-x/y` attributes by `renderMapWorkspace()`;
`positionMarkers()` (called every pan frame, not just on a full re-render)
just reads them back -- the expensive collision search itself is never
recomputed during a pan.

Real anchor coordinates from `transform.toScreen()` are RAW, unscaled
tile-space pixels (`toCss()` is what multiplies by `transform.scale` =
`DEFAULT_SCALE`) -- an early version of this collision math compared
CSS-pixel-sized boxes against those unscaled coordinates directly, which
silently under-detects collisions by a factor of `1/DEFAULT_SCALE` (~2.3x
at 0.44). This was caught only by a local Chromium dry-run against a real
freshly-created company (not by the isolated Node unit test, whose
generous synthetic fixture happened not to expose it) -- `layoutMarkerPlacards()`
now scales the anchor the same way `toCss()` does before running collision
math.

**Leader**: `.d-map-marker-dot` (`css/d-ui-map-phase2-markers.css`), a
small dot rendered as a child of the marker button, positioned via
`transform:translate(calc(-1*var(--ox)),calc(-1*var(--oy)))` -- i.e.
always at the TRUE tile anchor regardless of how far the placard itself
has been nudged or clamped. A marker with no neighbours keeps its
on-anchor position (`--ox`/`--oy` both `0px`), so its dot sits directly
under its own glyph, visually inert. A plain dot (rather than a rotated
connecting line) was chosen deliberately: every candidate offset is a
free 2D vector (not axis-restricted), and a dot reads correctly for any
direction with no rotation math, matching spec's explicit "stem / line /
dot" list of equally-acceptable options.

**Viewport clamp and its cross-marker interaction (requirement E)**: a
marker's placard is clamped into `[0,cssW]x[0,cssH]` ONLY when its own
tile ANCHOR is itself on-screen (within one placard-width/height of the
canvas box) -- clamping is meant to keep a near-edge placard from being
cut off, not to relocate an entity whose tile is nowhere near the current
camera view. A first implementation clamped unconditionally and was
caught by the same local Chromium dry-run: `layoutMarkerPlacards()`'s
offsets can legitimately point a near-edge marker's placard well past the
visible edge (it has no idea what the live viewport looks like -- that is
what keeps it pan-stable), and clamping several such markers
independently collapsed them all onto the identical boundary value,
undoing the very separation just computed and manufacturing brand-new
collisions between markers that were never near each other. The fix adds
a second, deliberately viewport/render-time-dependent pass restricted to
markers that actually needed clamping: each is nudged along the clamped
edge (bounded, deterministic candidate offsets) against every
already-positioned marker (clamped or not) before accepting a final
position.

**Known residual limitation**: local verification (a fresh company's own
17-entity home-prefecture fixture -- 8 tenants / 3 offices / 6
unowned-property listings, the same baseline `tests/map-phase2-
production-promotion-test.js` already treats as this codebase's reference
density) shows zero overlapping placards on a 1280x800 desktop viewport
across repeated runs, and shows zero overlaps on a 390x844 iPhone
viewport in the large majority of runs, but can occasionally show 1-2
partially-overlapping (not fully-stacked) placards on the narrower iPhone
viewport specifically, when this single worst-case density is combined
with edge clamping. This is the explicitly spec-sanctioned "どうしても
全件を同時表示できない高密度時" last-resort case, not the original bug
(near-total stacking, "赤3枚・紫3枚がほぼ完全に重なる"), and does not
affect tap-ability (fixed unconditionally by the z-index change above,
independent of the decluttering algorithm's visual outcome). A proper
fix (e.g. compact cluster indicators) was explicitly out of scope for
this pass per spec ("clusterを導入する場合は...scopeが大きくなるので無理
に入れない").

New coverage: `tests/map-phase2-marker-placard-interaction-test.js`
(root-cause z-index/stacking-context checks; always-visible placard label
content; `layoutMarkerPlacards` determinism, order-independence, stability
across a Tokyo->Osaka->Tokyo prefecture switch, and pan-invariance of the
applied offset; the 17-marker fixture's screen-space non-overlap; a
same-tile forced-collision case; viewport-clamp applicability; button
semantics/aria-label/44px hit target; and regression checks for
DEFAULT_SCALE, the Canvas backing-store cache, lazy-load recovery, filter
chips, `selectedDetail()`, and Prefecture Identity file byte-equality).
Three negative tests: a tile-only "same tile = collision" model (the old
`placeEntityTiles` occupancy check) misses real screen-space overlaps
this pass's rectangle check catches; reverting the z-index/stacking-
context fix breaks the "marker always wins the tap" comparison; and a
camera-dependent `layoutMarkerPlacards` (using `camTransform`/`camera`
instead of the raw world transform) would break pan-stability, which the
real source's camera-independence check guards against.

## 16. Chrome-exclusion repair (post-merge regression from section 15's own fix)

Real post-merge CI incident: after section 15's fix merged, the
`iPhone WebKit Smoke` job (`tests/iphone-playtest-webkit-test.js`) failed
on `main` -- `page.locator('[data-iphone-map-action="filter"]').click()`
timed out. The Playwright error log named the actual element intercepting
the pointer event: a `.d-map-marker`'s own icon `<span aria-hidden="true">`,
part of `.d-city-surface.d-city-surface-phase2`'s subtree.

**Root cause**: raising `.d-map-marker`'s z-index to 25 (section 15's own
tap-ability fix) had the side effect of also making markers out-rank the
`.iphone-map-nav`/`.iphone-map-tools`/`.iphone-map-popover` chrome
controls THEMSELVES -- legitimate, always-must-stay-tappable interactive
elements, not just decorative siblings a marker is allowed to sit above.
A marker that happened to render on top of one of these controls now
blocked its tap instead of the other way around.

**Fix**: `chromeExclusionRects(canvas)` (`js/map-phase2-canvas.js`) measures
those three controls' live `getBoundingClientRect()` every render (skipping
any that are missing/`hidden`/zero-sized), converted to canvas-relative
coordinates via `canvas.getBoundingClientRect()` as a common origin (valid
because `.d-phase2-canvas` is `inset:0` within `.d-city-surface`, itself
`inset:0` within `.d-map-stage`). `positionMarkers()` now seeds its
`claimed` rect list from these exclusion zones (previously empty at the
start of every render) before placing any marker, so the SAME nudge search
that already resolved viewport-edge-clamp collisions (section 15) also
routes markers away from the chrome controls. Unlike
`layoutMarkerPlacards()`'s own pan-invariant world-space search, this pass
is deliberately render-time/viewport-dependent -- the chrome controls sit
at fixed pixel offsets from the viewport edges, not tied to camera
position, so recomputing it fresh every render (never cached) does not
destabilize pan.

A local Chromium dry-run (this repository has no WebKit binary available)
reproducing the exact CI sequence (open a real store, switch to the map
tab, click `[data-iphone-map-action="filter"]`) did not reproduce the
original failure -- plausibly a WebKit-vs-Chromium text-metric/layout
difference in exactly where a marker's placard lands, not something this
sandbox can force deterministically. The regression itself was root-caused
directly from the real CI failure's own Playwright interception log (not
guessed), and the fix is verified by a Node-level unit test that
constructs a canvas mock exposing the same `.closest('.d-map-stage')` /
chrome-rect DOM shape `chromeExclusionRects()` reads, asserts a marker
placed exactly under a synthetic `.iphone-map-tools` rect is nudged clear
of it, and confirms (by reverting to the pre-fix source) that the same
test fails without the fix.

New coverage added to `tests/map-phase2-marker-placard-interaction-test.js`:
a marker whose natural position collides with a live `.iphone-map-tools`
rect is nudged clear of it; a hidden/zero-sized chrome element is NOT
treated as claimed space; the pre-existing canvas mock pattern used by
every other test in the suite (no `closest()`/`getBoundingClientRect()`)
still renders without crashing (`chromeExclusionRects()` degrades to `[]`
rather than throwing); and two negative tests (an empty exclusion list
would leave the marker overlapping the chrome rect; `positionMarkers()`'s
source must still call `chromeExclusionRects(canvas)`).

**Second real root cause, found by re-testing the `chromeExclusionRects()`
fix itself against real WebKit (`workflow_dispatch` with `mode:
iphone-webkit` on the fix branch, not waiting for a post-merge run) before
merging**: the fix above did NOT resolve the original CI failure. The
local Chromium dry-run's inability to reproduce the bug (noted above) was
a real warning sign, not a coincidence -- the actual defect was an
enhancer-ordering bug, not something a rendering-engine difference would
explain either way.

`js/d-ui-shell.js`'s `'d-ui-shell'` enhancer always runs before this
file's `'iphone-playtest-fixes'` enhancer (fixed by their registration
order in `index.html`, both driven by `js/ui-enhancer-registry.js`).
`renderMapWorkspace()` (`'d-ui-shell'`) rebuilds `.d-map-stage` --
including a brand new `<canvas>` and every marker -- from scratch on
every map-tab render, and calls `modules.mapPhase2Canvas.render()`
(which runs `positionMarkers()`) as part of that same rebuild. Only
afterward does `ensureMapChrome()` (`'iphone-playtest-fixes'`) append
`.iphone-map-nav`/`.iphone-map-tools`/`.iphone-map-popover` to that same
(freshly built) stage. `chromeExclusionRects(canvas)` was correct in
isolation, but the very first `positionMarkers()` pass for a new stage
always ran before any chrome existed to exclude -- there was nothing for
it to find yet. `ensureMapChrome()`'s own internal `stage.dataset.
iphoneMapKey===mapKey` memoisation guard doesn't save this: a fresh
`renderMapWorkspace()` call always produces a fresh `.d-map-stage`
element with no `dataset.iphoneMapKey` of its own, so the guard never
skips the (now correctly ordered) rebuild-and-reposition path on a stage
that just got rebuilt.

**Fix**: `ensureMapChrome()` now calls `modules.mapPhase2Canvas.render
(canvas,g)` again immediately after finalizing the chrome elements
(`stage.dataset.iphoneMapKey=mapKey`), so `positionMarkers()` gets a
second, chrome-aware pass once the exclusion zones actually exist in the
DOM. This adds no new `registerUIEnhancer()` call (still within the
existing `'iphone-playtest-fixes'` hook) and does not touch pan (which
calls `render()` directly via its own pointer-event handlers, independent
of this enhancer cycle, and by then the chrome already exists from the
first `enhance()` pass). Calling `render()` twice per stage build is
cheap: its canvas backing-store/district cache is keyed on canvas
identity + prefID, both unchanged between the two calls.

Re-verification against real WebKit uses the same mechanism that caught
the first fix's insufficiency: a `workflow_dispatch` run (`mode:
iphone-webkit`) on the fix branch itself, before merging, rather than
waiting for a post-merge run on `main` to find out. New static
(regex-based, matching this file's established DOM-dependent test style)
coverage in `tests/map-phase2-marker-placard-interaction-test.js`:
`ensureMapChrome()` must call `modules.mapPhase2Canvas.render(canvas,g)`
after (not before) finalizing the chrome elements, and a negative test
confirming the check fails without that call.

## 17. Static-asset cache coherence + marker tap -> entity detail

Real-device report AFTER PR #615 and PR #616 had both merged and published:
the production iPhone still showed the OLD abstract red/blue/purple pins with
no placard text, taps still did nothing, and no property detail ever opened.

**Why the previous fixes looked absent.** They were not absent -- the browser
was never running them. `scripts/verify-published-pages.js` and
`scripts/pages-deployment-smoke.js` both confirm GitHub Pages was serving
bytes identical to `main`, so the server was correct throughout. The failure
was entirely client-side: `index.html` referenced every asset by an
unversioned URL (`./js/d-ui-shell.js`), while `play.html` redirects to
`index.html` with a `Date.now()` `v=` parameter. The HTML was therefore
reliably *fresh* and every JS/CSS file it pointed at was reliably served from
whatever generation the browser had already cached -- exactly the
"HTMLだけ新しい / d-ui-shell.jsだけ古い" split. Two asset classes were even
further out of reach: the stylesheets reached only through
`css/d-ui-mobile-company.css`'s `@import` list, and the `prototypes/*.js`
runtime plus the sprite manifest that `js/map-phase2-canvas.js` injects at
runtime -- `index.html`'s own cache state says nothing about either.

**Fix (single deterministic revision).** `scripts/asset-revision.js` computes
one revision as a content hash over the map-critical asset set and
`scripts/stamp-asset-revision.js` stamps it onto every URL that reaches those
assets: the direct `<script>`/`<link>` tags, the nested `@import` list, and
`PROTOTYPE_SCRIPTS`/`MANIFEST_URL`. A content hash rather than a timestamp or
a commit SHA because it must be deterministic (two machines stamping the same
tree agree), self-invalidating (it changes exactly when real content changes,
so a release cannot forget to bust a cache and an unrelated release cannot
needlessly bust one), and recomputable by a test. A commit SHA is unusable:
the stamp has to be committed, and the SHA does not exist until after the
commit. Files that both contain a stamp and are themselves hashed are hashed
in canonical form (stamp values blanked), which makes stamping an idempotent
fixpoint instead of a self-referential loop.

`css/app.css` is deliberately NOT versioned -- it is byte-frozen against
`tests/fixtures/extracted-css-baseline.css`. Scope is the map-critical set;
widening it is a separate change.

**Two runtime diagnostics** make a mixed generation observable rather than
inferred: `globalThis.__STATIC_ASSET_REVISION` (stamped into
`js/map-phase2-canvas.js`) and `--d-map-asset-revision` (stamped into
`css/d-ui-map-phase2-markers.css`). A stale script and a stale stylesheet are
independently detectable because the two must agree. Both are inert -- never
saved, never in browser storage, never part of game state.

**Second, independent defect: the detail never had anything to show.**
`buildMapViewModel()` attached the raw state object for `store` and
`property` but not for `tenant` or `rentalOffice`. So even with fresh assets,
tapping an office marker produced a generic card plus a "go to the office
screen" link, and tapping a tenant fell back to a legacy `entity.item`
DOM-scrape field that `buildMapViewModel` has never set -- it always degraded
to the entity name. Both now carry their state (additive, exactly as
`store`/`property` already did), and `selectedDetail()` renders real fields:
tenant gets weekly rent, deposit, prefecture, trade area, size, traffic and
intended business; office gets weekly rent, deposit, prefecture, location,
capacity, grade and prestige; the property card gains prefecture, location,
ownership state and (only when `property.realEstate` actually exists)
building condition. Nothing is fabricated -- `rent` is labelled 週額 because
`js/engine.js` stores `office.rent` as `g.officeWeeklyCost` and charges tenant
rent per simulated week, so calling it 月額 would invent a number the state
does not hold. Actions are the existing ones (`open-store`,
`contract-office`, `buy-property-company`/`-personal`); no parallel leasing or
selection state was introduced.

**Third defect: the detail was invisible on a phone.** Below 1180px
`css/d-ui-reference-fidelity.css` drops `.d-context-panel` out of its sticky
desktop column, so it renders after the 520px-tall map stage and the three
overlay cards -- roughly a screen further down. Selection updated it
correctly and nothing visible moved, which is what made a working tap read as
"nothing happened". `revealContextPanel()` brings the freshly rendered panel
into view after a marker tap, on the stacked layout only, respecting
`prefers-reduced-motion`, with no new `registerUIEnhancer()` call, no timers
and no observers. It is deliberately unconditional rather than "scroll only
when the panel looks off-screen": a Chromium run caught the one-shot
visibility heuristic reading an intermediate layout (the chrome-triggered
re-render from PR #616 still moves things afterwards) and skipping the scroll
on the SECOND tap.

New coverage: `tests/static-asset-cache-coherence-test.js` (revision
determinism and content-sensitivity, the stamping fixpoint, full asset
coverage, one shared revision across every map-critical URL, stamp currency,
runtime diagnostics, `app.css`/SAVE_KEY/saveVersion invariants, plus four
negative tests: an unversioned marker stylesheet, a drifted `d-ui-shell.js`
revision, a stale committed stamp, an unversioned lazy prototype) and
`tests/map-marker-detail-interaction-test.js` (each kind opens its own
detail, executed against the real `selectedDetail()` source; identity match;
the 週額 labelling; no fabricated fields; single selection path; the 8px
tap/pan contract; the mobile reveal; PR #615/#616 non-regression; plus four
more negative tests). `tests/published-map-phase2-webkit-test.js` now also
asserts revision coherence and a marker-tap-opens-its-own-detail round trip
against the real published URL on every prefecture in its sequence.

## 18. Marker anchor integrity (placement bounded to the real building)

Real-device report after PR #617: tapping worked and the detail opened, but
the red / blue / purple markers no longer sat on anything. They drifted away
from plausible buildings, bunched toward the screen edges, and stopped
communicating *which* property they meant.

**Root cause, measured rather than inferred.** Instrumenting `main`
(`f74331b`) in Chromium against Tokyo's 17-marker home-prefecture fixture:

| | desktop 520x667 | iPhone 374x520 |
|---|---|---|
| markers displaced from their anchor | 15 / 17 | 14 / 17 |
| worst displacement | 334px (**64% of canvas width**) | 150px (**40%**) |
| median displacement | 94px | 103px |
| off-canvas building drawn on-canvas | 3 | 6 |

Three independent, individually unbounded displacement sources produced it:

1. **The declutter search.** `layoutMarkerPlacards()` searched 6 rings of a
   108x86 placard box, i.e. up to 696x564px. It moved the whole
   `.d-map-marker` button -- `left:var(--x);top:var(--y)` -- so the badge a
   player reads as "the marker" was what travelled, while only the 8px
   `.d-map-marker-dot` was counter-translated back to the true anchor. The
   earlier WebKit CI log from PR #616 recorded a live example:
   `data-phase2-offset-x="-232" data-phase2-offset-y="188"`, which is exactly
   ring 2 (2x116, 2x94).
2. **The edge clamp.** Its gate accepted an anchor a full placard box
   *outside* the canvas as "visible" and then clamped it back inside, so a
   building that was not on screen still got a marker on screen.
3. **The chrome-avoidance nudge** (PR #616) could walk 14 steps of 58px, 812px.

The same instrumentation showed the crowding all of that was solving is mild:
with every badge left exactly on its anchor only 6-7 of the 136 pairs overlap,
and the two closest anchors are 14px (desktop) / 28px (iPhone) apart. The
search was enormously over-scaled for the actual density.

**Responsibility split (previously conflated).**

- **world anchor** -- `tile -> transform.toScreen() * transform.scale`.
  Camera-independent, and never modified by any placement pass.
  `toScreen()` returns RAW unscaled tile-space pixels, so the multiply by
  `transform.scale` before any CSS-pixel comparison is load-bearing.
- **screen placement** -- `camTransform.toCss(tile)`, plus a bounded declutter
  offset, plus a bounded edge clamp and chrome nudge, and then hard-capped.
- **label layout** -- fixed in CSS relative to the badge, never moved
  independently, so a label cannot drift away from the marker it names.
- **leader dot** -- counter-translated by the applied offset, so the true
  anchor stays marked whenever the badge moved at all.

**The fix is one enforced invariant, not three separate promises.**
`MAX_ANCHOR_OFFSET` (56px, ~15% of the iPhone canvas width, about one badge
width) caps `|drawn position - true anchor|`, and `capToAnchor()` applies it
as the LAST step of every render, after declutter, clamp and chrome nudge have
all had their say. It shortens the offset vector rather than snapping back, so
the direction the other passes chose is preserved as far as the cap allows.
The declutter candidate set is bounded *by construction* -- candidates past
the cap are filtered out, rather than a ring count needing to be kept in sync
by hand -- and its collision box is now the marker's own badge (its tap
target) instead of the badge-plus-label footprint. Overlapping labels are the
accepted trade-off; a badge away from its building is not. The clamp gate is
now the canvas itself, so an off-camera building simply has no visible marker
(`.d-city-surface`'s `overflow:hidden` clips it).

**Result, same instrumentation after the change:**

| | desktop | iPhone |
|---|---|---|
| markers displaced | 15/17 -> **7/17** | 14/17 -> **4/17** |
| worst displacement | 334px -> **56px (11%)** | 150px -> **56px (15%)** |
| median displacement | 94px -> **0px** | 103px -> **0px** |
| off-canvas building drawn on-canvas | 3 -> **1** | 6 -> **0** |

Median displacement is zero: most markers now sit exactly on their building,
and the single remaining desktop case is a building within the cap of the
canvas edge, i.e. genuinely adjacent.

New coverage: `tests/map-marker-anchor-integrity-test.js` (the cap's size
relative to a phone canvas; candidates bounded by construction; `capToAnchor`
shortening while preserving direction; end-to-end through `render()` that no
marker exceeds the cap, including when a huge stale offset is fed in; the
leader dot still recovering the true anchor; off-canvas buildings not pulled
in; the clamp gate being the canvas itself; the chrome nudge bounded by the
same cap; PR #616 chrome routing still working; determinism and camera
independence; same-tile separation; raw-vs-scaled consistency; plus four
negative tests -- the old 6-ring search violating the cap, dropping
`capToAnchor`, restoring the margin-based clamp gate, and a stranded leader
dot). `tests/map-phase2-marker-placard-interaction-test.js`'s old "no two
placard rectangles overlap" assertion -- the requirement that justified the
unbounded search in the first place -- is replaced by the anchor-integrity
bound plus a "decluttering still separates most badges" budget.

## 19. Marker / building affinity + badge-size vs tap-target separation

Follow-up to section 18. With markers now pinned to their anchor, the real
device showed the next problem: the anchor itself was chosen without regard to
what is standing on it. "テナント募集" appeared on warehouses and apartment
blocks, office candidates appeared on shops, and a large share of every kind
floated over empty plazas.

### Root cause

`placeEntityTiles()` selected candidate tiles by district **zone**
(`ENTITY_KIND_DISTRICTS` / `PROPERTY_KIND_DISTRICTS`). A zone is not what a
player sees. It only decides which sprite category *pool* a tile draws from,
and those pools deliberately cross over --
`prototypes/map-world-preview.js`'s `ROLE_CATEGORY` gives the `commercial`
zone an `X` infill role of `residential.low` and the `cbd` zone one of
`commercial.small`. Worse, a zone's tile list also contains every plot the
block template left as **open space**, which has no building at all, plus
tiles reserved by a neighbour's 2x2 footprint.

Measured on main (`8337024`) with the real 47-sprite manifest, 5 prefectures:

| marker kind | no building at all | on housing | on the wrong commercial/office tier |
| --- | --- | --- | --- |
| tenant | 33% | 18% (`residential.low`) | 12% (`office.*`) |
| store | 35% | 7% (`residential.low`) | 21% (`office.*`) |
| office | 40% | -- | 18% (`commercial.small`) |
| realestate | 52% | -- | mixed, unrelated to the property's own kind |

### Fix: select by surface, not by zone

Affinity is now expressed against the **surface** a player actually looks at:
the sprite category really placed on that tile, or -- for a tile with no
building -- which kind of open space it is (`open.hardscape` /
`open.green` / `open.industrial`, grouped from that file's own
`OPEN_TYPES_BY_ZONE` vocabulary). `surfaceOfCell()` resolves it; road,
footprint-reserved and unresolved tiles report `null` and can never be
candidates.

Each kind declares a `preferred` and an `allowed` surface list
(`KIND_SURFACES`, and `PROPERTY_KIND_SURFACES` keyed by `g.properties`' own
six fixed labels). **Anything unlisted is forbidden**, so civic buildings,
the landmark, parkland and signage host no markers at all. `土地` and `物流`
are the only property kinds that prefer open ground, because they are the
only two that are literally land ("郊外ロードサイド土地",
"物流センター用地"); every other property kind must point at a building.

`SPRITE_SURFACE_OVERRIDES` is the per-sprite escape hatch: it reclassifies
`commercial_billboard` (a `commercial.small` asset that is a hoarding, not a
leasable unit) to `signage`, which no kind lists. Single assets can be
corrected without inventing a category or reclassifying their neighbours.

Fallback ladder, in order: unclaimed preferred -> unclaimed allowed ->
shared preferred -> shared allowed -> no map marker (the entity stays
reachable through the directory list). Steps 3-4 rank meaning above tile
exclusivity deliberately: two markers on one correct building read far better
than one marker on a warehouse, and `layoutMarkerPlacards()` already
separates co-located markers inside `MAX_ANCHOR_OFFSET`. A district carries
150-300 buildings against roughly 20 markers, so those steps are reached only
by a district genuinely starved of a category.

Result, measured across 10 prefectures (230 markers, 0 unplaced,
0 forbidden-surface violations):

| marker | lands on |
| --- | --- |
| store / tenant | `commercial.*` only |
| office | `office.*`, spilling to `commercial.hero/mid` only where office stock runs out (Gunma) |
| 商業ビル | `commercial.*` |
| 土地 | `open.hardscape` |
| 住宅 | `residential.low` |
| 大型物件 | `residential.premium` / `commercial.hero` |
| 物流 | `logistics` |
| オフィス | `office.*` |

### Badge size vs tap target

The pin's shape came from a `clip-path` on the button, and clip-path clips
hit testing too -- so the visible badge and the tap target were forced to be
one box, and 48x60 was the floor before the hexagon's waist fell under 44px.
(At 48px wide that hexagon spans only ~41px, so the shipped tap target was
already narrower than its box.)

The two are now separate: the button is a plain unclipped **46x56**
rectangle, every pixel tappable; the pin is drawn by `.d-map-marker:before`
at **34x42**, centred on the button's centre -- which is exactly where
`positionMarkers()` puts the tile anchor, so this changes size and nothing
about anchoring. Visible badge area drops ~50%; the real tap target grows
from a ~41px-wide hexagon to a full 46x56 rectangle. The 4-way colour legend
moves from the button to the pin at matching specificity.

`MARKER_CLAMP_HALF_W/H` drops 22/27 -> 18/22 so decluttering separates what a
player sees rather than the invisible button, and `DECLUTTER_STEP` drops
28 -> 24 so ring 2 (48px) clears a head-on collision inside the 56px cap.

Measured in Chromium: hit box 46x56 and `clip-path: none` on both viewports;
pin 34x42; anchor offset never above the cap (desktop max 48px, iPhone max
53px across Tokyo/Gunma/Saitama/Chiba, view toggle, pan and filter); tap ->
detail opens the correct entity in every case; 0 console errors; 0 horizontal
overflow.

New coverage: `tests/map-marker-building-affinity-test.js` (28 checks) --
per-acceptance-criterion affinity across 10 prefectures, the forbidden-surface
sweep, the live per-sprite override, determinism/order-independence/no-RNG,
the city fabric staying byte-identical, the fallback ladder exercised by
overflowing store/tenant/office 400-deep in a scarce prefecture so the
`allowed` tier is genuinely reached, static invariants on both allow-list
tables, the pin-smaller-than-button and >=44px-unclipped geometry, and four
negative tests (reverting to zone selection, listing parkland, dropping the
open-space guard, restoring the clip-path on the button).

## 20. Marker visual density / selection UX calibration

Follow-up to sections 18-19. With markers anchored to the right buildings, the
remaining real-device complaint was that the map no longer read as a *map*:
the pins plus their always-on category placards covered the street grid.

### Root cause

Section 15 ("requirement C") deliberately made every marker's label
unconditionally visible -- `.d-map-marker small{display:block;opacity:1}`,
overriding both the `opacity:0` default in `css/d-ui-reference-fidelity.css`
and the `<=820px` `display:none` in `css/d-ui.css` -- so a player could read
"テナント募集" without tapping. That solved discoverability and created a worse
problem: on a 390px screen seventeen opaque plates sat over the city.

Measured in Chromium on main (`2664e54`), Tokyo's 17-marker fixture, as a
share of the visible map surface:

| | desktop 1280x800 | iPhone 390x844 |
| --- | --- | --- |
| pin ink | 7.00% | 12.48% |
| label ink | 10.29% | 18.36% |
| **total marker ink** | **17.29%** | **30.84%** |
| labels painted at rest | 17 / 17 | 17 / 17 |

Nearly a third of the iPhone map was marker rather than city.

### Fix

**Default state is a bare pin.** `.d-map-marker small` returns to
`display:none`, and a `(0,2,1)` rule reveals it for
`.selected` / `:hover` / `:focus-visible` only. The `.selected` reveal
out-ranks the `(0,1,1)` `@media(max-width:820px)` hide in `css/d-ui.css`, so
the selected label appears on phones too -- which is the point.

**The label now names the entity.** A selected placard renders the category on
its own line (`placardLabel()`, unchanged) plus the entity's own name
(`placardName()`, which returns `''` when the name would only repeat the
category -- a store's category line already *is* its name). The visible label
is `aria-hidden`; the button's accessible name comes from `markerAriaLabel()`,
which carries category **and** name, so hiding the plate costs assistive
technology nothing -- it gains the name for every marker.

**The pin shrank again.** 34x42 -> **26x32** (-24% per axis, -42% area), and
the button dropped to exactly **44x44** -- the iOS minimum held on both axes,
every pixel tappable because the button stays `clip-path:none`. The inherited
`★★★` decoration (a fixed three stars on every marker, carrying no
information) is suppressed. `MARKER_CLAMP_HALF_W/H` follow the pin to 14/17
and `DECLUTTER_STEP` to 18, so ring 2 (36px) still clears a head-on collision.

### MAX_ANCHOR_OFFSET deliberately NOT tightened

Tightening the cap looked attractive -- smaller pins need less room -- and was
tried at 40. It silently broke chrome avoidance: `CLAMP_NUDGE_STEP` is bounded
by the cap, so at 40 the nudge could only reach 34px, while escaping
`.iphone-map-nav` (a full-width strip whose own button is `min-height:46px`)
needs roughly `46/2 + MARKER_CLAMP_HALF_H` = 40px, and the taller real strip
more. `tests/map-phase2-marker-placard-interaction-test.js`'s chrome-nudge
check caught it immediately. The cap stays **56**: the pin shrinking is what
reduces displacement in practice, the cap is what guarantees the marker still
points at its building, and the nudge headroom is what keeps the iPhone filter
tappable (the PR #616 regression). `tests/map-marker-density-selection-test.js`
encodes that reasoning as an executable check.

### Result

| | desktop 1280x800 | iPhone 390x844 |
| --- | --- | --- |
| labels painted at rest | 17 -> **0** | 17 -> **0** |
| pin ink | 7.00% -> **4.08%** | 12.48% -> **7.27%** |
| label ink | 10.29% -> **0.00%** | 18.36% -> **0.00%** |
| **total marker ink** | 17.29% -> **4.08%** | 30.84% -> **7.27%** |
| hit target | 46x56 -> **44x44** (>=44 both axes) | same |
| max anchor offset | within the 56px cap (25-51px measured) | within cap (10-51px) |

Exactly one label is painted when exactly one marker is selected, verified
per-marker (`labelPainted === selected` for every marker) rather than by a
global count. Tapping still opens the correct entity's detail for tenant /
office / realestate, through pan, filter, view toggle and
Tokyo/Gunma/Saitama/Chiba switches; 0 console errors, 0 horizontal overflow.

New coverage: `tests/map-marker-density-selection-test.js` (21 checks) --
the 20-35% shrink band measured against the inherited size, the >=44px
unclipped tap target, pin-smaller-than-button, anchor centring, star
suppression, the label-free resting state, the selection/hover/focus reveal,
the two-part label, `placardName`'s purity and no-repeat rule, the enriched
accessible name, the collision box tracking the pin, the declutter ring
arithmetic, the chrome-escape headroom that forbids tightening the cap, PR
#617/#619 wiring left intact, and five negative tests (restoring always-on
labels, a sub-44px button, deleting the `.selected` reveal, re-clipping the
button, and a shrink too small to count).

The two existing assertions that pinned the *old* always-on contract
(`map-phase2-marker-placard-interaction-test.js`,
`map-marker-detail-interaction-test.js`) are rewritten to the new one rather
than deleted: each now asserts hidden-by-default AND the selected reveal AND
that the base-file rules they override still exist.
