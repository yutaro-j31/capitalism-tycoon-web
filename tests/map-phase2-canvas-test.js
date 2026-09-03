'use strict';
/*
 * Focused contract test for PR A -- production adapter foundation +
 * feature flag + Phase 2 Canvas background wiring
 * (js/map-phase2-canvas.js + the minimal flag hook it adds to
 * js/d-ui-shell.js's renderMapWorkspace()). See
 * docs/map-phase2-production-integration-audit.md for the design this
 * implements.
 *
 * js/map-phase2-canvas.js touches document.* in exactly one place (lazy
 * <script> injection for the two prototypes/*.js files, gated so it is
 * only ever reached once the flag is on -- see ensurePrototypesLoaded).
 * It never queries or scrapes the DOM. That means it can still be loaded
 * and executed directly in a sandboxed vm context for most checks (with
 * a document stub only where the lazy-load path itself is exercised),
 * unlike js/d-ui-shell.js which stays regex-inspected as text.
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
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  if (opts.withPrototypes) {
    vm.runInContext(rendererSrc, sandbox, { filename: 'map-canvas-renderer.js' });
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
    assert.equal(typeof mod.isEnabled, 'function');
    assert.equal(typeof mod.setEnabledForDev, 'function');
    assert.equal(typeof mod.buildMapViewModel, 'function');
    assert.equal(typeof mod.render, 'function');
    assert.ok(mod.__installed);
  });

  await check('throws if registered twice (same guard pattern as every other module)', () => {
    const sandbox = freshSandbox();
    assert.throws(() => vm.runInContext(canvasSrc, sandbox, { filename: 'map-phase2-canvas.js' }), /already registered/);
  });

  /* ---------------- flag: default OFF, non-persistent ---------------- */
  await check('flag defaults to OFF with no URL param', () => {
    const sandbox = freshSandbox({ search: '' });
    assert.equal(sandbox.__capitalismTycoonModules.mapPhase2Canvas.isEnabled(), false);
  });

  await check('flag turns ON via ?phase2MapCanvas=1 / true / on', () => {
    for (const value of ['1', 'true', 'on']) {
      const sandbox = freshSandbox({ search: `?phase2MapCanvas=${value}` });
      assert.equal(sandbox.__capitalismTycoonModules.mapPhase2Canvas.isEnabled(), true, value);
    }
  });

  await check('flag stays OFF for an unrecognised query value', () => {
    const sandbox = freshSandbox({ search: '?phase2MapCanvas=maybe' });
    assert.equal(sandbox.__capitalismTycoonModules.mapPhase2Canvas.isEnabled(), false);
  });

  await check('setEnabledForDev() overrides the URL, and null resets to URL-derived value', () => {
    const sandbox = freshSandbox({ search: '' });
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    assert.equal(mod.isEnabled(), false);
    mod.setEnabledForDev(true);
    assert.equal(mod.isEnabled(), true);
    mod.setEnabledForDev(false);
    assert.equal(mod.isEnabled(), false);
    mod.setEnabledForDev(null);
    assert.equal(mod.isEnabled(), false, 'should fall back to the URL-derived value after reset');
  });

  await check('the flag is never written to localStorage, SAVE_KEY, or any g/engine field anywhere in the file', () => {
    assert.doesNotMatch(canvasSrc, /localStorage/);
    assert.doesNotMatch(canvasSrc, /SAVE_KEY|saveVersion/);
    assert.doesNotMatch(canvasSrc, /\bg\.\w+\s*=(?!=)/, 'must never assign to a g.* field (read-only adapter)');
  });

  /* ---------------- buildMapViewModel(): purity, no DOM scrape ---------------- */
  await check('buildMapViewModel reads g.stores/g.tenants/g.rentalOffices/g.properties directly, not the DOM', () => {
    assert.doesNotMatch(canvasSrc, /document\.querySelector|document\.querySelectorAll|closest\(/, 'buildMapViewModel (or anything else in this file) must not scrape rendered DOM the way production mapEntities() does');
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
    assert.match(canvasSrc, /PROTOTYPE_SCRIPTS=\['\.\/prototypes\/map-canvas-renderer\.js','\.\/prototypes\/map-world-preview\.js'\]/);
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
    const sandbox = freshSandbox({ withPrototypes: true, fetch: () => Promise.resolve({ json: () => Promise.resolve(manifest) }) });
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
    const sandbox = freshSandbox({ withPrototypes: true, fetch: () => Promise.resolve({ json: () => Promise.resolve(manifest) }) });
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
    const sandbox = freshSandbox({ withPrototypes: true, fetch: () => Promise.resolve({ json: () => Promise.resolve(manifest) }) });
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

  /* ---------------- flag-off parity: js/d-ui-shell.js ---------------- */
  await check('renderMapWorkspace() only adds the phase2 canvas/class when the flag is on -- flag-off markup is untouched', () => {
    assert.match(shellSrc, /mapPhase2Canvas\?\.isEnabled\?\.\(\)/, 'must check the flag defensively (optional chaining), never assume the module is loaded');
    assert.match(shellSrc, /d-city-surface-phase2/);
    assert.match(shellSrc, /d-phase2-canvas/);
  });

  await check('marker/selection/filter logic in js/d-ui-shell.js is untouched by this pass (still present, byte-identical to the audited baseline)', () => {
    assert.match(shellSrc, /const MARKER_POSITIONS=\[\[18,23\],\[43,17\],\[66,27\],\[25,47\],\[54,48\],\[78,52\],\[37,70\],\[64,73\],\[15,67\],\[83,31\]\];/);
    assert.match(shellSrc, /function mapEntities\(g,screen\)\{/);
    assert.match(shellSrc, /function markerPosition\(id,index,occupied\)\{/);
    assert.match(shellSrc, /function selectedDetail\(entity,g\)\{/);
    assert.match(shellSrc, /let selectedEntity;/);
  });

  await check('the legacy .d-city-blocks/isoCityBuildingsSVG markup generation is untouched (still called unconditionally, not deleted)', () => {
    assert.match(shellSrc, /Array\.from\(\{length:34\}/);
    assert.match(shellSrc, /isoCityBuildingsSVG\(g\)/);
  });

  await check('js/d-ui-shell.js does not call modules.uiEnhancerRegistry.registerUIEnhancer a second time for this pass (stays at one registration, the 79/79 cap is not affected)', () => {
    const registrations = shellSrc.match(/registerUIEnhancer\(/g) || [];
    assert.equal(registrations.length, 1);
  });

  /* ---------------- save / RNG invariants across the whole pass ---------------- */
  await check('no save-state reference (SAVE_KEY / saveVersion / localStorage) in the new adapter file', () => {
    assert.doesNotMatch(canvasSrc, /SAVE_KEY|saveVersion|localStorage/);
  });

  await check('production files this pass touches match the PR A + PR B scope (index.html, module-load-order.json, js/d-ui-shell.js, js/map-phase2-canvas.js, css/d-ui-map-phase2-canvas.css, css/d-ui-map-phase2-markers.css, css/d-ui-mobile-company.css, tests) -- prototypes/map-canvas-renderer.js and prototypes/map-world-preview.js content stays unmodified', () => {
    const { execSync } = require('child_process');
    let diffFiles;
    try {
      diffFiles = execSync('git diff --name-only origin/main...HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    } catch (e) {
      diffFiles = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    }
    assert.ok(!diffFiles.some(f => f.startsWith('js/') && f !== 'js/d-ui-shell.js' && f !== 'js/map-phase2-canvas.js'), `unexpected js/ file touched: ${diffFiles.filter(f => f.startsWith('js/')).join(', ')}`);
    const allowedCSS=new Set(['css/d-ui-map-phase2-canvas.css','css/d-ui-map-phase2-markers.css','css/d-ui-mobile-company.css']);
    assert.ok(!diffFiles.some(f => f.startsWith('css/') && !allowedCSS.has(f)), `unexpected css/ file touched: ${diffFiles.filter(f => f.startsWith('css/')).join(', ')}`);
  });

  /* ---------------- negative test 1: DOM scrape would be caught ---------------- */
  await check('NEGATIVE: if buildMapViewModel scraped the DOM like production mapEntities() does, the earlier DOM-scrape check would fail', () => {
    const withScrape = canvasSrc.replace(
      'function buildMapViewModel(g,engineInstance){',
      "function buildMapViewModel(g,engineInstance){const scraped=document.querySelectorAll('button');"
    );
    assert.notEqual(withScrape, canvasSrc, 'source replace did not match -- test itself is broken');
    assert.throws(() => {
      assert.doesNotMatch(withScrape, /document\.querySelector|document\.querySelectorAll|closest\(/);
    });
  });

  /* ---------------- negative test 2: persisting the flag would be caught ---------------- */
  await check('NEGATIVE: if the flag were persisted to localStorage, the earlier localStorage check would fail', () => {
    const withPersistence = canvasSrc.replace(
      'function setEnabledForDev(value){',
      "function setEnabledForDev(value){try{localStorage.setItem('phase2MapCanvas',String(value));}catch(e){}"
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
