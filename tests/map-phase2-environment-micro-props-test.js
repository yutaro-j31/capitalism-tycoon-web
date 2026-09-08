'use strict';
/*
 * Focused contract for Phase 2's Canvas-only environment micro-props.
 * Run directly: node tests/map-phase2-environment-micro-props-test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const MW = require(path.join(ROOT, 'prototypes/map-world-preview.js'));
const source = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/map-sprites/phase2/sprites.json'), 'utf8'));

let pass = 0;
function check(name, fn) {
  try { fn(); console.log('PASS:', name); pass++; }
  catch (error) { console.error('FAIL:', name, '--', error.message); process.exitCode = 1; }
}

function recordingContext() {
  const calls = [];
  const ctx = { calls, fillStyle: '', strokeStyle: '', lineWidth: 0 };
  for (const method of ['beginPath', 'closePath', 'fill', 'stroke']) {
    ctx[method] = () => calls.push([method, ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth]);
  }
  for (const method of ['moveTo', 'lineTo', 'ellipse', 'fillRect']) {
    ctx[method] = (...args) => calls.push([method, ...args, ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth]);
  }
  return ctx;
}

const tile = { w: 64, h: 32 };
const transform = { toScreen: (x, y) => [x * tile.w, y * tile.h] };
const TYPES = ['plaza', 'forecourt', 'pocketPark', 'treeStrip', 'parking', 'loadingBay'];
const cell = openType => ({ open: true, openType, tileX: 4, tileY: 7 });
const signature = (openType, prefID = 'tokyo') => {
  const ctx = recordingContext();
  MW.paintOpenLots(ctx, [cell(openType)], transform, tile, prefID);
  return JSON.stringify(ctx.calls);
};

check('all existing semantic open types receive visible, type-specific Canvas detail', () => {
  const signatures = TYPES.map(type => signature(type));
  for (let i = 0; i < TYPES.length; i++) {
    assert.ok(JSON.parse(signatures[i]).length > 0, `${TYPES[i]} drew no detail`);
  }
  assert.equal(new Set(signatures).size, TYPES.length, 'each open type should have a distinct visual operation signature');
});

check('plaza and forecourt are no longer paving-only', () => {
  assert.match(signature('plaza'), /fillRect/, 'plaza should paint a planter in addition to its bench');
  assert.match(signature('forecourt'), /fillRect/, 'forecourt should paint bollards or a planter');
});

check('micro-prop placement is deterministic for the same prefecture, tile, and open type', () => {
  for (const type of TYPES) assert.equal(signature(type), signature(type), `${type} changed between paints`);
});

check('parking and loading areas receive deterministic equipment variation', () => {
  for (const type of ['parking', 'loadingBay']) {
    const variants = ['tokyo', 'osaka', 'hokkaido', 'okinawa'].map(prefID => signature(type, prefID));
    assert.ok(new Set(variants).size >= 2, `${type} should vary in a controlled way across deterministic seeds`);
  }
});

check('parking-only wheel stops and loading-only service equipment stay semantically scoped', () => {
  const parking = signature('parking');
  const loadingVariants = ['tokyo', 'osaka', 'hokkaido', 'okinawa'].map(prefID => signature('loadingBay', prefID)).join('|');
  const nonIndustrial = ['plaza', 'forecourt', 'pocketPark', 'treeStrip'].map(type => signature(type)).join('|');
  assert.match(parking, /rgba\(63,66,62,\.76\)/, 'parking should include wheel-stop geometry');
  assert.match(loadingVariants, /#66736e|#65706d|#8a7d55/, 'loading bays should include service equipment');
  assert.doesNotMatch(nonIndustrial, /rgba\(63,66,62,\.76\)|#66736e|#65706d/,
    'parking/loading equipment escaped onto a green or civic open space');
});

check('paintOpenLots only visits the supplied visible tile list', () => {
  const ctx = recordingContext();
  MW.paintOpenLots(ctx, [cell('plaza')], transform, tile, 'tokyo');
  const oneVisible = JSON.stringify(ctx.calls);
  assert.equal(oneVisible, signature('plaza'));
  assert.ok(!oneVisible.includes(String(99 * tile.w)), 'an off-list/full-world coordinate was painted');
});

check('existing park trees and parking/loading markings remain present', () => {
  const park = JSON.parse(signature('pocketPark'));
  assert.ok(park.filter(call => call[0] === 'ellipse').length >= 5, 'pocketPark lost its two layered trees');
  for (const type of ['parking', 'loadingBay']) {
    const calls = JSON.parse(signature(type));
    assert.ok(calls.filter(call => call[0] === 'stroke').length >= 4, `${type} lost its existing three bay markings`);
  }
});

check('foundation stays Canvas-only and does not touch save, time, DOM, or random APIs', () => {
  const body = source.split('function paintBench')[1].split('/* ---------------- hero/filler-aware')[0];
  assert.doesNotMatch(body, /document|createElement|localStorage|SAVE_KEY|saveVersion|Date\.now|Math\.random/);
  assert.doesNotMatch(body, /appendChild|querySelector|engine|simulation/i);
});

check('roadside props are cached deterministically at world generation, not regenerated during pan paint', () => {
  const index2 = MW.indexCategoryManifest(manifest);
  const build = prefID => MW.buildWorldDistrict({ index2, prefID, cols: 32, rows: 28 });
  const fingerprint = district => district.tiles.map(cell =>
    `${cell.tileX},${cell.tileY}:${JSON.stringify(cell.environmentProps || [])}`).join('|');
  assert.equal(fingerprint(build('tokyo')), fingerprint(build('tokyo')));
  const paintBody = source.split('function paintRoadsideProps')[1].split('/* ---------------- meaningful open space')[0];
  assert.doesNotMatch(paintBody, /hash\(|resolveProfile|buildWorldDistrict/,
    'paint/pan must consume cached props rather than regenerate their layout');
});

check('streetlights and sparse wayfinding signs stay on eligible road edges in every prefecture', () => {
  const index2 = MW.indexCategoryManifest(manifest);
  const kinds = new Set();
  for (const prefID of Object.keys(require(path.join(ROOT, 'prototypes/map-prefecture-profiles.js')).PREFECTURE_MAP_PROFILES)) {
    const district = MW.buildWorldDistrict({ index2, prefID, cols: 32, rows: 28 });
    for (const cell of district.tiles.filter(row => row.environmentProps)) {
      assert.equal(cell.zone, 'road', `${prefID}: prop escaped onto ${cell.zone}`);
      assert.notEqual(cell.roadTier, 'local', `${prefID}: local-road scenery is too dense`);
      assert.equal(cell.intersection, false, `${prefID}: prop obstructed an intersection`);
      assert.ok(cell.environmentProps.length <= 2, `${prefID}: road cell was over-decorated`);
      for (const prop of cell.environmentProps) kinds.add(prop.kind);
    }
  }
  assert.deepEqual([...kinds].sort(), ['streetlight', 'wayfindingSign']);
});

check('all prefectures produce finite, in-bounds industrial props without renderer exceptions', () => {
  const index2 = MW.indexCategoryManifest(manifest);
  const profiles = require(path.join(ROOT, 'prototypes/map-prefecture-profiles.js')).PREFECTURE_MAP_PROFILES;
  for (const prefID of Object.keys(profiles)) {
    const district = MW.buildWorldDistrict({ index2, prefID, cols: 32, rows: 28 });
    for (const row of district.tiles) {
      assert.ok(Number.isFinite(row.tileX) && Number.isFinite(row.tileY), `${prefID}: non-finite tile coordinate`);
      assert.ok(row.tileX >= 0 && row.tileX < district.cols, `${prefID}: x escaped world bounds`);
      assert.ok(row.tileY >= 0 && row.tileY < district.rowsCount, `${prefID}: y escaped world bounds`);
    }
    const industrial = district.tiles.filter(row => row.open && ['parking', 'loadingBay'].includes(row.openType));
    const ctx = recordingContext();
    MW.paintOpenLots(ctx, industrial, transform, tile, prefID);
    for (const call of ctx.calls) {
      for (const value of call.slice(1).filter(value => typeof value === 'number')) {
        assert.ok(Number.isFinite(value), `${prefID}: renderer emitted a non-finite primitive`);
      }
    }
  }
});

check('roadside painting is culled by its supplied visible list and uses Canvas primitives only', () => {
  const ctx = recordingContext();
  const visible = [{ tileX: 2, tileY: 3, environmentProps: [{ kind: 'streetlight', alongX: true, edge: 1 }] }];
  MW.paintRoadsideProps(ctx, visible, transform, tile);
  assert.ok(ctx.calls.some(call => call[0] === 'ellipse'), 'streetlight lamp was not painted');
  assert.ok(ctx.calls.some(call => call[0] === 'stroke'), 'streetlight pole was not painted');
});

check('marker/city structure contracts remain outside this visual-only change', () => {
  const canvasSource = fs.readFileSync(path.join(ROOT, 'js/map-phase2-canvas.js'), 'utf8');
  assert.match(canvasSource, /const MAX_ANCHOR_OFFSET=56;/);
  assert.match(canvasSource, /const DEFAULT_SCALE=0\.44;/);
  assert.doesNotMatch(source, /MAX_ANCHOR_OFFSET|MARKER_CLAMP|selectedEntity/);
  const propBody = source.split('function paintBench')[1].split('/* ---------------- hero/filler-aware')[0];
  assert.doesNotMatch(propBody, /createElement|appendChild|\.d-map-marker/,
    'Canvas scenery must not add or mutate DOM markers');
});

if (!process.exitCode) console.log(`\n${pass} checks passed.`);
