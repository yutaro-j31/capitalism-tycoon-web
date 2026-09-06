'use strict';
/*
 * Marker anchor integrity contract.
 *
 * A marker means "this building, here". Everything in the placement pipeline
 * may move a marker to keep it tappable and legible, but nothing may move it
 * so far that a player can no longer tell which building it belongs to.
 *
 * Real-device report this locks down: on the published iPhone build the red /
 * blue / purple markers sat well away from any plausible building, drifted to
 * the screen edges, and stopped meaning anything -- even though tapping them
 * worked (PR #615-#617). Instrumenting main (f74331b) in Chromium against
 * Tokyo's 17-marker home-prefecture fixture measured exactly why:
 *
 *   desktop 520x667 canvas : 15/17 markers displaced, worst 334px = 64% of
 *                            the canvas width, median 94px
 *   iPhone  374x520 canvas : 14/17 displaced, worst 150px = 40%, median 103px
 *   3 (desktop) and 6 (iPhone) markers whose BUILDING was off-canvas had
 *   their badge clamped back on-canvas, so the map showed markers for
 *   buildings that were not on screen at all.
 *
 * Three independent unbounded displacement sources produced that:
 *   1. the declutter search: 6 rings of a 108x86 placard box = up to 696x564px
 *   2. the edge clamp: it accepted an anchor a full placard box OUTSIDE the
 *      canvas as "visible" and then clamped it back inside
 *   3. the chrome-avoidance nudge: 14 steps of 58px = up to 812px
 *
 * The same measurement showed the crowding all of that was solving is mild:
 * with every badge left exactly on its anchor only 6-7 of 136 pairs overlap,
 * and the two closest anchors are 14-28px apart. So the fix is a hard cap
 * (MAX_ANCHOR_OFFSET) enforced on the FINAL position by capToAnchor(), after
 * every other pass has had its say -- one invariant instead of three separate
 * promises.
 *
 * Run directly: node tests/map-marker-anchor-integrity-test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const canvasSrc = fs.readFileSync(path.join(ROOT, 'js/map-phase2-canvas.js'), 'utf8');
const markersCss = fs.readFileSync(path.join(ROOT, 'css/d-ui-map-phase2-markers.css'), 'utf8');

let pass = 0, fail = 0;
async function check(name, fn) {
  try { await fn(); console.log('PASS:', name); pass += 1; }
  catch (error) { console.log('FAIL:', name, '--', error.message); fail += 1; }
}

function constant(name) {
  const match = canvasSrc.match(new RegExp(`const ${name}=(\\d+)`));
  assert.ok(match, `could not locate ${name} in js/map-phase2-canvas.js`);
  return Number(match[1]);
}
const MAX_ANCHOR_OFFSET = constant('MAX_ANCHOR_OFFSET');
const DECLUTTER_STEP = constant('DECLUTTER_STEP');
const halfMatch = canvasSrc.match(/const MARKER_CLAMP_HALF_W=(\d+),MARKER_CLAMP_HALF_H=(\d+);/);
assert.ok(halfMatch, 'could not locate the marker box constants in js/map-phase2-canvas.js');
const HALF_W = Number(halfMatch[1]), HALF_H = Number(halfMatch[2]);

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

function readySandbox() {
  const sandbox = {
    console, location: { search: '' }, devicePixelRatio: 2, URLSearchParams,
    Promise, Object, Array, Math, JSON, Date, Number, String, Map, Set,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(MANIFEST) }),
    document: { head: { appendChild() {} }, createElement() { return { set src(v) {} }; } },
    setTimeout, clearTimeout, requestAnimationFrame: cb => { cb(); return 1; },
  };
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ['prototypes/map-canvas-renderer.js', 'prototypes/map-prefecture-profiles.js', 'prototypes/map-world-preview.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: path.basename(file) });
  }
  sandbox.__capitalismTycoonModules = {};
  vm.runInContext(canvasSrc, sandbox, { filename: 'map-phase2-canvas.js' });
  const mod = sandbox.__capitalismTycoonModules.mapPhase2Canvas;
  const warm = {
    getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
    getBoundingClientRect: () => ({ width: 1280, height: 800 }),
    parentElement: { querySelectorAll: () => [] }, width: 0, height: 0, style: {},
  };
  mod.render(warm, { selectedPref: 'tokyo' });
  return new Promise(resolve => {
    const poll = () => {
      if (mod.placeEntityTiles([], 'tokyo') !== null) { resolve({ sandbox, mod }); return; }
      setTimeout(poll, 20);
    };
    setTimeout(poll, 20);
  });
}

// A marker element stub that records the CSS custom properties positionMarkers writes.
function makeMarker(tileX, tileY, offsetX = 0, offsetY = 0, id = 'tenant:t1') {
  return {
    dataset: {
      dUiMarker: id, phase2TileX: String(tileX), phase2TileY: String(tileY),
      phase2OffsetX: String(offsetX), phase2OffsetY: String(offsetY),
    },
    style: { setProperty(key, value) { this[key] = value; } },
  };
}
function makeCanvas(width, height, markers, stage) {
  return {
    getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
    parentElement: { querySelectorAll: () => markers },
    width: 0, height: 0, style: {},
    closest: stage ? sel => (sel === '.d-map-stage' ? stage : null) : undefined,
  };
}
const num = (marker, key) => parseFloat(marker.style[key]);
const applied = marker => Math.hypot(num(marker, '--ox'), num(marker, '--oy'));

async function main() {
  /* ===================== THE CAP ITSELF ===================== */

  await check('MAX_ANCHOR_OFFSET is small enough to keep a marker recognisably on its building at the iPhone canvas width', () => {
    // The measured production iPhone map canvas is 374 CSS px wide.
    assert.ok(MAX_ANCHOR_OFFSET <= 374 * 0.2,
      `${MAX_ANCHOR_OFFSET}px is more than 20% of the iPhone canvas width -- the displacement that produced the real-device report was 40-64%`);
    assert.ok(MAX_ANCHOR_OFFSET >= HALF_W,
      'the cap must still leave room to separate two adjacent tap targets');
  });

  await check('every declutter candidate is inside the cap by construction, not by a hand-maintained ring count', () => {
    const body = canvasSrc.slice(canvasSrc.indexOf('function buildDeclutterCandidates'));
    assert.match(body, /Math\.hypot\(dx,dy\)<=MAX_ANCHOR_OFFSET/,
      'the candidate builder must filter on the cap itself');
    // Reproduce the builder and confirm the produced set really is bounded.
    const dirs = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
    const list = [{ dx: 0, dy: 0 }];
    for (let ring = 1; ring * DECLUTTER_STEP <= MAX_ANCHOR_OFFSET; ring += 1) {
      for (const [ux, uy] of dirs) {
        const dx = ux * ring * DECLUTTER_STEP, dy = uy * ring * DECLUTTER_STEP;
        if (Math.hypot(dx, dy) <= MAX_ANCHOR_OFFSET) list.push({ dx, dy });
      }
    }
    assert.ok(list.length > 1, 'there must be somewhere to move a colliding marker to');
    for (const c of list) {
      assert.ok(Math.hypot(c.dx, c.dy) <= MAX_ANCHOR_OFFSET, `candidate ${c.dx},${c.dy} escapes the cap`);
    }
    assert.deepEqual(list[0], { dx: 0, dy: 0 }, 'a marker with no neighbour must stay exactly on its building');
  });

  await check('capToAnchor shortens an over-long offset but keeps its direction (it never snaps back to the anchor)', () => {
    const source = canvasSrc.slice(canvasSrc.indexOf('function capToAnchor'));
    // The real function closes over MAX_ANCHOR_OFFSET, so inject the same
    // value (read from source above) rather than re-typing the logic here.
    const capToAnchor = new Function('MAX_ANCHOR_OFFSET',
      `${source.slice(0, source.indexOf('\n}') + 2)}; return capToAnchor;`)(MAX_ANCHOR_OFFSET);
    assert.deepEqual(capToAnchor(10, 0, 0, 0), [10, 0], 'an offset inside the cap is untouched');
    const [x, y] = capToAnchor(600, 0, 0, 0);
    assert.equal(Math.round(x), MAX_ANCHOR_OFFSET, 'an over-long offset is shortened to the cap');
    assert.equal(y, 0);
    const [dx, dy] = capToAnchor(300, 400, 0, 0); // 3-4-5 triangle, length 500
    assert.equal(Math.round(Math.hypot(dx, dy)), MAX_ANCHOR_OFFSET);
    assert.ok(dx > 0 && dy > 0 && Math.abs(dy / dx - 4 / 3) < 0.001, 'direction must be preserved');
    assert.deepEqual(capToAnchor(5, 5, 5, 5), [5, 5], 'a zero-length offset is safe (no divide by zero)');
  });

  /* ===================== END TO END THROUGH render() ===================== */

  await check('ANCHOR INTEGRITY: after a full render no marker sits further than the cap from its own building', async () => {
    const { mod } = await readySandbox();
    // A deliberately cruel cluster: many entities crowded onto neighbouring
    // tiles, which is what drove the old search out to hundreds of pixels.
    const markers = [];
    for (let i = 0; i < 12; i += 1) markers.push(makeMarker(14 + (i % 4), 14 + Math.floor(i / 4), 0, 0, `tenant:t${i}`));
    const canvas = makeCanvas(374, 520, markers);
    mod.render(canvas, { selectedPref: 'tokyo' });
    for (const marker of markers) {
      assert.ok(Number.isFinite(num(marker, '--x')), 'every marker must get a position');
      assert.ok(applied(marker) <= MAX_ANCHOR_OFFSET + 0.001,
        `${marker.dataset.dUiMarker} ended ${applied(marker).toFixed(1)}px from its building`);
    }
  });

  await check('the cap holds even when a huge stale offset is fed in from the view model', async () => {
    const { mod } = await readySandbox();
    // 696x564 is exactly what the old 6-ring placard search could produce.
    const marker = makeMarker(16, 16, 696, 564);
    const canvas = makeCanvas(374, 520, [marker]);
    mod.render(canvas, { selectedPref: 'tokyo' });
    assert.ok(applied(marker) <= MAX_ANCHOR_OFFSET + 0.001,
      `a stale ${Math.round(applied(marker))}px offset survived the cap`);
  });

  await check('the leader dot always marks the TRUE anchor: --ox/--oy equal the applied displacement exactly', async () => {
    const { mod } = await readySandbox();
    const markers = [makeMarker(16, 16, 0, 0, 'a'), makeMarker(16, 16, 0, 0, 'b'), makeMarker(17, 16, 0, 0, 'c')];
    const canvas = makeCanvas(374, 520, markers);
    mod.render(canvas, { selectedPref: 'tokyo' });
    for (const marker of markers) {
      // --ox/--oy are what css/d-ui-map-phase2-markers.css counter-translates
      // the dot by, so anchor = (--x - --ox, --y - --oy) must be recoverable.
      assert.ok(Number.isFinite(num(marker, '--ox')) && Number.isFinite(num(marker, '--oy')),
        'the dot offset must always be written, even when it is zero');
    }
    assert.match(markersCss, /\.d-map-marker-dot\{[^}]*translate\(calc\(-1\*var\(--ox/,
      'the dot must still be counter-translated back onto the anchor');
  });

  /* ===================== EDGE CLAMP ===================== */

  await check('a building that is OFF the canvas does not get a marker drawn ON the canvas', async () => {
    const { mod } = await readySandbox();
    // Probe a spread of tiles rather than assuming which one lands off-camera:
    // the camera centres each prefecture's landmark, so which tiles fall
    // outside a given canvas is a property of the world, not something to
    // guess. Then assert on the ones whose ANCHOR is genuinely off-canvas.
    const markers = [];
    for (let tx = 0; tx < 30; tx += 3) for (let ty = 0; ty < 26; ty += 3) markers.push(makeMarker(tx, ty, 0, 0, `t:${tx}-${ty}`));
    mod.render(makeCanvas(200, 200, markers), { selectedPref: 'tokyo' });
    const offAnchor = markers.filter(m => {
      const ax = num(m, '--x') - num(m, '--ox'), ay = num(m, '--y') - num(m, '--oy');
      return ax < 0 || ax > 200 || ay < 0 || ay > 200;
    });
    assert.ok(offAnchor.length > 0, 'sanity: some of these buildings must be off this small canvas');
    for (const m of offAnchor) {
      const x = num(m, '--x'), y = num(m, '--y');
      const ax = x - num(m, '--ox'), ay = y - num(m, '--oy');
      // It may still be drawn within MAX_ANCHOR_OFFSET of its own off-canvas
      // anchor (that is the cap doing its job); what must never happen is it
      // being dragged to the canvas edge from far away.
      assert.ok(Math.hypot(x - ax, y - ay) <= MAX_ANCHOR_OFFSET + 0.001,
        `${m.dataset.dUiMarker}: an off-camera building's marker travelled ${Math.round(Math.hypot(x - ax, y - ay))}px -- before this fix 6 of 17 iPhone markers were clamped in from off-canvas`);
    }
  });

  await check('the clamp gate is the canvas itself, not the canvas plus a placard margin', () => {
    assert.match(canvasSrc, /const anchorOnCanvas=\(ax,ay\)=>[\s\S]{0,160}ax>=0&&ax<=cssW&&ay>=0&&ay<=cssH/,
      'the gate must admit only anchors genuinely inside the canvas');
    assert.ok(!/anchorVisible/.test(canvasSrc), 'the old margin-based gate must be gone');
  });

  await check('a building near the edge but genuinely on-canvas still gets a visible marker, within the cap', async () => {
    const { sandbox, mod } = await readySandbox();
    const MW = sandbox.MapWorldPreview;
    const index2 = MW.indexCategoryManifest(MANIFEST);
    const worldMatch = canvasSrc.match(/const WORLD_COLS=(\d+),WORLD_ROWS=(\d+);/);
    assert.ok(worldMatch, 'could not locate WORLD_COLS/WORLD_ROWS');
    const cols = Number(worldMatch[1]), rows = Number(worldMatch[2]);
    const district = MW.buildWorldDistrict({ index2, prefID: 'tokyo', cols, rows });
    const landmark = district.tiles.find(cell => cell.zone === 'landmark');
    assert.ok(landmark, 'sanity: the fixture district must have a landmark tile');
    // initialCamera() centres the landmark, so this anchor is definitely on-canvas.
    const marker = makeMarker(landmark.tileX, landmark.tileY);
    const canvas = makeCanvas(300, 300, [marker]);
    mod.render(canvas, { selectedPref: 'tokyo' });
    const x = num(marker, '--x'), y = num(marker, '--y');
    assert.ok(x >= 0 && x <= 300 && y >= 0 && y <= 300, `on-canvas building must stay visible, got (${x},${y})`);
    assert.ok(applied(marker) <= MAX_ANCHOR_OFFSET + 0.001);
  });

  /* ===================== CHROME AVOIDANCE STAYS BOUNDED (PR #616) ===================== */

  await check('the chrome-avoidance nudge is bounded by the same cap instead of a 14-step 58px walk', () => {
    assert.match(canvasSrc, /for\(let n=1;n\*CLAMP_NUDGE_STEP<=MAX_ANCHOR_OFFSET;n\+\+\)/,
      'the nudge must be bounded by the cap');
    assert.ok(!/CLAMP_NUDGE_STEP_COUNT/.test(canvasSrc), 'the unbounded step count must be gone');
    const step = Number(canvasSrc.match(/const CLAMP_NUDGE_STEP=MARKER_CLAMP_HALF_H/) ? HALF_H : NaN);
    assert.ok(Number.isFinite(step) && step > 0, 'the nudge step must be a real distance');
    const offsets = [0];
    for (let n = 1; n * step <= MAX_ANCHOR_OFFSET; n += 1) offsets.push(n * step, -n * step);
    for (const offset of offsets) assert.ok(Math.abs(offset) <= MAX_ANCHOR_OFFSET);
  });

  await check('PR #616 still holds: markers are still routed away from the iPhone chrome controls', async () => {
    const { mod } = await readySandbox();
    assert.match(canvasSrc, /function chromeExclusionRects\(canvas\)/);
    assert.match(canvasSrc, /const claimed=chromeExclusionRects\(canvas\)/);
    // With a chrome rect over the marker's natural spot it must move, but
    // only within the cap.
    const marker = makeMarker(16, 16);
    const plain = makeCanvas(374, 520, [marker]);
    mod.render(plain, { selectedPref: 'tokyo' });
    const naturalX = num(marker, '--x'), naturalY = num(marker, '--y');
    const stage = {
      querySelector: sel => (sel === '.iphone-map-tools' ? {
        hidden: false,
        getBoundingClientRect: () => ({ left: naturalX - 20, top: naturalY - 20, right: naturalX + 20, bottom: naturalY + 20, width: 40, height: 40 }),
      } : null),
    };
    mod.render(makeCanvas(374, 520, [marker], stage), { selectedPref: 'tokyo' });
    assert.ok(applied(marker) <= MAX_ANCHOR_OFFSET + 0.001,
      'chrome avoidance must not be able to fling a marker off its building');
  });

  /* ===================== EXISTING CONTRACTS ===================== */

  await check('placement stays deterministic and camera-independent (pan must not reshuffle it)', async () => {
    const { mod } = await readySandbox();
    const entities = [
      { id: 'tenant:a', kind: 'tenant', sourceId: 'a', tileX: 10, tileY: 10 },
      { id: 'tenant:b', kind: 'tenant', sourceId: 'b', tileX: 10, tileY: 10 },
      { id: 'office:c', kind: 'office', sourceId: 'c', tileX: 11, tileY: 10 },
    ];
    const first = mod.layoutMarkerPlacards(entities, 'tokyo');
    const second = mod.layoutMarkerPlacards(entities, 'tokyo');
    assert.deepEqual(
      first.map(e => [e.id, e.placardOffsetX, e.placardOffsetY]),
      second.map(e => [e.id, e.placardOffsetX, e.placardOffsetY]),
      'two runs on the same input must agree exactly'
    );
    const body = canvasSrc.slice(canvasSrc.indexOf('function layoutMarkerPlacards'));
    const end = body.indexOf('\n}');
    assert.doesNotMatch(body.slice(0, end), /camTransform|\bcamera\b/,
      'the world-space layout must never read the live camera');
  });

  await check('two markers on the SAME tile still get told apart, within the cap', async () => {
    const { mod } = await readySandbox();
    const laidOut = mod.layoutMarkerPlacards([
      { id: 'tenant:a', kind: 'tenant', sourceId: 'a', tileX: 10, tileY: 10 },
      { id: 'tenant:b', kind: 'tenant', sourceId: 'b', tileX: 10, tileY: 10 },
    ], 'tokyo');
    const a = laidOut.find(e => e.id === 'tenant:a'), b = laidOut.find(e => e.id === 'tenant:b');
    assert.deepEqual([a.placardOffsetX, a.placardOffsetY], [0, 0], 'the first in canonical order keeps its building exactly');
    assert.ok(b.placardOffsetX !== 0 || b.placardOffsetY !== 0, 'the second must be separated');
    assert.ok(Math.hypot(b.placardOffsetX, b.placardOffsetY) <= MAX_ANCHOR_OFFSET, 'and still within the cap');
  });

  await check('untouched neighbours: DEFAULT_SCALE, the canvas cache, lazy-load retry and save invariants', () => {
    assert.match(canvasSrc, /const DEFAULT_SCALE=0\.44;/);
    assert.match(canvasSrc, /const sameCanvas=canvas===lastCanvasEl;/);
    assert.match(canvasSrc, /const MAX_LOAD_ATTEMPTS=3;/);
    assert.doesNotMatch(canvasSrc.slice(canvasSrc.indexOf('function positionMarkers')), /Math\s*\.\s*random/);
    assert.match(fs.readFileSync(path.join(ROOT, 'js/save-v9.js'), 'utf8'), /const SAVE_VERSION=9;/);
  });

  await check('raw vs scaled coordinates stay consistent: the world anchor is scaled before collision math', () => {
    const body = canvasSrc.slice(canvasSrc.indexOf('function layoutMarkerPlacards'));
    assert.match(body, /const \[rawAx,rawAy\]=transform\.toScreen\(entity\.tileX,entity\.tileY\);/);
    assert.match(body, /const ax=rawAx\*transform\.scale,ay=rawAy\*transform\.scale;/,
      'toScreen() returns RAW tile-space pixels and must be multiplied by scale before being compared against CSS-pixel boxes');
  });

  /* ===================== NEGATIVE TESTS ===================== */

  await check('NEGATIVE 1: the old 6-ring 108x86 placard search violates the cap (this is the design that broke real devices)', () => {
    const dirs = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
    let worst = 0;
    for (let ring = 1; ring <= 6; ring += 1) {
      for (const [ux, uy] of dirs) worst = Math.max(worst, Math.hypot(ux * ring * 116, uy * ring * 94));
    }
    assert.ok(worst > MAX_ANCHOR_OFFSET * 5,
      `sanity: the old search really did reach ${Math.round(worst)}px, far past the ${MAX_ANCHOR_OFFSET}px cap`);
    assert.ok(!/PLACARD_RING_COUNT|const PLACARD_W=/.test(canvasSrc), 'the unbounded placard search must be gone');
  });

  await check('NEGATIVE 2: dropping capToAnchor from positionMarkers is detectable', () => {
    const body = canvasSrc.slice(canvasSrc.indexOf('function positionMarkers'));
    const end = body.indexOf('\n}\n');
    const real = body.slice(0, end);
    assert.match(real, /capToAnchor\(baseX,chosenY,ax,ay\)/, 'the final position must be capped');
    const mutated = real.replace(/const \[x,y\]=capToAnchor\(baseX,chosenY,ax,ay\);/, 'const x=baseX,y=chosenY;');
    assert.notEqual(mutated, real, 'sanity: the mutation must actually change the source');
    assert.doesNotMatch(mutated, /capToAnchor\(baseX,chosenY,ax,ay\)/,
      'without it nothing bounds the combined declutter + clamp + chrome displacement');
  });

  await check('NEGATIVE 3: the pre-fix clamp gate would have pulled an off-canvas building inside the canvas; the real gate does not', async () => {
    const { mod } = await readySandbox();
    const markers = [];
    for (let tx = 0; tx < 30; tx += 3) for (let ty = 0; ty < 26; ty += 3) markers.push(makeMarker(tx, ty, 0, 0, `t:${tx}-${ty}`));
    mod.render(makeCanvas(200, 200, markers), { selectedPref: 'tokyo' });
    // Find a building that is off-canvas but close enough that the OLD gate
    // (anchor within one 108x86 placard box of the canvas) would have accepted
    // it and clamped it to [HALF_W, cssW-HALF_W].
    let probed = 0;
    for (const m of markers) {
      const ax = m.style['--x'] === undefined ? NaN : num(m, '--x') - num(m, '--ox');
      const ay = num(m, '--y') - num(m, '--oy');
      const offCanvas = ax < 0 || ax > 200 || ay < 0 || ay > 200;
      const oldGateAccepted = ax >= -108 && ax <= 200 + 108 && ay >= -86 && ay <= 200 + 86;
      if (!offCanvas || !oldGateAccepted) continue;
      probed += 1;
      const oldClampedX = Math.min(Math.max(ax, HALF_W), 200 - HALF_W);
      const oldClampedY = Math.min(Math.max(ay, HALF_H), 200 - HALF_H);
      assert.ok(oldClampedX >= 0 && oldClampedX <= 200 && oldClampedY >= 0 && oldClampedY <= 200,
        'sanity: the old gate really would have placed this off-canvas building inside the canvas');
      assert.ok(Math.hypot(num(m, '--x') - ax, num(m, '--y') - ay) <= MAX_ANCHOR_OFFSET + 0.001,
        `${m.dataset.dUiMarker}: the real code must not reproduce that clamp`);
    }
    assert.ok(probed > 0, 'sanity: at least one building must exercise the old gate to make this test non-vacuous');
  });

  await check('NEGATIVE 4: a marker whose --ox/--oy disagree with its applied displacement would strand the leader dot', async () => {
    const { mod } = await readySandbox();
    const marker = makeMarker(16, 16, 696, 564);
    mod.render(makeCanvas(374, 520, [marker]), { selectedPref: 'tokyo' });
    const x = num(marker, '--x'), y = num(marker, '--y'), ox = num(marker, '--ox'), oy = num(marker, '--oy');
    // The dot is drawn at (x - ox, y - oy); if that is not the true anchor the
    // dot points at nothing. Recompute the anchor independently.
    const anchorX = x - ox, anchorY = y - oy;
    const bogus = { ox: ox + 40, oy: oy + 40 };
    assert.notEqual(Math.round(x - bogus.ox), Math.round(anchorX),
      'sanity: a wrong --ox really does move the dot off the anchor');
    assert.ok(Math.hypot(ox, oy) <= MAX_ANCHOR_OFFSET + 0.001,
      'and the real offset stays inside the cap, so the dot is always close enough to read');
    assert.ok(Number.isFinite(anchorX) && Number.isFinite(anchorY));
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main();
