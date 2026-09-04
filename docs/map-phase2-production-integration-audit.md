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
