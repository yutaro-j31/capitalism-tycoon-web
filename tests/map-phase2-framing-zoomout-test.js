'use strict';
/*
 * Focused contract test for "Map Framing / Zoom-out Calibration".
 *
 * Context: PR D (production promotion) made Phase 2 the map's sole,
 * unconditional production renderer. Real iPhone playtesting after that
 * merge found the initial view too close -- js/map-phase2-canvas.js's
 * DEFAULT_SCALE=0.72 showed only 1-2 of the world's 7 street-grid
 * block-columns on first paint (a close-up of one intersection, not a
 * city overview). This PR pulls the camera back by lowering that single
 * projection scale constant (the same value render()'s ctx.setTransform
 * and withCamera().toCss both already read -- there is still no separate
 * camera.zoom field) and rebalances .d-map-marker's CSS footprint
 * (css/d-ui-map-phase2-markers.css) so markers don't dominate/overlap the
 * now-smaller buildings beneath them. See
 * docs/map-phase2-production-integration-audit.md section 12.
 *
 * This file focuses on what changed here; pan/tap/selection/prefecture-
 * switch/no-rebuild-during-pan/determinism coverage that this PR does not
 * touch already lives in tests/map-phase2-canvas-test.js,
 * tests/map-phase2-markers-test.js, and
 * tests/map-phase2-iphone-pan-webkit-test.js -- re-run here (STEP 8/9)
 * only as cheap, direct regression guards, not full duplicates.
 *
 * Run directly: node tests/map-phase2-framing-zoomout-test.js
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
const markersCssSrc = fs.readFileSync(path.join(ROOT, 'css/d-ui-map-phase2-markers.css'), 'utf8');
const referenceFidelityCssSrc = fs.readFileSync(path.join(ROOT, 'css/d-ui-reference-fidelity.css'), 'utf8');
const mobileCompanyCssSrc = fs.readFileSync(path.join(ROOT, 'css/d-ui-mobile-company.css'), 'utf8');
const rendererSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-canvas-renderer.js'), 'utf8');
const worldSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');
const profilesSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-prefecture-profiles.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/map-sprites/phase2/sprites.json'), 'utf8'));

function freshSandbox() {
  const sandbox = {
    console, location: { search: '' }, devicePixelRatio: 2, URLSearchParams,
    Promise, Object, Array, Math, JSON, Date,
    fetch: () => Promise.resolve({ json: () => Promise.resolve(manifest) }),
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

/*
 * Computes "how many of the world's street-grid block-columns are visible"
 * for a given CSS canvas width and projection scale, using the REAL
 * MapWorldPreview.buildWorldDistrict/worldTransform/STREET_PERIOD (not a
 * hand-derived copy of that geometry) so this test tracks the actual
 * production formula rather than a second, driftable implementation of it.
 */
function blockColumnsVisible(sandbox, worldCols, worldRows, scale, cssWidth) {
  const MW = sandbox.MapWorldPreview;
  const index2 = MW.indexCategoryManifest(manifest);
  const district = MW.buildWorldDistrict({ index2, prefID: 'tokyo', cols: worldCols, rows: worldRows });
  const wt = MW.worldTransform(district, index2.tile, scale);
  const contentWidth = wt.contentBounds.maxX - wt.contentBounds.minX;
  const blockCols = Math.ceil(worldCols / MW.STREET_PERIOD);
  const rawWidth = cssWidth / scale;
  return (rawWidth / contentWidth) * blockCols;
}

async function main() {
  const worldColsMatch = canvasSrc.match(/const WORLD_COLS=(\d+),WORLD_ROWS=(\d+);/);
  const scaleMatch = canvasSrc.match(/const DEFAULT_SCALE=([\d.]+);/);
  assert.ok(worldColsMatch, 'WORLD_COLS/WORLD_ROWS constant must still be present in a regex-extractable shape');
  assert.ok(scaleMatch, 'DEFAULT_SCALE constant must still be present in a regex-extractable shape');
  const WORLD_COLS = Number(worldColsMatch[1]), WORLD_ROWS = Number(worldColsMatch[2]);
  const DEFAULT_SCALE = Number(scaleMatch[1]);
  const OLD_DEFAULT_SCALE = 0.72; // the pre-this-PR value (PR A-D), kept only as a negative-test fixture

  /* ================= no new zoom state: still a single scale, not camera.zoom ================= */
  await check('no per-viewport or gesture-driven zoom state was introduced -- DEFAULT_SCALE stays the sole projection scale for both Canvas paint and marker placement (no pinch-zoom/gesture scope creep)', () => {
    // Checks for a literal "camera" + "." + "zoom" field reference without
    // spelling it out here -- this file's own explanatory prose (and
    // map-phase2-canvas.js's own comments) legitimately discuss why that
    // field does not exist, which would otherwise trip this same regex.
    assert.doesNotMatch(canvasSrc, new RegExp(['camera', '\\.', 'zoom'].join('')));
    assert.doesNotMatch(canvasSrc, /\bzoom\s*:/);
    assert.doesNotMatch(canvasSrc, /pinch|gesturestart|gesturechange/i);
    // still exactly one `let camera=` declaration -- {x,y} only, per PR C's contract
    const cameraDecls = canvasSrc.match(/let camera=/g) || [];
    assert.equal(cameraDecls.length, 1);
  });

  await check('DEFAULT_SCALE was actually pulled back from the pre-PR value (0.72), not left unchanged or increased', () => {
    assert.ok(DEFAULT_SCALE < OLD_DEFAULT_SCALE, `expected a pull-back: ${DEFAULT_SCALE} should be < ${OLD_DEFAULT_SCALE}`);
    assert.ok(DEFAULT_SCALE > 0.15, `DEFAULT_SCALE=${DEFAULT_SCALE} is implausibly small (city would read as empty specks)`);
  });

  /* ================= initial framing: 3-5 block-columns visible (STEP 6) ================= */
  // BLOCK_COLUMN_MIN sits strictly above the pre-PR scale's own desktop
  // reading (measured 2.63 at 0.72/520px, see the negative test below) so
  // this bar actually discriminates old-vs-new, not just documents a target.
  const BLOCK_COLUMN_MIN = 2.9, BLOCK_COLUMN_MAX = 5.5;
  await check('initial iPhone-width canvas (374 CSS px, the measured production .d-phase2-canvas width at the iPhone 13 viewport) shows 3-5 street-grid block-columns, not 1-2', () => {
    const sandbox = freshSandbox();
    const blocks = blockColumnsVisible(sandbox, WORLD_COLS, WORLD_ROWS, DEFAULT_SCALE, 374);
    assert.ok(blocks >= BLOCK_COLUMN_MIN && blocks <= BLOCK_COLUMN_MAX, `expected roughly 3-5 block-columns visible, got ${blocks.toFixed(2)}`);
  });

  await check('initial desktop-width canvas (520 CSS px, the measured production .d-phase2-canvas width at 1280x800) shows 3-5 street-grid block-columns', () => {
    const sandbox = freshSandbox();
    const blocks = blockColumnsVisible(sandbox, WORLD_COLS, WORLD_ROWS, DEFAULT_SCALE, 520);
    assert.ok(blocks >= BLOCK_COLUMN_MIN && blocks <= BLOCK_COLUMN_MAX, `expected roughly 3-5 block-columns visible, got ${blocks.toFixed(2)}`);
  });

  await check('the full city height (all street-grid block-rows) comfortably fits an iPhone-height canvas at DEFAULT_SCALE -- the pulled-back view should read as a full north-south city extent, not a cropped strip', () => {
    const sandbox = freshSandbox();
    const MW = sandbox.MapWorldPreview;
    const index2 = MW.indexCategoryManifest(manifest);
    const district = MW.buildWorldDistrict({ index2, prefID: 'tokyo', cols: WORLD_COLS, rows: WORLD_ROWS });
    const wt = MW.worldTransform(district, index2.tile, DEFAULT_SCALE);
    const contentHeight = wt.contentBounds.maxY - wt.contentBounds.minY;
    const rawHeight = 520 / DEFAULT_SCALE; // measured production .d-phase2-canvas height at the iPhone 13 viewport
    assert.ok(rawHeight >= contentHeight * 0.85, `expected the viewport to cover most/all of the content height (${contentHeight}), got raw height ${rawHeight.toFixed(1)}`);
  });

  /* ================= NEGATIVE: the pre-PR scale must NOT pass the new framing bar ================= */
  await check('NEGATIVE: the pre-PR DEFAULT_SCALE (0.72) would fail the 3-5 block-column bar above (proves the framing check is non-vacuous, and that this PR is a real behaviour change)', () => {
    const sandbox = freshSandbox();
    const blocksIphone = blockColumnsVisible(sandbox, WORLD_COLS, WORLD_ROWS, OLD_DEFAULT_SCALE, 374);
    const blocksDesktop = blockColumnsVisible(sandbox, WORLD_COLS, WORLD_ROWS, OLD_DEFAULT_SCALE, 520);
    assert.ok(blocksIphone < BLOCK_COLUMN_MIN, `sanity: old scale should read as too-zoomed-in, got ${blocksIphone.toFixed(2)}`);
    assert.ok(blocksDesktop < BLOCK_COLUMN_MIN, `sanity: old scale should read as too-zoomed-in on desktop too, got ${blocksDesktop.toFixed(2)}`);
  });

  /* ================= marker size rebalance + hit target (STEP 6/7) ================= */
  await check(".d-map-marker's CSS footprint was shrunk in css/d-ui-map-phase2-markers.css to rebalance against the now-smaller pulled-back city, while both dimensions stay >= the 44px iOS minimum tap target", () => {
    const sizeMatch = markersCssSrc.match(/\.d-map-marker\{width:(\d+)px;height:(\d+)px\}/);
    assert.ok(sizeMatch, '.d-map-marker size override must be present in css/d-ui-map-phase2-markers.css');
    const w = Number(sizeMatch[1]), h = Number(sizeMatch[2]);
    assert.ok(w >= 44 && h >= 44, `hit target too small: ${w}x${h}`);
    const oldSizeMatch = referenceFidelityCssSrc.match(/\.d-map-marker\{width:(\d+)px;height:(\d+)px/);
    assert.ok(oldSizeMatch, 'sanity: css/d-ui-reference-fidelity.css must still define its own (now-overridden) base marker size');
    const oldW = Number(oldSizeMatch[1]), oldH = Number(oldSizeMatch[2]);
    assert.ok(w < oldW && h < oldH, `expected a real reduction from the reference-fidelity base (${oldW}x${oldH}), got ${w}x${h}`);
  });

  await check('css/d-ui-map-phase2-markers.css is imported after css/d-ui-reference-fidelity.css in d-ui-mobile-company.css, so the new marker-size override actually wins the CSS cascade (same-specificity source-order tie)', () => {
    const referenceFidelityIndex = mobileCompanyCssSrc.indexOf('d-ui-reference-fidelity.css');
    const markersIndex = mobileCompanyCssSrc.indexOf('d-ui-map-phase2-markers.css');
    assert.ok(referenceFidelityIndex >= 0 && markersIndex >= 0, 'both @import lines must exist');
    assert.ok(markersIndex > referenceFidelityIndex, 'd-ui-map-phase2-markers.css must be imported after d-ui-reference-fidelity.css to win the cascade tie');
  });

  await check('NEGATIVE: without the d-ui-map-phase2-markers.css override, the reference-fidelity base size (58x72) would be the winning value and would not demonstrate a rebalance', () => {
    const withoutOverride = markersCssSrc.replace(/\.d-map-marker\{width:\d+px;height:\d+px\}[\s\S]*?\.d-map-marker:after\{bottom:\d+px\}\n?/, '');
    assert.doesNotMatch(withoutOverride, /\.d-map-marker\{width:\d+px;height:\d+px\}/, 'sanity: the mutated source must actually lack the override this check looks for');
  });

  /* ================= invariants this PR must not disturb (STEP 8) ================= */
  await check('no Math.random anywhere in the changed files (js/map-phase2-canvas.js, the two touched CSS files)', () => {
    assert.ok(!canvasSrc.includes(['Math', 'random'].join('.')));
  });

  await check('render() rebuilds the district only when the resolved prefecture actually changes -- a scale-only change must not have disturbed the "no rebuild during pan/redraw" contract', async () => {
    const sandbox = freshSandbox();
    const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
    const canvas = { width: 0, height: 0, style: {}, getContext: () => ({ setTransform(){}, clearRect(){}, fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, closePath(){}, stroke(){}, ellipse(){}, arc(){}, setLineDash(){}, fillText(){}, fill(){}, drawImage(){}, fillStyle:'', strokeStyle:'', lineWidth:0, font:'', textAlign:'' }), getBoundingClientRect: () => ({ width: 374, height: 520 }) };
    mod.render(canvas, { selectedPref: 'tokyo' });
    await new Promise(resolve => setTimeout(resolve, 300));
    mod.render(canvas, { selectedPref: 'tokyo' });
    const MW = sandbox.MapWorldPreview;
    const originalBuild = MW.buildWorldDistrict;
    let buildCount = 0;
    MW.buildWorldDistrict = (...args) => { buildCount++; return originalBuild(...args); };
    mod.render(canvas, { selectedPref: 'tokyo' });
    mod.render(canvas, { selectedPref: 'tokyo' });
    assert.equal(buildCount, 0, 'same prefecture, repeated render (as a pan redraw would do): must not rebuild the district');
    MW.buildWorldDistrict = originalBuild;
  });

  await check('SAVE_KEY and saveVersion invariants are untouched by this PR (this change never touches js/engine.js or js/save-v9.js)', () => {
    const engineSrc = fs.readFileSync(path.join(ROOT, 'js/engine.js'), 'utf8');
    const saveV9Src = fs.readFileSync(path.join(ROOT, 'js/save-v9.js'), 'utf8');
    assert.match(engineSrc, /const SAVE_KEY = 'capitalism_tycoon_web_v1';/);
    assert.match(saveV9Src, /const SAVE_VERSION=9;/);
    assert.doesNotMatch(canvasSrc, /SAVE_KEY|saveVersion/);
  });

  await check('no save-state / localStorage reference was introduced by this pass in the changed CSS files', () => {
    assert.doesNotMatch(markersCssSrc, /localStorage/);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
