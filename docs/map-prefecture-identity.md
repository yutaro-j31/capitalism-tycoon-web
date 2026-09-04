# Phase 2 map: prefecture identity / regional variation

2026-09. Visual/map-world-generation-only pass on top of the production
Phase 2 map (see `docs/map-phase2-production-integration-audit.md`,
PR #611/#612). Gameplay, economy, and save content are untouched. This
document is the reference for `prototypes/map-prefecture-profiles.js` and
the geometry changes in `prototypes/map-world-preview.js`, and the minimum
required contents per CLAUDE.md's founding-route-adjacent documentation
convention.

## Goal

Switching between all 47 prefectures must not look like "the same city
with a different name". Real-device testing (post PR #611/#612) found:
Gunma showed a Tokyo-Tower-like landmark; Saitama/Gunma/Chiba etc. showed
nearly identical city skeletons (building composition, roads, parks, CBD
relative position); prefecture switching itself worked correctly, but the
sense of "changing region" was visually absent.

Final acceptance target (verbatim from the owner): 「都道府県を変えること自体が
楽しいマップ」-- a map where switching prefectures is itself enjoyable. Not a
literal real-world recreation, an original city composition that abstracts
"Japanese-prefecture-ness" for game purposes.

## Root cause

`prototypes/map-world-preview.js`'s `regionForBlock(bc, br, blockCols,
blockRows)` used to be a **pure function of block coordinates and grid
size only** -- it took no `prefID` parameter at all. Every one of the 47
prefectures therefore produced a byte-identical zone/landmark skeleton
(same CBD corner, same commercial band, same park/landmark position);
only sprite-level choices (`selectSpriteForCategory`'s prefID-hashed
weighted pick, `templateRoleFor`'s block-transform variant, `openTypeFor`'s
open-space subtype) varied by prefecture. This is exactly the failure mode
the design spec calls out as forbidden by itself: "spriteだけ違ってgeometryは
同じ" is not real variation.

A second, independent root cause: the sprite manifest
(`assets/map-sprites/phase2/sprites.json`) had exactly **one**
`category:'landmark'` sprite, `landmark_tokyo_tower`, with no
prefecture/region filtering mechanism -- so it was unconditionally
selected for every prefecture's landmark tile, including Gunma/Saitama/etc.

## Architecture: 3 layers

1. **Layer 1 -- regional archetype** (`REGIONAL_ARCHETYPES` in
   `prototypes/map-prefecture-profiles.js`): 9 archetypes, each an 8-field
   weight profile (`cbdWeight`, `commercialWeight`, `residentialWeight`,
   `premiumResidentialWeight`, `industrialWeight`, `openSpaceWeight`
   0-10 scale; `highRiseBias`, `greeneryBias` 0-1 scale).
2. **Layer 2 -- prefecture-specific profile** (`PREFECTURE_MAP_PROFILES`):
   all 47 prefectures explicitly assigned to one archetype plus a
   `landmarkPolicy` (`'dedicated'` for Tokyo only, `'generic'` for the
   other 46).
3. **Layer 3 -- prefecture-specific deterministic seed** (`layoutSeed`,
   `` `${prefID}-layout` ``, derived automatically by `resolveProfile()`):
   fed into the FNV-1a `hash()` calls that place zone anchors and pick a
   block's template rotation/mirror variant. Since `layoutSeed` is unique
   per prefID, even two prefectures sharing an archetype (identical
   weights) end up with **different anchor positions and different block
   rotations** -- never the same generated city.

`resolveProfile(prefID)` (`prototypes/map-prefecture-profiles.js`) merges
all 3 layers into one object map-world-preview.js consumes; it also
reports `explicit: true/false` so tests can prove the generic fallback
(`DEFAULT_ARCHETYPE = 'metro_suburban'`) is never silently used for one of
the 47 real prefectures.

### Structural vs flavor: which hash key drives what

- **Structural (geometry)**: zone-anchor placement (`placeZoneAnchors`)
  and a block's template rotation/mirror variant (`templateRoleFor`) are
  keyed by `profile.layoutSeed`, not the raw `prefID`. This is what makes
  "same profile => same skeleton" independently testable (see the negative
  tests below) regardless of which prefID asked for it.
- **Flavor (sprite choice)**: `selectSpriteForCategory`, `pickRoleCategory`,
  `openTypeFor` stay keyed by the real `prefID`, exactly as before this
  pass. This is deliberate -- Layer 3's seed and the raw prefID are 1:1 for
  every real prefecture, so determinism is unaffected either way, but
  keeping sprite-level "flavor" on the raw id (rather than layoutSeed)
  means a prefecture's specific building mix still reads as its own,
  distinct from another prefecture sharing its archetype+geometry only in
  a synthetic test.

## Zone assignment: weighted-anchor Voronoi

Replaces the old fixed-corner `regionForBlock`. For each of the 6
meta-zones (`cbd`, `commercial`, `industrial`, `premiumResidential`,
`park`, `residential` -- `park` is the open-space/landmark region), one
deterministic anchor block is placed via `hash(layoutSeed:anchor:zone:
attempt:x/y)`, with a minimum-separation retry (up to 12 attempts) so the
6 anchors don't cluster. Every block in the grid is then assigned to
whichever zone's anchor is "closest" after subtracting a weight bonus
(`score = distance - weight * 0.6`) -- a discrete weighted-Voronoi/power
diagram, so a higher-weight zone claims a visibly larger, still-contiguous
catchment even from the same anchor distance.

A **repair pass** (`assignBlockZones`) guarantees every one of the 6 zones
captures at least one block even under an unlucky anchor placement --
this is the density guardrail (STEP 17): every prefecture retains enough
eligible tiles for store/tenant/office/realestate marker placement.

Deliberately out of scope: `STREET_PERIOD` and the three-tier road
network are untouched, so the PR #611/#612 camera "3-5 block-column"
initial-framing contract holds for every prefecture regardless of how the
interior zones are distributed. `BLOCK_TEMPLATES` (the per-zone hero/
secondary/cross-zone/open role pattern) is also untouched -- variation
comes from zone *shape and position*, not from rewriting the road/plot
grammar, keeping this PR's scope to geometry allocation rather than a road
network rewrite.

The landmark tile and its 2 civic-slot neighbours now sit at the seeded
`park` anchor's own block (previously a fixed `bc=2` corner) -- see
`buildWorldDistrict()` in `prototypes/map-world-preview.js`.

## Landmark selection / Tokyo exclusivity

`assets/map-sprites/phase2/sprites.json`'s `landmark_tokyo_tower` entry now
carries `"prefectureIds": ["tokyo"]`. `selectSpriteForCategory()` filters
its candidate pool through `spriteAllowedForPrefecture(sprite, prefID,
areaID)`:

- A sprite with no `prefectureIds`/`regionalTags` is generic (every
  sprite except the tower, today).
- `prefectureIds`, when present, is an allow-list: only eligible when
  `options.prefID` is listed.
- `regionalTags` is the same idea at areaID (region) granularity, wired
  for future assets; no sprite sets it yet, so it is currently inert.

For the 46 non-Tokyo prefectures, the `landmark` category pool is now
legitimately empty. `buildWorldDistrict()` falls back to the generic
`civic` category (`civic_01..04`, already in the manifest) for the
landmark tile; `landmarkCell.zone` stays `'landmark'` either way, so
`initialCamera()`'s `district.tiles.find(cell => cell.zone === 'landmark')`
lookup (the PR C camera contract) is unaffected. If even the civic pool
were empty, the cell is left un-flagged and pass 2b naturally resolves it
as ordinary open plaza space -- never a white screen or broken asset path.

No new landmark art was fabricated this pass (per the owner's explicit
instruction) -- a future, separate PR may add a dedicated per-prefecture
landmark asset pack; until then every non-Tokyo prefecture reads as a
generic civic building at its landmark position.

## Structural uniqueness contract

`MW.structuralLayoutSignature(district)` (exported from
`prototypes/map-world-preview.js`) fingerprints a built district's
*skeleton*: the block-to-zone assignment, the landmark tile position, and
the per-tile block-template role sequence -- **deliberately excluding**
`spriteId`/`scaleVariant`/`openType` (sprite-level "flavor"). An
implementation that only varies which sprite gets picked (geometry
unchanged) produces an identical signature for every prefecture and
correctly fails `new Set(signatures).size === 47`.

## 47-prefecture coverage table

9 archetypes, all 47 prefectures assigned (matching `js/data.js`'s
`g.prefs` ids exactly):

| Archetype | Count | Prefectures |
|---|---|---|
| `mega_core` | 1 | tokyo |
| `major_metro` | 3 | kanagawa, aichi, osaka |
| `metro_suburban` | 3 | saitama, chiba, shiga |
| `regional_hub` | 9 | miyagi, niigata, toyama, hyogo, hiroshima, kagawa, fukuoka, kumamoto, kagoshima |
| `industrial_logistics` | 6 | ibaraki, gifu, shizuoka, mie, okayama, yamaguchi |
| `inland_regional` | 20 | aomori, iwate, akita, yamagata, fukushima, tochigi, gunma, fukui, yamanashi, nagano, wakayama, tottori, shimane, tokushima, ehime, kochi, saga, nagasaki, oita, miyazaki |
| `historic_lowrise` | 3 | ishikawa, kyoto, nara |
| `northern_wide` | 1 | hokkaido |
| `island_subtropical` | 1 | okinawa |

Total: 47. `landmarkPolicy` is `'dedicated'` for tokyo, `'generic'` for
the other 46. Each prefecture's `layoutSeed` is `` `${prefID}-layout` ``
(automatically unique -- prefID itself is unique across all 47).

## Determinism

Every hash driving geometry or sprite choice is the same FNV-1a `hash()`
already used throughout `prototypes/map-world-preview.js` -- no
`Math.random`, no `Date.now()`, no wall-clock time, no render-order or
DOM-order dependency, no simulation RNG. Same prefecture + same code
version + same profile + same seed always reproduces the identical
`structuralLayoutSignature`; switching A -> B -> A reproduces A's exact
signature both times (verified for all 47 in a single cycle by
`tests/map-prefecture-identity-regional-variation-test.js`).

## Fallback architecture

- Unknown/missing `prefID` -> `resolveProfile()` returns the generic
  `DEFAULT_ARCHETYPE` (`'metro_suburban'`) profile with `explicit: false`.
  All 47 currently-in-game prefectures resolve `explicit: true` --
  verified by a dedicated coverage test, with a negative test proving a
  profile-table hole is actually caught.
- Missing dedicated landmark asset -> generic `civic` sprite, or ordinary
  open plaza if even that is absent. Never a broken asset path.
- Missing regional sprite (any other category) -> the pre-existing
  `CATEGORY_FALLBACK` chain / open-space degradation, unchanged by this
  pass.
- Old saves (pre-dating this pass) carry no prefecture-profile data at
  all and don't need to -- this is pure map-rendering state, never
  persisted. `SAVE_KEY`/`saveVersion` are untouched (still
  `capitalism_tycoon_web_v1` / `9`).

## Tests

`tests/map-prefecture-identity-regional-variation-test.js` -- coverage,
structural uniqueness, Tokyo landmark exclusivity (0 occurrences across
the other 46), fallback, regional pairwise differences (Tokyo vs Gunma/
Saitama/Chiba/Kyoto/Hokkaido/Okinawa, Saitama vs Gunma/Chiba), an
11-prefecture representative audit, density guardrails (every zone >=1
block for all 47), determinism (repeat build, A->B->A, full 47-cycle
twice), camera/scale (`DEFAULT_SCALE` stays 0.44, clamp never throws for
any of the 47 at desktop/iPhone viewport sizes), marker regression (4
kinds, 9-entity fixture, no exact overlap across a Tokyo->Gunma->
Saitama->Chiba->Hokkaido->Osaka->Kyoto->Fukuoka->Okinawa->Tokyo switching
sequence), RNG/save invariants, and 4 negative tests:

1. Removing the manifest's `prefectureIds` filter lets the Tokyo-exclusive
   landmark leak into other prefectures (proves the manifest fix is
   load-bearing).
2. Forcing all 47 prefectures onto one shared profile/seed collapses
   structural signatures from 47 unique values to 1 (proves the
   uniqueness test has teeth).
3. Deleting one prefecture's profile entry is caught as exactly one
   missing prefecture (proves the coverage test has teeth).
4. Building two "prefectures" that share the same forced profile/seed but
   differ in raw `prefID` produces an **identical** structural signature
   while their sprite-level flavor still differs -- proving the signature
   genuinely excludes sprite choice, and that a "sprite-only fake
   differentiation" implementation would be caught by check #2's
   `Set.size === 47` requirement.

Existing map regression suites (`tests/map-phase2-canvas-test.js`,
`tests/map-phase2-markers-test.js`, `tests/map-phase2-framing-zoomout-
test.js`, `tests/map-phase2-prefecture-switch-canvas-lifecycle-test.js`,
`tests/map-phase2-production-promotion-test.js`, `tests/map-phase2-p0-
assets-test.js`, `tests/map-phase2-p1-mid-civic-assets-test.js`,
`tests/map-phase2-visual-calibration-test.js`) were updated only where
their assertions encoded the *old*, now-intentionally-changed geometry
(a handful of exact-zone-occupancy-percentage / exact-civic-slot-count /
fixed-repeat-ratio-threshold checks were widened to a tolerant-but-still-
meaningful band, or re-targeted to a prefecture whose profile still gives
the original strong guarantee) -- no assertion was deleted, and each
widened check documents why in its own comment.

## Future work (explicitly out of scope this pass)

- A dedicated per-prefecture (or per-region, via `regionalTags`) landmark
  asset pack -- today every non-Tokyo prefecture reads as a generic civic
  building at its landmark position.
- Varying `STREET_PERIOD`/road-tier logic or `BLOCK_TEMPLATES` per
  archetype (kept out to protect the PR #611/#612 camera framing contract
  and to avoid a road-network rewrite ballooning this PR's scope).
- P2 props (cars, streetlights, benches, traffic signals, pedestrians),
  pinch zoom, momentum panning -- resumes once regional variation is
  confirmed stable in production.
