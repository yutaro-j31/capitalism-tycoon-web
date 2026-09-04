'use strict';
/*
 * Phase 2 PREVIEW ONLY -- not part of any PR yet, not wired into index.html.
 *
 * Builds a larger, procedurally-zoned "world" district (a street grid with
 * region assignment) and adds camera/pan/culling on top of the existing
 * Phase 1 renderer (prototypes/map-canvas-renderer.js). Every paint primitive
 * (paintTerrain/paintRoads/paintGreenery/blitSprites/drawPlaceholder/
 * paintContactShadow/spriteRenderSize/hash) is reused as-is from Phase 1 --
 * this file only adds:
 *   - a block/street-grid world generator (region by block position)
 *   - a camera-shifted transform adapter (no changes to Phase 1's transform)
 *   - viewport culling
 *   - crosswalk painting at intersections
 *   - pointer-drag pan with a tap/pan movement threshold
 *   - a category-driven asset manifest + selector (indexCategoryManifest /
 *     selectSpriteForCategory), which REPLACES Base.selectMapSprite for
 *     this file's own building placement -- see
 *     docs/map-phase2-asset-integration-contract.md. This is the
 *     "asset expansion foundation" pass: block templates, camera, roads,
 *     culling and the landmark gradient are unchanged; only which sprite id
 *     gets chosen for a plot moved to the new category system.
 *
 * This is exploratory: once approved, the reusable pieces get folded back
 * into prototypes/map-canvas-renderer.js as the real Phase 2 PR.
 */
(function (root) {
  const Base = (typeof module !== 'undefined' && module.exports)
    ? require('./map-canvas-renderer.js')
    : root.MapCanvas;
  const Profiles = (typeof module !== 'undefined' && module.exports)
    ? require('./map-prefecture-profiles.js')
    : root.MapPrefectureProfiles;

  const { hash, spriteRenderSize, SPRITE_WIDTH_FACTOR,
    paintTerrain, paintRoads, paintGreenery, drawPlaceholder, depthSorted,
    ZONE_LABEL, ZONE_USE, GROUND, SCALE_VARIANTS, nearbySpriteIds } = Base;
  /*
   * Phase 1's own NO_REPEAT_RADIUS (2) was tuned when Phase 2's category
   * pools were mostly single-sprite placeholders, where a wider radius
   * could not have helped (there was nothing else to pick). The P0 pass
   * gave office.small/commercial.small/residential.low real 6-9-sprite
   * pools, and measurement showed same-sprite repeats climbing sharply
   * between radius 2 and 3 specifically in those categories (baseline,
   * 10-prefecture total: 1154 tiles with a same-sprite neighbour within 3
   * tiles). A wider *local* exclusion radius here -- Phase 2's own pass 2b
   * only, Base's own buildDistrict()/NO_REPEAT_RADIUS is untouched --
   * cuts that to 341 (-70%) with a small, measured radius-2 side effect
   * (220 -> 277) and zero new missing/open-space degradations in any
   * tested prefecture (selectSpriteForCategory's own "never empty the
   * pool" guard already protects against that). Single-sprite categories
   * (residential.mid, residential.premium, logistics) are unaffected
   * either way -- there is nothing to exclude them in favour of yet.
   */
  const WORLD_NO_REPEAT_RADIUS = 3;

  /* ---------------- extra zone: premium residential ---------------- */
  const ZONE_LABEL2 = Object.assign({}, ZONE_LABEL, { premiumResidential: '高級住宅街', civic: '公共施設' });
  const ZONE_USE2 = Object.assign({}, ZONE_USE, { premiumResidential: 'residential', civic: 'civic' });
  const BUILDABLE2 = new Set(['cbd', 'commercial', 'residential', 'premiumResidential', 'industrial', 'landmark', 'civic']);
  const GROUND2 = Object.assign({}, GROUND, { premiumResidential: '#b9beac' });

  /*
   * ---------------- asset integration contract (2026-09, Phase 2 foundation) ----------------
   * See docs/map-phase2-asset-integration-contract.md for the full write-up. This block is the
   * ONLY thing that changed about how a building's sprite is chosen -- block templates, camera,
   * roads, culling and landmark gradient above/below are untouched. The goal is that dropping a
   * real asset into assets/map-sprites/phase2/sprites.json under the right `category` is enough
   * to have it start appearing; no renderer changes required.
   */
  const CATEGORY_TAXONOMY = new Set([
    'office.hero', 'office.mid', 'office.small',
    'commercial.hero', 'commercial.mid', 'commercial.small',
    'residential.premium', 'residential.mid', 'residential.low',
    'townhouse', 'logistics', 'civic', 'landmark',
    'openSpace.park', 'openSpace.plaza', 'openSpace.parking', 'openSpace.service', 'props'
  ]);
  const FOOTPRINT_BY_TYPE = { '1x1': { w: 1, h: 1 }, '1x2': { w: 1, h: 2 }, '2x1': { w: 2, h: 1 }, '2x2': { w: 2, h: 2 } };

  /*
   * If a category has zero sprites for a district, try these instead (in
   * order) before giving up. A category with an empty list here (or a
   * chain that still comes up empty) makes the plot fall back to open
   * space rather than forcing a mismatched building -- see
   * selectSpriteForCategory()'s caller in buildWorldDistrict().
   */
  /*
   * A strict rank hierarchy (small -> mid -> hero, low -> mid -> premium):
   * every entry's fallback list only ever points to a HIGHER rank, and no
   * category's list contains a category that lists it back. That makes it
   * structurally acyclic, not just "acyclic because the lookup happens not
   * to recurse" -- selectSpriteForCategory() only ever reads this table
   * one level deep (never re-expands a fallback's own fallback list), so a
   * cycle here could not create infinite recursion either way, but keeping
   * the table itself a clean DAG is what actually makes it readable.
   */
  const CATEGORY_FALLBACK = {
    'office.small': ['office.mid', 'office.hero'],
    'office.mid': ['office.hero'],
    'office.hero': [],
    'commercial.small': ['commercial.mid', 'commercial.hero'],
    'commercial.mid': ['commercial.hero'],
    'commercial.hero': [],
    'residential.low': ['residential.mid', 'residential.premium'],
    'residential.mid': ['residential.premium'],
    'residential.premium': [],
    'townhouse': ['residential.mid', 'residential.premium'],
    'logistics': [],
    'civic': [],
    'landmark': []
  };

  /*
   * Validation mirrors Base.validateManifest's philosophy (one bad row is
   * dropped, not the whole manifest) but checks the new schema: `category`
   * must be a taxonomy leaf, `footprintType` must agree with `footprint`,
   * `tier`/`districtTags`/`spawnWeight` are required. `file` keeps the same
   * anti-path-escape rule (no `..`, no absolute path, no remote URL).
   */
  function validateCategoryManifest(manifest) {
    const errors = [];
    if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest must be an object'], sprites: [] };
    if (!Array.isArray(manifest.sprites)) return { ok: false, errors: ['manifest.sprites must be an array'], sprites: [] };
    const tile = manifest.tile || { w: 64, h: 32 };
    if (!(tile.w > 0) || !(tile.h > 0)) return { ok: false, errors: ['manifest.tile must declare positive w/h when present'], sprites: [] };
    const seen = new Set();
    const sprites = [];
    for (const sprite of manifest.sprites) {
      const id = sprite && sprite.id;
      const label = id || '(missing id)';
      if (!id || typeof id !== 'string') { errors.push(`${label}: id must be a non-empty string`); continue; }
      if (seen.has(id)) { errors.push(`${label}: duplicate id`); continue; }
      if (!sprite.file || typeof sprite.file !== 'string') { errors.push(`${label}: file must be a string`); continue; }
      if (/[\\]|\.\.|^\//.test(sprite.file) || /^[a-z]+:/i.test(sprite.file)) { errors.push(`${label}: file must be a plain local filename`); continue; }
      if (!CATEGORY_TAXONOMY.has(sprite.category)) { errors.push(`${label}: unknown category ${sprite.category}`); continue; }
      const footprint = sprite.footprint;
      if (!footprint || !(footprint.w > 0) || !(footprint.h > 0)) { errors.push(`${label}: footprint must be positive`); continue; }
      const expectedFootprint = FOOTPRINT_BY_TYPE[sprite.footprintType];
      if (!expectedFootprint || expectedFootprint.w !== footprint.w || expectedFootprint.h !== footprint.h) {
        errors.push(`${label}: footprintType does not match footprint`); continue;
      }
      const anchor = sprite.anchor;
      if (!anchor || !(anchor.x >= 0 && anchor.x <= 1) || !(anchor.y >= 0 && anchor.y <= 1)) {
        errors.push(`${label}: anchor x/y must be 0..1 fractions of the image`); continue;
      }
      if (!['hero', 'filler', 'background'].includes(sprite.tier)) { errors.push(`${label}: tier must be hero/filler/background`); continue; }
      if (!Array.isArray(sprite.districtTags) || !sprite.districtTags.length) { errors.push(`${label}: districtTags must be a non-empty array`); continue; }
      if (!(sprite.spawnWeight > 0)) { errors.push(`${label}: spawnWeight must be positive`); continue; }
      seen.add(id);
      sprites.push(sprite);
    }
    return { ok: errors.length === 0, errors, sprites };
  }

  function indexCategoryManifest(manifest) {
    const { ok, errors, sprites } = validateCategoryManifest(manifest);
    const byId = {};
    const byCategoryDistrict = {};
    for (const sprite of sprites) {
      byId[sprite.id] = sprite;
      for (const district of sprite.districtTags) {
        const key = `${sprite.category}:${district}`;
        (byCategoryDistrict[key] = byCategoryDistrict[key] || []).push(sprite);
      }
    }
    for (const key of Object.keys(byCategoryDistrict)) byCategoryDistrict[key].sort((a, b) => a.id.localeCompare(b.id));
    return { ok, errors, sprites, byId, byCategoryDistrict, tile: (manifest && manifest.tile) || { w: 64, h: 32 } };
  }

  /*
   * Pure function: same (category, district, tileX, tileY, prefID) always
   * resolves the same sprite id (FNV-1a hash, no RNG). Walks
   * CATEGORY_FALLBACK until it finds a district with at least one sprite,
   * then does a weighted pick within that pool the same way
   * Base.selectMapSprite does. Returns null when even the full fallback
   * chain has no candidates -- the caller treats that as "no building here
   * yet", not an error.
   */
  /*
   * A sprite with no `prefectureIds`/`regionalTags` field is generic and
   * usable everywhere (every existing sprite today). `prefectureIds`, when
   * present, is an allow-list: the sprite is only eligible when
   * options.prefID is in it -- this is what keeps landmark_tokyo_tower
   * exclusive to Tokyo once the manifest marks it that way. `regionalTags`
   * is the same idea at areaID (region) granularity, for future assets;
   * no sprite in the manifest sets it yet, so it is currently a no-op.
   */
  function spriteAllowedForPrefecture(sprite, prefID, areaID) {
    if (Array.isArray(sprite.prefectureIds) && sprite.prefectureIds.length) {
      return sprite.prefectureIds.includes(prefID);
    }
    if (Array.isArray(sprite.regionalTags) && sprite.regionalTags.length) {
      return !!areaID && sprite.regionalTags.includes(areaID);
    }
    return true;
  }

  function selectSpriteForCategory(index2, options) {
    const category = options.category;
    const district = options.district;
    if (!index2 || !category || !district) return null;
    const chain = [category].concat(CATEGORY_FALLBACK[category] || []);
    let pool = null;
    for (const candidateCategory of chain) {
      let candidates = index2.byCategoryDistrict[`${candidateCategory}:${district}`];
      if (candidates && candidates.length) {
        candidates = candidates.filter(s => spriteAllowedForPrefecture(s, options.prefID, options.areaID));
      }
      if (candidates && candidates.length) { pool = candidates; break; }
    }
    if (!pool) return null;
    if (options.excludeIds && options.excludeIds.size) {
      const varied = pool.filter(s => !options.excludeIds.has(s.id));
      if (varied.length) pool = varied;
    }
    const key = [options.prefID || 'unknown', category, district, options.tileX, options.tileY].join(':');
    const total = pool.reduce((sum, sprite) => sum + sprite.spawnWeight, 0);
    let roll = hash(key) % total;
    for (const sprite of pool) {
      if (roll < sprite.spawnWeight) return sprite.id;
      roll -= sprite.spawnWeight;
    }
    return pool[pool.length - 1].id;
  }

  /*
   * which category a block-template role asks for, per zone; the district
   * tag passed to selectSpriteForCategory (below). A role entry may be a
   * single category string (the common case) or an ARRAY of category
   * strings, deterministically split by tile position (see
   * pickRoleCategory below) -- used for cbd's S role only (P1 pass):
   * CATEGORY_FALLBACK['office.small'] lists 'office.mid' as its first
   * fallback, but that fallback only ever fires when office.small's own
   * pool is completely empty. Since the P0 pass gave office.small 6 real
   * sprites, that fallback path is now permanently dead -- office.mid can
   * never be reached through it, no matter how many office.mid sprites
   * exist. Splitting cbd's S role directly between the two (3:1, so
   * office.mid reads as a minority "mid-rise layer" next to the small
   * background buildings, not a replacement for them) is what actually
   * makes an added office.mid asset appear in the city.
   */
  const ROLE_CATEGORY = {
    cbd: { H: 'office.hero', S: ['office.small', 'office.small', 'office.small', 'office.mid'], X: 'commercial.small' },
    commercial: { H: 'commercial.hero', S: 'commercial.small', X: 'residential.low' },
    residential: { H: 'residential.mid', S: 'residential.low' },
    premiumResidential: { H: 'residential.premium', S: 'residential.mid' },
    industrial: { H: 'logistics', S: 'logistics' }
  };
  /*
   * Deterministic split for an array-valued ROLE_CATEGORY entry (see above)
   * -- same FNV-1a hash used everywhere else in this file, no RNG. A
   * plain string entry is returned unchanged, so every other zone/role is
   * untouched by this helper.
   */
  function pickRoleCategory(entry, prefID, tileX, tileY) {
    if (!Array.isArray(entry)) return entry;
    const idx = hash(`${prefID}:roleCategory:${tileX}:${tileY}`) % entry.length;
    return entry[idx];
  }
  const ZONE_DISTRICT_TAG = {
    cbd: 'cbd', commercial: 'commercial', residential: 'residential',
    premiumResidential: 'premiumResidential', industrial: 'logistics', landmark: 'landmark', civic: 'civic'
  };

  /*
   * Block planning (2026-09 composition pass): a global "every other tile is
   * open" rule was useful for proving the density point, but it is not a
   * real design -- it makes every block look the same. This replaces it with
   * a small, hand-planned 4x4 (16-slot) template per zone: a fixed mix of
   * hero building / secondary building / cross-zone infill / open space,
   * applied to every block of that zone (rotated/mirrored per block for
   * variety, see BLOCK_TRANSFORMS) instead of resolved tile-by-tile.
   *
   * Roles:
   *   H  hero building, this block's own zone, full prominence
   *   S  secondary building, same zone, rendered as smaller/muted filler
   *   X  cross-zone infill -- a *different*, visually smaller zone's pool
   *      (e.g. commercial low-rise dropped into a CBD block), the only way
   *      to get real height variety where a zone's own sprite pool is only
   *      mid/high-rise (office has no low-rise archetype at all)
   *   G  green open space (pocket park / tree strip)
   *   Z  hardscape open space (plaza / forecourt)
   *   K  industrial open space (parking / loading bay)
   *   .  open space, default type for the zone (see openTypeFor)
   *
   * Built share (H+S+X) matches the requested per-district hierarchy:
   * CBD ~63%, commercial ~63%, residential ~44%, premium residential ~31%,
   * industrial ~25% -- all inside their target ranges (CBD 60-70,
   * commercial 55-65, residential 40-52, premium 30-42, industrial 25-38).
   */
  /*
   * 2026-09 revision (Phase 2A, "road network first / ordinary city"): each
   * template now carries only ONE hero (H) slot -- a block is "led" by a
   * single standout building, not several, so the city reads as blocks of
   * ordinary buildings with occasional landmarks rather than a showcase of
   * hero towers. Occupancy (built share) is unchanged from before -- only
   * the H/S split moved, since that is presentation weight, not plot count.
   */
  const BLOCK_TEMPLATES = {
    cbd:                'HSX.SZSSXZS.SZX.'.split(''),
    commercial:         'HSXGSZSS.XGSZ.SX'.split(''),
    residential:        'HGSSG.GSSGSZGSG.'.split(''),
    premiumResidential: 'HGSGG.GSSGGZGSG.'.split(''),
    industrial:         'HKKGSKSKGKSK.KGK'.split('')
  };
  const BUILT_ROLES = new Set(['H', 'S', 'X']);

  /* 8 ways to read a 4x4 template (identity + 3 rotations, each mirrored or
     not) so neighbouring blocks of the same zone don't look identical --
     still a fixed, deterministic lookup, not randomness */
  const BLOCK_TRANSFORMS = [
    (x, y) => [x, y], (x, y) => [3 - y, x], (x, y) => [3 - x, 3 - y], (x, y) => [y, 3 - x],
    (x, y) => [3 - x, y], (x, y) => [y, x], (x, y) => [x, 3 - y], (x, y) => [3 - y, 3 - x]
  ];
  /*
   * layoutSeed (not prefID directly) drives this -- see the "structural vs
   * flavor" split in the module doc comment near regionForBlockSeeded()
   * below. Since layoutSeed is 1:1 derived from prefID for every real
   * prefecture, determinism per-prefecture is unaffected either way; using
   * the profile's own seed instead of the raw id is what lets a test prove
   * "same profile => same skeleton" independent of which prefID asked for
   * it (see the negative test forcing all 47 profiles identical).
   */
  function templateRoleFor(zone, layoutSeed, blockKey, localX, localY) {
    const template = BLOCK_TEMPLATES[zone];
    if (!template) return '.';
    const variant = hash(`${layoutSeed}:blockVariant:${blockKey}`) % BLOCK_TRANSFORMS.length;
    const [tx, ty] = BLOCK_TRANSFORMS[variant](localX, localY);
    return template[ty * 4 + tx];
  }

  /*
   * Landmark gradient (2026-09 revision, Phase 2A): the previous version
   * forced most of radius 2 open as well, which read as "the city vanishes
   * around the tower" -- a big park, not a city node. This keeps only the
   * tower's own immediate ring as a small plaza/greenery core; beyond that
   * it steps straight back into an ordinary (if slightly quieter) block, so
   * the landmark reads as embedded in the city rather than isolated by it.
   *   radius 0-1: always open -- the small plaza/civic edge around the base
   *   radius 2: a light touch only -- a hero role steps down to secondary
   *     (no full-prominence tower crowding the plaza), nothing is forced
   *     open, so ordinary low/mid-rise blocks start right there
   *   radius 3+: unaffected, the normal template
   */
  function applyLandmarkGradient(role, prefID, tileX, tileY, dist) {
    if (dist <= 1) return '.';
    if (dist === 2 && (role === 'H' || role === 'X')) return 'S';
    return role;
  }

  /* ---------------- world/street-grid generator ---------------- */
  /*
   * A street runs on every tile whose x or y is a multiple of STREET_PERIOD;
   * the interior of each block (STREET_PERIOD-1 tiles square) belongs to one
   * region, chosen purely from the block's position -- a formula, not hand
   * art, so the grid stays fine and continuous instead of a few big islands.
   * A single landmark tile sits at a fixed block inside the park region.
   * Widened from 4 to 5 (16-tile interior blocks) so a block has real room
   * for setbacks and open lots instead of a nearly-solid 3x3.
   */
  const STREET_PERIOD = 5;

  /*
   * ---------------- prefecture identity / regional variation (2026-09) ----------------
   * See docs/map-prefecture-identity.md for the full write-up. This replaces the previous
   * fixed-corner regionForBlock(bc, br, blockCols, blockRows) -- a pure function of block
   * position and grid size ONLY, with no prefecture input at all, which is why every one of
   * the 47 prefectures used to produce a byte-identical zone skeleton (only sprite choice
   * varied by prefecture, never the skeleton itself).
   *
   * Each of the 6 meta-zones (the 5 buildable districts plus 'park', the open-space/landmark
   * region) gets one deterministic "anchor" block, placed by a weighted hash of the resolved
   * profile's layoutSeed -- Layer 2 (regional archetype weights) + Layer 3 (the prefecture's
   * own seed) from docs/map-prefecture-identity.md. A block is then assigned to whichever
   * zone's anchor is "closest" after subtracting a weight bonus (a discrete weighted-Voronoi/
   * power-diagram split): a zone with a higher profile weight claims a visibly larger
   * catchment even from the same anchor distance, so prefectures sharing an archetype still
   * end up with different capture-region *sizes* as well as different anchor *positions*.
   *
   * Kept deliberately out of scope (see CLAUDE.md's founding-route caution about scope
   * explosion applied here to this feature instead): STREET_PERIOD / road-tier logic is
   * untouched, so the PR #611/#612 camera "3-5 block-column" framing contract still holds for
   * every prefecture regardless of how the interior zones are distributed.
   */
  const ZONE_KEYS = ['cbd', 'commercial', 'industrial', 'premiumResidential', 'park', 'residential'];
  const ZONE_WEIGHT_FIELD = {
    cbd: 'cbdWeight', commercial: 'commercialWeight', industrial: 'industrialWeight',
    premiumResidential: 'premiumResidentialWeight', park: 'openSpaceWeight', residential: 'residentialWeight'
  };
  /* how strongly a zone's own weight lets it out-pull a nearer, lower-weight
     neighbour for a shared block -- tuned so a weight-10 zone can reach
     roughly as far as a weight-1 zone sitting 6 blocks closer */
  const ANCHOR_WEIGHT_BONUS_SCALE = 0.6;
  /* minimum Chebyshev block-distance the placer tries to keep between any
     two zone anchors, as a fraction of the placeable span, so 6 anchors
     spread across a small grid don't all cluster in one corner */
  const ANCHOR_MIN_SEPARATION_FRACTION = 0.5;
  const ANCHOR_PLACEMENT_ATTEMPTS = 12;

  function weightForZone(profile, zone) {
    const value = profile[ZONE_WEIGHT_FIELD[zone]];
    return typeof value === 'number' && value > 0 ? value : 1;
  }

  /*
   * One deterministic anchor block per zone, hash-seeded from
   * profile.layoutSeed -- never calls into JavaScript's built-in
   * random-number generator, never simulation RNG. Bounds stay inside the
   * grid's interior (never the outermost block ring) so an anchor is never
   * placed somewhere a fixed landmark/civic offset (see buildWorldDistrict
   * below) could fall outside the grid.
   */
  function placeZoneAnchors(profile, blockCols, blockRows) {
    const minBc = blockCols > 3 ? 1 : 0;
    const maxBc = blockCols > 3 ? blockCols - 2 : blockCols - 1;
    const minBr = blockRows > 3 ? 1 : 0;
    const maxBr = blockRows > 3 ? blockRows - 2 : blockRows - 1;
    const spanBc = Math.max(0, maxBc - minBc);
    const spanBr = Math.max(0, maxBr - minBr);
    const minSeparation = Math.max(1, Math.floor(Math.min(spanBc, spanBr) * ANCHOR_MIN_SEPARATION_FRACTION));
    const anchors = {};
    const placed = [];
    for (const zone of ZONE_KEYS) {
      let candidate = null;
      for (let attempt = 0; attempt < ANCHOR_PLACEMENT_ATTEMPTS; attempt++) {
        const bc = minBc + (hash(`${profile.layoutSeed}:anchor:${zone}:${attempt}:x`) % (spanBc + 1));
        const br = minBr + (hash(`${profile.layoutSeed}:anchor:${zone}:${attempt}:y`) % (spanBr + 1));
        if (attempt === 0) candidate = { bc, br }; // deterministic fallback if every attempt collides
        const tooClose = placed.some(p => Math.max(Math.abs(p.bc - bc), Math.abs(p.br - br)) < minSeparation);
        if (!tooClose) { candidate = { bc, br }; break; }
      }
      anchors[zone] = candidate;
      placed.push(candidate);
    }
    return anchors;
  }

  function regionForBlockSeeded(bc, br, anchors, profile) {
    let bestZone = ZONE_KEYS[0], bestScore = Infinity;
    for (const zone of ZONE_KEYS) {
      const anchor = anchors[zone];
      const dist = Math.max(Math.abs(bc - anchor.bc), Math.abs(br - anchor.br));
      const score = dist - weightForZone(profile, zone) * ANCHOR_WEIGHT_BONUS_SCALE;
      if (score < bestScore) { bestScore = score; bestZone = zone; }
    }
    return bestZone;
  }

  /*
   * Assigns every block once, then a repair pass guarantees each of the 6
   * zones captured at least one block: with only a handful of candidate
   * anchor slots on a small grid, an unlucky placement could in principle
   * let a higher-weight zone's catchment fully absorb a lower-weight one's
   * own anchor block. Density guardrails (docs/map-prefecture-identity.md)
   * require every zone keep enough eligible tiles for marker placement, so
   * this makes that a guarantee, not a probability.
   */
  function assignBlockZones(profile, blockCols, blockRows) {
    const anchors = placeZoneAnchors(profile, blockCols, blockRows);
    const assignment = new Map();
    const counts = {};
    for (const zone of ZONE_KEYS) counts[zone] = 0;
    for (let br = 0; br < blockRows; br++) {
      for (let bc = 0; bc < blockCols; bc++) {
        const zone = regionForBlockSeeded(bc, br, anchors, profile);
        assignment.set(`${bc},${br}`, zone);
        counts[zone]++;
      }
    }
    for (const zone of ZONE_KEYS) {
      if (counts[zone] > 0) continue;
      const anchor = anchors[zone];
      const key = `${anchor.bc},${anchor.br}`;
      const previousZone = assignment.get(key);
      if (previousZone && previousZone !== zone) counts[previousZone]--;
      assignment.set(key, zone);
      counts[zone]++;
    }
    return { anchors, assignment };
  }

  function buildWorldDistrict(options) {
    const index2 = options.index2;
    const prefID = options.prefID;
    const cols = options.cols;
    const rowsCount = options.rows;
    const blockCols = Math.ceil(cols / STREET_PERIOD);
    const blockRows = Math.ceil(rowsCount / STREET_PERIOD);
    /* Layer 2 (regional archetype weights) + Layer 3 (per-prefecture seed);
       a caller (a negative test, e.g.) may pass an explicit options.profile
       to override the real per-prefID lookup -- see docs/map-prefecture-
       identity.md and the "same profile for every prefID" negative test. */
    const profile = options.profile || (Profiles && Profiles.resolveProfile(prefID)) ||
      { layoutSeed: `${prefID || 'unknown'}-layout`, cbdWeight: 3, commercialWeight: 3, residentialWeight: 6, premiumResidentialWeight: 2, industrialWeight: 2, openSpaceWeight: 6, highRiseBias: 0.2, greeneryBias: 0.5, landmarkPolicy: 'generic' };
    const { anchors, assignment: blockZones } = assignBlockZones(profile, blockCols, blockRows);

    const tiles = [];
    const byKey = {};
    /* pass 1: zone assignment from the street grid */
    for (let tileY = 0; tileY < rowsCount; tileY++) {
      for (let tileX = 0; tileX < cols; tileX++) {
        const isStreet = (tileX % STREET_PERIOD === 0) || (tileY % STREET_PERIOD === 0);
        let zone;
        if (isStreet) {
          zone = 'road';
        } else {
          const bc = Math.floor(tileX / STREET_PERIOD);
          const br = Math.floor(tileY / STREET_PERIOD);
          zone = blockZones.get(`${bc},${br}`);
        }
        const cell = { tileX, tileY, zone, zoneLabel: ZONE_LABEL2[zone], use: ZONE_USE2[zone] || null };
        tiles.push(cell);
        byKey[`${tileX},${tileY}`] = cell;
      }
    }
    /* one landmark tile, centred on this prefecture's own seeded park
       anchor block, isolated on all four sides by park (never adjacent to
       a footprint>1 building) -- the anchor is always inside the grid's
       interior (placeZoneAnchors), so this stays bounds-safe */
    const parkAnchor = anchors.park;
    const parkBlockCentreX = parkAnchor.bc * STREET_PERIOD + Math.floor(STREET_PERIOD / 2);
    const parkBlockCentreY = parkAnchor.br * STREET_PERIOD + Math.floor(STREET_PERIOD / 2);
    const landmarkCell = byKey[`${parkBlockCentreX},${parkBlockCentreY}`];
    if (landmarkCell && landmarkCell.zone === 'park') {
      landmarkCell.zone = 'landmark';
      landmarkCell.zoneLabel = ZONE_LABEL2.landmark;
      landmarkCell.use = ZONE_USE2.landmark;
    }

    /* three road tiers -- arterial (sparse, wide), secondary (medium) and
       local (every remaining street line, narrow) -- so the network reads
       as a hierarchy instead of one uniform width everywhere */
    const ARTERIAL_PERIOD = STREET_PERIOD * 3;
    const SECONDARY_PERIOD = STREET_PERIOD * 2;
    for (const cell of tiles) {
      if (cell.zone !== 'road') continue;
      const onArterial = (cell.tileX % ARTERIAL_PERIOD === 0) || (cell.tileY % ARTERIAL_PERIOD === 0);
      const onSecondary = (cell.tileX % SECONDARY_PERIOD === 0) || (cell.tileY % SECONDARY_PERIOD === 0);
      cell.roadTier = onArterial ? 'arterial' : onSecondary ? 'secondary' : 'local';
      cell.roadPrimary = cell.roadTier !== 'local'; /* kept for anything still reading the old binary flag */
    }
    /* crosswalks only where two secondary-or-wider streets cross -- marking
       every local street intersection reads as clutter, not a legible grid */
    for (const cell of tiles) {
      cell.intersection = cell.zone === 'road' &&
        (cell.tileX % SECONDARY_PERIOD === 0) && (cell.tileY % SECONDARY_PERIOD === 0);
    }

    /* the landmark tile resolves its own sprite directly (its category pool
       only ever has one archetype) so it is never treated as an ordinary
       open/building plot below */
    if (landmarkCell) {
      /*
       * Prefecture-exclusive landmark sprites (see selectSpriteForCategory's
       * `prefectureIds` filtering below) mean the 'landmark' category pool
       * is legitimately EMPTY for every prefecture without a dedicated
       * asset -- today, every prefecture except Tokyo. Falling back to the
       * generic 'civic' pool there (instead of leaving spriteId null, which
       * would draw a dev placeholder box) is what fixes "a Tokyo-Tower-like
       * landmark appears in Gunma/Saitama etc": Tokyo Tower is filtered out
       * for every other prefecture, and civic_01..04 are the graceful,
       * always-available fallback. expectsBuilding is only set once a real
       * spriteId is resolved -- if even the civic pool is empty (a
       * manifest with no civic sprites at all), the cell is left alone
       * here and pass 2b naturally treats it as ordinary open plaza space
       * (OPEN_TYPES_BY_ZONE has no 'landmark' entry, so it falls back to
       * the ['plaza'] default) -- never a white screen or a broken asset
       * path, matching the same "stays ordinary park" contract the civic
       * cells below already had.
       */
      let landmarkSpriteId = selectSpriteForCategory(index2, {
        category: 'landmark', district: 'landmark', prefID,
        tileX: landmarkCell.tileX, tileY: landmarkCell.tileY
      });
      if (!landmarkSpriteId) {
        landmarkSpriteId = selectSpriteForCategory(index2, {
          category: 'civic', district: 'civic', prefID,
          tileX: landmarkCell.tileX, tileY: landmarkCell.tileY
        });
      }
      if (landmarkSpriteId) {
        landmarkCell.expectsBuilding = true;
        landmarkCell.spriteId = landmarkSpriteId;
        landmarkCell.scaleVariant = SCALE_VARIANTS[hash(`${prefID}:scale:${landmarkCell.tileX}:${landmarkCell.tileY}`) % SCALE_VARIANTS.length];
      }
    }

    /*
     * Two civic-building slots flank the landmark's own block, one
     * block-column either side of the seeded park anchor's own bc (the
     * landmark itself always sits at the anchor's bc) -- still inside the
     * park super-region, so this never touches the five occupancy-tracked
     * districts (cbd/commercial/residential/premiumResidential/industrial)
     * or BLOCK_TEMPLATES. Before this pass, `civic` was a taxonomy entry
     * with NO requester anywhere -- not a role, not even a
     * CATEGORY_FALLBACK target -- so adding civic sprites to the manifest
     * alone would never place one; this is the minimal fix. It keeps the
     * same graceful-degradation contract as everywhere else:
     * selectSpriteForCategory returning null just leaves the cell as
     * ordinary park (today's behaviour, unchanged).
     */
    const civicCells = [parkAnchor.bc - 1, parkAnchor.bc + 1]
      .map(bc => byKey[`${bc * STREET_PERIOD + Math.floor(STREET_PERIOD / 2)},${parkBlockCentreY}`])
      .filter(cell => cell && cell.zone === 'park');
    for (const cell of civicCells) {
      const spriteId = selectSpriteForCategory(index2, {
        category: 'civic', district: 'civic', prefID, tileX: cell.tileX, tileY: cell.tileY
      });
      if (!spriteId) continue; // no civic asset yet -- stays ordinary park
      cell.zone = 'civic';
      cell.zoneLabel = ZONE_LABEL2.civic;
      cell.use = ZONE_USE2.civic;
      cell.expectsBuilding = true;
      cell.spriteId = spriteId;
      cell.scaleVariant = SCALE_VARIANTS[hash(`${prefID}:scale:${cell.tileX}:${cell.tileY}`) % SCALE_VARIANTS.length];
    }

    /*
     * pass 2a: resolve every buildable cell's block-template role up front
     * (needs to exist for ALL cells before pass 2b, since footprint
     * reservation below must be able to check a not-yet-visited neighbour's
     * role -- row-major order alone can't guarantee that).
     */
    for (const cell of tiles) {
      if (!BUILDABLE2.has(cell.zone) || cell.zone === 'landmark' || cell.zone === 'civic') continue;
      const blockKey = `${Math.floor(cell.tileX / STREET_PERIOD)},${Math.floor(cell.tileY / STREET_PERIOD)}`;
      const localX = (cell.tileX % STREET_PERIOD) - 1;
      const localY = (cell.tileY % STREET_PERIOD) - 1;
      let role = templateRoleFor(cell.zone, profile.layoutSeed, blockKey, localX, localY);
      if (landmarkCell) {
        const dist = Math.max(Math.abs(cell.tileX - landmarkCell.tileX), Math.abs(cell.tileY - landmarkCell.tileY));
        if (dist <= 3) role = applyLandmarkGradient(role, prefID, cell.tileX, cell.tileY, dist);
      }
      cell.templateRole = role;
    }

    /*
     * pass 2b: turn each role into open space or a building, with footprint
     * reservation the same way Phase 1's buildDistrict() does it -- except a
     * hero/secondary's footprint may only absorb a neighbour that pass 2a
     * also marked as a built role (H/S/X); it can never silently swallow a
     * plot the template planned as open space.
     */
    for (const cell of tiles) {
      if (!BUILDABLE2.has(cell.zone) || cell.reserved || cell.expectsBuilding) continue;
      const role = cell.templateRole;
      if (!role || !BUILT_ROLES.has(role)) {
        if (BUILDABLE2.has(cell.zone) && cell.zone !== 'landmark') {
          cell.open = true;
          const landmarkDist = landmarkCell &&
            Math.max(Math.abs(cell.tileX - landmarkCell.tileX), Math.abs(cell.tileY - landmarkCell.tileY));
          cell.openType = (landmarkDist !== undefined && landmarkDist <= 2)
            ? openTypeFor(cell.zone, prefID, cell.tileX, cell.tileY, 'G')
            : openTypeFor(cell.zone, prefID, cell.tileX, cell.tileY, role);
        }
        continue;
      }
      const roleCategory = pickRoleCategory((ROLE_CATEGORY[cell.zone] || {})[role], prefID, cell.tileX, cell.tileY);
      const district = ZONE_DISTRICT_TAG[cell.zone] || cell.zone;
      const spriteId = roleCategory && selectSpriteForCategory(index2, {
        category: roleCategory, district, prefID,
        tileX: cell.tileX, tileY: cell.tileY,
        excludeIds: nearbySpriteIds(byKey, cell.tileX, cell.tileY, WORLD_NO_REPEAT_RADIUS)
      });
      if (!spriteId) {
        /* no sprite available for this role/category even after the
           fallback chain (e.g. an X-infill category with zero assets yet)
           -- degrade to open space rather than force a mismatched building
           or a dev placeholder onto a plot the template meant to build on */
        cell.open = true;
        cell.openType = openTypeFor(cell.zone, prefID, cell.tileX, cell.tileY, role === 'X' ? '.' : role);
        continue;
      }
      cell.expectsBuilding = true;
      cell.filler = role !== 'H';
      cell.spriteId = spriteId;
      const meta = index2.byId[spriteId];
      if (role === 'X') cell.use = meta.category;
      cell.scaleVariant = SCALE_VARIANTS[hash(`${prefID}:scale:${cell.tileX}:${cell.tileY}`) % SCALE_VARIANTS.length];
      const footprint = meta && meta.footprint;
      if (footprint && (footprint.w > 1 || footprint.h > 1)) {
        const claim = [];
        let fits = true;
        for (let dy = 0; dy < footprint.h && fits; dy++) {
          for (let dx = 0; dx < footprint.w && fits; dx++) {
            if (dx === 0 && dy === 0) continue;
            const neighbour = byKey[`${cell.tileX + dx},${cell.tileY + dy}`];
            if (!neighbour || neighbour.zone !== cell.zone || neighbour.reserved ||
              !neighbour.templateRole || !BUILT_ROLES.has(neighbour.templateRole)) { fits = false; break; }
            claim.push(neighbour);
          }
        }
        if (fits) {
          for (const neighbour of claim) { neighbour.reserved = true; neighbour.occupiedBy = { tileX: cell.tileX, tileY: cell.tileY }; }
          cell.footprint = footprint;
        }
      }
    }

    return {
      prefID, tiles, byKey, cols, rowsCount,
      profile, blockCols, blockRows,
      /* plain-object copy (not the Map) so this survives a JSON round-trip
         for anything that snapshots a district -- structuralLayoutSignature
         and tests read this directly instead of re-deriving block zones */
      blockZones: Object.fromEntries(blockZones),
      landmarkTile: landmarkCell ? { tileX: landmarkCell.tileX, tileY: landmarkCell.tileY } : null
    };
  }

  /*
   * A deterministic fingerprint of a built district's *skeleton* -- block
   * zone allocation, landmark position, and the per-tile block-template
   * role sequence -- deliberately excluding spriteId/scaleVariant/openType
   * (sprite-level "flavor" picks) so this can only read as different across
   * prefectures when the actual city structure differs, not merely which
   * building sprite got chosen. This is what STEP 8 / docs/map-prefecture-
   * identity.md's structural-uniqueness contract is checked against: an
   * implementation that only varies sprite IDs (geometry unchanged) would
   * produce IDENTICAL signatures for every prefecture and correctly fail
   * that test.
   */
  function structuralLayoutSignature(district) {
    const blockPart = Object.keys(district.blockZones).sort().map(k => `${k}=${district.blockZones[k]}`).join(',');
    const landmarkPart = district.landmarkTile ? `${district.landmarkTile.tileX}:${district.landmarkTile.tileY}` : 'none';
    const rolePart = district.tiles
      .filter(cell => cell.templateRole)
      .map(cell => `${cell.tileX}:${cell.tileY}:${cell.templateRole}`)
      .join(',');
    return `${blockPart}|${landmarkPart}|${rolePart}`;
  }

  /*
   * What kind of meaningful open space an open plot reads as -- never a bare
   * gap. cbd/commercial favour a paved plaza or forecourt; residential and
   * premium residential favour a pocket park or tree strip; industrial
   * favours parking / a loading bay (Canvas primitives only, no assets).
   */
  const OPEN_TYPES_BY_ZONE = {
    cbd: ['plaza', 'plaza', 'forecourt'],
    commercial: ['plaza', 'forecourt', 'pocketPark'],
    residential: ['pocketPark', 'treeStrip', 'pocketPark'],
    premiumResidential: ['pocketPark', 'treeStrip'],
    industrial: ['parking', 'loadingBay']
  };
  const GREEN_TYPES = ['pocketPark', 'treeStrip'];
  const HARDSCAPE_TYPES = ['plaza', 'forecourt'];
  const INDUSTRIAL_OPEN_TYPES = ['parking', 'loadingBay'];
  /*
   * A block template's role already says WHAT kind of open space a plot
   * should read as (G green / Z hardscape / K industrial); '.' (or no role,
   * e.g. a plot outside any template) falls back to the zone's own default
   * mix, same as before.
   */
  function openTypeFor(zone, prefID, tileX, tileY, role) {
    const pick = options => options[hash(`${prefID}:openType:${tileX}:${tileY}`) % options.length];
    if (role === 'G') return pick(GREEN_TYPES);
    if (role === 'Z') return pick(HARDSCAPE_TYPES);
    if (role === 'K') return pick(INDUSTRIAL_OPEN_TYPES);
    return pick(OPEN_TYPES_BY_ZONE[zone] || ['plaza']);
  }

  /* ---------------- world transform + camera ---------------- */
  /*
   * Unlike Phase 1's fitTransform (which scales the whole district to fit
   * one viewport), this picks a fixed scale once and returns the *world*
   * pixel bounding box; the camera then pans a viewport-sized window over
   * it. The transform itself stays a pure tile<->world-pixel function --
   * camera is applied only by the thin adapter below, at draw time.
   */
  /*
   * `toScreen` stays in raw, unscaled tile-space (exactly like Base's own
   * fitTransform/createTransform): `scale` is applied once, uniformly, by
   * the caller's canvas context transform (ctx.setTransform(dpr*scale,...)),
   * the same two-stage pattern Base.createCityLayer.present() already uses.
   * Baking `scale` into this bounding-box math too would double-apply it.
   * That means camera position, viewport width/height (for culling and the
   * camera clamp) and worldWidth/worldHeight below are ALL in raw tile-space
   * units, not CSS pixels -- the caller divides its CSS viewport size by
   * `scale` before passing it in (see map-phase2-preview.html).
   */
  function worldTransform(district, tile, scale, margin) {
    const pad = margin === undefined ? 220 : margin;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const corners = [[0, 0], [district.cols, 0], [0, district.rowsCount], [district.cols, district.rowsCount]];
    for (const [tx, ty] of corners) {
      const x = (tx - ty) * (tile.w / 2);
      const y = (tx + ty) * (tile.h / 2);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const originX = -minX + pad;
    const originY = -minY + pad;
    const transform = Base.createTransform({ tileW: tile.w, tileH: tile.h, originX, originY, scale });
    const worldWidth = (maxX - minX) + pad * 2;
    const worldHeight = (maxY - minY) + pad * 2;
    /* the actual drawable city, excluding the pad reserved for tall sprite
       headroom at the world edge -- this is what the camera clamp should
       treat as "the map", not the padded backing rectangle */
    const contentBounds = { minX: pad, maxX: worldWidth - pad, minY: pad, maxY: worldHeight - pad };
    return { transform, worldWidth, worldHeight, contentBounds };
  }

  /* camera-shifted view of a transform: every other paint helper in Phase 1
     (paintTerrain/paintRoads/paintGreenery/blitSprites/overlayAnchors) only
     ever calls toScreen/toCss, so this adapter is a complete substitute --
     none of that code needs to know panning exists */
  function withCamera(transform, camera) {
    return {
      tileW: transform.tileW, tileH: transform.tileH, scale: transform.scale,
      toScreen(tileX, tileY) {
        const [x, y] = transform.toScreen(tileX, tileY);
        return [x - camera.x, y - camera.y];
      },
      toCss(tileX, tileY) {
        const [x, y] = transform.toScreen(tileX, tileY);
        return [(x - camera.x) * transform.scale, (y - camera.y) * transform.scale];
      }
    };
  }

  /*
   * A plain world-rectangle clamp lets the camera slide entirely into the
   * headroom padding around the city -- on a narrow iPhone viewport that
   * reads as "half the screen is empty sky", which is not an acceptable
   * resting position. This clamps against the actual drawable content
   * bounds instead, only allowing a small, fixed overflow (a fraction of
   * the viewport) past the content edge so headroom for tall sprites still
   * exists at the true edge of the map.
   */
  /*
   * The city is a diamond (isometric projection of a rectangular tile grid)
   * inscribed in a rectangular bounding box, not a rectangle itself -- an
   * axis-aligned clamp on screen-space X and Y independently can still park
   * the camera in one of the box's four corners, which are empty (outside
   * the diamond) by construction. That was the "big void" bug: clamping
   * camera.x and camera.y separately allowed both to sit near their own
   * edge at once, landing the viewport over a corner with almost no
   * content nearby.
   *
   * The fix is to clamp in TILE space instead, where the world really is
   * just a rectangle: take the viewport centre, convert it back to a tile
   * coordinate (transform.toTile, the exact inverse of toScreen), clamp
   * that tile coordinate to the district's [0,cols] x [0,rows] rectangle
   * (plus a small tile-count overshoot for a natural amount of headroom at
   * the true edge), then convert back to screen space. Every tile inside
   * that clamped rectangle is real content, so this can never rest on a
   * corner void the way the screen-space rectangle clamp could.
   */
  function clampCameraToContent(camera, transform, district, viewportWidth, viewportHeight, overshootTiles) {
    /*
     * A fixed tile-count inset only looks right at the scale it was tuned
     * for: the same inset covers less of a viewport that (at a lower zoom
     * scale) now spans more raw tile-space. Left unspecified, the inset is
     * derived from the viewport's own size in tile units, so the same
     * "keep most of the view inside real content" behaviour holds whether
     * the map is zoomed in or pulled back -- clamped to [3,8] tiles so a
     * large desktop viewport (which can already be a big fraction of a
     * pulled-back world) never insets so far it collapses the pannable
     * range to nothing.
     */
    const rawInset = Math.min(viewportWidth / transform.tileW, viewportHeight / transform.tileH) * 0.5;
    const autoInset = -Math.min(Math.max(rawInset, 3), 8);
    const ot = overshootTiles === undefined ? autoInset : overshootTiles;
    const centreX = camera.x + viewportWidth / 2;
    const centreY = camera.y + viewportHeight / 2;
    const [tileX, tileY] = transform.toTile(centreX, centreY);
    const clampedTileX = Math.min(Math.max(tileX, -ot), district.cols + ot);
    const clampedTileY = Math.min(Math.max(tileY, -ot), district.rowsCount + ot);
    const [screenX, screenY] = transform.toScreen(clampedTileX, clampedTileY);
    return { x: screenX - viewportWidth / 2, y: screenY - viewportHeight / 2 };
  }

  /* ---------------- culling ---------------- */
  /*
   * Only tiles whose screen position (after the camera shift) falls within
   * the viewport, padded by `margin` (tall sprites and their footprint
   * overhang extend up/left/right of their own tile), are drawn each frame.
   * The world's tiles/byKey are built once by buildWorldDistrict(); this
   * never rebuilds them -- it only filters the array pan reads from.
   */
  function cullVisible(district, transform, camera, viewportWidth, viewportHeight, margin) {
    const m = margin === undefined ? 260 : margin;
    return district.tiles.filter(cell => {
      const [x, y] = transform.toScreen(cell.tileX, cell.tileY);
      const sx = x - camera.x, sy = y - camera.y;
      return sx > -m && sx < viewportWidth + m && sy > -m && sy < viewportHeight + m;
    });
  }

  /* ---------------- a slightly wider sidewalk band ---------------- */
  /*
   * Base.paintTerrain already strokes a thin sidewalk edge on every
   * road-facing lot boundary; this adds one more, slightly further out and
   * a touch lighter, so the walkway reads as a real strip rather than a
   * hairline -- purely decorative, no new geometry.
   */
  const SIDEWALK_WIDE = 'rgba(224,223,217,.55)';
  function paintSidewalkWidening(ctx, visibleTiles, transform, tile, byKey) {
    for (const cell of visibleTiles) {
      if (!BUILDABLE2.has(cell.zone)) continue;
      const [x, y] = transform.toScreen(cell.tileX, cell.tileY);
      const edges = [
        [cell.tileX + 1, cell.tileY, [x + tile.w / 2, y], [x, y + tile.h / 2]],
        [cell.tileX, cell.tileY + 1, [x, y + tile.h / 2], [x - tile.w / 2, y]],
        [cell.tileX - 1, cell.tileY, [x - tile.w / 2, y], [x, y - tile.h / 2]],
        [cell.tileX, cell.tileY - 1, [x, y - tile.h / 2], [x + tile.w / 2, y]]
      ];
      ctx.strokeStyle = SIDEWALK_WIDE;
      ctx.lineWidth = 2;
      for (const [nx, ny, a, b] of edges) {
        const neighbour = byKey[`${nx},${ny}`];
        if (!neighbour || neighbour.zone !== 'road') continue;
        const inset = 0.72;
        ctx.beginPath();
        ctx.moveTo(x + (a[0] - x) * inset, y + (a[1] - y) * inset);
        ctx.lineTo(x + (b[0] - x) * inset, y + (b[1] - y) * inset);
        ctx.stroke();
      }
    }
  }

  /* ---------------- three-tier road network ---------------- */
  /*
   * A local reimplementation of Base.paintRoads' kerb/centreline logic
   * (which only knows a binary primary/secondary split) extended to the
   * three road tiers computed in buildWorldDistrict: arterial (widest, has
   * a centreline), secondary (medium, thinner centreline), local (narrowest,
   * no centreline -- a quiet residential lane, not a through street).
   */
  const ROAD_WIDTH = { arterial: 1.14, secondary: 0.86, local: 0.5 };
  const ROAD_COLOUR = '#8e959c';
  const KERB_COLOUR = '#cdcdc6';
  function worldTilePath(ctx, x, y, tile, inflate) {
    const hw = (tile.w / 2) * (inflate || 1);
    const hh = (tile.h / 2) * (inflate || 1);
    ctx.beginPath();
    ctx.moveTo(x, y - hh); ctx.lineTo(x + hw, y); ctx.lineTo(x, y + hh); ctx.lineTo(x - hw, y);
    ctx.closePath();
  }
  function paintWorldRoads(ctx, visibleTiles, transform, tile, byKey) {
    const at = (tx, ty) => { const cell = byKey[`${tx},${ty}`]; return cell ? cell.zone : null; };
    for (const cell of visibleTiles) {
      if (cell.zone !== 'road') continue;
      const [x, y] = transform.toScreen(cell.tileX, cell.tileY);
      const w = ROAD_WIDTH[cell.roadTier] || ROAD_WIDTH.local;
      worldTilePath(ctx, x, y, tile, w);
      ctx.fillStyle = ROAD_COLOUR;
      ctx.fill();
      const neighbours = [
        [cell.tileX + 1, cell.tileY, [x + tile.w / 2, y], [x, y + tile.h / 2]],
        [cell.tileX, cell.tileY + 1, [x, y + tile.h / 2], [x - tile.w / 2, y]],
        [cell.tileX - 1, cell.tileY, [x - tile.w / 2, y], [x, y - tile.h / 2]],
        [cell.tileX, cell.tileY - 1, [x, y - tile.h / 2], [x + tile.w / 2, y]]
      ];
      ctx.strokeStyle = KERB_COLOUR;
      ctx.lineWidth = 2.4;
      for (const [nx, ny, a, b] of neighbours) {
        const zone = at(nx, ny);
        if (zone === 'road' || zone === null) continue;
        const ia = [x + (a[0] - x) * w, y + (a[1] - y) * w];
        const ib = [x + (b[0] - x) * w, y + (b[1] - y) * w];
        ctx.beginPath(); ctx.moveTo(ia[0], ia[1]); ctx.lineTo(ib[0], ib[1]); ctx.stroke();
      }
      if (cell.roadTier === 'local') continue; /* quiet local lanes stay unmarked */
      const alongX = at(cell.tileX - 1, cell.tileY) === 'road' || at(cell.tileX + 1, cell.tileY) === 'road';
      const alongY = at(cell.tileX, cell.tileY - 1) === 'road' || at(cell.tileX, cell.tileY + 1) === 'road';
      ctx.strokeStyle = 'rgba(255,255,255,.72)';
      ctx.lineWidth = cell.roadTier === 'arterial' ? 1.6 : 1.2;
      ctx.setLineDash(cell.roadTier === 'arterial' ? [7, 6] : [4, 6]);
      if (alongX && !alongY) {
        ctx.beginPath(); ctx.moveTo(x - tile.w / 2, y - tile.h / 2); ctx.lineTo(x + tile.w / 2, y + tile.h / 2); ctx.stroke();
      } else if (alongY && !alongX) {
        ctx.beginPath(); ctx.moveTo(x + tile.w / 2, y - tile.h / 2); ctx.lineTo(x - tile.w / 2, y + tile.h / 2); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  /* ---------------- crosswalks (Canvas primitive, no assets) ---------------- */
  function paintCrosswalks(ctx, visibleTiles, transform, tile) {
    for (const cell of visibleTiles) {
      if (!cell.intersection) continue;
      const [x, y] = transform.toScreen(cell.tileX, cell.tileY);
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      const r = tile.w * 0.30;
      ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.5); ctx.lineTo(x + r, y - r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r, y + r * 0.5); ctx.lineTo(x + r, y + r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r); ctx.lineTo(x - r * 0.5, y + r); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + r * 0.5, y - r); ctx.lineTo(x + r * 0.5, y + r); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* ---------------- meaningful open space (Canvas primitives only) ---------------- */
  /*
   * Base.paintTerrain already draws a light paving lattice on any cell.open
   * tile (that IS the "plaza"/"forecourt" look). This adds the extra reading
   * for the other open types, on top of that base treatment -- never a bare
   * gap, but never a new sprite either.
   */
  function paintOpenLots(ctx, visibleTiles, transform, tile, prefID) {
    for (const cell of visibleTiles) {
      if (!cell.open || !cell.openType) continue;
      const [x, y] = transform.toScreen(cell.tileX, cell.tileY);
      if (cell.openType === 'pocketPark' || cell.openType === 'treeStrip') {
        const count = cell.openType === 'pocketPark' ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const seed = hash(`${prefID}:openTree:${cell.tileX}:${cell.tileY}:${i}`);
          const tx = x + ((seed % 22) - 11);
          const ty = y + (((seed >>> 5) % 10) - 5);
          ctx.fillStyle = 'rgba(40,60,35,.18)';
          ctx.beginPath(); ctx.ellipse(tx + 2, ty + 2, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#557f42';
          ctx.beginPath(); ctx.ellipse(tx - 1, ty - 5, 5.2, 4.6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#6a9a52';
          ctx.beginPath(); ctx.ellipse(tx + 1.5, ty - 7.5, 5, 4.4, 0, 0, Math.PI * 2); ctx.fill();
        }
      } else if (cell.openType === 'parking' || cell.openType === 'loadingBay') {
        ctx.strokeStyle = 'rgba(255,255,255,.4)';
        ctx.lineWidth = 1.2;
        const w = tile.w * 0.30;
        for (const offset of [-0.4, 0, 0.4]) {
          ctx.beginPath();
          ctx.moveTo(x - w + offset * tile.w, y - tile.h * 0.16);
          ctx.lineTo(x - w + offset * tile.w + 6, y + tile.h * 0.16);
          ctx.stroke();
        }
      }
      /* 'forecourt' and 'plaza' read from Base.paintTerrain's own paving
         lattice on any cell.open tile -- no extra marks needed here */
    }
  }

  /* ---------------- hero/filler-aware sprite blit ---------------- */
  /*
   * Same placement, ordering and contact-shadow treatment as Base.blitSprites
   * (copied, not diverged, so the two stay easy to reconcile), plus:
   * background filler plots (cell.filler) render a little smaller and a
   * little more muted (lower alpha, no filter/blur) so a block reads as one
   * hero building plus supporting context, not a wall of equally loud towers.
   */
  const FILLER_SCALE = 0.76;
  const FILLER_ALPHA = 0.72;
  const SHADOW_FILL = 'rgba(20,24,20,.22)';
  function paintContactShadowLocal(ctx, x, y, meta, width) {
    const footprint = meta.footprint || { w: 1, h: 1 };
    const rx = width * 0.24 * Math.max(1, footprint.w * 0.72);
    const ry = rx * 0.34;
    ctx.fillStyle = SHADOW_FILL;
    ctx.beginPath();
    ctx.ellipse(x, y + ry * 0.15, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function blitWorldSprites(ctx, district, transform, images, index, options) {
    const settings = options || {};
    const tile = index.tile;
    const widthFactor = settings.spriteWidthFactor || SPRITE_WIDTH_FACTOR;
    let blitted = 0, placeholders = 0;
    for (const cell of depthSorted(district)) {
      const [x, y] = transform.toScreen(cell.tileX, cell.tileY);
      const meta = cell.spriteId ? index.byId[cell.spriteId] : null;
      const image = meta && images[meta.id];
      if (!meta || !image || !image.width) {
        if (settings.showPlaceholders !== false) { drawPlaceholder(ctx, x, y, tile, cell.spriteId, false); placeholders++; }
        continue;
      }
      const variant = (cell.scaleVariant || 1) * (cell.filler ? FILLER_SCALE : 1);
      const { width, height } = spriteRenderSize(image, meta, tile, widthFactor, variant);
      if (settings.showShadows !== false) paintContactShadowLocal(ctx, x, y, meta, width);
      if (cell.filler) ctx.globalAlpha = FILLER_ALPHA;
      ctx.drawImage(image, x - width * meta.anchor.x, y - height * meta.anchor.y, width, height);
      if (cell.filler) ctx.globalAlpha = 1;
      blitted++;
    }
    return { blitted, placeholders };
  }

  /* pins only ever anchor to full-prominence (non-filler) buildings */
  function worldOverlayAnchors(district, transform, specs) {
    return Base.overlayAnchors({ prefID: district.prefID, tiles: district.tiles.filter(c => !c.filler), byKey: district.byKey }, transform, specs);
  }

  const api = Object.assign({}, Base, {
    buildWorldDistrict, worldTransform, withCamera, clampCameraToContent, cullVisible,
    paintWorldRoads, paintCrosswalks, paintOpenLots, paintSidewalkWidening, blitWorldSprites,
    overlayAnchors: worldOverlayAnchors,
    validateCategoryManifest, indexCategoryManifest, selectSpriteForCategory,
    CATEGORY_TAXONOMY, CATEGORY_FALLBACK, ROLE_CATEGORY, pickRoleCategory, ZONE_DISTRICT_TAG,
    ZONE_LABEL2, ZONE_USE2, GROUND2, STREET_PERIOD, BLOCK_TEMPLATES, BUILT_ROLES,
    structuralLayoutSignature, placeZoneAnchors, assignBlockZones, ZONE_KEYS
  });

  root.MapWorldPreview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
