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

check('marker/city structure contracts remain outside this visual-only change', () => {
  const canvasSource = fs.readFileSync(path.join(ROOT, 'js/map-phase2-canvas.js'), 'utf8');
  assert.match(canvasSource, /const MAX_ANCHOR_OFFSET=56;/);
  assert.match(canvasSource, /const DEFAULT_SCALE=0\.44;/);
  assert.doesNotMatch(source, /MAX_ANCHOR_OFFSET|MARKER_CLAMP|selectedEntity/);
});

if (!process.exitCode) console.log(`\n${pass} checks passed.`);
