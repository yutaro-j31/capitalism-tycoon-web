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
