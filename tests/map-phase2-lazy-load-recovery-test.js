'use strict';
/*
 * Focused regression test for the Phase 2 map lazy-load recovery fix.
 *
 * Real production incident: a real iPhone hit "出店候補を読み込み中です"
 * forever on the published GitHub Pages map -- switching prefectures did
 * nothing. Root cause (confirmed by reading main's source, not guessed):
 * js/map-phase2-canvas.js's old ensureAssetsLoaded() cached its
 * assetsPromise/manifestPromise unconditionally, including on FAILURE
 * (`.catch(()=>null)` just resolved to null forever; a rejected
 * manifestPromise is still truthy, so `manifestPromise||fetch(...)` never
 * retried it either). A single transient failure -- anywhere in the chain
 * -- permanently prevented assetsReady from ever being set, and every
 * subsequent render() call kept hitting the same dead cached promise.
 *
 * This file tests the bounded-retry state machine that replaces that
 * (idle -> loading -> ready, or idle -> loading -> retry* -> error), NOT
 * the map's rendering/geometry/marker-placement behavior itself -- those
 * are already covered in depth by tests/map-phase2-canvas-test.js,
 * tests/map-phase2-markers-test.js, tests/map-phase2-prefecture-switch-
 * canvas-lifecycle-test.js, tests/map-phase2-framing-zoomout-test.js, and
 * tests/map-prefecture-identity-regional-variation-test.js, all of which
 * still pass unmodified (their fetch mocks needed one addition -- `ok:
 * true`, since production now checks response.ok -- but their own
 * assertions are untouched).
 *
 * Run directly: node tests/map-phase2-lazy-load-recovery-test.js
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
const smokeSrc = fs.readFileSync(path.join(ROOT, 'scripts/pages-deployment-smoke.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/map-sprites/phase2/sprites.json'), 'utf8'));
const PROTOTYPE_SCRIPTS = ['./prototypes/map-canvas-renderer.js', './prototypes/map-prefecture-profiles.js', './prototypes/map-world-preview.js'];
const PROTOTYPE_GLOBALS = ['MapCanvas', 'MapPrefectureProfiles', 'MapWorldPreview'];
const PROTOTYPE_SOURCES = [
  fs.readFileSync(path.join(ROOT, 'prototypes/map-canvas-renderer.js'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'prototypes/map-prefecture-profiles.js'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8'),
];

/*
 * A controllable fake <script>-injecting document: `scriptOutcomes[src]`
 * is an array of 'fail'/'ok' outcomes consumed in order, one per
 * appendChild call for that src (repeating the last entry once
 * exhausted). On 'ok' it evaluates that script's REAL production source
 * into the same sandbox (exactly what a real <script> load would do),
 * setting the real PROTOTYPE_GLOBALS entry -- not a fake stub -- so
 * ensureAssetsLoaded()'s real MW.indexCategoryManifest()/loadSprites()
 * calls keep working after a recovery. appendCounts tracks how many times
 * each src was actually appended, so a test can prove an already-
 * succeeded script is never re-loaded on a partial-failure retry.
 */
function makeControllableDocument(sandbox, scriptOutcomes, appendCounts) {
  return {
    createElement() {
      const el = {};
      Object.defineProperty(el, 'src', {
        set(value) {
          this._src = value;
          /*
           * Production now injects these with a deterministic ?rev= cache
           * cache-busting stamp (scripts/asset-revision.js). This bookkeeping is
           * about WHICH module was injected and HOW MANY times it was retried,
           * so the stamp is stripped and the identity is what gets counted --
           * otherwise every retry assertion below would key off a value that
           * changes whenever any map asset's content changes.
           */
          const src = String(value).split(/[?#]/)[0];
          appendCounts[src] = (appendCounts[src] || 0) + 1;
          const queue = scriptOutcomes[src] || ['ok'];
          const index = Math.min(appendCounts[src] - 1, queue.length - 1);
          const outcome = queue[index];
          queueMicrotask(() => {
            if (outcome === 'fail') { this.onerror && this.onerror(); return; }
            const scriptIndex = PROTOTYPE_SCRIPTS.indexOf(src);
            if (scriptIndex !== -1) vm.runInContext(PROTOTYPE_SOURCES[scriptIndex], sandbox, { filename: src });
            this.onload && this.onload();
          });
        },
        get() { return this._src; },
      });
      return el;
    },
    head: { appendChild() {} },
  };
}

/*
 * A controllable fetch: `outcomes` is an array of 'fail'/'ok'/'bad-manifest'
 * consumed in order (repeating the last once exhausted) -- lets a test
 * script "the manifest fetch fails once, then succeeds" without any real
 * network or timer trickery beyond the production code's own setTimeout.
 */
function makeControllableFetch(outcomes, goodManifest) {
  let calls = 0;
  return () => {
    const index = Math.min(calls, outcomes.length - 1);
    calls++;
    const outcome = outcomes[index];
    if (outcome === 'fail') return Promise.reject(new Error('simulated network failure'));
    if (outcome === 'bad-manifest') return Promise.resolve({ ok: true, json: () => Promise.resolve({ sprites: 'not-an-array' }) });
    if (outcome === 'http-error') return Promise.resolve({ ok: false, status: 500 });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(goodManifest) });
  };
}

function freshSandbox({ scriptOutcomes = {}, fetchOutcomes = ['ok'], sourceOverride } = {}) {
  const appendCounts = {};
  const sandbox = {
    console, devicePixelRatio: 2,
    Promise, Object, Array, Math, JSON, Date, Number, String, Map, Set,
    setTimeout, clearTimeout,
    fetch: makeControllableFetch(fetchOutcomes, manifest),
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.document = makeControllableDocument(sandbox, scriptOutcomes, appendCounts);
  vm.createContext(sandbox);
  sandbox.__capitalismTycoonModules = {};
  vm.runInContext(sourceOverride || canvasSrc, sandbox, { filename: 'map-phase2-canvas.js' });
  return { sandbox, appendCounts, mod: sandbox.__capitalismTycoonModules.mapPhase2Canvas };
}

function stubCanvas() {
  return {
    width: 0, height: 0, style: {},
    getContext: () => ({
      setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
      stroke() {}, ellipse() {}, arc() {}, setLineDash() {}, fillText() {}, fill() {}, drawImage() {},
      fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '',
    }),
    getBoundingClientRect: () => ({ width: 1280, height: 680 }),
  };
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitUntil(fn, { timeoutMs = 6000, stepMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return;
    await wait(stepMs);
  }
  throw new Error(`waitUntil timed out after ${timeoutMs}ms`);
}

async function main() {

/* =================== LOADING -> READY (STEP 15) =================== */

await check('healthy first attempt: idle -> loading -> ready, assetsReady set, no error', async () => {
  const { mod } = freshSandbox({});
  const canvas = stubCanvas();
  mod.render(canvas, { selectedPref: 'tokyo' });
  assert.equal(mod.getLoadState().state, 'loading');
  await waitUntil(() => mod.getLoadState().state === 'ready');
  assert.equal(mod.getLoadState().error, null);
});

/* =================== BOUNDED RETRY RECOVERS (STEP 1/2/6/15) =================== */

await check('first prototype script failure recovers via bounded retry (loading -> ready, not stuck)', async () => {
  const { mod } = freshSandbox({ scriptOutcomes: { './prototypes/map-canvas-renderer.js': ['fail', 'ok'] } });
  mod.render(stubCanvas(), { selectedPref: 'tokyo' });
  await waitUntil(() => mod.getLoadState().state === 'ready', { timeoutMs: 5000 });
});

await check('first manifest fetch failure recovers via bounded retry (loading -> ready, not stuck)', async () => {
  const { mod } = freshSandbox({ fetchOutcomes: ['fail', 'ok'] });
  mod.render(stubCanvas(), { selectedPref: 'tokyo' });
  await waitUntil(() => mod.getLoadState().state === 'ready', { timeoutMs: 5000 });
});

await check('two consecutive manifest fetch failures still recover within MAX_LOAD_ATTEMPTS (3rd attempt succeeds)', async () => {
  const { mod } = freshSandbox({ fetchOutcomes: ['fail', 'fail', 'ok'] });
  mod.render(stubCanvas(), { selectedPref: 'tokyo' });
  await waitUntil(() => mod.getLoadState().state === 'ready', { timeoutMs: 5000 });
});

/* =================== PARTIAL-SUCCESS IDEMPOTENCY (STEP 3) =================== */

await check('partial prototype load: the script that already succeeded is never re-appended on a later retry', async () => {
  const { mod, appendCounts } = freshSandbox({
    scriptOutcomes: { './prototypes/map-world-preview.js': ['fail', 'ok'] },
  });
  mod.render(stubCanvas(), { selectedPref: 'tokyo' });
  await waitUntil(() => mod.getLoadState().state === 'ready', { timeoutMs: 5000 });
  assert.equal(appendCounts['./prototypes/map-canvas-renderer.js'], 1, 'script 1 (never failed) must load exactly once');
  assert.equal(appendCounts['./prototypes/map-prefecture-profiles.js'], 1, 'script 2 (never failed) must load exactly once');
  assert.equal(appendCounts['./prototypes/map-world-preview.js'], 2, 'script 3 (failed once) must be attempted exactly twice, not more');
});

/* =================== EXHAUSTED RETRIES -> EXPLICIT ERROR, NEVER STUCK LOADING (STEP 6/7/15) =================== */

await check('manifest validation failure exhausts retries and reaches an explicit error state, tagged manifest-validation', async () => {
  const { mod } = freshSandbox({ fetchOutcomes: ['bad-manifest'] });
  mod.render(stubCanvas(), { selectedPref: 'tokyo' });
  await waitUntil(() => mod.getLoadState().state === 'error', { timeoutMs: 5000 });
  assert.equal(mod.getLoadState().error.stage, 'manifest-validation');
});

await check('permanent manifest fetch failure exhausts retries and reaches error, tagged manifest-fetch (never stuck in loading forever)', async () => {
  const { mod } = freshSandbox({ fetchOutcomes: ['fail'] });
  mod.render(stubCanvas(), { selectedPref: 'tokyo' });
  await waitUntil(() => mod.getLoadState().state === 'error', { timeoutMs: 5000 });
  assert.equal(mod.getLoadState().error.stage, 'manifest-fetch');
});

await check('permanent HTTP error (500) on the manifest exhausts retries and reaches error', async () => {
  const { mod } = freshSandbox({ fetchOutcomes: ['http-error'] });
  mod.render(stubCanvas(), { selectedPref: 'tokyo' });
  await waitUntil(() => mod.getLoadState().state === 'error', { timeoutMs: 5000 });
  assert.equal(mod.getLoadState().error.stage, 'manifest-fetch');
});

await check('permanent prototype script failure exhausts retries and reaches error, tagged prototype', async () => {
  const { mod } = freshSandbox({ scriptOutcomes: { './prototypes/map-prefecture-profiles.js': ['fail'] } });
  mod.render(stubCanvas(), { selectedPref: 'tokyo' });
  await waitUntil(() => mod.getLoadState().state === 'error', { timeoutMs: 5000 });
  assert.equal(mod.getLoadState().error.stage, 'prototype');
});

/* =================== USER-TRIGGERED RETRY BUTTON (STEP 7/15) =================== */

await check('retryMapLoad() after exhausted retries recovers once the underlying failure clears (error -> loading -> ready)', async () => {
  const { sandbox, mod } = freshSandbox({ fetchOutcomes: ['fail'] });
  mod.render(stubCanvas(), { selectedPref: 'tokyo' });
  await waitUntil(() => mod.getLoadState().state === 'error', { timeoutMs: 5000 });
  sandbox.fetch = makeControllableFetch(['ok'], manifest);
  mod.retryMapLoad();
  assert.equal(mod.getLoadState().state, 'loading', 'retryMapLoad must synchronously move out of error');
  await waitUntil(() => mod.getLoadState().state === 'ready', { timeoutMs: 5000 });
});

await check('retryMapLoad() is a no-op while a load is already in progress (does not restart/duplicate an in-flight attempt)', async () => {
  const { mod } = freshSandbox({ fetchOutcomes: ['fail', 'fail', 'ok'] });
  mod.render(stubCanvas(), { selectedPref: 'tokyo' });
  assert.equal(mod.getLoadState().state, 'loading');
  mod.retryMapLoad(); // must not disturb the in-progress bounded retry sequence
  await waitUntil(() => mod.getLoadState().state === 'ready', { timeoutMs: 5000 });
});

/* =================== d-ui-shell.js: error/retry UI wiring (STEP 7) =================== */

await check('js/d-ui-shell.js shows an explicit error + retry control (not the loading text) when getLoadState().state is \'error\'', () => {
  assert.match(shellSrc, /loadState\.state===['"]error['"]/);
  assert.match(shellSrc, /d-map-load-error/);
  assert.match(shellSrc, /data-d-ui-action="map-retry"/);
  assert.match(shellSrc, /マップの読み込みに失敗しました/);
  assert.match(shellSrc, /再試行/);
});

await check('js/d-ui-shell.js never surfaces the internal error stage/message (loadErrorDetail) to the user -- diagnostics stay console-only', () => {
  const markersBlock = shellSrc.split('let markersHTML=')[1].split('const filterChips=')[0];
  assert.doesNotMatch(markersBlock, /loadState\.error\.(stage|message)/, 'must not interpolate the technical error into user-visible markup');
});

await check('the map-retry click action calls retryMapLoad() then re-renders (handleClick wiring)', () => {
  assert.match(shellSrc, /action==='map-retry'.*retryMapLoad\?\.\(\)/);
});

await check('the retry button meets the 44px minimum iOS tap target', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/d-ui-map-phase2-markers.css'), 'utf8');
  const rule = css.match(/\.d-map-retry-btn\{([^}]*)\}/);
  assert.ok(rule, '.d-map-retry-btn rule must exist');
  assert.match(rule[1], /min-width:\s*44px/);
  assert.match(rule[1], /min-height:\s*44px/);
});

/* =================== NO POLLING / BOUNDED RETRY DISCIPLINE (STEP 6) =================== */

await check('no setInterval call anywhere in the load/retry machinery (bounded one-shot setTimeout only)', () => {
  assert.doesNotMatch(canvasSrc, /[^a-zA-Z]setInterval\s*\(/);
});

await check('MAX_LOAD_ATTEMPTS is a small, bounded constant (not unbounded retry)', () => {
  const match = canvasSrc.match(/const MAX_LOAD_ATTEMPTS=(\d+);/);
  assert.ok(match, 'MAX_LOAD_ATTEMPTS must be declared as a literal constant');
  const n = Number(match[1]);
  assert.ok(n >= 2 && n <= 5, `MAX_LOAD_ATTEMPTS should be a small bounded number, saw ${n}`);
});

/* =================== SAVE / RNG INVARIANTS =================== */

await check('no Math.random, no simulation RNG, no save-state reference in the changed lazy-load code', () => {
  assert.doesNotMatch(canvasSrc, /Math\s*\.\s*random/);
  assert.doesNotMatch(canvasSrc, /engine\.roll|engine\.rng/);
  assert.doesNotMatch(canvasSrc, /SAVE_KEY|saveVersion|localStorage/);
});

/* =================== DEPLOYMENT TARGET COVERAGE (STEP 4/16) =================== */

await check('scripts/pages-deployment-smoke.js includes the lazy prototype scripts and the sprite manifest + every referenced sprite as deployment targets', () => {
  const smoke = require(path.join(ROOT, 'scripts/pages-deployment-smoke.js'));
  const targets = smoke.deploymentTargets(ROOT);
  for (const src of PROTOTYPE_SCRIPTS) {
    assert.ok(targets.includes(src.replace(/^\.\//, '')), `deployment targets must include ${src}`);
  }
  assert.ok(targets.includes('assets/map-sprites/phase2/sprites.json'));
  const spriteCount = manifest.sprites.length;
  const spriteTargets = targets.filter(t => t.includes('/map-sprites/') && t.endsWith('.png'));
  assert.equal(spriteTargets.length, spriteCount, `every one of the ${spriteCount} manifest sprites must be a deployment target`);
});

await check('pages-deployment-smoke.js reads PROTOTYPE_SCRIPTS from js/map-phase2-canvas.js itself, not a second hardcoded copy', () => {
  assert.match(smokeSrc, /const PROTOTYPE_SCRIPTS=\\\[/, 'must regex-extract the production array literal, not hand-maintain its own list');
});

/* =================== published WebKit coverage exists (STEP 5/C) =================== */

await check('a published-URL WebKit test exists that actually opens the map, waits for the loading placeholder to resolve, and checks the canvas is painted', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tests/published-map-phase2-webkit-test.js'), 'utf8');
  assert.match(src, /waitForMapLoadResolved/);
  assert.match(src, /d-map-load-error/);
  assert.match(src, /getImageData/);
  assert.match(src, /d-map-marker/);
  assert.match(src, /data-iphone-pref/);
});

await check('the new published map test is wired into pages-deployment-smoke.yml\'s verify-published-assets job', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/pages-deployment-smoke.yml'), 'utf8');
  assert.match(workflow, /node tests\/published-map-phase2-webkit-test\.js/);
  assert.match(workflow, /MAP_PHASE2_TARGET_URL: https:\/\/yutaro-j31\.github\.io\/capitalism-tycoon-web\//);
});

/* =================== NEGATIVE TESTS (STEP 15) =================== */

await check('NEGATIVE: reverting to the old permanent-cache (.catch(()=>null), never-reset) model leaves the map stuck after a single transient failure -- proves the fix above is load-bearing', async () => {
  const startMarker = '/*\n * ---- lazy-load recovery (bounded-retry state machine) ----';
  const endMarker = 'function getLoadState(){return {state:loadState,error:loadErrorDetail};}';
  const startIndex = canvasSrc.indexOf(startMarker);
  const endIndex = canvasSrc.indexOf(endMarker);
  assert.ok(startIndex !== -1 && endIndex !== -1 && endIndex > startIndex, 'source anchors not found -- test itself is broken');
  const reverted = canvasSrc.slice(0, startIndex)
    + (
      `let assetsReady=null;
let prototypesPromise=null;
function ensurePrototypesLoaded(){
  if(globalThis.MapCanvas&&globalThis.MapPrefectureProfiles&&globalThis.MapWorldPreview)return Promise.resolve();
  if(typeof document==='undefined')return Promise.reject(new Error('map-phase2-canvas: document unavailable'));
  if(prototypesPromise)return prototypesPromise;
  const loadScript=src=>new Promise((resolve,reject)=>{
    const el=document.createElement('script');
    el.src=src;el.onload=()=>resolve();el.onerror=()=>reject(new Error('map-phase2-canvas: failed to load '+src));
    document.head.appendChild(el);
  });
  prototypesPromise=PROTOTYPE_SCRIPTS.reduce((chain,src)=>chain.then(()=>loadScript(src)),Promise.resolve())
    .catch(error=>{prototypesPromise=null;throw error;});
  return prototypesPromise;
}
let manifestPromise=null;
let assetsPromise=null;
function ensureAssetsLoaded(){
  const MW=globalThis.MapWorldPreview;
  if(!MW)return Promise.resolve(null);
  if(assetsPromise)return assetsPromise;
  manifestPromise=manifestPromise||fetch(MANIFEST_URL).then(res=>res.json());
  assetsPromise=manifestPromise.then(manifest=>{
    const index2=MW.indexCategoryManifest(manifest);
    if(!index2.ok)return null;
    const legacyIndex=Object.assign({},index2,{sprites:index2.sprites.filter(s=>s.placeholder)});
    const newIndex=Object.assign({},index2,{sprites:index2.sprites.filter(s=>!s.placeholder)});
    return Promise.all([MW.loadSprites(legacyIndex,IMAGE_BASE),MW.loadSprites(newIndex,ASSET_BASE)])
      .then(([legacyResult,newResult])=>({index2,images:Object.assign({},legacyResult.images,newResult.images)}));
  }).catch(()=>null);
  return assetsPromise;
}
function ensureMapReady(){
  ensurePrototypesLoaded().then(ensureAssetsLoaded).then(result=>{
    if(!result||assetsReady)return;
    assetsReady=result;
    modules.dUIShell?.enhance?.(true);
    modules.uiEnhancerRegistry?.runUIEnhancers?.();
  }).catch(()=>{});
}
function retryMapLoad(){ensureMapReady();}
function getLoadState(){return {state:assetsReady?'ready':'loading',error:null};}`
    )
    + canvasSrc.slice(endIndex + endMarker.length);
  assert.notEqual(reverted, canvasSrc, 'source replace did not match -- test itself is broken');

  const scratchPath = path.join(ROOT, 'js/_scratch-lazy-load-negtest.js');
  fs.writeFileSync(scratchPath, reverted);
  try {
    delete require.cache[require.resolve(scratchPath)];
    const revertedSrc = fs.readFileSync(scratchPath, 'utf8');
    const { mod } = freshSandbox({ fetchOutcomes: ['fail', 'ok'], sourceOverride: revertedSrc });
    mod.render(stubCanvas(), { selectedPref: 'tokyo' });
    await wait(2500); // longer than this file's own bounded retry window would need
    assert.notEqual(mod.getLoadState().state, 'ready', 'the reverted permanent-cache model must NOT recover even though the underlying fetch would have succeeded on a real retry -- if this fails, the negative test itself is broken');
  } finally {
    fs.unlinkSync(scratchPath);
  }
});

await check('NEGATIVE: removing the lazy prototype scripts / sprite manifest extraction leaves them absent from deployment targets -- proves the deployment-target fix above is load-bearing', () => {
  const smoke = require(path.join(ROOT, 'scripts/pages-deployment-smoke.js'));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const htmlOnlyTargets = new Set(['index.html', 'play.html', 'release-candidate.json', ...smoke.extractAssetPaths(html)]);
  for (const src of PROTOTYPE_SCRIPTS) {
    assert.ok(!htmlOnlyTargets.has(src.replace(/^\.\//, '')), 'the pre-fix (index.html-only) extraction must NOT have seen the lazy prototype scripts -- otherwise this negative test is not demonstrating a real gap');
  }
  assert.ok(!htmlOnlyTargets.has('assets/map-sprites/phase2/sprites.json'), 'the pre-fix extraction must NOT have seen the sprite manifest either');
});

await check('NEGATIVE: a published-map test that only waits for page network idle (never for the loading placeholder to clear) would report success even while the map is permanently stuck loading', async () => {
  const { mod } = freshSandbox({ fetchOutcomes: ['fail'] }); // permanent failure -> exhausts retries -> 'error', never 'ready'
  mod.render(stubCanvas(), { selectedPref: 'tokyo' });
  await waitUntil(() => mod.getLoadState().state === 'error', { timeoutMs: 5000 });
  // A weak assertion mirroring "the page loaded without crashing" (what a test that
  // never opens the map tab, like the pre-existing tests/iphone-webkit-smoke-test.js,
  // effectively checks) would see this as a pass -- state is neither 'idle' nor throwing.
  const weakCheckWouldPass = mod.getLoadState().state !== 'idle';
  assert.equal(weakCheckWouldPass, true, 'sanity: the weak check really would have let this slip through');
  // This file's own published test instead requires state to specifically be 'ready'
  // with 0 error-UI elements (see assertCityPainted in tests/published-map-phase2-
  // webkit-test.js) -- which correctly distinguishes 'error' from 'ready' and fails.
  assert.notEqual(mod.getLoadState().state, 'ready', 'sanity: the strong check correctly does not consider this resolved');
});

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
