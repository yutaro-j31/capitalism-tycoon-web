'use strict';
/*
 * Focused regression test for the "map-phase2-prefecture-canvas-lifecycle"
 * fix. Real iPhone playtesting of the merged production map (main
 * 91ac0bf1a1b39aee49b65765119b0d51e12fa6aa, after PR #611's zoom-out
 * calibration) found prefecture switching badly broken: a blank/mostly-
 * background-color canvas, a giant stretched fragment of the scenery, and
 * the legacy .d-map-tools bar (with its now-nonfunctional zoom-out/zoom-in
 * buttons, dead since PR #608 removed the zoom mechanism they used to
 * drive) reappearing at the bottom of the map.
 *
 * Root cause 1 (canvas backing-store lifecycle): js/d-ui-shell.js's
 * renderMapWorkspace() rebuilds .d-city-surface's innerHTML wholesale on
 * every render (prefecture switch included), so a brand new <canvas>
 * element replaces the old one every time. js/map-phase2-canvas.js's
 * render() used to skip re-running Base.sizeCanvas() (which sets both the
 * canvas's backing-store width/height AND its inline CSS width/height)
 * whenever the CSS size matched the PREVIOUS canvas's last-known size --
 * comparing only cssW/cssH, never canvas element identity. A same-size
 * prefecture switch (the common case: the viewport doesn't change size)
 * hit that skip on the fresh element, leaving its backing store at the
 * HTML canvas default of 300x150 while every paint call still assumed the
 * real (much larger) cssW/cssH -- a small fragment of the scenery
 * stretched to fill the element's real CSS box (100% via css/d-ui-map-
 * phase2-canvas.css), or just the background fill colour, depending on
 * where that tiny 300x150 window happened to land.
 *
 * Root cause 2 (dead legacy toolbar): js/d-ui-shell.js's
 * renderMapWorkspace() still generated .d-map-toolbar/.d-map-tools (with
 * dead zoom-out/zoom-in/filter/legend buttons wired to nothing in this
 * file's handleClick()) on every render, relying on js/iphone-playtest-
 * fixes.js's ensureMapChrome() enhancer to hide them afterward via
 * oldTools.hidden=true. That "generate dead markup, then hide it" pattern
 * is exactly what PR D's production promotion (docs/map-phase2-
 * production-integration-audit.md section 11) was supposed to have
 * retired -- it just hadn't been finished for these two elements, leaving
 * a JS-enhancer-timing-dependent window where a freshly rebuilt toolbar
 * could be visible before the hide step ran.
 *
 * Both fixes are the same file (js/map-phase2-canvas.js's canvas-identity
 * cache) plus a markup deletion (js/d-ui-shell.js/js/iphone-playtest-
 * fixes.js) -- no pinch zoom, no new camera.zoom field, no new gestures.
 *
 * Run directly: node tests/map-phase2-prefecture-switch-canvas-lifecycle-test.js
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
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/map-sprites/phase2/sprites.json'), 'utf8'));
const markersCssSrc = fs.readFileSync(path.join(ROOT, 'css/d-ui-map-phase2-markers.css'), 'utf8');

/* ---------------- sandbox + stubs (same approach as tests/map-phase2-canvas-test.js) ---------------- */
function freshSandbox(sourceOverride) {
  const sandbox = {
    console, location: { search: '' }, devicePixelRatio: 2, URLSearchParams,
    Promise, Object, Array, Math, JSON, Date,
    fetch: () => Promise.resolve({ json: () => Promise.resolve(manifest) }),
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(rendererSrc, sandbox, { filename: 'map-canvas-renderer.js' });
  vm.runInContext(worldSrc, sandbox, { filename: 'map-world-preview.js' });
  sandbox.__capitalismTycoonModules = {};
  vm.runInContext(sourceOverride || canvasSrc, sandbox, { filename: 'map-phase2-canvas.js' });
  return sandbox;
}

/* Records every canvas.width/height assignment (i.e. every real
   Base.sizeCanvas call) and every ctx.setTransform call, per distinct
   canvas object, so tests can tell whether a *specific* canvas element's
   backing store was actually (re)initialised. */
function stubCtx(canvas, calls) {
  return {
    setTransform(...args) { calls.setTransform.push(args); },
    clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    stroke() {}, ellipse() {}, arc() {}, setLineDash() {}, fillText() {}, fill() {}, drawImage() {},
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '',
  };
}
function makeCanvas(cssW, cssH) {
  const calls = { setTransform: [], sizeCanvasCalls: 0 };
  const canvas = {
    _cssW: cssW, _cssH: cssH, style: {},
    get width() { return this._width; }, set width(v) { this._width = v; calls.sizeCanvasCalls++; },
    get height() { return this._height; }, set height(v) { this._height = v; },
    getContext: () => stubCtx(canvas, calls),
    getBoundingClientRect: () => ({ width: canvas._cssW, height: canvas._cssH }),
  };
  canvas.__calls = calls;
  return canvas;
}

async function primeAssets(sandbox) {
  const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
  const warm = makeCanvas(100, 100);
  mod.render(warm, { selectedPref: 'tokyo' }); // placeholder pass: kicks off async asset load
  await new Promise(resolve => setTimeout(resolve, 300));
  return mod;
}

async function main() {
  /* ================= canvas identity / backing-store lifecycle (STEP: hypothesis 1) ================= */
  await check('fresh canvas, same CSS size as the previous canvas: its backing store IS (re)initialised, not skipped', async () => {
    const sandbox = freshSandbox();
    const mod = await primeAssets(sandbox);
    const canvasA = makeCanvas(374, 520);
    mod.render(canvasA, { selectedPref: 'tokyo' });
    assert.ok(canvasA.__calls.sizeCanvasCalls >= 1, 'canvas A must have its backing store set on first render');
    assert.equal(canvasA.width, 374 * 2, 'canvas A backing width must reflect cssW*dpr, not the 300px HTML default');

    const canvasB = makeCanvas(374, 520); // same CSS size as A, but a DIFFERENT element -- the prefecture-switch case
    mod.render(canvasB, { selectedPref: 'gunma' });
    assert.ok(canvasB.__calls.sizeCanvasCalls >= 1, 'fresh canvas B (same CSS size as A) must still have its OWN backing store set -- this is the bug: it used to be skipped');
    assert.equal(canvasB.width, 374 * 2, `canvas B backing width must be ${374 * 2} (cssW*dpr), not left at the HTML default (300) or some other stale value`);
    assert.equal(canvasB.height, 520 * 2, `canvas B backing height must be ${520 * 2}`);
  });

  await check('same canvas, same CSS size (a pan/select/filter redraw): backing store is NOT reinitialised (perf contract preserved)', async () => {
    const sandbox = freshSandbox();
    const mod = await primeAssets(sandbox);
    const canvas = makeCanvas(374, 520);
    mod.render(canvas, { selectedPref: 'tokyo' });
    const callsAfterFirst = canvas.__calls.sizeCanvasCalls;
    assert.ok(callsAfterFirst >= 1);
    mod.render(canvas, { selectedPref: 'tokyo' }); // same canvas object, same size -- e.g. a pan redraw
    assert.equal(canvas.__calls.sizeCanvasCalls, callsAfterFirst, 'reusing the same canvas element at the same CSS size must not reassign canvas.width/height again (that resets the backing store per the HTML5 canvas spec, and pan redraws happen far more often than real resizes)');
  });

  await check('same canvas, CSS size actually changed (a real resize): backing store IS reinitialised', async () => {
    const sandbox = freshSandbox();
    const mod = await primeAssets(sandbox);
    const canvas = makeCanvas(374, 520);
    mod.render(canvas, { selectedPref: 'tokyo' });
    const callsAfterFirst = canvas.__calls.sizeCanvasCalls;
    canvas._cssW = 390; canvas._cssH = 600;
    mod.render(canvas, { selectedPref: 'tokyo' });
    assert.ok(canvas.__calls.sizeCanvasCalls > callsAfterFirst, 'a genuine CSS size change on the same canvas must still resize the backing store');
  });

  /* ================= no blank/stretched canvas across a full prefecture sequence ================= */
  await check('Tokyo -> Gunma -> Saitama -> Tokyo -> Gunma -> Saitama, each on a FRESH canvas element (matching renderMapWorkspace()\'s wholesale rebuild): every canvas ends with a correct, non-default backing store', async () => {
    const sandbox = freshSandbox();
    const mod = await primeAssets(sandbox);
    const sequence = ['tokyo', 'gunma', 'saitama', 'tokyo', 'gunma', 'saitama'];
    const results = [];
    for (const prefID of sequence) {
      const canvas = makeCanvas(374, 520); // a fresh element every time, like renderMapWorkspace() produces
      mod.render(canvas, { selectedPref: prefID });
      results.push({ prefID, backingW: canvas.width, backingH: canvas.height, transformCalls: [...canvas.__calls.setTransform] });
      assert.notEqual(canvas.width, 300, `prefecture ${prefID}: canvas backing width must not be stuck at the HTML default (300)`);
      assert.notEqual(canvas.height, 150, `prefecture ${prefID}: canvas backing height must not be stuck at the HTML default (150)`);
      assert.equal(canvas.width, 374 * 2, `prefecture ${prefID}: backing width must match cssW*dpr`);
      assert.equal(canvas.height, 520 * 2, `prefecture ${prefID}: backing height must match cssH*dpr`);
    }
    // scale must stay DEFAULT_SCALE (0.44) throughout -- read back from the second (real-draw) ctx.setTransform
    // call's a-component (dpr*transform.scale), since dpr=2 is fixed by this sandbox.
    for (const r of results) {
      const realDraw = r.transformCalls.find(args => args[0] !== 2); // the placeholder pass uses setTransform(dpr,0,0,dpr,0,0); the real draw pass's second call uses dpr*scale
      assert.ok(realDraw, `prefecture ${r.prefID}: expected a real (non-placeholder) draw transform call`);
      const scale = realDraw[0] / 2;
      assert.ok(Math.abs(scale - 0.44) < 1e-9, `prefecture ${r.prefID}: expected DEFAULT_SCALE=0.44, computed ${scale}`);
    }
  });

  /* ================= no district rebuild / no placement rebuild during pan (still true after this fix) ================= */
  await check('render() rebuilds the district only when the resolved prefecture actually changes (same canvas, repeated redraw -- the pan-redraw case)', async () => {
    const sandbox = freshSandbox();
    const mod = await primeAssets(sandbox);
    const canvas = makeCanvas(374, 520);
    mod.render(canvas, { selectedPref: 'tokyo' });
    const MW = sandbox.MapWorldPreview;
    const originalBuild = MW.buildWorldDistrict;
    let buildCount = 0;
    MW.buildWorldDistrict = (...args) => { buildCount++; return originalBuild(...args); };
    mod.render(canvas, { selectedPref: 'tokyo' });
    mod.render(canvas, { selectedPref: 'tokyo' });
    assert.equal(buildCount, 0, 'same prefecture, repeated render (as a pan redraw would do): must not rebuild the district');
    mod.render(canvas, { selectedPref: 'gunma' });
    assert.equal(buildCount, 1, 'prefecture change: must rebuild exactly once');
    MW.buildWorldDistrict = originalBuild;
  });

  await check('render() never calls placeEntityTiles() itself -- entity placement is d-ui-shell.js\'s responsibility, not re-triggered by a Canvas redraw/pan', () => {
    const renderBody = canvasSrc.split('function render(')[1].split('\ninstallPanHandlers');
    assert.ok(renderBody[0].length > 0);
    assert.doesNotMatch(renderBody[0], /placeEntityTiles\(/);
  });

  /* ================= no legacy .d-map-tools / dead zoom controls (STEP: hypothesis 2) ================= */
  await check('renderMapWorkspace() (js/d-ui-shell.js) no longer generates .d-map-toolbar or .d-map-tools -- there is nothing left to hide via JS enhancer timing', () => {
    assert.doesNotMatch(shellSrc, /class="d-map-toolbar"/);
    assert.doesNotMatch(shellSrc, /class="d-map-tools"/);
    assert.doesNotMatch(shellSrc, /都市ビュー⌄/);
  });

  await check('the dead zoom-out/zoom-in glyph buttons (−/＋) are gone from js/d-ui-shell.js\'s map workspace markup', () => {
    const workspaceTemplate = shellSrc.split('workspace.innerHTML=')[1].split('\n')[0];
    assert.doesNotMatch(workspaceTemplate, /<button type="button">−<\/button>/);
    assert.doesNotMatch(workspaceTemplate, /<button type="button">＋<\/button>/);
  });

  await check('js/iphone-playtest-fixes.js no longer references .d-map-tools (the element it used to hide is gone, so ensureMapChrome() has nothing left to query for it)', () => {
    assert.doesNotMatch(iphoneFixesSrc, /querySelector\('\.d-map-tools'\)/);
  });

  await check('the real, wired iPhone map chrome (.iphone-map-nav/.iphone-map-tools/.iphone-map-popover, filter/legend/view) is still intact and unconditional (runs on every viewport, not just iPhone)', () => {
    assert.match(iphoneFixesSrc, /class='iphone-map-nav'|className='iphone-map-nav'/);
    assert.match(iphoneFixesSrc, /className='iphone-map-tools'/);
    assert.match(iphoneFixesSrc, /className='iphone-map-popover'/);
    for (const action of ['filter', 'legend', 'view']) assert.match(iphoneFixesSrc, new RegExp(`data-iphone-map-action="${action}"`));
    for (const removed of ['zoom-out', 'zoom-in', 'zoom-reset']) assert.doesNotMatch(iphoneFixesSrc, new RegExp(`data-iphone-map-action="${removed}"`));
  });

  /* ================= marker hit target / css cascade still holds ================= */
  await check('.d-map-marker stays 48x60 (>=44px hit target both dimensions) -- unaffected by this PR', () => {
    const sizeMatch = markersCssSrc.match(/\.d-map-marker\{width:(\d+)px;height:(\d+)px\}/);
    assert.ok(sizeMatch, '.d-map-marker size override must still be present');
    const w = Number(sizeMatch[1]), h = Number(sizeMatch[2]);
    assert.ok(w >= 44 && h >= 44, `hit target too small: ${w}x${h}`);
  });

  /* ================= determinism / save invariants ================= */
  await check('no Math.random anywhere in the changed files', () => {
    assert.ok(!canvasSrc.includes(['Math', 'random'].join('.')));
    assert.ok(!shellSrc.includes(['Math', 'random'].join('.')));
    assert.ok(!iphoneFixesSrc.includes(['Math', 'random'].join('.')));
  });

  await check('SAVE_KEY and saveVersion invariants are untouched by this PR', () => {
    const engineSrc = fs.readFileSync(path.join(ROOT, 'js/engine.js'), 'utf8');
    const saveV9Src = fs.readFileSync(path.join(ROOT, 'js/save-v9.js'), 'utf8');
    assert.match(engineSrc, /const SAVE_KEY = 'capitalism_tycoon_web_v1';/);
    assert.match(saveV9Src, /const SAVE_VERSION=9;/);
    assert.doesNotMatch(canvasSrc, /SAVE_KEY|saveVersion/);
    assert.doesNotMatch(shellSrc.split('function renderMapWorkspace')[1].split('\nfunction ')[0], /SAVE_KEY|saveVersion/);
  });

  /* ================= NEGATIVE 1: reverting the canvas-identity cache must fail the fresh-canvas test ================= */
  await check('NEGATIVE: a cache implementation that ignores canvas identity (the pre-fix code) fails the "fresh canvas must resize" contract above', async () => {
    const buggySrc = canvasSrc.replace(
      /const sameCanvas=canvas===lastCanvasEl;\s*\n\s*const dpr=\(sameCanvas&&cssW===lastCssW&&cssH===lastCssH&&lastDpr\)\?lastDpr:Base\.sizeCanvas\(canvas,cssW,cssH,globalThis\.devicePixelRatio\);\s*\n\s*lastCanvasEl=canvas;lastCssW=cssW;lastCssH=cssH;lastDpr=dpr;/,
      "const dpr=(cssW===lastCssW&&cssH===lastCssH&&lastDpr)?lastDpr:Base.sizeCanvas(canvas,cssW,cssH,globalThis.devicePixelRatio);\n  lastCssW=cssW;lastCssH=cssH;lastDpr=dpr;"
    );
    assert.notEqual(buggySrc, canvasSrc, 'sanity: the mutation must actually change the source');
    const sandbox = freshSandbox(buggySrc);
    const mod = await primeAssets(sandbox);
    const canvasA = makeCanvas(374, 520);
    mod.render(canvasA, { selectedPref: 'tokyo' });
    const canvasB = makeCanvas(374, 520); // fresh element, same CSS size
    mod.render(canvasB, { selectedPref: 'gunma' });
    assert.notEqual(canvasB.width, 374 * 2, 'the buggy (pre-fix) cache should leave canvas B at a stale/default backing width, reproducing the reported blank/stretched canvas');
  });

  /* ================= NEGATIVE 2: reintroducing the dead zoom buttons must fail the toolbar-removal contract ================= */
  await check('NEGATIVE: reintroducing .d-map-tools with zoom-out/zoom-in buttons into renderMapWorkspace() fails the removal contract above', () => {
    const withDeadToolbar = shellSrc.replace(
      'workspace.innerHTML=`<div class="d-map-stage"><div class="d-city-surface d-city-surface-phase2">',
      'workspace.innerHTML=`<div class="d-map-stage"><div class="d-map-tools"><button type="button">−</button><button type="button">＋</button></div><div class="d-city-surface d-city-surface-phase2">'
    );
    assert.notEqual(withDeadToolbar, shellSrc, 'sanity: the mutation must actually change the source');
    assert.match(withDeadToolbar, /class="d-map-tools"/, 'sanity: mutated source must trip the same check the removal test above uses');
    const workspaceTemplate = withDeadToolbar.split('workspace.innerHTML=')[1].split('\n')[0];
    assert.match(workspaceTemplate, /<button type="button">−<\/button>/, 'sanity: mutated source must trip the dead-button check above');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main();
