'use strict';
/*
 * Contract for the Phase 1 Canvas map renderer foundation.
 *
 * The point of Phase 1 is the *method*: a Canvas city that blits externally
 * authored sprites, with only interactive pins in the DOM. These assertions
 * lock the properties that make that method viable, so a later phase cannot
 * quietly regress them:
 *
 *   A deterministic sprite selection      E overlay/city separation
 *   B no RNG in the visual path           F existing map pin kinds kept
 *   C simulation RNG untouched            G iPhone constraints
 *   D manifest validation                 H accessible DOM controls
 *
 * It also enforces the rule that motivated the rewrite: this renderer must
 * never draw buildings itself.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RENDERER_PATH = path.join(ROOT, 'prototypes', 'map-canvas-renderer.js');
const PAGE_PATH = path.join(ROOT, 'map-phase1-prototype.html');
const MANIFEST_PATH = path.join(ROOT, 'assets', 'map-sprites', 'phase1', 'sprites.json');
const INDEX_PATH = path.join(ROOT, 'index.html');

const rendererSource = fs.readFileSync(RENDERER_PATH, 'utf8');
const pageSource = fs.readFileSync(PAGE_PATH, 'utf8');
const MapCanvas = require(RENDERER_PATH);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const LAYOUT = [
  'WW..LLLL..RR',
  'WW..LLLL..RR',
  'WW..LLLL..RR',
  '............',
  'CCCC..PPPPRR',
  'CCCC..PPPPRR',
  'CCCC..PPPPRR',
  '............',
  'MMMM..XX..RR',
  'MMMM..XX..RR',
  'MMMM......RR',
  '............'
];

/* ---------- B: no RNG anywhere in the visual path ---------- */
/* built from parts so this test file's own text cannot satisfy the search */
const RNG_CALL = ['Math', 'random'].join('.');
assert.ok(!rendererSource.includes(RNG_CALL), 'the map renderer must not call the global RNG');
assert.ok(!pageSource.includes(RNG_CALL), 'the prototype page must not call the global RNG');
/* calls into the simulation RNG, not the letters "RNG" in prose */
assert.doesNotMatch(rendererSource, /\brng\s*\(|\.rng\b|randomCall|nextRandom|\brandom\s*\(/,
  'the map renderer must not reach for simulation RNG');
assert.match(rendererSource, /function hash\(/, 'sprite variation must come from a named deterministic hash');

/* ---------- the rule that motivated this rewrite ---------- */
/* buildings arrive as artwork; the renderer only blits them */
assert.match(rendererSource, /drawImage/, 'buildings must be blitted from sprite images');
assert.doesNotMatch(rendererSource, /facade|windowGrid|drawTower|drawBuilding\b|proceduralBuilding/i,
  'the renderer must not contain building-drawing helpers: artwork comes from sprites');
assert.ok(rendererSource.includes('drawPlaceholder'),
  'a missing sprite must fall back to an explicit development placeholder');

/* ---------- D: manifest validation ---------- */
const index = MapCanvas.indexManifest(manifest);
assert.ok(index.ok, `the committed manifest must be valid: ${index.errors.join('; ')}`);
assert.ok(index.sprites.length >= 15, `Phase 1 declares at least 15 sprites, found ${index.sprites.length}`);
for (const [category, minimum] of [['office', 5], ['commercial', 4], ['residential', 3], ['industrial', 2], ['landmark', 1]]) {
  const count = index.sprites.filter(s => s.category === category).length;
  assert.ok(count >= minimum, `category ${category} needs at least ${minimum} declared sprites, found ${count}`);
}
for (const sprite of index.sprites) {
  assert.ok(sprite.anchor.y > 0.5, `${sprite.id}: the anchor must sit low in the image so the sprite meets the ground`);
  assert.doesNotMatch(sprite.file, /^https?:|^\/|\.\./, `${sprite.id}: sprite files must be local to the asset directory`);
}

/* invalid manifests are rejected rather than trusted */
assert.equal(MapCanvas.validateManifest(null).ok, false, 'a null manifest must be rejected');
assert.equal(MapCanvas.validateManifest({}).ok, false, 'a manifest without sprites must be rejected');
assert.equal(MapCanvas.validateManifest({ tile: { w: 64, h: 32 }, sprites: {} }).ok, false,
  'sprites must be an array');
assert.equal(MapCanvas.validateManifest({ sprites: [], tile: { w: 0, h: 0 } }).ok, false,
  'a manifest without a usable tile size must be rejected');

const withBadRows = MapCanvas.validateManifest({
  tile: { w: 64, h: 32 },
  sprites: [
    { id: 'good', file: 'good.png', category: 'office', zone: ['cbd'], anchor: { x: 0.5, y: 0.9 } },
    { id: 'remote', file: 'https://example.com/a.png', category: 'office', zone: ['cbd'], anchor: { x: 0.5, y: 0.9 } },
    { id: 'escape', file: '../secret.png', category: 'office', zone: ['cbd'], anchor: { x: 0.5, y: 0.9 } },
    { id: 'good', file: 'dup.png', category: 'office', zone: ['cbd'], anchor: { x: 0.5, y: 0.9 } },
    { id: 'noanchor', file: 'b.png', category: 'office', zone: ['cbd'] },
    { file: 'c.png', category: 'office', zone: ['cbd'], anchor: { x: 0.5, y: 0.9 } }
  ]
});
assert.equal(withBadRows.ok, false, 'invalid rows must be reported');
assert.equal(withBadRows.sprites.length, 1, 'only the valid row survives');
assert.equal(withBadRows.sprites[0].id, 'good');
assert.equal(withBadRows.errors.length, 5, 'every invalid row must be explained');

/* ---------- A: deterministic sprite selection ---------- */
const districtA = MapCanvas.buildDistrict({ layout: LAYOUT, index, prefID: 'tokyo' });
const districtB = MapCanvas.buildDistrict({ layout: LAYOUT, index, prefID: 'tokyo' });
const fingerprint = d => d.tiles.map(t => `${t.tileX},${t.tileY},${t.zone},${t.spriteId}`).join('|');
assert.equal(fingerprint(districtA), fingerprint(districtB), 'the same prefecture must resolve an identical district');

const args = { index, prefID: 'tokyo', zoneType: 'cbd', useType: 'office', tileX: 4, tileY: 5 };
assert.equal(MapCanvas.selectMapSprite(args), MapCanvas.selectMapSprite(args), 'selection must be a pure function');
/* two given tiles may legitimately land on the same sprite; what matters is
   that the selector spreads across the pool over the tile space */
const sweep = new Set();
for (let tx = 0; tx < 12; tx++) {
  for (let ty = 0; ty < 12; ty++) sweep.add(MapCanvas.selectMapSprite(Object.assign({}, args, { tileX: tx, tileY: ty })));
}
assert.ok(sweep.size >= 4, `the selector must spread across the office pool, saw ${sweep.size} distinct sprites`);
assert.equal(MapCanvas.selectMapSprite({ index, prefID: 'tokyo', zoneType: 'nowhere', tileX: 0, tileY: 0 }), null,
  'an unknown zone resolves to no sprite rather than an arbitrary one');

/* selection respects the zone/category the manifest declares */
for (const cell of districtA.tiles) {
  if (!cell.spriteId) continue;
  const sprite = index.byId[cell.spriteId];
  assert.ok(sprite, `tile ${cell.tileX},${cell.tileY} selected unknown sprite ${cell.spriteId}`);
  assert.ok(sprite.zone.includes(cell.zone),
    `zone ${cell.zone} must only select sprites declaring that zone, got ${cell.spriteId}`);
}
/* every zone in the slice can vary its artwork */
const perZone = {};
for (const cell of districtA.tiles) {
  if (cell.spriteId) (perZone[cell.zone] = perZone[cell.zone] || new Set()).add(cell.spriteId);
}
for (const zone of ['cbd', 'commercial', 'residential', 'industrial', 'landmark']) {
  assert.ok(perZone[zone] && perZone[zone].size >= 1, `the district must place buildings in ${zone}`);
}
assert.ok(perZone.cbd.size >= 3, 'the CBD must draw on several archetypes, not one repeated sprite');

/* ---------- isometric transform + anchors ---------- */
const transform = MapCanvas.fitTransform(districtA, 880, 560, index.tile, 200);
assert.ok(transform.scale > 0 && transform.scale <= 1, 'the fitted scale must be a positive down-scale');
const phone = MapCanvas.fitTransform(districtA, 358, 228, index.tile, 200);
assert.ok(phone.scale > 0 && phone.scale < transform.scale, 'a narrow canvas must scale the district down');
const [screenX, screenY] = transform.toScreen(4, 6);
const [tileX, tileY] = transform.toTile(screenX, screenY);
assert.ok(Math.abs(tileX - 4) < 1e-9 && Math.abs(tileY - 6) < 1e-9, 'tile <-> screen conversion must round-trip');

/* ---------- depth ordering ---------- */
const ordered = MapCanvas.depthSorted(districtA);
for (let i = 1; i < ordered.length; i++) {
  const previous = ordered[i - 1].tileX + ordered[i - 1].tileY;
  const current = ordered[i].tileX + ordered[i].tileY;
  assert.ok(previous <= current, 'sprites must be drawn back-to-front by depth');
}

/* ---------- F: the overlay keeps the existing pin kinds ---------- */
const anchors = MapCanvas.overlayAnchors(districtA, transform);
const kinds = anchors.map(a => a.kind);
for (const kind of ['store', 'tenant', 'office', 'realestate']) {
  assert.ok(kinds.includes(kind), `the overlay must keep the existing ${kind} pin`);
}
assert.ok(anchors.length <= 12, `the overlay must stay a small DOM layer, got ${anchors.length}`);
for (const anchor of anchors) {
  assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.y), `${anchor.kind}: pins need finite CSS coordinates`);
  assert.ok(anchor.label, `${anchor.kind}: pins need an accessible label`);
}
assert.equal(
  MapCanvas.overlayAnchors(districtB, transform).map(a => `${a.kind}:${a.tileX},${a.tileY}`).join('|'),
  anchors.map(a => `${a.kind}:${a.tileX},${a.tileY}`).join('|'),
  'pin placement must be deterministic'
);

/* ---------- E: selection must not rebuild the city ---------- */
/* A minimal 2D context stub: the city layer must be driven purely by its
   cache key, so re-presenting with unchanged inputs does no extra work. */
function stubContext() {
  const calls = { drawImage: 0, fill: 0 };
  const ctx = {
    canvas: { width: 0, height: 0 },
    setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    closePath() {}, stroke() {}, ellipse() {}, arc() {}, setLineDash() {}, fillText() {},
    fill() { calls.fill++; }, drawImage() { calls.drawImage++; },
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: ''
  };
  return { ctx, calls };
}
const layer = MapCanvas.createCityLayer();
const surface = stubContext();
const present = () => layer.present(surface.ctx, districtA, transform, {}, index, {
  dpr: 2, cssWidth: 880, cssHeight: 560, sky: '#c8d3dc',
  createCanvas: (w, h) => { const s = stubContext(); s.ctx.canvas = { width: w, height: h }; s.ctx.getContext = () => s.ctx; return s.ctx; }
});
present();
assert.equal(layer.stats.cacheMisses, 1, 'the first present must build the city once');
present();
present();
assert.equal(layer.stats.cacheMisses, 1, 're-presenting unchanged inputs must reuse the cached city');
assert.ok(layer.stats.cacheHits >= 2, 'repeat presents must be cache hits');
layer.invalidate();
present();
assert.equal(layer.stats.cacheMisses, 2, 'an explicit invalidate must rebuild');
/* the cache key must not contain the selected marker at all */
assert.doesNotMatch(rendererSource, /selectedEntity|selectedMarker/, 'selection state must not reach the city cache key');
assert.match(pageSource, /Selection must not rebuild the city/, 'the page must document the selection/render split');

/* ---------- placeholder + asset failure ---------- */
const missing = MapCanvas.blitSprites(surface.ctx, districtA, transform, {}, index, { placeholderLabels: false });
assert.equal(missing.blitted, 0, 'with no images loaded nothing can be blitted');
assert.ok(missing.placeholders > 0, 'missing artwork must still mark its plot, not vanish');
const fakeImage = { width: 192, height: 240 };
const everyImage = {};
for (const sprite of index.sprites) everyImage[sprite.id] = fakeImage;
const loaded = MapCanvas.blitSprites(surface.ctx, districtA, transform, everyImage, index, {});
assert.ok(loaded.blitted > 0 && loaded.placeholders === 0, 'loaded artwork must be blitted instead of placeheld');
assert.equal(loaded.blitted, missing.placeholders, 'the same plots are filled either way');

/* ---------- G: iPhone constraints ---------- */
assert.equal(MapCanvas.resolveDpr(3), 2, 'devicePixelRatio must be clamped for iPhone Safari');
assert.equal(MapCanvas.resolveDpr(1), 1);
assert.equal(MapCanvas.resolveDpr(0), 1, 'a bogus ratio must fall back to 1');
assert.equal(MapCanvas.MAX_DPR, 2);
const fakeCanvas = { style: {} };
const usedDpr = MapCanvas.sizeCanvas(fakeCanvas, 358, 228, 3);
assert.equal(usedDpr, 2);
assert.equal(fakeCanvas.width, 716, 'the backing store scales with the clamped ratio');
assert.equal(fakeCanvas.style.width, '358px', 'the CSS size stays independent of the backing store');

assert.match(pageSource, /min-height:44px/, 'HUD controls must keep 44px tap targets');
assert.match(pageSource, /\.pin\{[^}]*width:44px;height:44px/, 'pin hit targets must stay 44px even though the icon is small');
assert.match(pageSource, /\.pin i\{[^}]*width:13px/, 'the pin icon itself must stay small so it does not cover the city');
assert.match(pageSource, /env\(safe-area-inset/, 'the page must respect the iPhone safe area');
assert.doesNotMatch(pageSource, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, '100vw causes iPhone overflow');
assert.doesNotMatch(pageSource, /https?:\/\//, 'no CDN or remote assets');
for (const forbidden of ['three.js', 'pixi', 'phaser']) {
  assert.ok(!pageSource.toLowerCase().includes(forbidden), `Phase 1 must not pull in ${forbidden}`);
}

/* ---------- H: accessible, keyboard-usable overlay ---------- */
assert.match(pageSource, /aria-label/, 'pins must carry accessible labels');
assert.match(pageSource, /aria-pressed/, 'pin selection state must be exposed');
assert.match(pageSource, /:focus-visible/, 'keyboard focus must stay visible');
assert.match(pageSource, /<button type="button"/, 'interactive overlay elements must be real buttons');

/* ---------- production boot path untouched ---------- */
const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
assert.doesNotMatch(indexHtml, /map-phase1|map-canvas-renderer|map-sprites/,
  'Phase 1 is a prototype: the shipped boot path must not load it');
assert.doesNotMatch(rendererSource, /registerUIEnhancer/, 'Phase 1 must not consume the enhancer budget');
assert.doesNotMatch(rendererSource, /MutationObserver/, 'Phase 1 must not add observers');
assert.doesNotMatch(rendererSource, /localStorage|SAVE_KEY|saveVersion/, 'Phase 1 must not touch save state');
assert.doesNotMatch(rendererSource, /https?:\/\//, 'the renderer must not reference remote resources');

console.log('map canvas foundation contract passed');
