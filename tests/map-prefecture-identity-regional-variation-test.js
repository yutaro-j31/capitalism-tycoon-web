'use strict';
/*
 * Focused contract test for "Prefecture Identity / Regional Variation" --
 * see docs/map-prefecture-identity.md for the full design. This is a
 * visual/map-world-generation-only pass: gameplay, economy, and save
 * content are untouched. Every check here concerns the Phase 2 map's
 * procedurally-generated city SKELETON (zone allocation, landmark
 * placement/exclusivity, per-prefecture structural variety) and its
 * interaction with the existing PR B/C/D/#611/#612 marker/camera/canvas
 * contracts, which this pass must not regress.
 *
 * Root cause this pass fixes (see prototypes/map-world-preview.js's
 * regionForBlockSeeded doc comment): regionForBlock() used to be a pure
 * function of block position and grid size ONLY, with no prefecture input
 * at all, so all 47 prefectures produced a byte-identical zone/landmark
 * skeleton; only sprite-level picks varied by prefecture. This is now
 * replaced with a profile/seed-driven weighted-anchor zone assignment
 * (prototypes/map-prefecture-profiles.js supplies the 47 explicit
 * profiles) and prefecture-aware landmark sprite selection.
 *
 * Run directly: node tests/map-prefecture-identity-regional-variation-test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
async function check(name, fn) {
  try { await fn(); console.log('PASS:', name); pass++; }
  catch (e) { console.log('FAIL:', name, '--', e.message); fail++; }
}

const MW = require(path.join(ROOT, 'prototypes/map-world-preview.js'));
const MapPrefectureProfiles = require(path.join(ROOT, 'prototypes/map-prefecture-profiles.js'));
const { REGIONAL_ARCHETYPES, PREFECTURE_MAP_PROFILES, resolveProfile, DEFAULT_ARCHETYPE } = MapPrefectureProfiles;

const worldSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');
const profilesSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-prefecture-profiles.js'), 'utf8');
const rendererSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-canvas-renderer.js'), 'utf8');
const canvasSrc = fs.readFileSync(path.join(ROOT, 'js/map-phase2-canvas.js'), 'utf8');
const engineSrc = fs.readFileSync(path.join(ROOT, 'js/engine.js'), 'utf8');
const saveV9Src = fs.readFileSync(path.join(ROOT, 'js/save-v9.js'), 'utf8');

const realManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/map-sprites/phase2/sprites.json'), 'utf8'));
const realIndex = MW.indexCategoryManifest(realManifest);
assert.ok(realIndex.ok, `sanity: real sprite manifest must index cleanly, errors: ${realIndex.errors.join(', ')}`);

const WORLD_COLS = 32, WORLD_ROWS = 28;
const ALL_PREF_IDS = Object.keys(PREFECTURE_MAP_PROFILES);

function buildDistrict(prefID, overrides) {
  return MW.buildWorldDistrict(Object.assign({ index2: realIndex, prefID, cols: WORLD_COLS, rows: WORLD_ROWS }, overrides || {}));
}
function sig(prefID, overrides) { return MW.structuralLayoutSignature(buildDistrict(prefID, overrides)); }

function readPrefsFromDataJs() {
  const dataSrc = fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8');
  const idx = dataSrc.indexOf('"prefs"');
  const start = dataSrc.indexOf('[', idx);
  let depth = 0, end = null;
  for (let i = start; i < dataSrc.length; i++) {
    if (dataSrc[i] === '[') depth++;
    else if (dataSrc[i] === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return JSON.parse(dataSrc.slice(start, end));
}

async function main() {
/* =================== COVERAGE (STEP 4/26) =================== */


await check('all 47 prefectures currently in g.prefs (js/data.js) have an explicit PREFECTURE_MAP_PROFILES entry, and there is no profile entry for a prefecture not in g.prefs', () => {
  const prefs = readPrefsFromDataJs();
  const dataIds = new Set(prefs.map(p => p.id));
  assert.equal(dataIds.size, 47, 'sanity: g.prefs should have 47 entries');
  const missing = [...dataIds].filter(id => !PREFECTURE_MAP_PROFILES[id]);
  assert.deepEqual(missing, [], `prefectures missing a profile entry: ${missing.join(', ')}`);
  const extra = Object.keys(PREFECTURE_MAP_PROFILES).filter(id => !dataIds.has(id));
  assert.deepEqual(extra, [], `profile entries for prefectures not in g.prefs: ${extra.join(', ')}`);
});

await check('resolveProfile() reports explicit:true for all 47 real prefectures, and explicit:false with the generic fallback archetype for an unknown prefID', () => {
  for (const id of ALL_PREF_IDS) {
    assert.equal(resolveProfile(id).explicit, true, `${id} should resolve to an explicit profile`);
  }
  const fallback = resolveProfile('not-a-real-prefecture-xyz');
  assert.equal(fallback.explicit, false);
  assert.equal(fallback.archetype, DEFAULT_ARCHETYPE);
});

await check('every one of the 47 profile entries names a valid, defined regional archetype', () => {
  for (const id of ALL_PREF_IDS) {
    const entry = PREFECTURE_MAP_PROFILES[id];
    assert.ok(REGIONAL_ARCHETYPES[entry.archetype], `${id} references unknown archetype ${entry.archetype}`);
  }
});

await check('every resolved profile has a unique layoutSeed across all 47 prefectures (Layer 3)', () => {
  const seeds = ALL_PREF_IDS.map(id => resolveProfile(id).layoutSeed);
  assert.equal(new Set(seeds).size, 47, `expected 47 unique seeds, saw ${new Set(seeds).size}`);
});

/* =================== STRUCTURAL UNIQUENESS (STEP 8/26) =================== */

await check('structural layout signature is unique across all 47 real prefectures (geometry, not sprite choice)', () => {
  const sigs = ALL_PREF_IDS.map(id => sig(id));
  assert.equal(new Set(sigs).size, 47, `expected 47 unique structural signatures, saw ${new Set(sigs).size}`);
});

await check('structural layout signature is independent of sprite manifest entry order (STEP 23 manifest-order independence, extended to geometry)', () => {
  const shuffled = { tile: realManifest.tile, sprites: [...realManifest.sprites].reverse() };
  const shuffledIndex = MW.indexCategoryManifest(shuffled);
  assert.ok(shuffledIndex.ok);
  for (const id of ['tokyo', 'gunma', 'saitama']) {
    const a = MW.structuralLayoutSignature(buildDistrict(id));
    const b = MW.structuralLayoutSignature(MW.buildWorldDistrict({ index2: shuffledIndex, prefID: id, cols: WORLD_COLS, rows: WORLD_ROWS }));
    assert.equal(a, b, `${id}: structural signature changed when manifest order was reversed`);
  }
});

/* =================== TOKYO LANDMARK EXCLUSIVITY (STEP 9/12/26) =================== */

await check('the Tokyo-exclusive landmark sprite is selectable for Tokyo itself', () => {
  const d = buildDistrict('tokyo');
  const landmark = d.tiles.find(c => c.zone === 'landmark');
  assert.ok(landmark, 'tokyo should always place a landmark tile');
  assert.equal(landmark.spriteId, 'landmark_tokyo_tower');
});

await check('the Tokyo-exclusive landmark sprite appears 0 times across the other 46 prefectures', () => {
  const others = ALL_PREF_IDS.filter(id => id !== 'tokyo');
  assert.equal(others.length, 46);
  for (const id of others) {
    const landmark = buildDistrict(id).tiles.find(c => c.zone === 'landmark');
    if (landmark) assert.notEqual(landmark.spriteId, 'landmark_tokyo_tower', `${id} incorrectly selected the Tokyo-exclusive landmark`);
  }
});

/* =================== FALLBACK ARCHITECTURE (STEP 10/13/24/26) =================== */

await check('every non-Tokyo prefecture with a landmark-tile building falls back to a real civic-category sprite (no broken asset path, no white screen)', () => {
  for (const id of ALL_PREF_IDS.filter(x => x !== 'tokyo')) {
    const landmark = buildDistrict(id).tiles.find(c => c.zone === 'landmark');
    if (!landmark || !landmark.expectsBuilding) continue; // graceful ordinary-plaza fallback is also a valid outcome
    assert.ok(realIndex.byId[landmark.spriteId], `${id}: landmark spriteId ${landmark.spriteId} missing from manifest index`);
    assert.equal(realIndex.byId[landmark.spriteId].category, 'civic');
  }
});

await check('an unknown prefID still builds a valid district via the generic fallback profile -- no crash, has tiles, has a landmark cell', () => {
  const d = buildDistrict('not-a-real-prefecture-xyz');
  assert.ok(d.tiles.length > 0);
  assert.ok(d.landmarkTile);
  assert.ok(d.profile && d.profile.explicit === false);
});

/* =================== REGIONAL DIFFERENCES (STEP 11-15/26) =================== */

const REGIONAL_PAIRS = [
  ['tokyo', 'gunma'], ['tokyo', 'saitama'], ['tokyo', 'chiba'], ['tokyo', 'kyoto'],
  ['tokyo', 'hokkaido'], ['tokyo', 'okinawa'], ['saitama', 'gunma'], ['saitama', 'chiba']
];
for (const [a, b] of REGIONAL_PAIRS) {
  await check(`structural signature differs: ${a} vs ${b}`, () => {
    assert.notEqual(sig(a), sig(b), `${a} and ${b} produced the same structural signature`);
  });
}

await check('Tokyo (mega_core) has a strictly higher cbdWeight and highRiseBias than Gunma/Saitama/Chiba (inland_regional/metro_suburban) -- measurable, not just structural', () => {
  const tokyo = resolveProfile('tokyo');
  for (const id of ['gunma', 'saitama', 'chiba']) {
    const other = resolveProfile(id);
    assert.ok(tokyo.cbdWeight > other.cbdWeight, `tokyo cbdWeight ${tokyo.cbdWeight} should exceed ${id} ${other.cbdWeight}`);
    assert.ok(tokyo.highRiseBias > other.highRiseBias, `tokyo highRiseBias ${tokyo.highRiseBias} should exceed ${id} ${other.highRiseBias}`);
  }
});

await check('representative 11-prefecture audit set (Tokyo/Gunma/Saitama/Chiba/Hokkaido/Kanagawa/Aichi/Osaka/Kyoto/Fukuoka/Okinawa) each resolve to a distinct archetype-or-seed combination with no crash', () => {
  const REP = ['tokyo', 'gunma', 'saitama', 'chiba', 'hokkaido', 'kanagawa', 'aichi', 'osaka', 'kyoto', 'fukuoka', 'okinawa'];
  const sigs = REP.map(id => sig(id));
  assert.equal(new Set(sigs).size, REP.length, 'the 11-prefecture audit set should not collide on structural signature');
});

/* =================== DENSITY GUARDRAILS (STEP 17/26) =================== */

await check('every one of the 6 meta-zones (cbd/commercial/residential/premiumResidential/industrial/park) captures at least one block for all 47 prefectures (marker-placement guardrail)', () => {
  for (const id of ALL_PREF_IDS) {
    const d = buildDistrict(id);
    const counts = {};
    for (const zone of Object.values(d.blockZones)) counts[zone] = (counts[zone] || 0) + 1;
    for (const zone of ['cbd', 'commercial', 'residential', 'premiumResidential', 'industrial', 'park']) {
      assert.ok(counts[zone] > 0, `${id}: zone ${zone} captured 0 blocks`);
    }
  }
});

await check('no anomalous full-map degeneracy across all 47 prefectures (never 0 built tiles, never 0 road tiles, never every tile open)', () => {
  for (const id of ALL_PREF_IDS) {
    const d = buildDistrict(id);
    const roadCount = d.tiles.filter(t => t.zone === 'road').length;
    const builtCount = d.tiles.filter(t => t.expectsBuilding).length;
    const openCount = d.tiles.filter(t => t.open).length;
    assert.ok(roadCount > 0, `${id}: 0 road tiles`);
    assert.ok(builtCount > 0, `${id}: 0 built tiles`);
    assert.ok(openCount < d.tiles.length, `${id}: every tile is open space`);
  }
});

/* =================== DETERMINISM (STEP 22/26) =================== */

await check('same prefecture always builds an identical structural signature across repeat builds', () => {
  assert.equal(sig('tokyo'), sig('tokyo'));
});

await check('A -> B -> A prefecture switching reproduces the exact same structural signature for A both times', () => {
  const a1 = sig('saitama');
  sig('chiba');
  const a2 = sig('saitama');
  assert.equal(a1, a2);
});

await check('full 47-prefecture cycle (STEP 21 sweep) is deterministic end to end: rebuilding all 47 twice produces identical signatures in the same order', () => {
  const run1 = ALL_PREF_IDS.map(id => sig(id));
  const run2 = ALL_PREF_IDS.map(id => sig(id));
  assert.deepEqual(run1, run2);
});

/* =================== CAMERA / SCALE (STEP 20/26) =================== */

await check('DEFAULT_SCALE stays 0.44 (PR #611/#612 initial-framing contract, untouched by this pass)', () => {
  assert.match(canvasSrc, /const DEFAULT_SCALE=0\.44;/);
});

await check('worldTransform + clampCameraToContent succeed without throwing for every one of the 47 prefectures at the production DEFAULT_SCALE, for both a desktop and an iPhone viewport', () => {
  for (const id of ALL_PREF_IDS) {
    const d = buildDistrict(id);
    const wt = MW.worldTransform(d, realIndex.tile, 0.44);
    for (const [vw, vh] of [[1280, 800], [390, 844]]) {
      const camera = MW.clampCameraToContent({ x: 0, y: 0 }, wt.transform, d, vw / 0.44, vh / 0.44);
      assert.ok(Number.isFinite(camera.x) && Number.isFinite(camera.y), `${id}: camera clamp produced a non-finite value at ${vw}x${vh}`);
    }
  }
});

/* =================== MARKER REGRESSION (STEP 18/26) =================== */

function freshSandbox() {
  const sandbox = {
    console, devicePixelRatio: 2,
    Promise, Object, Array, Math, JSON, Date, Number, String, Map, Set,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(realManifest) }),
    document: { head: { appendChild() {} }, createElement() { return { set src(v) {} }; } },
    requestAnimationFrame: cb => { cb(); return 1; },
    setTimeout, clearTimeout,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(rendererSrc, sandbox, { filename: 'map-canvas-renderer.js' });
  vm.runInContext(profilesSrc, sandbox, { filename: 'map-prefecture-profiles.js' });
  vm.runInContext(worldSrc, sandbox, { filename: 'map-world-preview.js' });
  sandbox.__capitalismTycoonModules = {};
  vm.runInContext(canvasSrc, sandbox, { filename: 'map-phase2-canvas.js' });
  return sandbox;
}

function fixtureG(prefID) {
  return {
    selectedPref: prefID,
    stores: [],
    tenants: Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, prefID, name: `Tenant ${i}` })),
    rentalOffices: Array.from({ length: 2 }, (_, i) => ({ id: `o${i}`, prefID, name: `Office ${i}` })),
    properties: Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, prefID, name: `Property ${i}`, kind: '商業ビル' })),
  };
}

async function withReadyMod(fn) {
  const sandbox = freshSandbox();
  const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
  const canvas = {
    getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
    getBoundingClientRect: () => ({ width: 1280, height: 800 }),
    parentElement: { querySelectorAll: () => [] },
    width: 0, height: 0, style: {},
  };
  mod.render(canvas, { selectedPref: 'tokyo' });
  await new Promise(resolve => {
    const poll = () => {
      if (mod.placeEntityTiles([], 'tokyo') !== null) return resolve();
      setTimeout(poll, 10);
    };
    setTimeout(poll, 10);
  });
  return fn(mod, canvas);
}

await check('marker placement (4 kinds, 9-entity fixture) stays valid across the STEP 21 prefecture switching sequence -- no exact overlap, all placeable', async () => {
  const SEQUENCE = ['tokyo', 'gunma', 'saitama', 'chiba', 'hokkaido', 'osaka', 'kyoto', 'fukuoka', 'okinawa', 'tokyo'];
  await withReadyMod((mod, canvas) => {
    for (const prefID of SEQUENCE) {
      const g = fixtureG(prefID);
      assert.doesNotThrow(() => mod.render(canvas, g), `render() threw while switching to ${prefID}`);
      const vmResult = mod.buildMapViewModel(g, null);
      assert.equal(vmResult.entities.length, 9, `${prefID}: fixture should always produce 9 raw entities`);
      const placed = mod.placeEntityTiles(vmResult.entities, prefID).filter(e => e.tileX !== null && e.tileY !== null);
      assert.equal(placed.length, 9, `${prefID}: all 9 entities should be placeable`);
      const keys = placed.map(e => `${e.tileX},${e.tileY}`);
      assert.equal(new Set(keys).size, keys.length, `${prefID}: two entities landed on the exact same tile`);
    }
  });
});

await check('selection/filter wiring is untouched by this pass (js/d-ui-shell.js still owns activeEntities/selectedDetail/filter chips)', () => {
  const shellSrc = fs.readFileSync(path.join(ROOT, 'js/d-ui-shell.js'), 'utf8');
  assert.match(shellSrc, /const activeEntities=placed\|\|\[\];/);
  assert.match(shellSrc, /function selectedDetail\(entity,g\)\{/);
  assert.match(shellSrc, /const filterChips=`<div class="d-map-filter-chips">/);
});

/* =================== RNG / SAVE INVARIANTS (STEP 22/32/H) =================== */

await check('no Math.random anywhere in the new profile/geometry files', () => {
  const RNG_CALL = ['Math', 'random'].join('.');
  assert.ok(!worldSrc.includes(RNG_CALL), 'map-world-preview.js must not call Math.random');
  assert.ok(!profilesSrc.includes(RNG_CALL), 'map-prefecture-profiles.js must not call Math.random');
});

await check('no simulation RNG (engine.roll/engine.rng) reference in the new profile/geometry files', () => {
  assert.doesNotMatch(worldSrc, /engine\.roll|engine\.rng/);
  assert.doesNotMatch(profilesSrc, /engine\.roll|engine\.rng/);
});

await check('no save-state reference (SAVE_KEY/saveVersion/localStorage) in the new profile/geometry files', () => {
  assert.doesNotMatch(worldSrc, /SAVE_KEY|saveVersion|localStorage/);
  assert.doesNotMatch(profilesSrc, /SAVE_KEY|saveVersion|localStorage/);
});

await check('SAVE_KEY and saveVersion invariants are untouched (js/engine.js / js/save-v9.js are not part of this pass)', () => {
  assert.match(engineSrc, /const SAVE_KEY = 'capitalism_tycoon_web_v1';/);
  assert.match(saveV9Src, /const SAVE_VERSION=9;/);
});

/* =================== NEGATIVE TESTS (STEP 27) =================== */

await check('NEGATIVE: without prefectureIds filtering, the Tokyo-exclusive landmark would leak into other prefectures (proves the manifest-level fix is load-bearing, not incidental)', () => {
  const unfiltered = JSON.parse(JSON.stringify(realManifest));
  const tower = unfiltered.sprites.find(s => s.id === 'landmark_tokyo_tower');
  assert.ok(tower, 'sanity: landmark_tokyo_tower must exist in the manifest');
  delete tower.prefectureIds;
  const unfilteredIndex = MW.indexCategoryManifest(unfiltered);
  assert.ok(unfilteredIndex.ok);
  let leaked = 0;
  for (const id of ALL_PREF_IDS.filter(x => x !== 'tokyo')) {
    const d = MW.buildWorldDistrict({ index2: unfilteredIndex, prefID: id, cols: WORLD_COLS, rows: WORLD_ROWS });
    const landmark = d.tiles.find(c => c.zone === 'landmark');
    if (landmark && landmark.spriteId === 'landmark_tokyo_tower') leaked++;
  }
  assert.ok(leaked > 0, 'removing prefectureIds should have let the Tokyo tower leak into at least one other prefecture -- otherwise the real fix above is not actually protecting anything');
});

await check('NEGATIVE: forcing every one of the 47 prefectures onto the exact same profile/seed collapses structural signatures to 1 (proves the uniqueness test above has teeth)', () => {
  const fixedProfile = resolveProfile('tokyo');
  const sigs = ALL_PREF_IDS.map(id => MW.structuralLayoutSignature(buildDistrict(id, { profile: fixedProfile })));
  assert.equal(new Set(sigs).size, 1, `expected all 47 to collapse to 1 signature under a forced shared profile, saw ${new Set(sigs).size}`);
});

await check('NEGATIVE: a profile table missing one prefecture fails the coverage check (proves the coverage test above has teeth)', () => {
  const broken = Object.assign({}, PREFECTURE_MAP_PROFILES);
  delete broken.gunma;
  const prefs = readPrefsFromDataJs();
  const dataIds = new Set(prefs.map(p => p.id));
  const missing = [...dataIds].filter(id => !broken[id]);
  assert.deepEqual(missing, ['gunma'], 'deleting one profile entry should be caught as exactly one missing prefecture');
});

await check('NEGATIVE: sprite-ID-only "fake" differentiation (same profile/seed, different prefID) is caught -- structural signature stays identical even though sprite-level flavor differs, proving the signature genuinely excludes sprite choice', () => {
  const fixedProfile = resolveProfile('tokyo');
  const sigTokyo = MW.structuralLayoutSignature(buildDistrict('tokyo', { profile: fixedProfile }));
  const sigGunma = MW.structuralLayoutSignature(buildDistrict('gunma', { profile: fixedProfile }));
  assert.equal(sigTokyo, sigGunma, 'same profile/seed must produce the same structural skeleton regardless of which prefID asked for it');

  const spritesTokyo = buildDistrict('tokyo', { profile: fixedProfile }).tiles.map(t => t.spriteId).filter(Boolean).join(',');
  const spritesGunma = buildDistrict('gunma', { profile: fixedProfile }).tiles.map(t => t.spriteId).filter(Boolean).join(',');
  assert.notEqual(spritesTokyo, spritesGunma, 'sanity: sprite-level flavor should still differ by raw prefID even when the structural profile is forced identical');
});

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
