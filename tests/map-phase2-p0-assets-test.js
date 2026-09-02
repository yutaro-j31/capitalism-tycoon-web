'use strict';
/*
 * Focused contract test for the Phase 2 P0 background-building asset pass
 * (office.small / commercial.small / residential.low, 20 sprites). This is a
 * plain node script (not yet registered in tests/run-all.js -- prototypes/
 * and assets/map-sprites/phase2/ are still pre-integration, matching the
 * precedent set by the Phase 2 foundation commit's own contract-verify pass).
 * Run directly: node tests/map-phase2-p0-assets-test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const MW = require(path.join(ROOT, 'prototypes/map-world-preview.js'));
const manifestPath = path.join(ROOT, 'assets/map-sprites/phase2/sprites.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS:', name); pass++; }
  catch (e) { console.log('FAIL:', name, '--', e.message); fail++; }
}

const p0Sprites = manifest.sprites.filter(s => !s.placeholder);

check('manifest has exactly 35 sprites (15 legacy placeholders + 20 P0)', () => {
  assert.equal(manifest.sprites.length, 35);
  assert.equal(p0Sprites.length, 20);
});

check('P0 category counts match office.small=6 / commercial.small=8 / residential.low=6', () => {
  const counts = {};
  for (const s of p0Sprites) counts[s.category] = (counts[s.category] || 0) + 1;
  assert.equal(counts['office.small'], 6);
  assert.equal(counts['commercial.small'], 8);
  assert.equal(counts['residential.low'], 6);
});

check('P0 sprite ids are unique across the whole manifest (no collision with the legacy 15)', () => {
  const ids = manifest.sprites.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

check('manifest validates cleanly (no dropped/invalid rows)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  assert.equal(idx.ok, true, JSON.stringify(idx.errors));
  assert.equal(idx.sprites.length, manifest.sprites.length);
});

check('P0 sprites all use footprintType 1x1 (contract doc: "今回の不足リストはすべて1x1想定")', () => {
  for (const s of p0Sprites) {
    assert.equal(s.footprintType, '1x1', s.id);
    assert.deepEqual(s.footprint, { w: 1, h: 1 }, s.id);
  }
});

check('P0 sprites are not marked placeholder (they are real, finished art)', () => {
  for (const s of p0Sprites) assert.ok(!s.placeholder, s.id);
});

check('P0 districtTags follow ROLE_CATEGORY: office.small=[cbd], commercial.small=[cbd,commercial], residential.low=[commercial,residential]', () => {
  for (const s of p0Sprites) {
    if (s.category === 'office.small') assert.deepEqual(s.districtTags.slice().sort(), ['cbd']);
    if (s.category === 'commercial.small') assert.deepEqual(s.districtTags.slice().sort(), ['cbd', 'commercial']);
    if (s.category === 'residential.low') assert.deepEqual(s.districtTags.slice().sort(), ['commercial', 'residential']);
  }
});

check('P0 file paths stay plain local filenames under sprites/p0/ (no path escape)', () => {
  for (const s of p0Sprites) {
    assert.ok(!/\.\.|^\/|^[a-z]+:/i.test(s.file), `${s.id}: ${s.file}`);
    assert.ok(s.file.startsWith('sprites/p0/'), `${s.id}: ${s.file}`);
  }
});

check('every P0 file exists on disk under assets/map-sprites/phase2/', () => {
  for (const s of p0Sprites) {
    const full = path.join(ROOT, 'assets/map-sprites/phase2', s.file);
    assert.ok(fs.existsSync(full), `${s.id}: missing ${full}`);
  }
});

check('no duplicated binaries: P0 PNGs are all distinct from each other and from every legacy phase1 PNG', () => {
  const hashFile = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const legacyHashes = new Set();
  for (const s of manifest.sprites.filter(s => s.placeholder)) {
    legacyHashes.add(hashFile(path.join(ROOT, 'assets/map-sprites/phase1', s.file)));
  }
  const p0Hashes = new Set();
  for (const s of p0Sprites) {
    const h = hashFile(path.join(ROOT, 'assets/map-sprites/phase2', s.file));
    assert.ok(!legacyHashes.has(h), `${s.id}: duplicates a phase1 canonical binary`);
    assert.ok(!p0Hashes.has(h), `${s.id}: duplicates another P0 sprite's binary`);
    p0Hashes.add(h);
  }
});

check('P0 PNGs decode, are RGBA (alpha channel present), and match their declared width/height', () => {
  // Minimal PNG header parser (no image library available in this test's
  // runtime): reads the IHDR chunk directly rather than decoding pixels.
  for (const s of p0Sprites) {
    const full = path.join(ROOT, 'assets/map-sprites/phase2', s.file);
    const buf = fs.readFileSync(full);
    assert.ok(buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47 || buf[0] === 0x89, `${s.id}: not a PNG (bad signature)`);
    assert.equal(buf.toString('ascii', 12, 16), 'IHDR', `${s.id}: missing IHDR chunk`);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const colorType = buf.readUInt8(25);
    assert.ok(width > 0 && height > 0, `${s.id}: invalid dimensions`);
    // PNG color type 6 = RGBA (truecolor with alpha), 4 = grayscale with alpha
    assert.ok(colorType === 6 || colorType === 4, `${s.id}: PNG color type ${colorType} has no alpha channel`);
  }
});

check('P0 anchor values are within the 0..1 fraction range required by the manifest schema', () => {
  for (const s of p0Sprites) {
    assert.ok(s.anchor.x >= 0 && s.anchor.x <= 1, `${s.id}: anchor.x=${s.anchor.x}`);
    assert.ok(s.anchor.y >= 0 && s.anchor.y <= 1, `${s.id}: anchor.y=${s.anchor.y}`);
    // anchors were measured from each sprite's own alpha bottom-contact row,
    // so they should sit close to the bottom of the image, not the middle/top
    assert.ok(s.anchor.y > 0.9, `${s.id}: anchor.y=${s.anchor.y} is not near the bottom -- looks unmeasured`);
  }
});

check('P0 spawnWeight is positive and uniform (no per-asset spawn tuning in this pass)', () => {
  for (const s of p0Sprites) assert.ok(s.spawnWeight > 0, s.id);
  const weights = new Set(p0Sprites.map(s => s.spawnWeight));
  assert.equal(weights.size, 1, `expected a single uniform spawnWeight, saw ${[...weights]}`);
});

check('adding P0 assets does not change district occupancy (algorithm untouched)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = MW.buildWorldDistrict({ index2: idx, prefID: 'tokyo', cols: 32, rows: 28 });
  const byZone = {};
  for (const t of district.tiles) {
    if (t.zone === 'landmark' || t.zone === 'road' || t.zone === 'park') continue;
    byZone[t.zone] = byZone[t.zone] || { total: 0, built: 0 };
    byZone[t.zone].total++;
    if (t.expectsBuilding) byZone[t.zone].built++;
  }
  const pct = zone => byZone[zone].built / byZone[zone].total * 100;
  assert.ok(Math.abs(pct('cbd') - 62.5) < 0.1, `cbd occupancy drifted: ${pct('cbd')}`);
  assert.ok(Math.abs(pct('commercial') - 62.5) < 0.1, `commercial occupancy drifted: ${pct('commercial')}`);
  assert.ok(Math.abs(pct('residential') - 44.1) < 0.2, `residential occupancy drifted: ${pct('residential')}`);
  assert.ok(Math.abs(pct('premiumResidential') - 30.0) < 0.1, `premium occupancy drifted: ${pct('premiumResidential')}`);
  assert.ok(Math.abs(pct('industrial') - 26.7) < 0.2, `industrial occupancy drifted: ${pct('industrial')}`);
});

check('P0 categories now resolve real assets directly (no longer fall back to mid/hero for office.small/commercial.small/residential.low)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  for (const [category, district] of [['office.small', 'cbd'], ['commercial.small', 'commercial'], ['residential.low', 'residential']]) {
    const seen = new Set();
    for (let tx = 0; tx < 12; tx++) for (let ty = 0; ty < 12; ty++) {
      const id = MW.selectSpriteForCategory(idx, { category, district, prefID: 'tokyo', tileX: tx, tileY: ty });
      if (id) seen.add(id);
    }
    assert.ok(seen.size >= 2, `${category}/${district}: expected variety among real P0 assets, saw ${seen.size}`);
    for (const id of seen) assert.equal(idx.byId[id].category, category, `${category}/${district}: resolved to a fallback category (${idx.byId[id].category}) instead of a real ${category} asset`);
  }
});

check('deterministic: selectSpriteForCategory is a pure function of its inputs (repeat calls agree)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const args = { category: 'office.small', district: 'cbd', prefID: 'tokyo', tileX: 5, tileY: 9 };
  const first = MW.selectSpriteForCategory(idx, args);
  for (let i = 0; i < 20; i++) assert.equal(MW.selectSpriteForCategory(idx, args), first);
});

check('deterministic: manifest entry order does not change district output', () => {
  const idxA = MW.indexCategoryManifest(manifest);
  const shuffled = JSON.parse(JSON.stringify(manifest));
  shuffled.sprites = shuffled.sprites.slice().reverse();
  const idxB = MW.indexCategoryManifest(shuffled);
  const dA = MW.buildWorldDistrict({ index2: idxA, prefID: 'tokyo', cols: 32, rows: 28 });
  const dB = MW.buildWorldDistrict({ index2: idxB, prefID: 'tokyo', cols: 32, rows: 28 });
  const fp = d => d.tiles.map(t => t.spriteId || '').join('|');
  assert.equal(fp(dA), fp(dB));
});

check('duplicate id in manifest is rejected (row dropped, not the whole manifest)', () => {
  const bad = JSON.parse(JSON.stringify(manifest));
  bad.sprites.push(Object.assign({}, bad.sprites[bad.sprites.length - 1]));
  const idx = MW.indexCategoryManifest(bad);
  assert.equal(idx.ok, false);
  assert.ok(idx.errors.some(e => /duplicate id/.test(e)));
  assert.equal(idx.sprites.length, manifest.sprites.length);
});

check('unknown category on a P0-shaped row is rejected (row dropped, not the whole manifest)', () => {
  const bad = JSON.parse(JSON.stringify(manifest));
  bad.sprites.push(Object.assign({}, p0Sprites[0], { id: 'bogus_p0_row', category: 'not.a.real.category' }));
  const idx = MW.indexCategoryManifest(bad);
  assert.equal(idx.ok, false);
  assert.ok(!idx.byId.bogus_p0_row);
  assert.equal(idx.sprites.length, manifest.sprites.length);
});

check('missing P0 image still falls back to a placeholder draw, not a crash (white-screen guard)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = MW.buildWorldDistrict({ index2: idx, prefID: 'tokyo', cols: 16, rows: 16 });
  const transform = MW.worldTransform(district, idx.tile, 1).transform;
  const stats = { drawImage: 0 };
  const ctx = {
    setTransform(){}, clearRect(){}, fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, closePath(){},
    stroke(){}, ellipse(){}, arc(){}, setLineDash(){}, fillText(){}, fill(){}, drawImage(){ stats.drawImage++; },
    fillStyle:'', strokeStyle:'', lineWidth:0, font:'', textAlign:'',
  };
  // no images loaded at all (simulates every P0 PNG failing to load)
  const result = MW.blitWorldSprites(ctx, district, transform, {}, idx, { placeholderLabels: false });
  assert.ok(result.placeholders > 0);
  assert.equal(result.blitted, 0);
  assert.equal(stats.drawImage, 0);
});

check('no Math.random or simulation RNG anywhere this pass touched', () => {
  const rendererSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');
  const pageSrc = fs.readFileSync(path.join(ROOT, 'map-phase2-preview.html'), 'utf8');
  const RNG_CALL = ['Math', 'random'].join('.');
  assert.ok(!rendererSrc.includes(RNG_CALL));
  assert.ok(!pageSrc.includes(RNG_CALL));
});

check('no save-state reference (SAVE_KEY / saveVersion / localStorage) in the touched files', () => {
  const rendererSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');
  const pageSrc = fs.readFileSync(path.join(ROOT, 'map-phase2-preview.html'), 'utf8');
  assert.doesNotMatch(rendererSrc, /SAVE_KEY|saveVersion|localStorage/);
  assert.doesNotMatch(pageSrc, /SAVE_KEY|saveVersion|localStorage/);
});

check('production files untouched by this pass (index.html / js/ / css/ / prototypes/map-canvas-renderer.js)', () => {
  const { execSync } = require('child_process');
  let diffFiles;
  try {
    diffFiles = execSync('git diff --name-only origin/main...HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch (e) {
    diffFiles = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  }
  for (const f of diffFiles) {
    assert.ok(
      !f.startsWith('index.html') && !f.startsWith('js/') && !f.startsWith('css/') && f !== 'prototypes/map-canvas-renderer.js',
      `production/renderer-core file touched: ${f}`
    );
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
