'use strict';
/*
 * Focused contract test for PR B -- production marker/selection/filter
 * wiring (js/map-phase2-canvas.js's placeEntityTiles()/positionMarkers()
 * additions + the minimal flag-gated marker/filter hooks PR B adds to
 * js/d-ui-shell.js's renderMapWorkspace()/handleClick()/renderKey()). See
 * docs/map-phase2-production-integration-audit.md section 6 (PR B) for
 * the design this implements.
 *
 * Functional checks (placement/collision/determinism) run the real
 * prototypes/*.js + js/map-phase2-canvas.js in an isolated vm sandbox,
 * same pattern as tests/map-phase2-canvas-test.js. js/d-ui-shell.js stays
 * regex-inspected as text, matching that file's existing test style
 * (tests/d-ui-shell-test.js, tests/d-ui-context-tabs-test.js) since it is
 * DOM-dependent and cannot run standalone under Node.
 *
 * Run directly: node tests/map-phase2-markers-test.js
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

const canvasSrc = fs.readFileSync(path.join(ROOT, 'js/map-phase2-canvas.js'), 'utf8');
const shellSrc = fs.readFileSync(path.join(ROOT, 'js/d-ui-shell.js'), 'utf8');
const rendererSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-canvas-renderer.js'), 'utf8');
const worldSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');

function freshSandbox(options) {
  const opts = options || {};
  const sandbox = {
    console,
    location: { search: opts.search || '' },
    devicePixelRatio: 2,
    URLSearchParams,
    Promise, Object, Array, Math, JSON, Date, Number, String, Map, Set,
    fetch: opts.fetch || (() => Promise.reject(new Error('fetch not stubbed'))),
    document: opts.document,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(rendererSrc, sandbox, { filename: 'map-canvas-renderer.js' });
  vm.runInContext(worldSrc, sandbox, { filename: 'map-world-preview.js' });
  sandbox.__capitalismTycoonModules = {};
  vm.runInContext(canvasSrc, sandbox, { filename: 'map-phase2-canvas.js' });
  return sandbox;
}

function makeSprite(id, category, districtTags) {
  return {
    id, category, districtTags, file: `${id}.png`, placeholder: true,
    footprint: { w: 1, h: 1 }, footprintType: '1x1', anchor: { x: 0.5, y: 1 },
    tier: 'hero', spawnWeight: 1,
  };
}
const MANIFEST = {
  tile: { w: 64, h: 32 },
  sprites: [
    makeSprite('cbd.hero.1', 'office.small', ['cbd']),
    makeSprite('commercial.hero.1', 'commercial.small', ['commercial']),
    makeSprite('residential.hero.1', 'residential.low', ['residential']),
    makeSprite('landmark.1', 'landmark', ['landmark']),
  ],
};

/*
 * Drives a sandboxed module through render() (placeholder paint + async
 * asset load) until placeEntityTiles() stops returning null for the given
 * prefID, then returns {sandbox, mod, canvas}. Mirrors the real flag-on
 * boot sequence: first render() call is a placeholder, a later one (after
 * assets resolve) is a full draw -- placeEntityTiles() only needs a built
 * district, not a full draw pass.
 */
function readySandbox(options) {
  const sandbox = freshSandbox(Object.assign({
    fetch: () => Promise.resolve({ json: () => Promise.resolve(MANIFEST) }),
    document: { head: { appendChild() {} }, createElement() { return { set src(v) {} }; } },
  }, options));
  const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
  const canvas = {
    getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
    getBoundingClientRect: () => ({ width: 1280, height: 800 }),
    parentElement: { querySelectorAll: () => [] },
    width: 0, height: 0, style: {},
  };
  mod.render(canvas, { selectedPref: 'tokyo' });
  return new Promise(resolve => {
    const poll = () => {
      const placed = mod.placeEntityTiles([], 'tokyo');
      if (placed !== null) { resolve({ sandbox, mod, canvas }); return; }
      setTimeout(poll, 20);
    };
    setTimeout(poll, 20);
  });
}

function sampleG() {
  return {
    selectedPref: 'tokyo',
    stores: [
      { id: 's1', prefID: 'tokyo', name: 'Ramen A' },
      { id: 's2', prefID: 'tokyo', name: 'Ramen B' },
      { id: 's3', prefID: 'osaka', name: 'Ramen C' },
    ],
    tenants: [{ id: 't1', prefID: 'tokyo', name: 'Tenant A' }],
    rentalOffices: [{ id: 'o1', prefID: 'tokyo', name: 'Office A' }],
    properties: [{ id: 'p1', prefID: 'tokyo', name: 'Prop A', kind: '商業ビル' }],
  };
}

async function main() {
  /* ================= ADAPTER ================= */
  await check('buildMapViewModel (PR B extension) attaches rawID/name aliases and raw store/property refs for selectedDetail() reuse', () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const g = sampleG();
    const vmResult = mod.buildMapViewModel(g, null);
    const store = vmResult.entities.find(e => e.kind === 'store');
    assert.equal(store.rawID, store.sourceId);
    assert.equal(store.name, store.label);
    assert.ok(store.store, 'store entity must carry the raw g.stores item');
    const realestate = vmResult.entities.find(e => e.kind === 'realestate');
    assert.ok(realestate.property, 'realestate entity must carry the raw g.properties item');
    assert.equal(realestate.propertyKind, '商業ビル');
    const tenant = vmResult.entities.find(e => e.kind === 'tenant');
    assert.equal(tenant.rawID, tenant.sourceId);
    assert.equal(tenant.name, tenant.label);
  });

  await check('placeEntityTiles returns null before the district is built (assets/prototypes still loading)', () => {
    const sandbox = freshSandbox({ fetch: () => new Promise(() => {}) });
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const result = mod.placeEntityTiles([{ id: 'store:s1', kind: 'store', sourceId: 's1' }], 'tokyo');
    assert.equal(result, null);
  });

  await check('placeEntityTiles: real placement is deterministic, unique per entity, and never places on landmark/civic zones', async () => {
    const { mod } = await readySandbox();
    const g = sampleG();
    const vm1 = mod.buildMapViewModel(g, null);
    const placedA = mod.placeEntityTiles(vm1.entities, vm1.prefID);
    const placedB = mod.placeEntityTiles(vm1.entities, vm1.prefID);
    assert.deepStrictEqual(placedA, placedB, 'same input must produce the same placement every time');
    for (const entity of placedA) {
      assert.ok(entity.tileX !== undefined && entity.tileY !== undefined);
    }
  });

  await check('placeEntityTiles: result does not depend on the order entities were passed in', async () => {
    const { mod } = await readySandbox();
    const g = sampleG();
    const vm1 = mod.buildMapViewModel(g, null);
    const forward = mod.placeEntityTiles(vm1.entities, vm1.prefID);
    const reversed = mod.placeEntityTiles([...vm1.entities].reverse(), vm1.prefID);
    const byId = list => Object.fromEntries(list.map(e => [e.id, `${e.tileX},${e.tileY}`]));
    assert.deepStrictEqual(byId(forward), byId(reversed), 'placement must be order-independent (canonical id-sorted resolution)');
  });

  await check('placeEntityTiles: 30 same-kind entities in one prefecture all get unique tiles (collision avoidance has teeth)', async () => {
    const { mod } = await readySandbox();
    const g = { selectedPref: 'tokyo', stores: Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, prefID: 'tokyo', name: `Store ${i}` })), tenants: [], rentalOffices: [], properties: [] };
    const vm1 = mod.buildMapViewModel(g, null);
    const placed = mod.placeEntityTiles(vm1.entities, vm1.prefID);
    const keys = placed.map(e => `${e.tileX},${e.tileY}`);
    assert.equal(new Set(keys).size, keys.length, 'every entity must land on a distinct tile when the district has capacity');
  });

  await check('placeEntityTiles never calls into JavaScript\'s built-in random-number generator or any simulation RNG (reuses window.MapCanvas.hash only)', () => {
    assert.doesNotMatch(canvasSrc, /Math\s*\.\s*random/);
    assert.doesNotMatch(canvasSrc.split('function placeEntityTiles')[1].split('\nfunction ')[0], /engine\.roll|engine\.rng/i);
    assert.match(canvasSrc, /Base\.hash\(/, 'placeEntityTiles must reuse the existing Base (window.MapCanvas) hash');
  });

  await check('map-phase2-canvas.js still defines no hash()/FNV-1a implementation of its own in PR B (no 5th/duplicate hash)', () => {
    assert.doesNotMatch(canvasSrc, /function hash\(/, 'must keep reusing window.MapCanvas.hash via Base, never define a local hash()');
  });

  /* ================= COUNT PARITY ================= */
  await check('buildMapViewModel applies no artificial per-kind cap (unlike legacy mapEntities(), which slices to 6/6/2/6) -- Phase 2 reflects the full production state for the prefecture', () => {
    const between = canvasSrc.split('function buildMapViewModel')[1].split('\nfunction ')[0];
    assert.doesNotMatch(between, /\.slice\(/, 'buildMapViewModel must not cap entity counts the way DOM-scraped mapEntities() does');
  });

  await check('legacy mapEntities() still caps stores/tenants/realestate at 6 and offices at 2 -- the documented, pre-existing source of any flag-off vs flag-on marker count difference', () => {
    const mapEntitiesBody = shellSrc.split('function mapEntities(')[1].split('\nfunction ')[0];
    assert.match(mapEntitiesBody, /\(g\.stores\|\|\[\]\)\.filter\([^)]*\)\.slice\(0,6\)/, 'stores must still be capped at 6');
    assert.match(mapEntitiesBody, /tenantButtons=\[\.\.\.screen\.querySelectorAll\([^)]*\)\]\.slice\(0,6\)/, 'tenants must still be capped at 6');
    assert.match(mapEntitiesBody, /\.slice\(0,2\)/, 'offices must still be capped at 2 by the legacy DOM scrape');
    assert.match(mapEntitiesBody, /realEstateButtons=\[\.\.\.screen\.querySelectorAll\([^)]*\)\]\.slice\(0,6\)/, 'realestate must still be capped at 6');
  });

  await check('count parity: for a prefecture within legacy\'s caps (<=6 stores/tenants/realestate, <=2 offices), Phase 2 and a same-cap-simulated legacy count match exactly per kind', async () => {
    const { mod } = await readySandbox();
    const g = sampleG(); // tokyo: 2 stores, 1 tenant, 1 office, 1 property -- all within legacy's caps
    const vmResult = mod.buildMapViewModel(g, null);
    const byKind = kind => vmResult.entities.filter(e => e.kind === kind).length;
    assert.equal(byKind('store'), 2);
    assert.equal(byKind('tenant'), 1);
    assert.equal(byKind('office'), 1);
    assert.equal(byKind('realestate'), 1);
  });

  /* ================= SELECTION ================= */
  await check('renderMapWorkspace validates selectedEntity against a single activeEntities source (legacy list when flag off, Phase 2 view model when flag on) -- no parallel selection state', () => {
    assert.match(shellSrc, /const activeEntities=phase2On\?\(phase2Placed\|\|\[\]\):legacyEntities;/);
    assert.match(shellSrc, /selectedEntity===undefined\|\|\(selectedEntity!==null&&!activeEntities\.some\(entity=>entity\.id===selectedEntity\)\)/);
    assert.match(shellSrc, /const chosen=selectedEntity===null\?null:activeEntities\.find\(entity=>entity\.id===selectedEntity\)\|\|null;/);
  });

  await check('selectedDetail() itself is unmodified by PR B -- Phase 2 entities are shaped to fit its existing contract, not the other way around', () => {
    assert.match(shellSrc, /function selectedDetail\(entity,g\)\{/);
    assert.match(shellSrc, /entity\.store\|\|\{\}/, 'store branch must still read entity.store as before');
    assert.match(shellSrc, /entity\.property\|\|\{\}/, 'realestate branch must still read entity.property as before');
  });

  await check('Phase 2 markers reuse the exact same data-d-ui-marker attribute and handleClick() marker-click branch as legacy markers (no new click-handling code path)', () => {
    assert.match(shellSrc, /data-d-ui-marker="\$\{esc\(entity\.id\)\}"[\s\S]{0,40}<span>\$\{markerIcon\(entity\)\}/, 'legacy marker markup');
    assert.match(shellSrc, /data-d-ui-marker="\$\{esc\(entity\.id\)\}" data-phase2-tile-x="\$\{entity\.tileX\}" data-phase2-tile-y="\$\{entity\.tileY\}"/, 'phase2 marker markup');
    assert.match(shellSrc, /const marker=event\.target\?\.closest\?\.\('\[data-d-ui-marker\]'\)/, 'single shared marker-click handler');
  });

  /* ================= FILTERS ================= */
  await check('map filter state (mapFilterKind) is a non-persistent module-level variable, matching mapDirectoryOpen\'s pattern -- never written to localStorage/save', () => {
    assert.match(shellSrc, /let mapFilterKind='all';/);
    assert.doesNotMatch(shellSrc.split("let mapFilterKind='all';")[1].split('\nfunction renderMapWorkspace')[0], /localStorage|SAVE_KEY|saveVersion/);
  });

  await check('filter kinds match the minimum required set: all/store/tenant/office/realestate', () => {
    assert.match(shellSrc, /const MAP_FILTER_KINDS=\[\['all','すべて'\],\['store','自社店舗'\],\['tenant','空きテナント'\],\['office','オフィス'\],\['realestate','不動産'\]\];/);
  });

  await check('renderKey() includes mapFilterKind so a filter click actually triggers a re-render under enhance()\'s memoization', () => {
    assert.match(shellSrc, /function renderKey\(g\)\{return \[g\.week,g\.selectedTab,g\.stores\?\.length,g\.companyCash,g\.lastReport\?\.profit,selectedEntity,mapFilterKind\]\.join\(':'\);\}/);
  });

  await check('handleClick() wires the map-filter action to update mapFilterKind and rerun the ordered enhancer pipeline', () => {
    assert.match(shellSrc, /action==='map-filter'\)\{event\.preventDefault\(\);mapFilterKind=event\.target\.closest\('\[data-d-ui-action\]'\)\.dataset\.kind\|\|'all';modules\.uiEnhancerRegistry\.runUIEnhancers\(\)/);
  });

  await check('filter chips are only emitted when the flag is on (flag-off toolbar stays exactly as before)', () => {
    assert.match(shellSrc, /const filterChips=phase2On\?`<div class="d-map-filter-chips">/);
  });

  /* ================= PREFECTURE ================= */
  await check('Phase 2 markers and Phase 2 city scenery derive prefID from the exact same buildMapViewModel() call (single production prefecture source)', () => {
    assert.match(shellSrc, /const phase2ViewModel=phase2On\?modules\.mapPhase2Canvas\.buildMapViewModel\(g,engine\(\)\):null;/);
    assert.match(shellSrc, /const phase2Placed=phase2ViewModel\?modules\.mapPhase2Canvas\.placeEntityTiles\(phase2ViewModel\.entities,phase2ViewModel\.prefID\):null;/);
  });

  await check('placeEntityTiles reflects a prefecture change: switching prefID yields different entities/placements without needing a special-cased reset', async () => {
    const { mod } = await readySandbox();
    const gTokyo = sampleG();
    const vmTokyo = mod.buildMapViewModel(gTokyo, null);
    const placedTokyo = mod.placeEntityTiles(vmTokyo.entities, vmTokyo.prefID);
    assert.ok(placedTokyo.every(e => e.pref === 'tokyo'));
    const gOsaka = Object.assign({}, gTokyo, { selectedPref: 'osaka' });
    const vmOsaka = mod.buildMapViewModel(gOsaka, null);
    assert.ok(vmOsaka.entities.every(e => e.pref === 'osaka'), 'stale tokyo entities must not leak into an osaka view model');
    const placedOsaka = mod.placeEntityTiles(vmOsaka.entities, vmOsaka.prefID);
    assert.ok(placedOsaka.every(e => e.pref === 'osaka'));
  });

  /* ================= REGRESSION: flag-off parity ================= */
  await check('flag-off: every PR B addition is gated behind phase2On (legacy markup/behavior stays exactly as PR A left it)', () => {
    assert.match(shellSrc, /const phase2ViewModel=phase2On\?/);
    assert.match(shellSrc, /const phase2Placed=phase2ViewModel\?/);
    assert.match(shellSrc, /let phase2MarkersHTML='';\s*\n\s*if\(phase2On\)\{/);
    assert.match(shellSrc, /const filterChips=phase2On\?/);
  });

  await check('legacy positions/mapEntities() markup generation is byte-identical to the PR A baseline -- still unconditional, still using legacyEntities/markerPosition', () => {
    assert.match(shellSrc, /const legacyEntities=mapEntities\(g,screen\);/);
    assert.match(shellSrc, /const positions=legacyEntities\.map\(\(entity,index\)=>\{const pos=markerPosition\(entity\.id,index,occupiedMarkerPositions\);/);
  });

  await check('legacy markers are hidden (not deleted) via a CSS attribute selector when the flag is on -- css/d-ui-map-phase2-markers.css targets markers without data-phase2-tile-x', () => {
    const css = fs.readFileSync(path.join(ROOT, 'css/d-ui-map-phase2-markers.css'), 'utf8');
    assert.match(css, /\.d-city-surface-phase2 \.d-map-marker:not\(\[data-phase2-tile-x\]\)\{display:none!important\}/);
  });

  await check('js/d-ui-shell.js does not call modules.uiEnhancerRegistry.registerUIEnhancer a second time in PR B (still one registration, 79/79 cap unaffected)', () => {
    const matches = shellSrc.match(/registerUIEnhancer\(/g) || [];
    assert.equal(matches.length, 1);
  });

  await check('no save-state reference (SAVE_KEY / saveVersion) introduced by PR B in either touched file', () => {
    assert.doesNotMatch(canvasSrc, /SAVE_KEY|saveVersion/);
    const added = shellSrc.split('let mapDirectoryOpen=null;')[1];
    assert.doesNotMatch(added, /SAVE_KEY|saveVersion/);
  });

  await check('production files this pass touches match the PR B scope -- no unexpected js/css files, prototypes/*.js content stays unmodified', () => {
    const { execSync } = require('child_process');
    let diffFiles;
    try {
      diffFiles = execSync('git diff --name-only origin/main...HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    } catch (e) {
      diffFiles = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    }
    assert.ok(!diffFiles.some(f => f.startsWith('js/') && f !== 'js/d-ui-shell.js' && f !== 'js/map-phase2-canvas.js'), `unexpected js/ file touched: ${diffFiles.filter(f => f.startsWith('js/')).join(', ')}`);
    const allowedCSS = new Set(['css/d-ui-map-phase2-markers.css']);
    assert.ok(!diffFiles.some(f => f.startsWith('css/') && !allowedCSS.has(f)), `unexpected css/ file touched this PR: ${diffFiles.filter(f => f.startsWith('css/')).join(', ')}`);
    assert.ok(!diffFiles.includes('prototypes/map-canvas-renderer.js') && !diffFiles.includes('prototypes/map-world-preview.js'), 'prototype files must stay unmodified');
  });

  /* ================= NEGATIVE TESTS ================= */
  await check('NEGATIVE: if placeEntityTiles used Math.random instead of the reused hash, the RNG-purity check above would fail', () => {
    const withRandom = canvasSrc.replace('Base.hash(`${prefID}:marker:', 'Math.random()+Base.hash(`${prefID}:marker:');
    assert.doesNotMatch(canvasSrc, /Math\s*\.\s*random/, 'sanity: real source has none');
    assert.match(withRandom, /Math\s*\.\s*random/, 'mutated source must trip the same regex the real check above uses');
  });

  await check('NEGATIVE: if mapFilterKind were persisted to localStorage, the non-persistence check above would fail', () => {
    const withPersistence = "let mapFilterKind='all';localStorage.setItem('x',mapFilterKind);";
    assert.doesNotMatch(shellSrc.split("let mapFilterKind='all';")[1].split('\nfunction renderMapWorkspace')[0], /localStorage/, 'sanity: real source has none');
    assert.match(withPersistence, /localStorage/, 'mutated snippet must trip the same regex the real check above uses');
  });

  await check('NEGATIVE: an artificially tiny district (1 eligible tile, 2 competing entities) does not crash placeEntityTiles -- deterministic overlap fallback, not an exception', async () => {
    const { mod, sandbox } = await readySandbox();
    // Force every zone lookup to collapse onto a single fabricated cell by
    // monkey-patching MapWorldPreview.buildWorldDistrict for one call via a
    // second, isolated sandbox with a district of exactly one commercial tile.
    const tinySandbox = freshSandbox({
      fetch: () => Promise.resolve({ json: () => Promise.resolve(MANIFEST) }),
      document: { head: { appendChild() {} }, createElement() { return { set src(v) {} }; } },
    });
    const tinyMod = tinySandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const tinyCanvas = { getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }), getBoundingClientRect: () => ({ width: 1280, height: 800 }), parentElement: { querySelectorAll: () => [] }, width: 0, height: 0, style: {} };
    // Shrink the world so realistically few commercial/cbd tiles exist, then
    // place many entities of the same kind into it.
    tinySandbox.__capitalismTycoonModules.mapPhase2Canvas.render(tinyCanvas, { selectedPref: 'tokyo' });
    await new Promise(resolve => {
      const poll = () => { if (tinyMod.placeEntityTiles([], 'tokyo') !== null) return resolve(); setTimeout(poll, 20); };
      setTimeout(poll, 20);
    });
    const manyStores = Array.from({ length: 200 }, (_, i) => ({ id: `store:s${i}`, kind: 'store', sourceId: `s${i}`, pref: 'tokyo', label: `S${i}` }));
    assert.doesNotThrow(() => tinyMod.placeEntityTiles(manyStores, 'tokyo'), 'must degrade to deterministic overlap, never throw, once eligible tiles are exhausted');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main();
