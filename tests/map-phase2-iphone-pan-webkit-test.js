'use strict';
/*
 * Focused contract test for PR C -- Phase 2 iPhone pan / camera
 * synchronization / WebKit hardening (js/map-phase2-canvas.js's camera
 * persistence + pointer-drag pan additions, plus the one-line justPanned
 * check PR C adds to js/d-ui-shell.js's handleClick()). See
 * docs/map-phase2-production-integration-audit.md section 6 (PR C).
 *
 * Functional pan/camera checks drive the real prototypes/*.js +
 * js/map-phase2-canvas.js in an isolated vm sandbox with a minimal but
 * real EventTarget-shaped document stub (addEventListener/dispatch), so
 * pointerdown/move/up are genuinely dispatched through
 * installPanHandlers()'s actual delegated listeners -- not simulated by
 * calling internal functions directly (there are none exported to call).
 * js/d-ui-shell.js stays regex-inspected as text, matching this file's
 * existing test style.
 *
 * Run directly: node tests/map-phase2-iphone-pan-webkit-test.js
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
const panCss = fs.readFileSync(path.join(ROOT, 'css/d-ui-map-phase2-pan.css'), 'utf8');
const rendererSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-canvas-renderer.js'), 'utf8');
const worldSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');
const profilesSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-prefecture-profiles.js'), 'utf8');

/* ---------------- minimal but real EventTarget-shaped document stub ---------------- */
function makeDocumentStub() {
  const listeners = new Map();
  return {
    addEventListener(type, fn, capture) {
      const key = `${type}:${capture ? 1 : 0}`;
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(fn);
    },
    removeEventListener(type, fn, capture) {
      listeners.get(`${type}:${capture ? 1 : 0}`)?.delete(fn);
    },
    dispatch(type, evt) {
      for (const fn of listeners.get(`${type}:1`) || []) fn(evt);
      for (const fn of listeners.get(`${type}:0`) || []) fn(evt);
    },
    listenerCount(type, capture) {
      return (listeners.get(`${type}:${capture ? 1 : 0}`) || new Set()).size;
    },
    head: { appendChild() {} },
    createElement() { return { set src(v) {} }; },
    querySelector() { return null; },
  };
}
function makeCanvasMock() {
  const calls = { setCapture: 0, releaseCapture: 0 };
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
  const el = {
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 1280, height: 800 }),
    parentElement: { querySelectorAll: () => [] },
    width: 0, height: 0, style: {},
    setPointerCapture() { calls.setCapture++; },
    releasePointerCapture() { calls.releaseCapture++; },
    // A pointerdown targeting the canvas itself: closest() finds both the
    // canvas class (walking zero steps) and the shared phase2 container
    // (walking up), and querySelector() re-finds itself from that container
    // -- matching how onPointerDown() in production resolves the canvas via
    // event.target.closest('.d-city-surface-phase2').querySelector('.d-phase2-canvas').
    closest(sel) { return (sel === '.d-phase2-canvas' || sel === '.d-city-surface-phase2') ? el : null; },
    querySelector(sel) { return sel === '.d-phase2-canvas' ? el : null; },
    __calls: calls,
  };
  return el;
}
// A pointerdown target shaped like a Phase 2 marker button: a DOM sibling of
// the canvas (both children of .d-city-surface-phase2), not a descendant of
// it -- so closest('.d-phase2-canvas') must fail, but closest('.d-city-
// surface-phase2') must still resolve to the shared container that can
// locate the real canvas via querySelector. Used to prove STEP 7's "drag
// starting on top of a 44px marker" requirement: production's onPointerDown()
// must not gate on the canvas alone, or a drag starting on a marker would
// never begin.
function makeMarkerTarget(canvas) {
  return {
    closest(sel) {
      if (sel !== '.d-city-surface-phase2') return null;
      return { querySelector(s) { return s === '.d-phase2-canvas' ? canvas : null; } };
    },
  };
}
function nonCanvasTarget() { return { closest() { return null; } }; }

function freshSandbox(options) {
  const opts = options || {};
  let rafCalls = 0;
  const sandbox = {
    console,
    location: { search: opts.search || '' },
    devicePixelRatio: 1,
    URLSearchParams,
    Promise, Object, Array, Math, JSON, Date, Number, String, Map, Set,
    fetch: opts.fetch || (() => Promise.resolve({ ok: true, json: () => Promise.resolve(MANIFEST) })),
    requestAnimationFrame: cb => { rafCalls++; cb(); return rafCalls; },
    setTimeout, clearTimeout,
  };
  sandbox.globalThis = sandbox;
  sandbox.document = opts.document !== undefined ? opts.document : makeDocumentStub();
  if (opts.withAddEventListener !== false) {
    sandbox.addEventListener = () => {};
  }
  sandbox.__capitalismTycoonModules = {};
  vm.createContext(sandbox);
  vm.runInContext(rendererSrc, sandbox, { filename: 'map-canvas-renderer.js' });
  vm.runInContext(profilesSrc, sandbox, { filename: 'map-prefecture-profiles.js' });
  vm.runInContext(worldSrc, sandbox, { filename: 'map-world-preview.js' });
  vm.runInContext(canvasSrc, sandbox, { filename: 'map-phase2-canvas.js' });
  sandbox.__rafCalls = () => rafCalls;
  return sandbox;
}

function makeSprite(id, category, districtTags) {
  return { id, category, districtTags, file: `${id}.png`, placeholder: true, footprint: { w: 1, h: 1 }, footprintType: '1x1', anchor: { x: 0.5, y: 1 }, tier: 'hero', spawnWeight: 1 };
}
const MANIFEST = { tile: { w: 64, h: 32 }, sprites: [
  makeSprite('cbd.hero.1', 'office.small', ['cbd']),
  makeSprite('commercial.hero.1', 'commercial.small', ['commercial']),
  makeSprite('residential.hero.1', 'residential.low', ['residential']),
  makeSprite('landmark.1', 'landmark', ['landmark']),
] };

async function readyModule(options) {
  const sandbox = freshSandbox(options);
  const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
  const canvas = makeCanvasMock();
  mod.render(canvas, { selectedPref: 'tokyo' });
  await new Promise(resolve => {
    const poll = () => {
      const placed = mod.placeEntityTiles([], 'tokyo');
      if (placed !== null) return resolve();
      setTimeout(poll, 20);
    };
    setTimeout(poll, 20);
  });
  return { sandbox, mod, canvas };
}

async function main() {
  /* ================= CAMERA: single source of truth ================= */
  await check('camera persists across renders of the same prefecture (the PR A/B bug this PR fixes: a fresh landmark-centred camera used to be computed on every single render() call, silently undoing any pan)', async () => {
    const { mod, canvas } = await readyModule();
    const g = { selectedPref: 'tokyo', stores: [], tenants: [], rentalOffices: [], properties: [] };
    const marker = { dataset: { dUiMarker: 'store:s1', phase2TileX: '10', phase2TileY: '10' }, style: { setProperty(k, v) { this[k] = v; } } };
    canvas.parentElement.querySelectorAll = () => [marker];
    mod.render(canvas, g);
    const first = { x: marker.style['--x'], y: marker.style['--y'] };
    mod.render(canvas, g);
    const second = { x: marker.style['--x'], y: marker.style['--y'] };
    assert.equal(first.x, second.x);
    assert.equal(first.y, second.y);
  });

  await check('camera resets to a fresh landmark-centred position when the resolved prefecture changes', async () => {
    const { sandbox, mod, canvas } = await readyModule();
    const marker = { dataset: { dUiMarker: 'store:s1', phase2TileX: '10', phase2TileY: '10' }, style: { setProperty(k, v) { this[k] = v; } } };
    canvas.parentElement.querySelectorAll = () => [marker];
    mod.render(canvas, { selectedPref: 'tokyo' });
    const tokyoInitial = { x: marker.style['--x'], y: marker.style['--y'] };
    // pan away from the initial position
    sandbox.document.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: canvas });
    sandbox.document.dispatch('pointermove', { pointerId: 1, clientX: 160, clientY: 100 });
    sandbox.document.dispatch('pointerup', { pointerId: 1 });
    const tokyoPanned = { x: marker.style['--x'], y: marker.style['--y'] };
    assert.notEqual(tokyoInitial.x, tokyoPanned.x, 'sanity: the pan itself must have moved the camera');
    // switch prefecture -- camera must NOT carry the panned position forward
    mod.render(canvas, { selectedPref: 'osaka' });
    const osakaAfterSwitch = { x: marker.style['--x'], y: marker.style['--y'] };
    assert.notEqual(osakaAfterSwitch.x, tokyoPanned.x, 'a stale panned camera position must not leak into a different prefecture');
  });

  await check('a pointer drag past the tap/pan threshold moves the camera (and therefore repositions markers) before pointerup', async () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const canvas = makeCanvasMock();
    const marker = { dataset: { dUiMarker: 'store:s1', phase2TileX: '10', phase2TileY: '10' }, style: { setProperty(k, v) { this[k] = v; } } };
    canvas.parentElement.querySelectorAll = () => [marker];
    mod.render(canvas, { selectedPref: 'tokyo' });
    await new Promise(resolve => { const poll = () => { mod.render(canvas, { selectedPref: 'tokyo' }); if (marker.style['--x'] !== undefined) return resolve(); setTimeout(poll, 20); }; setTimeout(poll, 20); });
    const before = marker.style['--x'];
    sandbox.document.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: canvas });
    sandbox.document.dispatch('pointermove', { pointerId: 1, clientX: 160, clientY: 100 });
    assert.notEqual(marker.style['--x'], before, 'marker must reposition mid-drag, not only after pointerup');
    sandbox.document.dispatch('pointerup', { pointerId: 1 });
  });

  await check('movement below the 8px tap/pan threshold does not start a drag (no setPointerCapture, no camera change)', async () => {
    const { mod, sandbox, canvas } = await readyModule();
    const marker = { dataset: { dUiMarker: 'store:s1', phase2TileX: '10', phase2TileY: '10' }, style: { setProperty(k, v) { this[k] = v; } } };
    canvas.parentElement.querySelectorAll = () => [marker];
    mod.render(canvas, { selectedPref: 'tokyo' });
    const before = marker.style['--x'];
    sandbox.document.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: canvas });
    sandbox.document.dispatch('pointermove', { pointerId: 1, clientX: 104, clientY: 101 }); // ~4px, below threshold
    assert.equal(canvas.__calls.setCapture, 0);
    assert.equal(marker.style['--x'], before, 'camera must not move for a sub-threshold jitter');
    sandbox.document.dispatch('pointerup', { pointerId: 1 });
  });

  await check('a drag starting on top of a 44px marker button (a DOM sibling of the canvas, not a descendant) still pans -- STEP 7\'s explicit requirement, and the exact bug this PR fixes over the first ported draft', async () => {
    const { mod, sandbox, canvas } = await readyModule();
    const marker = { dataset: { dUiMarker: 'store:s1', phase2TileX: '10', phase2TileY: '10' }, style: { setProperty(k, v) { this[k] = v; } } };
    canvas.parentElement.querySelectorAll = () => [marker];
    mod.render(canvas, { selectedPref: 'tokyo' });
    const before = marker.style['--x'];
    const markerTarget = makeMarkerTarget(canvas);
    sandbox.document.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: markerTarget });
    sandbox.document.dispatch('pointermove', { pointerId: 1, clientX: 160, clientY: 100 });
    assert.equal(canvas.__calls.setCapture, 1, 'a drag starting on a marker must still cross the threshold and capture the pointer on the real canvas');
    assert.notEqual(marker.style['--x'], before, 'the camera (and therefore marker position) must move even though the gesture started on a marker, not the canvas');
    sandbox.document.dispatch('pointerup', { pointerId: 1 });
    assert.equal(mod.consumeJustPanned(), true, 'a real drag that started on a marker must still suppress the following synthetic marker click');
  });

  await check('a pointerleave crossing off a small marker button onto a sibling still inside the map surface must NOT cancel a pending pre-threshold drag (the exact regression the drag-starts-on-a-marker fix above introduced: a multi-step real-world drag exits the small marker element well before crossing PAN_THRESHOLD, and the pointerleave safety net used to clear dragState on ANY element boundary crossing, not just leaving the map surface)', async () => {
    const { mod, sandbox, canvas } = await readyModule();
    const marker = { dataset: { dUiMarker: 'store:s1', phase2TileX: '10', phase2TileY: '10' }, style: { setProperty(k, v) { this[k] = v; } } };
    canvas.parentElement.querySelectorAll = () => [marker];
    mod.render(canvas, { selectedPref: 'tokyo' });
    const before = marker.style['--x'];
    const markerTarget = makeMarkerTarget(canvas);
    sandbox.document.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: markerTarget });
    // pointer leaves the marker's own icon span onto a sibling still inside .d-city-surface-phase2, before the threshold is crossed
    sandbox.document.dispatch('pointerleave', { pointerId: 1, relatedTarget: makeMarkerTarget(canvas) });
    sandbox.document.dispatch('pointermove', { pointerId: 1, clientX: 160, clientY: 100 });
    assert.equal(canvas.__calls.setCapture, 1, 'the drag must still be alive and cross the threshold after leaving only the small marker element');
    assert.notEqual(marker.style['--x'], before, 'camera must still move -- dragState must not have been wrongly cleared');
    sandbox.document.dispatch('pointerup', { pointerId: 1 });
  });

  await check('a pointerleave whose relatedTarget is genuinely outside .d-city-surface-phase2 still cancels a pending pre-threshold drag (the safety net\'s real purpose: an abandoned pointerdown with no following move before the pointer leaves the interactive map area entirely)', async () => {
    const { mod, sandbox, canvas } = await readyModule();
    const marker = { dataset: { dUiMarker: 'store:s1', phase2TileX: '10', phase2TileY: '10' }, style: { setProperty(k, v) { this[k] = v; } } };
    canvas.parentElement.querySelectorAll = () => [marker];
    mod.render(canvas, { selectedPref: 'tokyo' });
    const before = marker.style['--x'];
    sandbox.document.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: canvas });
    sandbox.document.dispatch('pointerleave', { pointerId: 1, relatedTarget: nonCanvasTarget() });
    sandbox.document.dispatch('pointermove', { pointerId: 1, clientX: 160, clientY: 100 });
    assert.equal(canvas.__calls.setCapture, 0, 'a drag genuinely abandoned outside the map surface must not resume on a later stray pointermove');
    assert.equal(marker.style['--x'], before, 'camera must not move once the pre-threshold drag has been cancelled');
    sandbox.document.dispatch('pointerup', { pointerId: 1 });
  });

  await check('a pointerdown that does not originate on .d-phase2-canvas is ignored entirely (filter chips/buttons/detail panel never get hijacked into a pan)', async () => {
    const { mod, sandbox } = await readyModule();
    sandbox.document.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: nonCanvasTarget() });
    sandbox.document.dispatch('pointermove', { pointerId: 1, clientX: 200, clientY: 100 });
    // consumeJustPanned must stay false -- nothing was ever recognised as a drag
    assert.equal(mod.consumeJustPanned(), false);
  });

  /* ================= TAP/PAN CLICK SUPPRESSION ================= */
  await check('ending a drag sets a one-shot justPanned flag that a following marker click must consume, then clears it', async () => {
    const { mod, sandbox, canvas } = await readyModule();
    const marker = { dataset: { dUiMarker: 'store:s1', phase2TileX: '10', phase2TileY: '10' }, style: { setProperty(k, v) { this[k] = v; } } };
    canvas.parentElement.querySelectorAll = () => [marker];
    mod.render(canvas, { selectedPref: 'tokyo' });
    sandbox.document.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: canvas });
    sandbox.document.dispatch('pointermove', { pointerId: 1, clientX: 160, clientY: 100 });
    sandbox.document.dispatch('pointerup', { pointerId: 1 });
    assert.equal(canvas.__calls.releaseCapture, 1);
    assert.equal(mod.consumeJustPanned(), true, 'first check after a real drag must report justPanned');
    assert.equal(mod.consumeJustPanned(), false, 'the flag must be one-shot, not sticky');
  });

  await check('a plain tap (pointerdown+pointerup with no crossing move) never sets justPanned', async () => {
    const { mod, sandbox, canvas } = await readyModule();
    sandbox.document.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: canvas });
    sandbox.document.dispatch('pointerup', { pointerId: 1 });
    assert.equal(mod.consumeJustPanned(), false);
  });

  await check('handleClick() checks modules.mapPhase2Canvas.consumeJustPanned() before honouring a marker click, so a pan-ending synthetic click never re-selects', () => {
    assert.match(shellSrc, /if\(marker\)\{event\.preventDefault\(\);if\(modules\.mapPhase2Canvas\?\.consumeJustPanned\?\.\(\)\)return true;selectedEntity=marker\.dataset\.dUiMarker;/);
  });

  /* ================= CAMERA BOUNDS ================= */
  await check('camera stays clamped via the existing clampCameraToContent() (world can never fully leave the viewport) -- reused, not reimplemented', () => {
    assert.match(canvasSrc, /MW\.clampCameraToContent\(camera,transform,district,rawW,rawH\)/);
    assert.match(canvasSrc, /MW\.clampCameraToContent\(\{x:lx-rawW\/2,y:ly-rawH\/2\},transform,district,rawW,rawH\)/);
  });

  /* ================= WORLD REBUILD / PLACEMENT REBUILD DISCIPLINE ================= */
  await check('panning does not rebuild the district or re-run entity placement -- only camera changes and a repaint/reposition happen', async () => {
    const { sandbox, mod, canvas } = await readyModule();
    let buildCount = 0;
    const MW = sandbox.MapWorldPreview;
    const originalBuild = MW.buildWorldDistrict;
    MW.buildWorldDistrict = (...args) => { buildCount++; return originalBuild(...args); };
    const marker = { dataset: { dUiMarker: 'store:s1', phase2TileX: '10', phase2TileY: '10' }, style: { setProperty(k, v) { this[k] = v; } } };
    canvas.parentElement.querySelectorAll = () => [marker];
    mod.render(canvas, { selectedPref: 'tokyo' });
    const before = buildCount;
    sandbox.document.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: canvas });
    for (let i = 0; i < 20; i++) sandbox.document.dispatch('pointermove', { pointerId: 1, clientX: 100 + i * 5, clientY: 100 });
    sandbox.document.dispatch('pointerup', { pointerId: 1 });
    assert.equal(buildCount, before, 'buildWorldDistrict must not be called again during a pan of the same prefecture');
    MW.buildWorldDistrict = originalBuild;
  });

  await check('placeEntityTiles is never called by the pan path itself (entity placement is a separate concern from camera movement)', () => {
    const panSection = canvasSrc.split('const PAN_THRESHOLD')[1].split('\nfunction installPanHandlers')[0];
    assert.doesNotMatch(panSection, /placeEntityTiles\(/);
  });

  /* ================= RENDER SCHEDULING (rAF coalescing) ================= */
  await check('pointermove redraws are coalesced through requestAnimationFrame, not painted synchronously once per event', () => {
    assert.match(canvasSrc, /function schedulePanRedraw\(canvas\)\{\s*\n\s*if\(pendingFrame\)return;\s*\n\s*pendingFrame=true;\s*\n\s*globalThis\.requestAnimationFrame/);
  });

  await check('no MutationObserver and no polling (setInterval) anywhere in the pan implementation', () => {
    assert.doesNotMatch(canvasSrc, /new MutationObserver|new\s+\w+\.MutationObserver/);
    assert.doesNotMatch(canvasSrc, /setInterval\(/);
  });

  /* ================= POINTER EVENTS / WEBKIT ================= */
  await check('Pointer Events are the sole gesture path -- pointerdown/pointermove/pointerup/pointercancel via setPointerCapture, no separate touchstart/touchmove/touchend listeners that could double-fire the same gesture', () => {
    assert.match(canvasSrc, /document\.addEventListener\('pointerdown',onPointerDown,true\)/);
    assert.match(canvasSrc, /document\.addEventListener\('pointermove',onPointerMove,true\)/);
    assert.match(canvasSrc, /document\.addEventListener\('pointerup',endDrag,true\)/);
    assert.match(canvasSrc, /document\.addEventListener\('pointercancel',endDrag,true\)/);
    assert.doesNotMatch(canvasSrc, /addEventListener\('touchstart'|addEventListener\('touchmove'|addEventListener\('touchend'/);
    assert.match(canvasSrc, /setPointerCapture/);
  });

  await check('each pan listener type is installed exactly once (installPanHandlers() itself only runs once, at module load)', () => {
    const sandbox = freshSandbox();
    assert.equal(sandbox.document.listenerCount('pointerdown', true), 1);
    assert.equal(sandbox.document.listenerCount('pointermove', true), 1);
    assert.equal(sandbox.document.listenerCount('pointerup', true), 1);
    assert.equal(sandbox.document.listenerCount('pointercancel', true), 1);
  });

  await check('installPanHandlers() is defensive about a document/addEventListener that is not a real DOM (does not throw when loaded in a minimal sandbox)', () => {
    assert.doesNotThrow(() => freshSandbox({ document: { head: { appendChild() {} }, createElement() { return { set src(v) {} }; } } }));
  });

  await check('touch-action:none on .d-phase2-canvas so the browser\'s native touch scroll/zoom never competes with the custom pointer-drag pan', () => {
    assert.match(panCss, /\.d-phase2-canvas\{touch-action:none\}/);
  });

  /* ================= LEGACY --iphone-map-zoom: fully removed (production promotion) ================= */
  // PR C isolated Phase 2 from the legacy --iphone-map-zoom transform with
  // a CSS override; production promotion (PR D) went further and removed
  // the legacy zoom mechanism (js/iphone-playtest-fixes.js's state.mapZoom,
  // its zoom-in/zoom-out/zoom-reset buttons, and every CSS rule reading
  // --iphone-map-zoom) entirely, since it only ever scaled the legacy city
  // layers PR D also deleted. With no transform source left to isolate
  // from, PR C's override rule is gone too -- these checks now prove the
  // whole legacy zoom path (mechanism, buttons, and the isolation rule that
  // used to guard against it) is actually gone, not just neutralized.
  await check('the legacy --iphone-map-zoom CSS custom property is set nowhere in js/iphone-playtest-fixes.js', () => {
    const iphoneFixesJs = fs.readFileSync(path.join(ROOT, 'js/iphone-playtest-fixes.js'), 'utf8');
    assert.doesNotMatch(iphoneFixesJs, /--iphone-map-zoom/);
    assert.doesNotMatch(iphoneFixesJs, /mapZoom/);
  });

  await check('no CSS rule anywhere reads --iphone-map-zoom any more, including PR C\'s own former isolation override', () => {
    const iphoneFixesCss = fs.readFileSync(path.join(ROOT, 'css/iphone-playtest-fixes.css'), 'utf8');
    assert.doesNotMatch(iphoneFixesCss, /--iphone-map-zoom/);
    assert.doesNotMatch(panCss, /--iphone-map-zoom/);
    assert.doesNotMatch(panCss, /transform:none!important/);
  });

  await check('the zoom-in/zoom-out/zoom-reset map actions are gone from js/iphone-playtest-fixes.js -- filter/legend/view remain', () => {
    const iphoneFixesJs = fs.readFileSync(path.join(ROOT, 'js/iphone-playtest-fixes.js'), 'utf8');
    for (const action of ['zoom-in', 'zoom-out', 'zoom-reset']) assert.doesNotMatch(iphoneFixesJs, new RegExp(`data-iphone-map-action="${action}"`));
    for (const action of ['filter', 'legend', 'view']) assert.match(iphoneFixesJs, new RegExp(`data-iphone-map-action="${action}"`));
  });

  /* ================= RESIZE ================= */
  await check('a resize event triggers a re-render (clamp + reposition) via the same render() path, guarded so it never fires in a sandbox without a real window', () => {
    assert.match(canvasSrc, /if\(typeof globalThis\.addEventListener==='function'\)\{\s*\n\s*globalThis\.addEventListener\('resize'/);
  });

  /* ================= REGRESSION: PR A/B still intact ================= */
  await check('buildMapViewModel/placeEntityTiles (PR A/B) are untouched by PR C\'s additions', () => {
    assert.match(canvasSrc, /function buildMapViewModel\(g,engineInstance\)\{/);
    assert.match(canvasSrc, /function placeEntityTiles\(entities,prefID\)\{/);
  });

  await check('no Math.random, no simulation RNG, no save-state reference anywhere in the pan additions', () => {
    assert.doesNotMatch(canvasSrc, /Math\s*\.\s*random/);
    assert.doesNotMatch(canvasSrc, /engine\.roll|engine\.rng/i);
    assert.doesNotMatch(canvasSrc, /SAVE_KEY|saveVersion/);
    const shellAdded = shellSrc.split("let mapFilterKind='all';")[1];
    assert.doesNotMatch(shellAdded, /localStorage/);
  });

  await check('no new hash()/FNV-1a implementation added for pan/camera work (still only Base.hash, reused by placeEntityTiles)', () => {
    assert.doesNotMatch(canvasSrc, /function hash\(/);
  });

  await check('Phase 2 selection/filter wiring (PR B) is still present and unconditional after production promotion: single activeEntities source, no legacy list left beside it', () => {
    assert.match(shellSrc, /const activeEntities=placed\|\|\[\];/);
    assert.doesNotMatch(shellSrc, /legacyEntities/);
  });

  await check('17-marker Phase 2 baseline (PR B) is unaffected: buildMapViewModel still applies no artificial per-kind cap', () => {
    const between = canvasSrc.split('function buildMapViewModel')[1].split('\nfunction ')[0];
    assert.doesNotMatch(between, /\.slice\(/);
  });

  await check('js/d-ui-shell.js does not call modules.uiEnhancerRegistry.registerUIEnhancer a second time in PR C (still one registration, 79/79 cap unaffected)', () => {
    const matches = shellSrc.match(/registerUIEnhancer\(/g) || [];
    assert.equal(matches.length, 1);
  });

  // Note: this file's own PR-scope git-diff check was removed here for the
  // same reason as tests/map-phase2-canvas-test.js -- it described PR C's
  // small diff and no longer matches PR D's much larger production-
  // promotion diff on the same branch. The current PR's scope check lives
  // in tests/map-phase2-production-promotion-test.js.

  /* ================= NEGATIVE TESTS ================= */
  await check('NEGATIVE: if a CSS rule reading --iphone-map-zoom were reintroduced, the earlier removal check would fail', () => {
    const withRule = panCss + '\n.iphone-map-enhanced .d-city-surface-phase2{transform:scale(var(--iphone-map-zoom,1))}';
    assert.doesNotMatch(panCss, /--iphone-map-zoom/, 'sanity: real source has none');
    assert.match(withRule, /--iphone-map-zoom/, 'mutated source must trip the same regex the real check above uses');
  });

  await check('NEGATIVE: if pan redraw were NOT rAF-coalesced (direct render() call instead of requestAnimationFrame scheduling), the scheduling check above would fail', () => {
    const uncoalesced = canvasSrc.replace('globalThis.requestAnimationFrame(()=>{pendingFrame=false;render(canvas,lastG);});', 'render(canvas,lastG);');
    assert.notEqual(uncoalesced, canvasSrc, 'sanity: replace must have matched');
    assert.throws(() => assert.match(uncoalesced, /function schedulePanRedraw\(canvas\)\{\s*\n\s*if\(pendingFrame\)return;\s*\n\s*pendingFrame=true;\s*\n\s*globalThis\.requestAnimationFrame/));
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main();
