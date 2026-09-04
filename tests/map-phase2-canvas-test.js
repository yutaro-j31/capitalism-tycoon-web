'use strict';
/*
 * Focused contract test for the Phase 2 production adapter foundation
 * (js/map-phase2-canvas.js's buildMapViewModel/placeEntityTiles/render).
 * See docs/map-phase2-production-integration-audit.md for the design this
 * implements.
 *
 * Originally written for PR A (introduced the feature flag) and extended
 * through PR C (pan). PR D (production promotion) removed the flag
 * entirely -- Phase 2 is now the sole map renderer -- so this file's old
 * isEnabled()/setEnabledForDev()/query-flag/flag-off-parity checks were
 * removed along with the code they tested; that removal-contract coverage
 * (no flag, no legacy renderer, always-on Phase 2) now lives in
 * tests/map-phase2-production-promotion-test.js. What remains here is the
 * adapter's own foundational behavior, unaffected by the promotion: pure
 * view-model construction, no DOM scraping, no 4th hash implementation,
 * and render()'s DPR/prefecture-switching/degrade-gracefully contract.
 *
 * js/map-phase2-canvas.js touches document.* in exactly one place (lazy
 * <script> injection for the two prototypes/*.js files -- see
 * ensurePrototypesLoaded). It never queries or scrapes the DOM. That means
 * it can still be loaded and executed directly in a sandboxed vm context
 * for most checks, unlike js/d-ui-shell.js which stays regex-inspected as
 * text.
 *
 * Run directly: node tests/map-phase2-canvas-test.js
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
const profilesSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-prefecture-profiles.js'), 'utf8');

/*
 * Loads js/map-phase2-canvas.js into a fresh, isolated sandbox each time
 * -- NOT Node's own global object -- so tests can't leak state (the
 * module-level asset/district caches) between checks. Optionally also
 * loads the two prototype files first (as real browser globals, the
 * `root.MapCanvas`/`root.MapWorldPreview` branch) when a test needs the
 * real rendering path.
 */
function freshSandbox(options) {
  const opts = options || {};
  const sandbox = {
    console,
    location: { search: opts.search || '' },
    devicePixelRatio: 2,
    URLSearchParams,
    Promise, Object, Array, Math, JSON, Date,
    fetch: opts.fetch || (() => Promise.reject(new Error('fetch not stubbed'))),
    setTimeout, clearTimeout,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  if (opts.withPrototypes) {
    vm.runInContext(rendererSrc, sandbox, { filename: 'map-canvas-renderer.js' });
    vm.runInContext(profilesSrc, sandbox, { filename: 'map-prefecture-profiles.js' });
    vm.runInContext(worldSrc, sandbox, { filename: 'map-world-preview.js' });
  }
  sandbox.__capitalismTycoonModules = {};
  vm.runInContext(canvasSrc, sandbox, { filename: 'map-phase2-canvas.js' });
  return sandbox;
}

function sampleState() {
  return {
    selectedPref: 'tokyo',
    founderHomePrefID: 'osaka',
    stores: [
      { id: 's1', prefID: 'tokyo', name: 'Ramen A', businessID: 'ramen' },
      { id: 's2', prefID: 'osaka', name: 'Ramen B' },
    ],
    tenants: [{ id: 't1', prefID: 'tokyo', name: 'Tenant A' }],
    rentalOffices: [{ id: 'o1', prefID: 'tokyo', name: 'Office A' }],
    properties: [{ id: 'p1', prefID: 'tokyo', name: 'Prop A' }],
  };
}

function stubCtx(calls) {
  return {
    setTransform() { calls.setTransform = (calls.setTransform || 0) + 1; },
    clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    stroke() {}, ellipse() {}, arc() {}, setLineDash() {}, fillText() {}, fill() {},
    drawImage() { calls.drawImage = (calls.drawImage || 0) + 1; },
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '',
  };
}
function stubCanvas(calls) {
  return {
    width: 0, height: 0, style: {},
    getContext: () => stubCtx(calls),
    getBoundingClientRect: () => ({ width: 1280, height: 680 }),
  };
}

async function main() {
  /* ---------------- registration / shape ---------------- */
  await check('registers modules.mapPhase2Canvas with the expected pure API', () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    assert.ok(mod, 'not registered');
    assert.equal(typeof mod.buildMapViewModel, 'function');
    assert.equal(typeof mod.placeEntityTiles, 'function');
    assert.equal(typeof mod.render, 'function');
    assert.equal(typeof mod.consumeJustPanned, 'function');
    assert.ok(mod.__installed);
  });

  await check('no feature flag remains: isEnabled/setEnabledForDev are gone from the module\'s public API (production promotion removed them)', () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    assert.equal(mod.isEnabled, undefined);
    assert.equal(mod.setEnabledForDev, undefined);
  });

  await check('throws if registered twice (same guard pattern as every other module)', () => {
    const sandbox = freshSandbox();
    assert.throws(() => vm.runInContext(canvasSrc, sandbox, { filename: 'map-phase2-canvas.js' }), /already registered/);
  });

  await check('never persists anything to localStorage, SAVE_KEY, saveVersion, or any g/engine field anywhere in the file (read-only adapter)', () => {
    assert.doesNotMatch(canvasSrc, /localStorage/);
    assert.doesNotMatch(canvasSrc, /SAVE_KEY|saveVersion/);
    assert.doesNotMatch(canvasSrc, /\bg\.\w+\s*=(?!=)/, 'must never assign to a g.* field (read-only adapter)');
  });

  /* ---------------- buildMapViewModel(): purity, no DOM scrape ---------------- */
  await check('buildMapViewModel reads g.stores/g.tenants/g.rentalOffices/g.properties directly, not the DOM', () => {
    /*
     * Scoped to buildMapViewModel()'s own body, not the whole file: PR C
     * legitimately adds document.querySelector/event.target.closest calls
     * elsewhere in this file (pan pointer-event delegation, resize
     * handling) -- pure UI event-target lookups, not scraping production
     * entity data out of rendered HTML the way legacy mapEntities() does.
     * buildMapViewModel() itself must still never touch the DOM at all.
     */
    const viewModelBody = canvasSrc.split('function buildMapViewModel')[1].split('\nfunction ')[0];
    assert.doesNotMatch(viewModelBody, /document\.querySelector|document\.querySelectorAll|closest\(/, 'buildMapViewModel must not scrape rendered DOM the way production mapEntities() does');
    assert.match(canvasSrc, /g&&g\.stores/);
    assert.match(canvasSrc, /g&&g\.tenants/);
    assert.match(canvasSrc, /g&&g\.rentalOffices/);
    assert.match(canvasSrc, /g&&g\.properties/);
  });

  await check('buildMapViewModel filters entities to the current prefecture and normalises to {id,kind,sourceId,pref,label}', () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const vmResult = mod.buildMapViewModel(sampleState(), null);
    assert.equal(vmResult.prefID, 'tokyo');
    assert.equal(vmResult.entities.length, 4, 'osaka store should be filtered out');
    for (const entity of vmResult.entities) {
      assert.equal(entity.pref, 'tokyo');
      assert.ok(['store', 'tenant', 'office', 'realestate'].includes(entity.kind));
      assert.ok(entity.id.startsWith(`${entity.kind}:`));
      assert.equal(typeof entity.sourceId, 'string');
      assert.equal(typeof entity.label, 'string');
    }
  });

  await check('buildMapViewModel resolves store labels via engine.business() when store.name is absent', () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const g = { selectedPref: 'tokyo', stores: [{ id: 's1', prefID: 'tokyo', businessID: 'ramen' }] };
    const fakeEngine = { business: id => (id === 'ramen' ? { name: 'ラーメン店' } : null) };
    const result = mod.buildMapViewModel(g, fakeEngine);
    assert.equal(result.entities[0].label, 'ラーメン店');
  });

  await check('buildMapViewModel is pure: never mutates the state object it is given', () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const g = sampleState();
    const before = JSON.stringify(g);
    mod.buildMapViewModel(g, null);
    mod.buildMapViewModel(g, null);
    assert.equal(JSON.stringify(g), before);
  });

  await check('buildMapViewModel is deterministic: same input always produces the same output', () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const g = sampleState();
    const a = JSON.stringify(mod.buildMapViewModel(g, null));
    const b = JSON.stringify(mod.buildMapViewModel(g, null));
    assert.equal(a, b);
  });

  await check('buildMapViewModel does not require a prefecture (falls back to including everything)', () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const g = { stores: [{ id: 's1', prefID: 'tokyo' }, { id: 's2', prefID: 'osaka' }] };
    const result = mod.buildMapViewModel(g, null);
    assert.equal(result.prefID, null);
    assert.equal(result.entities.length, 2);
  });

  /* ---------------- RNG / determinism invariants ---------------- */
  await check('no Math.random anywhere in the new adapter file', () => {
    assert.ok(!canvasSrc.includes(['Math', 'random'].join('.')));
  });

  await check('no simulation RNG consumed: the file never calls into engine.roll/engine.rng or similar', () => {
    assert.doesNotMatch(canvasSrc, /engine\.roll|engine\.rng|\.random\(/i);
  });

  /* ---------------- production reuse: no 4th hash/placement implementation ---------------- */
  await check("map-phase2-canvas.js defines no hash()/FNV-1a implementation of its own -- it must reuse window.MapCanvas/MapWorldPreview's existing one", () => {
    assert.doesNotMatch(canvasSrc, /function hash\s*\(/);
    assert.doesNotMatch(canvasSrc, /2166136261/, 'FNV-1a offset basis constant should not be re-implemented here');
  });

  await check('map-phase2-canvas.js references window.MapCanvas / window.MapWorldPreview rather than copy-pasting renderer logic', () => {
    assert.match(canvasSrc, /globalThis\.MapCanvas/);
    assert.match(canvasSrc, /globalThis\.MapWorldPreview/);
  });

  await check('prototypes/map-canvas-renderer.js and prototypes/map-world-preview.js are lazy-loaded via <script> injection, not static <script> tags in index.html (they live under prototypes/, not js/, and tests/javascript-module-split-test.js treats index.html as an exact 1:1 inventory of js/*.js)', () => {
    assert.match(canvasSrc, /PROTOTYPE_SCRIPTS=\['\.\/prototypes\/map-canvas-renderer\.js','\.\/prototypes\/map-prefecture-profiles\.js','\.\/prototypes\/map-world-preview\.js'\]/);
    assert.match(canvasSrc, /document\.createElement\('script'\)/);
    const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.doesNotMatch(indexSrc, /<script src="\.\/prototypes\//, 'prototypes/*.js must not be added as static <script> tags in index.html');
    assert.match(indexSrc, /<script src="\.\/js\/map-phase2-canvas\.js">/);
  });

  /* ---------------- render(): draws without throwing, degrades gracefully ---------------- */
  await check('render() with missing canvas/Base/MW does not throw (defensive no-op)', () => {
    const sandbox = freshSandbox({ withPrototypes: false });
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    assert.doesNotThrow(() => mod.render(null, {}));
    assert.doesNotThrow(() => mod.render(stubCanvas({}), {}));
  });

  await check('render() applies the DPR clamp (max 2) via the shared sizeCanvas/resolveDpr from window.MapCanvas', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/map-sprites/phase2/sprites.json'), 'utf8'));
    const sandbox = freshSandbox({ withPrototypes: true, fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) }) });
    sandbox.devicePixelRatio = 3; // above the MAX_DPR=2 clamp
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const calls = {};
    const canvas = stubCanvas(calls);
    mod.render(canvas, { selectedPref: 'tokyo' });
    assert.equal(canvas.width, 1280 * 2, 'width should reflect the clamped DPR (2), not the raw devicePixelRatio (3)');
    assert.equal(canvas.height, 680 * 2);
  });

  await check('render() paints a placeholder fill (no throw, no white screen) before sprite assets finish loading, and completes a full draw pass once they do', async () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/map-sprites/phase2/sprites.json'), 'utf8'));
    const sandbox = freshSandbox({ withPrototypes: true, fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) }) });
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const calls = {};
    const canvas = stubCanvas(calls);
    assert.doesNotThrow(() => mod.render(canvas, { selectedPref: 'tokyo' }));
    assert.ok(calls.setTransform >= 1, 'placeholder pass should still touch the canvas');
    await new Promise(resolve => setTimeout(resolve, 300));
    const callsBefore = calls.setTransform;
    assert.doesNotThrow(() => mod.render(canvas, { selectedPref: 'tokyo' }));
    assert.ok(calls.setTransform > callsBefore, 'second render should be the real draw pass, not another placeholder-only pass');
  });

  /* ---------------- prefecture switching ---------------- */
  await check('render() rebuilds the district only when the resolved prefecture actually changes', async () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/map-sprites/phase2/sprites.json'), 'utf8'));
    const sandbox = freshSandbox({ withPrototypes: true, fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) }) });
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const canvas = stubCanvas({});
    mod.render(canvas, { selectedPref: 'tokyo' }); // placeholder pass: kicks off async load, builds nothing yet
    await new Promise(resolve => setTimeout(resolve, 300));
    mod.render(canvas, { selectedPref: 'tokyo' }); // first real draw pass: primes the district cache (builds once, unavoidably)
    const MW = sandbox.MapWorldPreview;
    const originalBuild = MW.buildWorldDistrict;
    let buildCount = 0;
    MW.buildWorldDistrict = (...args) => { buildCount++; return originalBuild(...args); };
    mod.render(canvas, { selectedPref: 'tokyo' });
    mod.render(canvas, { selectedPref: 'tokyo' });
    assert.equal(buildCount, 0, 'same prefecture as the already-cached one: must not rebuild the district');
    mod.render(canvas, { selectedPref: 'osaka' });
    assert.equal(buildCount, 1, 'prefecture change: must rebuild exactly once');
    MW.buildWorldDistrict = originalBuild;
  });

  /* ---------------- js/d-ui-shell.js: still the only production caller ---------------- */
  await check('renderMapWorkspace() always renders the Phase 2 canvas/class -- there is no flag branch left to check', () => {
    assert.doesNotMatch(shellSrc, /mapPhase2Canvas\?\.isEnabled\?\.\(\)/, 'the flag check itself must be gone');
    assert.match(shellSrc, /d-city-surface-phase2/);
    assert.match(shellSrc, /d-phase2-canvas/);
    assert.match(shellSrc, /modules\.mapPhase2Canvas\.buildMapViewModel\(g,engine\(\)\)/);
    assert.match(shellSrc, /modules\.mapPhase2Canvas\.render\(workspace\.querySelector\('\.d-phase2-canvas'\),g\)/);
  });

  await check('selectedDetail()/selection state in js/d-ui-shell.js are untouched by production promotion (still present, still the sole selection/detail contract)', () => {
    assert.match(shellSrc, /function selectedDetail\(entity,g\)\{/);
    assert.match(shellSrc, /let selectedEntity;/);
  });

  await check('js/d-ui-shell.js registers with modules.uiEnhancerRegistry.registerUIEnhancer exactly once (the 79/79 cap is not affected by production promotion)', () => {
    const registrations = shellSrc.match(/registerUIEnhancer\(/g) || [];
    assert.equal(registrations.length, 1);
  });

  /* ---------------- save / RNG invariants across the whole pass ---------------- */
  await check('no save-state reference (SAVE_KEY / saveVersion / localStorage) in the new adapter file', () => {
    assert.doesNotMatch(canvasSrc, /SAVE_KEY|saveVersion|localStorage/);
  });

  // Note: this file's own "production files this pass touches match the
  // PR scope" git-diff check was removed here -- it was written for PR A +
  // PR B's small diff and no longer describes reality once PR D's much
  // larger production-promotion diff lands on the same branch. The current
  // PR's own scope check lives in tests/map-phase2-production-promotion-
  // test.js instead, with its own up-to-date allowed-file list.

  /* ---------------- negative test 1: DOM scrape would be caught ---------------- */
  await check('NEGATIVE: if buildMapViewModel scraped the DOM like production mapEntities() does, the earlier DOM-scrape check would fail', () => {
    const withScrape = canvasSrc.replace(
      'function buildMapViewModel(g,engineInstance){',
      "function buildMapViewModel(g,engineInstance){const scraped=document.querySelectorAll('button');"
    );
    assert.notEqual(withScrape, canvasSrc, 'source replace did not match -- test itself is broken');
    const scrapedViewModelBody = withScrape.split('function buildMapViewModel')[1].split('\nfunction ')[0];
    assert.throws(() => {
      assert.doesNotMatch(scrapedViewModelBody, /document\.querySelector|document\.querySelectorAll|closest\(/);
    });
  });

  /* ---------------- negative test 2: persisting adapter state would be caught ---------------- */
  await check('NEGATIVE: if buildMapViewModel wrote to localStorage, the earlier no-persistence check would fail', () => {
    const withPersistence = canvasSrc.replace(
      'function buildMapViewModel(g,engineInstance){',
      "function buildMapViewModel(g,engineInstance){try{localStorage.setItem('phase2MapCanvas','1');}catch(e){}"
    );
    assert.notEqual(withPersistence, canvasSrc, 'source replace did not match -- test itself is broken');
    assert.throws(() => {
      assert.doesNotMatch(withPersistence, /localStorage/);
    });
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
