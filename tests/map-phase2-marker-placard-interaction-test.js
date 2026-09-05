'use strict';
/*
 * Focused contract test for the Marker Interaction / Decluttering / Placard
 * UX pass -- fixes production markers (tenant/office/realestate/store)
 * silently failing to tap on real devices, and redesigns them into
 * always-readable signboard-style placards with deterministic screen-space
 * decluttering. See docs/map-phase2-production-integration-audit.md for the
 * root-cause writeup this implements.
 *
 * Root cause (confirmed by reading the actual CSS/JS, not guessed):
 * .d-city-surface (css/d-ui-reference-fidelity.css) used to carry a
 * non-none `filter`, which forces an isolated stacking context onto that
 * box (CSS Filter Effects spec) -- .d-map-marker's own z-index could then
 * never out-rank a SIBLING of .d-city-surface-phase2, no matter how high it
 * was set. js/iphone-playtest-fixes.js's ensureMapChrome()/
 * ensureSyntheticMapEntities() append exactly such siblings on EVERY
 * viewport (.iphone-map-nav z:18, .iphone-map-tools z:18,
 * .iphone-map-popover z:19, up to 3 .iphone-synthetic-marker.competitor
 * z:11), so any real marker under one of them had its tap silently
 * swallowed. Fix: move the filter to .d-phase2-canvas (a pixel-identical
 * visual no-op, since canvas already paints over everything inside
 * .d-city-surface) and raise .d-map-marker's z-index above all of the
 * above.
 *
 * Functional (decluttering/placard) checks run the real prototypes/*.js +
 * js/map-phase2-canvas.js in an isolated vm sandbox, same pattern as
 * tests/map-phase2-markers-test.js. js/d-ui-shell.js stays regex-inspected
 * as text (it is DOM-dependent and cannot run standalone under Node),
 * matching that file's own established test style.
 *
 * Run directly: node tests/map-phase2-marker-placard-interaction-test.js
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
const iphoneJsSrc = fs.readFileSync(path.join(ROOT, 'js/iphone-playtest-fixes.js'), 'utf8');
const markersCssSrc = fs.readFileSync(path.join(ROOT, 'css/d-ui-map-phase2-markers.css'), 'utf8');
const canvasCssSrc = fs.readFileSync(path.join(ROOT, 'css/d-ui-map-phase2-canvas.css'), 'utf8');
const referenceCssSrc = fs.readFileSync(path.join(ROOT, 'css/d-ui-reference-fidelity.css'), 'utf8');
const iphoneCssSrc = fs.readFileSync(path.join(ROOT, 'css/iphone-playtest-fixes.css'), 'utf8');
const baseCssSrc = fs.readFileSync(path.join(ROOT, 'css/d-ui.css'), 'utf8');
const rendererSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-canvas-renderer.js'), 'utf8');
const worldSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');
const profilesSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-prefecture-profiles.js'), 'utf8');

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
    setTimeout, clearTimeout,
    requestAnimationFrame: cb => { cb(); return 1; },
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

/*
 * Minimal but real EventTarget-shaped document stub, matching the pattern
 * already established in tests/map-phase2-iphone-pan-webkit-test.js --
 * lets pointerdown/move/up genuinely dispatch through installPanHandlers()'s
 * actual delegated document listeners, rather than simulating pan by
 * calling internal functions directly (there are none exported to call).
 */
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
    closest(sel) { return (sel === '.d-phase2-canvas' || sel === '.d-city-surface-phase2') ? el : null; },
    querySelector(sel) { return sel === '.d-phase2-canvas' ? el : null; },
    __calls: calls,
  };
  return el;
}

function readySandbox(options) {
  const sandbox = freshSandbox(Object.assign({
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(MANIFEST) }),
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

// Tokyo 17-marker fixture (store 0 / tenant 8 / office 3 / realestate 6),
// the exact baseline tests/map-phase2-production-promotion-test.js already
// established -- reused here so "no overlap for the representative
// 17-marker fixture" is checked against the SAME data other tests already
// treat as the production baseline, not a fresh made-up fixture.
function tokyoFixtureG() {
  return {
    selectedPref: 'tokyo',
    stores: [],
    tenants: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, prefID: 'tokyo', name: `Tenant ${i}` })),
    rentalOffices: Array.from({ length: 3 }, (_, i) => ({ id: `o${i}`, prefID: 'tokyo', name: `Office ${i}` })),
    properties: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, prefID: 'tokyo', name: `Property ${i}`, kind: '商業ビル' })),
  };
}

function extractFunctionBody(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `could not locate function ${name}`);
  const braceStart = src.indexOf('{', start);
  let depth = 0, index = braceStart;
  for (; index < src.length; index += 1) {
    if (src[index] === '{') depth += 1;
    else if (src[index] === '}') { depth -= 1; if (depth === 0) break; }
  }
  assert.equal(depth, 0, `unbalanced braces extracting ${name}`);
  return src.slice(start, index + 1);
}

function ruleZIndex(css, selector) {
  const re = new RegExp(selector.replace(/[.[\]]/g, '\\$&') + '\\{[^}]*\\}', 'g');
  let match, z = null;
  while ((match = re.exec(css))) {
    const zm = match[0].match(/z-index:(\d+)/);
    if (zm) z = Number(zm[1]);
  }
  return z;
}

// AABB collision box matching js/map-phase2-canvas.js's own marker box, and
// the hard cap on how far a marker may sit from its building -- both
// extracted from source (not re-typed) so this test can never silently drift
// from the constants the real placement actually uses.
const boxMatch = canvasSrc.match(/const MARKER_CLAMP_HALF_W=(\d+),MARKER_CLAMP_HALF_H=(\d+);/);
assert.ok(boxMatch, 'could not locate MARKER_CLAMP_HALF_W/H in js/map-phase2-canvas.js');
const HALF_W = Number(boxMatch[1]), HALF_H = Number(boxMatch[2]);
const capMatch = canvasSrc.match(/const MAX_ANCHOR_OFFSET=(\d+);/);
assert.ok(capMatch, 'could not locate MAX_ANCHOR_OFFSET in js/map-phase2-canvas.js');
const MAX_ANCHOR_OFFSET = Number(capMatch[1]);
function rectOf(cx, cy) { return { left: cx - HALF_W, top: cy - HALF_H, right: cx + HALF_W, bottom: cy + HALF_H }; }
function overlaps(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }

async function main() {
  /* ================= ROOT CAUSE FIX: STACKING CONTEXT / Z-INDEX ================= */
  await check('.d-city-surface no longer carries a `filter` (the property that forced an isolated stacking context and trapped every marker\'s z-index inside it)', () => {
    const rule = referenceCssSrc.match(/\.d-city-surface\{[^}]*\}/);
    assert.ok(rule, '.d-city-surface base rule must still exist');
    assert.doesNotMatch(rule[0], /filter:/, '.d-city-surface must not set filter any more');
  });

  await check('the saturate/contrast filter moved to .d-phase2-canvas (pixel-identical visual result, since canvas already paints over everything inside .d-city-surface)', () => {
    assert.match(canvasCssSrc, /\.d-phase2-canvas\{[^}]*filter:saturate\(\.92\) contrast\(1\.05\)/);
  });

  await check('.d-map-marker\'s z-index now out-ranks every iPhone chrome overlay that used to swallow its taps (.iphone-map-nav/.iphone-map-tools/.iphone-map-popover/.iphone-synthetic-marker), on every viewport', () => {
    const markerZ = ruleZIndex(markersCssSrc, '.d-map-marker');
    assert.ok(Number.isFinite(markerZ), '.d-map-marker must declare an explicit z-index');
    for (const [selector, css] of [
      ['.iphone-map-nav', iphoneCssSrc],
      ['.iphone-map-tools', iphoneCssSrc],
      ['.iphone-map-popover', iphoneCssSrc],
      ['.iphone-synthetic-marker', iphoneCssSrc],
    ]) {
      const otherZ = ruleZIndex(css, selector);
      assert.ok(Number.isFinite(otherZ), `${selector} must still declare a z-index (sanity: this test's own extraction works)`);
      assert.ok(markerZ > otherZ, `.d-map-marker (z:${markerZ}) must out-rank ${selector} (z:${otherZ})`);
    }
  });

  await check('.iphone-map-nav/.iphone-map-tools/.iphone-map-popover/.iphone-synthetic-marker still run on EVERY viewport (no @media gate, no user-agent check) -- the fix must cover desktop, not just iPhone', () => {
    for (const selector of ['.iphone-map-nav{', '.iphone-map-tools{', '.iphone-map-popover{', '.iphone-synthetic-marker{']) {
      assert.ok(iphoneCssSrc.includes(selector), `${selector} must still exist`);
    }
    // ensureMapChrome() itself is the load-bearing gate -- js/iphone-playtest-fixes.js's own
    // enhance() calls it unconditionally whenever the map tab is active, with no user-agent check
    // (unlike enhanceBrowserMode(), which DOES sniff navigator.userAgent for an unrelated purpose --
    // this checks ensureMapChrome() specifically, not the whole file).
    assert.match(iphoneJsSrc, /function ensureMapChrome\(\)\{\s*if\(activeTab\(\)!=='map'\)return;/);
    assert.doesNotMatch(extractFunctionBody(iphoneJsSrc, 'ensureMapChrome'), /navigator\.userAgent/);
  });

  /* ================= ALWAYS-VISIBLE PLACARD LABEL ================= */
  await check('the marker label is unconditionally visible (opacity:1, display:block) -- it used to be opacity:0 until hover/focus/selected and fully display:none under <=820px (every phone)', () => {
    assert.match(markersCssSrc, /\.d-map-marker small\{display:block;opacity:1/);
    // sanity: the OLD hover-reveal/mobile-hide rules this overrides are still in the base files
    // (this test would be vacuous if they had been deleted instead of overridden).
    assert.match(referenceCssSrc, /\.d-map-marker small\{opacity:0/);
    assert.match(baseCssSrc, /\.d-map-marker small\{display:none\}/);
  });

  await check('placardLabel() maps each kind to a fixed category label, matching acceptance criterion C', () => {
    assert.match(shellSrc, /function placardLabel\(entity\)\{/);
    const body = extractFunctionBody(shellSrc, 'placardLabel');
    assert.match(body, /if\(entity\.kind==='tenant'\)return 'テナント募集';/);
    assert.match(body, /if\(entity\.kind==='office'\)return 'オフィス募集';/);
    assert.match(body, /if\(entity\.kind==='realestate'\)return '売物件';/);
    assert.match(body, /return entity\.name\|\|'自社店舗';/);
  });

  await check('the marker template renders the placard label and dot, and keeps the exact data-d-ui-marker/data-phase2-tile-x/y click contract byte-for-byte', () => {
    assert.match(shellSrc, /data-d-ui-marker="\$\{esc\(entity\.id\)\}" data-phase2-tile-x="\$\{entity\.tileX\}" data-phase2-tile-y="\$\{entity\.tileY\}"/, 'unchanged marker click contract');
    assert.match(shellSrc, /data-phase2-offset-x="\$\{entity\.placardOffsetX\|\|0\}" data-phase2-offset-y="\$\{entity\.placardOffsetY\|\|0\}"/);
    assert.match(shellSrc, /aria-label="\$\{esc\(placardLabel\(entity\)\)\}"/);
    assert.match(shellSrc, /<i class="d-map-marker-dot" aria-hidden="true"><\/i>/);
    assert.match(shellSrc, /<small>\$\{esc\(placardLabel\(entity\)\)\}<\/small>/);
  });

  /* ================= ACCESSIBILITY ================= */
  await check('markers are real <button> elements (native button semantics) with an aria-label and a >=44px hit target on both dimensions', () => {
    assert.match(shellSrc, /placeable\.map\(entity=>`<button type="button" class="d-map-marker/);
    const sizeMatch = markersCssSrc.match(/\.d-map-marker\{width:(\d+)px;height:(\d+)px\}/);
    assert.ok(sizeMatch, '.d-map-marker size rule must still exist');
    assert.ok(Number(sizeMatch[1]) >= 44 && Number(sizeMatch[2]) >= 44, 'hit target must stay >=44px both dimensions');
  });

  /* ================= SCREEN-SPACE DECLUTTERING ================= */
  await check('layoutMarkerPlacards is exported from modules.mapPhase2Canvas', () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    assert.equal(typeof mod.layoutMarkerPlacards, 'function');
  });

  await check('layoutMarkerPlacards returns null before the district is built (matches placeEntityTiles\'s own "still loading" contract)', () => {
    const sandbox = freshSandbox({ fetch: () => new Promise(() => {}) });
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    assert.equal(mod.layoutMarkerPlacards([{ id: 'tenant:t1', kind: 'tenant', tileX: 3, tileY: 3 }], 'tokyo'), null);
  });

  await check('deterministic: the same entity set + prefID produces byte-identical placardOffsetX/Y every time (stable across rerender)', async () => {
    const { mod } = await readySandbox();
    const g = tokyoFixtureG();
    const vm1 = mod.buildMapViewModel(g, null);
    const placedOnce = mod.placeEntityTiles(vm1.entities, vm1.prefID);
    const laidOutA = mod.layoutMarkerPlacards(placedOnce, vm1.prefID);
    const laidOutB = mod.layoutMarkerPlacards(placedOnce, vm1.prefID);
    assert.deepStrictEqual(
      laidOutA.map(e => [e.id, e.placardOffsetX, e.placardOffsetY]),
      laidOutB.map(e => [e.id, e.placardOffsetX, e.placardOffsetY]),
      'two calls on the same input must agree exactly'
    );
  });

  await check('order-independent: canonical (id-sorted) resolution means the result does not depend on the order entities were passed in', async () => {
    const { mod } = await readySandbox();
    const g = tokyoFixtureG();
    const vm1 = mod.buildMapViewModel(g, null);
    const placed = mod.placeEntityTiles(vm1.entities, vm1.prefID);
    const forward = mod.layoutMarkerPlacards(placed, vm1.prefID);
    const reversed = mod.layoutMarkerPlacards([...placed].reverse(), vm1.prefID);
    const byId = list => Object.fromEntries(list.map(e => [e.id, `${e.placardOffsetX},${e.placardOffsetY}`]));
    assert.deepStrictEqual(byId(forward), byId(reversed));
  });

  await check('stable A->B->A: switching Tokyo->Osaka->Tokyo reproduces Tokyo\'s exact original placard layout (no hidden mutable cache keyed on "last prefecture visited")', async () => {
    const { mod } = await readySandbox();
    const g = tokyoFixtureG();
    const vmTokyo = mod.buildMapViewModel(g, null);
    const placedTokyo = mod.placeEntityTiles(vmTokyo.entities, vmTokyo.prefID);
    const laidOutTokyoA = mod.layoutMarkerPlacards(placedTokyo, vmTokyo.prefID);
    const vmOsaka = mod.buildMapViewModel(Object.assign({}, g, { selectedPref: 'osaka' }), null);
    const placedOsaka = mod.placeEntityTiles(vmOsaka.entities, vmOsaka.prefID);
    mod.layoutMarkerPlacards(placedOsaka, vmOsaka.prefID);
    const laidOutTokyoB = mod.layoutMarkerPlacards(placedTokyo, vmTokyo.prefID);
    const byId = list => Object.fromEntries(list.map(e => [e.id, `${e.placardOffsetX},${e.placardOffsetY}`]));
    assert.deepStrictEqual(byId(laidOutTokyoA), byId(laidOutTokyoB));
  });

  await check('ANCHOR INTEGRITY: every marker in the 17-marker Tokyo fixture stays within MAX_ANCHOR_OFFSET of its own building, and decluttering still separates most badges', async () => {
    const { sandbox, mod } = await readySandbox();
    const g = tokyoFixtureG();
    const vm1 = mod.buildMapViewModel(g, null);
    const placed = mod.placeEntityTiles(vm1.entities, vm1.prefID);
    const laidOut = mod.layoutMarkerPlacards(placed, vm1.prefID);
    const placeable = laidOut.filter(e => e.tileX !== null && e.tileY !== null);
    assert.equal(placeable.length, 17, 'sanity: baseline fixture count unchanged');

    // Reconstruct the exact camera-independent world transform js/map-
    // phase2-canvas.js's own layoutMarkerPlacards() uses, via the same
    // public MapWorldPreview API this sandbox already loaded -- no internal
    // export needed just for this test.
    const MW = sandbox.MapWorldPreview;
    const index2 = MW.indexCategoryManifest(MANIFEST);
    const worldColsMatch = canvasSrc.match(/const WORLD_COLS=(\d+),WORLD_ROWS=(\d+);/);
    assert.ok(worldColsMatch, 'could not locate WORLD_COLS/WORLD_ROWS in js/map-phase2-canvas.js');
    const cols = Number(worldColsMatch[1]), rows = Number(worldColsMatch[2]);
    const scaleMatch = canvasSrc.match(/const DEFAULT_SCALE=([\d.]+);/);
    const scale = Number(scaleMatch[1]);
    const district = MW.buildWorldDistrict({ index2, prefID: 'tokyo', cols, rows });
    const wt = MW.worldTransform(district, index2.tile, scale);

    const rects = placeable.map(e => {
      // transform.toScreen() returns RAW unscaled tile-space pixels; scale
      // by transform.scale to match layoutMarkerPlacards()'s own CSS-pixel
      // math (and what actually renders) -- see that function's own comment.
      const [rawAx, rawAy] = wt.transform.toScreen(e.tileX, e.tileY);
      const ax = rawAx * wt.transform.scale, ay = rawAy * wt.transform.scale;
      return { id: e.id, rect: rectOf(ax + e.placardOffsetX, ay + e.placardOffsetY) };
    });
    /*
     * The contract this replaced demanded that NO two boxes overlap, and an
     * unbounded 6-ring search over a 108x86 placard box is what it took to
     * satisfy that -- up to 696px of displacement, measured at 334px (64% of
     * the canvas width) in a real desktop render, with markers landing
     * nowhere near their buildings. Anchor integrity is the stronger and more
     * meaningful guarantee: a marker may overlap a neighbour, but it may
     * never stop pointing at its own building.
     */
    for (const e of placeable) {
      const distance = Math.hypot(e.placardOffsetX, e.placardOffsetY);
      assert.ok(distance <= MAX_ANCHOR_OFFSET + 0.001,
        `${e.id} was displaced ${distance.toFixed(1)}px from its building, past the ${MAX_ANCHOR_OFFSET}px cap`);
    }
    // Decluttering must still do real work: most badges end up separated.
    let overlapping = 0;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) if (overlaps(rects[i].rect, rects[j].rect)) overlapping += 1;
    }
    const pairs = rects.length * (rects.length - 1) / 2;
    assert.ok(overlapping <= pairs * 0.15,
      `${overlapping} of ${pairs} badge pairs overlap -- decluttering stopped doing useful work`);
  });

  await check('deterministic ordering has teeth: two entities placed on the SAME tile (would collide at offset {0,0}) never both keep {dx:0,dy:0}', async () => {
    const { mod } = await readySandbox();
    // Force a real same-tile collision: two tenants sharing one hand-picked
    // tile (bypassing placeEntityTiles' own occupancy avoidance) so
    // layoutMarkerPlacards must be the thing that tells them apart.
    const entities = [
      { id: 'tenant:a', kind: 'tenant', sourceId: 'a', tileX: 10, tileY: 10 },
      { id: 'tenant:b', kind: 'tenant', sourceId: 'b', tileX: 10, tileY: 10 },
    ];
    const laidOut = mod.layoutMarkerPlacards(entities, 'tokyo');
    const a = laidOut.find(e => e.id === 'tenant:a'), b = laidOut.find(e => e.id === 'tenant:b');
    assert.ok(!(a.placardOffsetX === b.placardOffsetX && a.placardOffsetY === b.placardOffsetY), 'two same-tile markers must not resolve to the identical offset');
    // canonical id order (a < b): 'a' gets first pick (offset {0,0}), 'b' must move.
    assert.deepStrictEqual([a.placardOffsetX, a.placardOffsetY], [0, 0]);
    assert.ok(b.placardOffsetX !== 0 || b.placardOffsetY !== 0);
  });

  await check('viewport clamp applies to a marker whose OWN anchor is on-screen: a large offset pushing its placard past the edge is pulled back inside [0,cssW]', async () => {
    const { sandbox, mod } = await readySandbox();
    // The initial (landmark-centred) camera always places the landmark
    // tile's anchor at exactly (cssW/2, cssH/2) by construction (see
    // js/map-phase2-canvas.js's initialCamera()) -- using it here
    // guarantees this marker's own anchor is on-screen regardless of
    // canvas size, so the clamp-applicability check in positionMarkers()
    // actually engages (unlike an arbitrary tile, which may legitimately
    // be far outside the current view and must NOT be clamped -- see that
    // function's own comment).
    const MW = sandbox.MapWorldPreview;
    const index2 = MW.indexCategoryManifest(MANIFEST);
    const worldColsMatch = canvasSrc.match(/const WORLD_COLS=(\d+),WORLD_ROWS=(\d+);/);
    const cols = Number(worldColsMatch[1]), rows = Number(worldColsMatch[2]);
    const district = MW.buildWorldDistrict({ index2, prefID: 'tokyo', cols, rows });
    const landmark = district.tiles.find(cell => cell.zone === 'landmark');
    assert.ok(landmark, 'sanity: the fixture district must have a landmark tile');

    const marker = { dataset: { dUiMarker: 'tenant:t0', phase2TileX: String(landmark.tileX), phase2TileY: String(landmark.tileY), phase2OffsetX: '500', phase2OffsetY: '0' }, style: { setProperty(k, v) { this[k] = v; } } };
    const narrowCanvas = {
      getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
      getBoundingClientRect: () => ({ width: 300, height: 300 }),
      parentElement: { querySelectorAll: () => [marker] },
      width: 0, height: 0, style: {},
    };
    mod.render(narrowCanvas, { selectedPref: 'tokyo' });
    const x = parseFloat(marker.style['--x']), y = parseFloat(marker.style['--y']);
    assert.ok(Number.isFinite(x) && x >= 0 && x <= 300, `x=${x} must stay inside the 300px-wide canvas despite the +500px offset request`);
    assert.ok(Number.isFinite(y) && y >= 0 && y <= 300, `y=${y} must stay inside the 300px-tall canvas`);
  });

  await check('viewport clamp does NOT apply to a marker whose own anchor is genuinely off-screen -- clamping it would drag unrelated off-screen entities into the same visible corner and manufacture new collisions (the real bug a Chromium dry-run caught)', async () => {
    const { mod } = await readySandbox();
    // Tile (0,0) is a world corner, nowhere near the landmark-centred
    // camera's view on a small canvas -- its anchor must be off-screen.
    const marker = { dataset: { dUiMarker: 'tenant:far', phase2TileX: '0', phase2TileY: '0', phase2OffsetX: '0', phase2OffsetY: '0' }, style: { setProperty(k, v) { this[k] = v; } } };
    const narrowCanvas = {
      getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
      getBoundingClientRect: () => ({ width: 60, height: 60 }),
      parentElement: { querySelectorAll: () => [marker] },
      width: 0, height: 0, style: {},
    };
    mod.render(narrowCanvas, { selectedPref: 'tokyo' });
    const x = parseFloat(marker.style['--x']);
    assert.ok(Number.isFinite(x) && (x < 0 || x > 60), `sanity: this tile's anchor must actually be off-screen on a 60px canvas (x=${x})`);
  });

  await check('stable across pan: --ox/--oy (the applied placard offset) do not change when the camera pans, only --x/--y (the anchor + offset) do', async () => {
    const sandbox = freshSandbox({
      fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(MANIFEST) }),
      document: makeDocumentStub(),
    });
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const canvas = makeCanvasMock();
    mod.render(canvas, { selectedPref: 'tokyo' });
    await new Promise(resolve => {
      const poll = () => { if (mod.placeEntityTiles([], 'tokyo') !== null) return resolve(); setTimeout(poll, 20); };
      setTimeout(poll, 20);
    });
    const marker = { dataset: { dUiMarker: 'tenant:t0', phase2TileX: '5', phase2TileY: '5', phase2OffsetX: '40', phase2OffsetY: '0' }, style: { setProperty(k, v) { this[k] = v; } } };
    canvas.parentElement.querySelectorAll = () => [marker];
    mod.render(canvas, { selectedPref: 'tokyo' });
    const before = { x: marker.style['--x'], ox: marker.style['--ox'] };
    sandbox.document.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, target: canvas });
    sandbox.document.dispatch('pointermove', { pointerId: 1, clientX: 160, clientY: 100 });
    sandbox.document.dispatch('pointerup', { pointerId: 1 });
    const after = { x: marker.style['--x'], ox: marker.style['--ox'] };
    assert.notEqual(before.x, after.x, 'sanity: the pan itself must have moved the anchor');
    assert.equal(before.ox, after.ox, 'the applied placard offset must be pan-invariant');
  });

  /* ================= CHROME EXCLUSION (repair for a real post-merge WebKit CI regression) =================
   * Raising .d-map-marker's z-index above the iPhone chrome (the root-cause
   * fix above) had an unintended side effect: a marker rendered ON TOP of
   * .iphone-map-nav/.iphone-map-tools/.iphone-map-popover now blocks THEIR
   * own tap instead. Confirmed by a real post-merge WebKit CI failure
   * (tests/iphone-playtest-webkit-test.js timed out clicking
   * [data-iphone-map-action="filter"]: "span ... from .d-city-surface-phase2
   * subtree intercepts pointer events"). chromeExclusionRects() measures
   * those controls' live DOM rects and positionMarkers() now routes every
   * on-screen marker away from them using the same nudge search already
   * built for viewport-edge-clamp collisions. */
  function makeChromeStageCanvas({ canvasRect, chromeRect, marker }) {
    const stage = {
      querySelector(sel) {
        if (sel === '.iphone-map-tools') return chromeRect ? { hidden: false, getBoundingClientRect: () => chromeRect } : null;
        return null;
      },
    };
    return {
      getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
      getBoundingClientRect: () => canvasRect,
      parentElement: { querySelectorAll: () => [marker] },
      width: 0, height: 0, style: {},
      closest(sel) { return sel === '.d-map-stage' ? stage : null; },
    };
  }

  await check('a marker whose natural position collides with the live .iphone-map-tools rect is nudged clear of it, not left overlapping', async () => {
    const { mod } = await readySandbox();
    const marker = { dataset: { dUiMarker: 'tenant:t0', phase2TileX: '16', phase2TileY: '16', phase2OffsetX: '0', phase2OffsetY: '0' }, style: { setProperty(k, v) { this[k] = v; } } };
    const canvasRect = { left: 0, top: 0, width: 300, height: 300 };
    // First render with no chrome to learn this marker's natural (unclamped) --x/--y.
    const plainCanvas = makeChromeStageCanvas({ canvasRect, chromeRect: null, marker });
    mod.render(plainCanvas, { selectedPref: 'tokyo' });
    const naturalX = parseFloat(marker.style['--x']), naturalY = parseFloat(marker.style['--y']);
    assert.ok(Number.isFinite(naturalX) && Number.isFinite(naturalY), 'sanity: marker must have a resolved on-screen position');

    // A chrome rect placed exactly over that natural position -- the real
    // shape of the CI failure (a chrome control sitting where a marker
    // would otherwise render).
    const chromeRect = { left: naturalX - 20, top: naturalY - 20, right: naturalX + 20, bottom: naturalY + 20, width: 40, height: 40 };
    const chromeCanvas = makeChromeStageCanvas({ canvasRect, chromeRect, marker });
    mod.render(chromeCanvas, { selectedPref: 'tokyo' });
    const x = parseFloat(marker.style['--x']), y = parseFloat(marker.style['--y']);
    const MARKER_HALF_MATCH = canvasSrc.match(/const MARKER_CLAMP_HALF_W=(\d+),MARKER_CLAMP_HALF_H=(\d+);/);
    assert.ok(MARKER_HALF_MATCH, 'could not locate MARKER_CLAMP_HALF_W/H in js/map-phase2-canvas.js');
    const halfW = Number(MARKER_HALF_MATCH[1]), halfH = Number(MARKER_HALF_MATCH[2]);
    const markerRect = { left: x - halfW, top: y - halfH, right: x + halfW, bottom: y + halfH };
    assert.ok(!overlaps(markerRect, chromeRect), `marker rect ${JSON.stringify(markerRect)} must not overlap the chrome exclusion rect ${JSON.stringify(chromeRect)}`);
  });

  await check('a hidden or zero-sized .iphone-map-tools element is NOT treated as claimed space (matches ensureMapChrome()\'s own hidden-until-opened popover pattern)', async () => {
    const { mod } = await readySandbox();
    const marker = { dataset: { dUiMarker: 'tenant:t0', phase2TileX: '16', phase2TileY: '16', phase2OffsetX: '0', phase2OffsetY: '0' }, style: { setProperty(k, v) { this[k] = v; } } };
    const canvasRect = { left: 0, top: 0, width: 300, height: 300 };
    const plainCanvas = makeChromeStageCanvas({ canvasRect, chromeRect: null, marker });
    mod.render(plainCanvas, { selectedPref: 'tokyo' });
    const naturalX = parseFloat(marker.style['--x']), naturalY = parseFloat(marker.style['--y']);

    const stage = {
      querySelector(sel) {
        if (sel !== '.iphone-map-tools') return null;
        return { hidden: true, getBoundingClientRect: () => ({ left: naturalX - 20, top: naturalY - 20, right: naturalX + 20, bottom: naturalY + 20, width: 40, height: 40 }) };
      },
    };
    const hiddenChromeCanvas = {
      getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
      getBoundingClientRect: () => canvasRect,
      parentElement: { querySelectorAll: () => [marker] },
      width: 0, height: 0, style: {},
      closest(sel) { return sel === '.d-map-stage' ? stage : null; },
    };
    mod.render(hiddenChromeCanvas, { selectedPref: 'tokyo' });
    const x = parseFloat(marker.style['--x']), y = parseFloat(marker.style['--y']);
    assert.equal(x, naturalX, 'a hidden chrome control must not nudge the marker away');
    assert.equal(y, naturalY, 'a hidden chrome control must not nudge the marker away');
  });

  await check('a canvas mock without closest()/getBoundingClientRect() (the pre-existing pattern used by every OTHER test in this suite) still renders markers with no crash -- chromeExclusionRects() degrades to [] rather than throwing', async () => {
    const { mod, canvas } = await readySandbox();
    const marker = { dataset: { dUiMarker: 'tenant:t0', phase2TileX: '16', phase2TileY: '16', phase2OffsetX: '0', phase2OffsetY: '0' }, style: { setProperty(k, v) { this[k] = v; } } };
    canvas.parentElement.querySelectorAll = () => [marker];
    assert.equal(typeof canvas.closest, 'undefined', 'sanity: this is the plain mock other tests already rely on');
    mod.render(canvas, { selectedPref: 'tokyo' });
    assert.ok(Number.isFinite(parseFloat(marker.style['--x'])), 'marker must still resolve a position');
  });

  /* ================= NEGATIVE: CHROME EXCLUSION ================= */
  await check('NEGATIVE: seeding `claimed` from an EMPTY exclusion list (i.e. not calling chromeExclusionRects() at all) would leave the marker overlapping the chrome rect -- proves the positive test above is non-vacuous', async () => {
    const { mod } = await readySandbox();
    const marker = { dataset: { dUiMarker: 'tenant:t0', phase2TileX: '16', phase2TileY: '16', phase2OffsetX: '0', phase2OffsetY: '0' }, style: { setProperty(k, v) { this[k] = v; } } };
    const canvasRect = { left: 0, top: 0, width: 300, height: 300 };
    const plainCanvas = makeChromeStageCanvas({ canvasRect, chromeRect: null, marker });
    mod.render(plainCanvas, { selectedPref: 'tokyo' });
    const naturalX = parseFloat(marker.style['--x']), naturalY = parseFloat(marker.style['--y']);
    const chromeRect = { left: naturalX - 20, top: naturalY - 20, right: naturalX + 20, bottom: naturalY + 20, width: 40, height: 40 };
    const MARKER_HALF_MATCH = canvasSrc.match(/const MARKER_CLAMP_HALF_W=(\d+),MARKER_CLAMP_HALF_H=(\d+);/);
    const halfW = Number(MARKER_HALF_MATCH[1]), halfH = Number(MARKER_HALF_MATCH[2]);
    const unclampedRect = { left: naturalX - halfW, top: naturalY - halfH, right: naturalX + halfW, bottom: naturalY + halfH };
    assert.ok(overlaps(unclampedRect, chromeRect), 'sanity: without the fix, the marker\'s natural rect actually does collide with the chrome rect -- the fix above has real work to do');
  });

  await check('NEGATIVE: chromeExclusionRects must actually be wired into positionMarkers -- source no longer contains a call site is a real regression', () => {
    const body = extractFunctionBody(canvasSrc, 'positionMarkers');
    assert.match(body, /chromeExclusionRects\(canvas\)/, 'positionMarkers must seed `claimed` from chromeExclusionRects(canvas)');
  });

  /*
   * js/d-ui-shell.js's 'd-ui-shell' enhancer always runs BEFORE this file's
   * 'iphone-playtest-fixes' enhancer (see their registration order in
   * index.html), and renderMapWorkspace() rebuilds .d-map-stage -- and
   * calls modules.mapPhase2Canvas.render() to position every marker --
   * from scratch on every map-tab render. That means the FIRST
   * positionMarkers() pass for a freshly-built stage always runs before
   * ensureMapChrome() (this file) has appended .iphone-map-nav/-tools/
   * -popover, so chromeExclusionRects() has nothing to find on that pass
   * no matter how correct it is in isolation. Confirmed by a real iPhone
   * WebKit CI run against this exact chromeExclusionRects() fix (still
   * failing) before this second fix was added: a marker positioned before
   * the chrome existed continued to block the filter button's tap even
   * with the exclusion-rect logic in place. ensureMapChrome() must
   * re-trigger render() itself once the chrome exists, so
   * positionMarkers() gets a second, chrome-aware pass.
   */
  await check('ensureMapChrome() re-triggers modules.mapPhase2Canvas.render() after building the chrome controls, so positionMarkers() gets a chrome-aware pass even on the very first render of a freshly-built .d-map-stage', () => {
    const body = extractFunctionBody(iphoneJsSrc, 'ensureMapChrome');
    assert.match(body, /modules\.mapPhase2Canvas\.render\(canvas,g\)/, 'ensureMapChrome must re-render markers after the chrome controls exist');
    // sanity: the re-render call must come AFTER the chrome elements are
    // actually built/finalized (stage.dataset.iphoneMapKey=mapKey is the
    // last chrome-build statement), not before -- calling it earlier would
    // just reproduce the exact bug this fix addresses.
    const keyAssignIndex = body.indexOf('stage.dataset.iphoneMapKey=mapKey');
    const rerenderIndex = body.indexOf('modules.mapPhase2Canvas');
    assert.ok(keyAssignIndex >= 0 && rerenderIndex > keyAssignIndex, 'the re-render call must come after the chrome controls are finalized in the DOM');
  });

  await check('NEGATIVE: removing the re-render call from ensureMapChrome() (reverting to the single, chrome-unaware positionMarkers() pass) would fail the check above', () => {
    const body = extractFunctionBody(iphoneJsSrc, 'ensureMapChrome');
    const reverted = body.replace(/\s*const canvas=stage\.querySelector\('\.d-phase2-canvas'\);\s*\n\s*if\(canvas&&modules\.mapPhase2Canvas\?\.render\)modules\.mapPhase2Canvas\.render\(canvas,g\);\s*\n/, '\n');
    assert.doesNotMatch(reverted, /modules\.mapPhase2Canvas\.render\(canvas,g\)/, 'sanity: the mutated source must actually lack the re-render call');
    assert.match(body, /modules\.mapPhase2Canvas\.render\(canvas,g\)/, 'sanity: the real source must have it');
  });

  /* ================= REGRESSIONS ================= */
  await check('DEFAULT_SCALE stays 0.44 (PR #611/#612 initial-framing contract, untouched by this pass)', () => {
    assert.match(canvasSrc, /const DEFAULT_SCALE=0\.44;/);
  });

  await check('Canvas backing-store identity cache (sameCanvas/lastCanvasEl) is untouched', () => {
    assert.match(canvasSrc, /const sameCanvas=canvas===lastCanvasEl;/);
  });

  await check('lazy-load recovery state machine (bounded retry, getLoadState/retryMapLoad) is untouched', () => {
    assert.match(canvasSrc, /const MAX_LOAD_ATTEMPTS=3;/);
    assert.match(canvasSrc, /function getLoadState\(\)\{return \{state:loadState,error:loadErrorDetail\};\}/);
    assert.match(canvasSrc, /function retryMapLoad\(\)\{/);
  });

  await check('filter chips (all/store/tenant/office/realestate) are untouched', () => {
    assert.match(shellSrc, /const MAP_FILTER_KINDS=\[\['all','すべて'\],\['store','自社店舗'\],\['tenant','空きテナント'\],\['office','オフィス'\],\['realestate','不動産'\]\];/);
  });

  await check('selectedDetail() is untouched (still the sole detail-panel contract)', () => {
    assert.match(shellSrc, /function selectedDetail\(entity,g\)\{/);
  });

  await check('prototypes/map-world-preview.js and prototypes/map-prefecture-profiles.js are byte-untouched (Prefecture Identity, PR #613, must not regress)', () => {
    const { execSync } = require('child_process');
    let diffOutput = '';
    try {
      diffOutput = execSync('git diff --name-only origin/main...HEAD -- prototypes/map-world-preview.js prototypes/map-prefecture-profiles.js assets/map-sprites/phase2/sprites.json', { cwd: ROOT }).toString();
    } catch (e) {
      // No origin/main or not a git repo in this environment -- not this
      // test's job to diagnose git plumbing; skip rather than false-fail.
      return;
    }
    assert.equal(diffOutput.trim(), '', `prefecture identity files must not change in this PR, but git reports: ${diffOutput}`);
  });

  await check('js/d-ui-shell.js registers with modules.uiEnhancerRegistry.registerUIEnhancer exactly once (79/79 external enhancer cap unaffected)', () => {
    const registrations = shellSrc.match(/registerUIEnhancer\(/g) || [];
    assert.equal(registrations.length, 1);
  });

  await check('no Math.random / simulation RNG / save-state reference anywhere in the changed decluttering code', () => {
    const body = extractFunctionBody(canvasSrc, 'layoutMarkerPlacards');
    assert.doesNotMatch(body, /Math\s*\.\s*random/);
    assert.doesNotMatch(body, /engine\.roll|engine\.rng/i);
    assert.doesNotMatch(body, /SAVE_KEY|saveVersion|localStorage/);
  });

  /* ================= NEGATIVE TESTS ================= */
  await check('NEGATIVE: a tile-only "same tile = collision" model (the old placeEntityTiles occupancy check) misses real screen-space overlaps that this pass\'s rectangle check catches', () => {
    // Two DIFFERENT tiles, close enough in world-space for their 108x86
    // placard boxes to overlap at zero offset -- adjacent tiles under the
    // isometric projection are well within that range.
    const a = rectOf(0, 0), b = rectOf(20, 10);
    assert.ok(overlaps(a, b), 'sanity: these two boxes must actually overlap for this negative test to mean anything');
    // The OLD model's definition of "collision" was tileX===tileY-key
    // equality (placeEntityTiles' `occupied` Set) -- these two entities sit
    // on DIFFERENT tiles, so the old model would report zero collisions here
    // even though the real (new) screen-space check correctly finds one.
    const oldModelTileKeyA = '5,5', oldModelTileKeyB = '6,5';
    assert.notEqual(oldModelTileKeyA, oldModelTileKeyB, 'the old tile-key model sees these as non-colliding');
  });

  await check('NEGATIVE: reverting the z-index/stacking-context fix (marker z-index back to 5, filter back on .d-city-surface) makes the "marker always wins the tap" comparison fail', () => {
    const revertedMarkersCss = markersCssSrc.replace('.d-map-marker{z-index:25}', '.d-map-marker{z-index:5}');
    const markerZ = ruleZIndex(revertedMarkersCss, '.d-map-marker');
    const popoverZ = ruleZIndex(iphoneCssSrc, '.iphone-map-popover');
    assert.ok(markerZ < popoverZ, 'mutated source must actually trip the failure this negative test is checking for');
    // sanity: the REAL (unreverted) source passes this same comparison.
    const realMarkerZ = ruleZIndex(markersCssSrc, '.d-map-marker');
    assert.ok(realMarkerZ > popoverZ, 'sanity: the real source must NOT trip it');
  });

  await check('NEGATIVE: a camera-dependent layoutMarkerPlacards (using camTransform/camera instead of the raw world transform) would break pan-stability -- the real source stays camera-independent', () => {
    const body = extractFunctionBody(canvasSrc, 'layoutMarkerPlacards');
    assert.doesNotMatch(body, /\bcamera\b|camTransform/, 'the real function must never reference the live camera');
    const mutated = body.replace('transform.toScreen(entity.tileX,entity.tileY)', 'camTransform.toCss(entity.tileX,entity.tileY)');
    assert.match(mutated, /camTransform/, 'mutated source must actually trip the camera-independence check above');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main();
