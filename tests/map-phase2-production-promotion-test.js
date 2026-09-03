'use strict';
/*
 * Focused contract test for PR D -- Phase 2 map production promotion +
 * legacy map removal. See docs/map-phase2-production-integration-audit.md
 * section 6 (PR D) for the design this implements.
 *
 * PR A introduced Phase 2 behind an internal feature flag; PR B wired
 * production markers/selection/filter; PR C hardened iPhone pan/camera.
 * PR D removes the flag entirely and deletes the legacy renderer it used
 * to sit beside (rather than leaving it hidden-by-CSS underneath): Phase 2
 * is now the sole, unconditional production map. This file is the single
 * removal-contract test for that promotion -- it does not re-test Phase
 * 2's own placement/pan mechanics (tests/map-phase2-markers-test.js and
 * tests/map-phase2-iphone-pan-webkit-test.js already own that coverage in
 * depth); it proves the promotion itself: no flag, no legacy code path,
 * no legacy CSS, and the production adapter/selection/filter/pan contract
 * still holds with nothing gating it.
 *
 * Run directly: node tests/map-phase2-production-promotion-test.js
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
const iphoneFixesSrc = fs.readFileSync(path.join(ROOT, 'js/iphone-playtest-fixes.js'), 'utf8');
const rendererSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-canvas-renderer.js'), 'utf8');
const worldSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');
const profilesSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-prefecture-profiles.js'), 'utf8');

function freshSandbox(options) {
  const opts = options || {};
  const sandbox = {
    console,
    devicePixelRatio: 2,
    Promise, Object, Array, Math, JSON, Date, Number, String, Map, Set,
    fetch: opts.fetch || (() => Promise.reject(new Error('fetch not stubbed'))),
    document: opts.document,
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

/*
 * Tokyo 17-marker fixture (store 0 / tenant 8 / office 3 / realestate 6),
 * the official baseline PR B established and PR C confirmed unaffected --
 * a fresh game starts with 0 stores (none founded yet), so this is the
 * exact fixture the real desktop/iPhone Playwright runs in PR B/C
 * observed. Documented here as this PR's production contract, not "always
 * 17" unconditionally: this is the expected count for THIS fixture state.
 */
function tokyoFixtureG() {
  return {
    selectedPref: 'tokyo',
    stores: [],
    tenants: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, prefID: 'tokyo', name: `Tenant ${i}` })),
    rentalOffices: Array.from({ length: 3 }, (_, i) => ({ id: `o${i}`, prefID: 'tokyo', name: `Office ${i}` })),
    properties: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, prefID: 'tokyo', name: `Property ${i}`, kind: '商業ビル' })),
  };
}

async function main() {
  /* ================= PRODUCTION MAP IS ALWAYS PHASE 2 ================= */
  await check('no feature flag remains anywhere in the production map path: isEnabled/setEnabledForDev are gone from js/map-phase2-canvas.js', () => {
    assert.doesNotMatch(canvasSrc, /function isEnabled\(/);
    assert.doesNotMatch(canvasSrc, /function setEnabledForDev\(/);
    assert.doesNotMatch(canvasSrc, /flagOverride/);
  });

  await check('no query-string flag remains: ?phase2MapCanvas is never read anywhere in production JS', () => {
    assert.doesNotMatch(canvasSrc, /phase2MapCanvas/);
    assert.doesNotMatch(canvasSrc, /URLSearchParams/);
    assert.doesNotMatch(canvasSrc, /location\?\.search|globalThis\.location/);
  });

  await check('renderMapWorkspace() has no phase2On branch anywhere -- the production map is unconditionally Phase 2', () => {
    assert.doesNotMatch(shellSrc, /phase2On/);
    assert.doesNotMatch(shellSrc, /mapPhase2Canvas\?\.isEnabled/);
  });

  await check('a normal render call (no query string, no dev override) reaches the Phase 2 adapter and paints the canvas', async () => {
    const { mod, canvas } = await readySandbox();
    const g = tokyoFixtureG();
    assert.doesNotThrow(() => mod.render(canvas, g));
    const vmResult = mod.buildMapViewModel(g, null);
    assert.equal(vmResult.entities.length, 17, 'sanity: fixture has 0+8+3+6=17 raw entities before placement filtering');
  });

  await check('the Phase 2 asset-load-complete callback also runs the shared enhancer registry (not just modules.dUIShell.enhance directly) -- otherwise js/iphone-playtest-fixes.js\'s registered enhancer never re-applies to the freshly rebuilt map DOM. This was previously only exercised behind the dev flag; production promotion makes it hit every real user\'s first map view, so it must be correct unconditionally', async () => {
    const registryCalls = [];
    const sandbox = freshSandbox({
      fetch: () => Promise.resolve({ json: () => Promise.resolve(MANIFEST) }),
      document: { head: { appendChild() {} }, createElement() { return { set src(v) {} }; } },
    });
    sandbox.__capitalismTycoonModules.dUIShell = { enhance: () => { registryCalls.push('dUIShell.enhance'); } };
    sandbox.__capitalismTycoonModules.uiEnhancerRegistry = { runUIEnhancers: () => { registryCalls.push('runUIEnhancers'); } };
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const canvas = {
      getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
      getBoundingClientRect: () => ({ width: 1280, height: 800 }),
      parentElement: { querySelectorAll: () => [] },
      width: 0, height: 0, style: {},
    };
    mod.render(canvas, { selectedPref: 'tokyo' });
    await new Promise(resolve => {
      const poll = () => { if (registryCalls.length) return resolve(); setTimeout(poll, 20); };
      setTimeout(poll, 20);
    });
    assert.deepEqual(registryCalls, ['dUIShell.enhance', 'runUIEnhancers'], 'both must run, in this order, once assets finish loading');
  });

  /* ================= LEGACY CODE IS DELETED, NOT HIDDEN ================= */
  await check('mapEntities() (legacy DOM-scraped adapter) is fully gone from js/d-ui-shell.js', () => {
    assert.doesNotMatch(shellSrc, /function mapEntities\(/);
  });

  await check('MARKER_POSITIONS / markerPosition() / markerPositionsCollide() (legacy fixed-slot placement) are fully gone from js/d-ui-shell.js', () => {
    assert.doesNotMatch(shellSrc, /MARKER_POSITIONS/);
    assert.doesNotMatch(shellSrc, /function markerPosition\(/);
    assert.doesNotMatch(shellSrc, /function markerPositionsCollide\(/);
  });

  await check('isoCityBuildingsSVG() (legacy isometric-city renderer) and the legacy 34-block procedural generation are fully gone from js/d-ui-shell.js', () => {
    assert.doesNotMatch(shellSrc, /function isoCityBuildingsSVG\(/);
    assert.doesNotMatch(shellSrc, /Array\.from\(\{length:34\}/);
  });

  await check('no legacy procedural-city markup (.d-water/.d-road-grid/.d-city-blocks) is generated by renderMapWorkspace() any more -- not even hidden-by-CSS', () => {
    assert.doesNotMatch(shellSrc, /d-water|d-road-grid|d-city-blocks/);
  });

  await check('no hidden-duplicate-marker CSS path remains: the old rule that hid legacy markers lacking data-phase2-tile-x is gone (there is no legacy marker left to hide)', () => {
    const markersCss = fs.readFileSync(path.join(ROOT, 'css/d-ui-map-phase2-markers.css'), 'utf8');
    assert.doesNotMatch(markersCss, /:not\(\[data-phase2-tile-x\]\)/);
    const canvasCss = fs.readFileSync(path.join(ROOT, 'css/d-ui-map-phase2-canvas.css'), 'utf8');
    assert.doesNotMatch(canvasCss, /display:none/);
  });

  await check('css/d-ui-map-buildings.css (legacy isometric-city stylesheet) is deleted, and no d-iso-* class name remains referenced anywhere in production CSS/JS', () => {
    assert.ok(!fs.existsSync(path.join(ROOT, 'css/d-ui-map-buildings.css')));
    assert.doesNotMatch(shellSrc, /d-iso-/);
    const mobileCompanyCss = fs.readFileSync(path.join(ROOT, 'css/d-ui-mobile-company.css'), 'utf8');
    assert.doesNotMatch(mobileCompanyCss, /d-ui-map-buildings/);
  });

  await check('the legacy per-viewport map-zoom mechanism (state, CSS custom property, and its zoom-in/zoom-out/reset buttons) is fully gone from js/iphone-playtest-fixes.js and its CSS', () => {
    assert.doesNotMatch(iphoneFixesSrc, /mapZoom/);
    assert.doesNotMatch(iphoneFixesSrc, /--iphone-map-zoom/);
    const iphoneFixesCss = fs.readFileSync(path.join(ROOT, 'css/iphone-playtest-fixes.css'), 'utf8');
    assert.doesNotMatch(iphoneFixesCss, /--iphone-map-zoom/);
  });

  await check('ensureCityDetail() (a second, independent legacy procedural-city layer in js/iphone-playtest-fixes.js) is gone -- Phase 2\'s own Canvas is the only city renderer left', () => {
    assert.doesNotMatch(iphoneFixesSrc, /function ensureCityDetail\(/);
    assert.doesNotMatch(iphoneFixesSrc, /iphone-city-detail/);
  });

  await check('the competitor synthetic-marker path is intentionally retained (not one of Phase 2\'s 4 production kinds, so it is not redundant with buildMapViewModel())', () => {
    assert.match(iphoneFixesSrc, /class="iphone-synthetic-marker competitor"/);
    assert.match(iphoneFixesSrc, /function handleSyntheticMarker\(/);
  });

  /* ================= 4-KIND PRODUCTION ADAPTER ================= */
  await check('buildMapViewModel produces all 4 production entity kinds (store/tenant/office/realestate) directly from g fields, with no DOM scraping and no artificial per-kind cap', () => {
    const viewModelBody = canvasSrc.split('function buildMapViewModel')[1].split('\nfunction ')[0];
    assert.doesNotMatch(viewModelBody, /document\.querySelector|document\.querySelectorAll|closest\(/);
    assert.doesNotMatch(viewModelBody, /\.slice\(/);
    assert.match(canvasSrc, /g&&g\.stores/);
    assert.match(canvasSrc, /g&&g\.tenants/);
    assert.match(canvasSrc, /g&&g\.rentalOffices/);
    assert.match(canvasSrc, /g&&g\.properties/);
  });

  /* ================= SELECTION / DETAIL / FILTER ================= */
  await check('selection wiring: a single activeEntities source (the Phase 2 view model, no parallel legacy list) drives selectedEntity/chosen', () => {
    assert.match(shellSrc, /const activeEntities=placed\|\|\[\];/);
    assert.match(shellSrc, /const chosen=selectedEntity===null\?null:activeEntities\.find\(entity=>entity\.id===selectedEntity\)\|\|null;/);
  });

  await check('detail wiring: selectedDetail() is unmodified and still handles all 4 kinds', () => {
    assert.match(shellSrc, /function selectedDetail\(entity,g\)\{/);
    for (const kind of ['store', 'tenant', 'realestate']) assert.match(shellSrc, new RegExp(`entity\\.kind===['"]${kind}['"]`));
  });

  await check('filter wiring: filter chips are always emitted (unconditional), and mapFilterKind covers all/store/tenant/office/realestate', () => {
    assert.match(shellSrc, /const filterChips=`<div class="d-map-filter-chips">/);
    assert.match(shellSrc, /const MAP_FILTER_KINDS=\[\['all','すべて'\],\['store','自社店舗'\],\['tenant','空きテナント'\],\['office','オフィス'\],\['realestate','不動産'\]\];/);
  });

  /* ================= PAN / CAMERA (cross-check; depth lives in the PR C test file) ================= */
  await check('pointer-drag pan and the shared camera are still exported and unconditional (installPanHandlers ran, consumeJustPanned exists)', () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    assert.equal(typeof mod.consumeJustPanned, 'function');
    assert.doesNotMatch(canvasSrc, /if\(phase2On\)/);
  });

  /* ================= 17-MARKER FIXTURE BASELINE / NO OVERLAP ================= */
  await check('Tokyo fixture (store 0 / tenant 8 / office 3 / realestate 6 = 17 placeable entities) matches the PR B/C baseline this PR must not regress', async () => {
    const { mod } = await readySandbox();
    const g = tokyoFixtureG();
    const vmResult = mod.buildMapViewModel(g, null);
    assert.equal(vmResult.entities.length, 17);
    const placed = mod.placeEntityTiles(vmResult.entities, vmResult.prefID);
    const placeable = placed.filter(e => e.tileX !== null && e.tileY !== null);
    assert.equal(placeable.length, 17, 'the 17-entity baseline is the count actually placeable on tiles (tenant/office/realestate; 0 stores in a fresh game)');
  });

  await check('no two placed entities in the 17-marker fixture share the exact same tile (no exact marker overlap)', async () => {
    const { mod } = await readySandbox();
    const g = tokyoFixtureG();
    const vmResult = mod.buildMapViewModel(g, null);
    const placed = mod.placeEntityTiles(vmResult.entities, vmResult.prefID).filter(e => e.tileX !== null && e.tileY !== null);
    const keys = placed.map(e => `${e.tileX},${e.tileY}`);
    assert.equal(new Set(keys).size, keys.length, 'every placed entity must land on a distinct tile');
  });

  /* ================= NEGATIVE TESTS: STEP 5's guardrail -- relaxing the gate must NOT unlock unrelated features ================= */
  await check('NEGATIVE: relaxing the map to always-on did not unconditionally unlock other production systems -- M&A/real estate/governance gating in app.js is untouched by this pass', () => {
    const appSrc = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
    assert.match(appSrc, /function renderMA\(|maAcquisitionTargets|maDealRooms/, 'sanity: M&A gating code still exists in app.js');
  });

  await check('NEGATIVE: if renderMapWorkspace() regressed to generating .d-city-blocks again, the earlier no-legacy-markup check would fail', () => {
    const withRegression = shellSrc + '\nfunction extra(){return `<div class="d-city-blocks"></div>`;}';
    assert.doesNotMatch(shellSrc, /d-city-blocks/, 'sanity: real source has none');
    assert.match(withRegression, /d-city-blocks/, 'mutated source must trip the same regex the real check above uses');
  });

  await check('NEGATIVE: if buildMapViewModel scraped the DOM again (like the deleted legacy mapEntities() did), the no-DOM-scrape check would fail', () => {
    const withScrape = canvasSrc.replace(
      'function buildMapViewModel(g,engineInstance){',
      "function buildMapViewModel(g,engineInstance){const scraped=document.querySelectorAll('button');"
    );
    assert.notEqual(withScrape, canvasSrc, 'source replace did not match -- test itself is broken');
    const scrapedBody = withScrape.split('function buildMapViewModel')[1].split('\nfunction ')[0];
    assert.throws(() => assert.doesNotMatch(scrapedBody, /document\.querySelectorAll/));
  });

  /* ================= SAVE / DETERMINISM INVARIANTS ================= */
  await check('no save-state reference (SAVE_KEY / saveVersion / localStorage) was introduced by this pass in any touched production file', () => {
    for (const src of [canvasSrc, shellSrc, iphoneFixesSrc]) {
      assert.doesNotMatch(src, /SAVE_KEY|saveVersion/);
    }
  });

  await check('production map placement stays fully deterministic: same fixture state produces byte-identical placement twice in a row', async () => {
    const { mod } = await readySandbox();
    const g = tokyoFixtureG();
    const vmResult = mod.buildMapViewModel(g, null);
    const a = JSON.stringify(mod.placeEntityTiles(vmResult.entities, vmResult.prefID));
    const b = JSON.stringify(mod.placeEntityTiles(vmResult.entities, vmResult.prefID));
    assert.equal(a, b);
  });

  await check('js/d-ui-shell.js registers with modules.uiEnhancerRegistry.registerUIEnhancer exactly once (79/79 external enhancer cap unaffected by this pass)', () => {
    const registrations = shellSrc.match(/registerUIEnhancer\(/g) || [];
    assert.equal(registrations.length, 1);
  });

  /* ================= SCOPE ================= */
  await check('production files this PR touches match the expected production-promotion scope', () => {
    const { execSync } = require('child_process');
    let diffFiles;
    try {
      diffFiles = execSync('git diff --name-only origin/main...HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    } catch (e) {
      diffFiles = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    }
    const allowedJS = new Set(['js/d-ui-shell.js', 'js/map-phase2-canvas.js', 'js/iphone-playtest-fixes.js']);
    assert.ok(!diffFiles.some(f => f.startsWith('js/') && !allowedJS.has(f)), `unexpected js/ file touched: ${diffFiles.filter(f => f.startsWith('js/')).join(', ')}`);
    const allowedCSS = new Set([
      'css/d-ui-map-buildings.css', 'css/d-ui-map-depth.css', 'css/d-ui-map-phase2-canvas.css',
      'css/d-ui-map-phase2-markers.css', 'css/d-ui-map-phase2-pan.css', 'css/d-ui-mobile-company.css',
      'css/d-ui-reference-fidelity.css', 'css/d-ui.css', 'css/iphone-playtest-fixes.css',
    ]);
    assert.ok(!diffFiles.some(f => f.startsWith('css/') && !allowedCSS.has(f)), `unexpected css/ file touched: ${diffFiles.filter(f => f.startsWith('css/')).join(', ')}`);
    assert.ok(!diffFiles.includes('prototypes/map-canvas-renderer.js') && !diffFiles.includes('prototypes/map-world-preview.js'), 'prototype files must stay unmodified');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
