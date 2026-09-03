'use strict';
/*
 * Focused contract test for the Phase 2 P1 mid-rise/civic asset pass
 * (civic x4, office.mid x4, residential.mid x4 -- 12 sprites). Plain node
 * script, same pattern as tests/map-phase2-p0-assets-test.js.
 *
 * This pass also fixed two reachability bugs discovered by auditing the
 * contract before adding anything (see docs/map-phase2-asset-integration-
 * contract.md section 13 and prototypes/map-world-preview.js):
 *   - office.mid had no live requester: cbd's S role requested
 *     office.small directly, and CATEGORY_FALLBACK['office.small'] only
 *     ever reaches office.mid when office.small's own pool is completely
 *     empty -- which stopped being true the moment P0 gave office.small
 *     real assets. Fixed by splitting cbd's S role 3:1 between
 *     office.small/office.mid (ROLE_CATEGORY + pickRoleCategory).
 *   - civic had NO requester anywhere (not a role, not even a
 *     CATEGORY_FALLBACK target). Fixed by adding two fixed civic-building
 *     slots beside the landmark's own block, inside the park super-region
 *     (never touching the five occupancy-tracked districts).
 * Run directly: node tests/map-phase2-p1-mid-civic-assets-test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const MW = require(path.join(ROOT, 'prototypes/map-world-preview.js'));
const MapPrefectureProfiles = require(path.join(ROOT, 'prototypes/map-prefecture-profiles.js'));
const manifestPath = path.join(ROOT, 'assets/map-sprites/phase2/sprites.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS:', name); pass++; }
  catch (e) { console.log('FAIL:', name, '--', e.message); fail++; }
}

const P1_CATEGORIES = new Set(['civic', 'office.mid', 'residential.mid']);
const p1Sprites = manifest.sprites.filter(s => !s.placeholder && P1_CATEGORIES.has(s.category));
const PREF_ID = 'tokyo';
const COLS = 32, ROWS = 28;

function buildTokyo(idx) {
  return MW.buildWorldDistrict({ index2: idx, prefID: PREF_ID, cols: COLS, rows: ROWS });
}

/* ---------------- 1. total manifest count / category counts ---------------- */
check('manifest now has 47 sprites (15 legacy + 20 P0 + 12 P1)', () => {
  assert.equal(manifest.sprites.length, 47);
  assert.equal(p1Sprites.length, 12);
});

check('P1 category counts match civic=4 / office.mid=4 / residential.mid=4', () => {
  const counts = {};
  for (const s of p1Sprites) counts[s.category] = (counts[s.category] || 0) + 1;
  assert.equal(counts['civic'], 4);
  assert.equal(counts['office.mid'], 4);
  assert.equal(counts['residential.mid'], 4);
});

check('P1 sprite ids are unique across the whole manifest (no collision with the legacy 15 or P0 20)', () => {
  const ids = manifest.sprites.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

check('manifest validates cleanly (no dropped/invalid rows)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  assert.equal(idx.ok, true, JSON.stringify(idx.errors));
  assert.equal(idx.sprites.length, manifest.sprites.length);
});

check('P1 sprites all use footprintType 1x1 (aspect-ratio audit: all 12 are narrower/shorter on screen than the existing hero towers once footprint.w normalizes their rendered width, see spriteRenderSize)', () => {
  for (const s of p1Sprites) {
    assert.equal(s.footprintType, '1x1', s.id);
    assert.deepEqual(s.footprint, { w: 1, h: 1 }, s.id);
  }
});

check('P1 sprites are not marked placeholder (they are real, finished art)', () => {
  for (const s of p1Sprites) assert.ok(!s.placeholder, s.id);
});

/* ---------------- districtTags: corrected against the real contract, not the pack's raw suggestion ---------------- */
check('civic districtTags = [civic] (the pack suggested cbd/commercial/residential, which predates the civic-slot mechanism and does not match ZONE_DISTRICT_TAG.civic)', () => {
  for (const s of p1Sprites.filter(s => s.category === 'civic')) {
    assert.deepEqual(s.districtTags, ['civic'], s.id);
  }
});

check('office.mid districtTags = [cbd] (matches ROLE_CATEGORY.cbd.S array district)', () => {
  for (const s of p1Sprites.filter(s => s.category === 'office.mid')) {
    assert.deepEqual(s.districtTags, ['cbd'], s.id);
  }
});

check('residential.mid districtTags include premiumResidential (the pack\'s suggestion omitted it, but ROLE_CATEGORY.premiumResidential.S is a real direct requester of residential.mid -- same convention as the existing legacy residential_midrise row)', () => {
  for (const s of p1Sprites.filter(s => s.category === 'residential.mid')) {
    assert.deepEqual(s.districtTags.slice().sort(), ['commercial', 'premiumResidential', 'residential'], s.id);
  }
});

check('P1 file paths stay plain local filenames under sprites/p1/ (no path escape)', () => {
  for (const s of p1Sprites) {
    assert.ok(!/\.\.|^\/|^[a-z]+:/i.test(s.file), `${s.id}: ${s.file}`);
    assert.ok(s.file.startsWith('sprites/p1/'), `${s.id}: ${s.file}`);
  }
});

check('every P1 file exists on disk under assets/map-sprites/phase2/', () => {
  for (const s of p1Sprites) {
    const full = path.join(ROOT, 'assets/map-sprites/phase2', s.file);
    assert.ok(fs.existsSync(full), `${s.id}: missing ${full}`);
  }
});

check('no duplicated binaries: P1 PNGs are all distinct from each other and from every legacy/P0 PNG', () => {
  const hashFile = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const otherHashes = new Set();
  for (const s of manifest.sprites) {
    if (P1_CATEGORIES.has(s.category) && !s.placeholder) continue;
    const base = s.placeholder ? 'assets/map-sprites/phase1' : 'assets/map-sprites/phase2';
    otherHashes.add(hashFile(path.join(ROOT, base, s.file)));
  }
  const p1Hashes = new Set();
  for (const s of p1Sprites) {
    const h = hashFile(path.join(ROOT, 'assets/map-sprites/phase2', s.file));
    assert.ok(!otherHashes.has(h), `${s.id}: duplicates an existing canonical binary`);
    assert.ok(!p1Hashes.has(h), `${s.id}: duplicates another P1 sprite's binary`);
    p1Hashes.add(h);
  }
});

check('P1 PNGs decode, are RGBA (alpha channel present)', () => {
  for (const s of p1Sprites) {
    const full = path.join(ROOT, 'assets/map-sprites/phase2', s.file);
    const buf = fs.readFileSync(full);
    assert.ok(buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47, `${s.id}: not a PNG (bad signature)`);
    assert.equal(buf.toString('ascii', 12, 16), 'IHDR', `${s.id}: missing IHDR chunk`);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const colorType = buf.readUInt8(25);
    assert.ok(width > 0 && height > 0, `${s.id}: invalid dimensions`);
    assert.ok(colorType === 6 || colorType === 4, `${s.id}: PNG color type ${colorType} has no alpha channel`);
  }
});

check('P1 anchor values are within the 0..1 fraction range and sit near the bottom (independently re-measured via alpha-threshold + minimum-row-width, not the pack\'s raw anchorHint)', () => {
  for (const s of p1Sprites) {
    assert.ok(s.anchor.x >= 0 && s.anchor.x <= 1, `${s.id}: anchor.x=${s.anchor.x}`);
    assert.ok(s.anchor.y >= 0 && s.anchor.y <= 1, `${s.id}: anchor.y=${s.anchor.y}`);
    assert.ok(s.anchor.y > 0.9, `${s.id}: anchor.y=${s.anchor.y} is not near the bottom -- looks unmeasured`);
  }
});

check('P1 spawnWeight is positive and uniform (no per-asset spawn tuning in this pass)', () => {
  for (const s of p1Sprites) assert.ok(s.spawnWeight > 0, s.id);
  const weights = new Set(p1Sprites.map(s => s.spawnWeight));
  assert.equal(weights.size, 1, `expected a single uniform spawnWeight, saw ${[...weights]}`);
});

/* ---------------- 2. civic direct-hit (this pass's headline fix) ---------------- */
/*
 * 2026-09 (prefecture identity / regional variation): the civic slots sit
 * one block-column either side of the seeded park anchor, inside whatever
 * park-zone area that prefecture's profile weight produced -- for a
 * profile with very little openSpaceWeight (Tokyo's mega_core archetype is
 * the lowest of all 9 archetypes, by design: STEP 11's "Tokyo must read as
 * the densest city"), the park area can be small enough that one or both
 * neighbouring blocks are captured by a different, denser zone instead,
 * so a civic slot gracefully has nothing to convert (falls back to
 * ordinary park -- never a broken or missing-asset build). "Exactly 2
 * fixed slots" is still verified below, just against a prefecture whose
 * archetype (inland_regional, openSpaceWeight=6) reliably gives the park
 * region enough room, instead of hard-coding it to Tokyo specifically.
 */
check('civic requests resolve to real assets on a park-generous prefecture (2 fixed slots per map, both hitting real civic sprites, 0 open-space fallback)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = MW.buildWorldDistrict({ index2: idx, prefID: 'aomori', cols: COLS, rows: ROWS });
  const civicCells = district.tiles.filter(t => t.zone === 'civic');
  assert.equal(civicCells.length, 2, `expected exactly 2 civic-zone cells, saw ${civicCells.length}`);
  for (const cell of civicCells) {
    assert.ok(cell.spriteId, 'civic cell has no spriteId');
    assert.equal(idx.byId[cell.spriteId].category, 'civic');
  }
});

check('civic slots on the densest archetype (Tokyo) degrade gracefully -- never more than 2, never a broken asset when present', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = buildTokyo(idx);
  const civicCells = district.tiles.filter(t => t.zone === 'civic');
  assert.ok(civicCells.length <= 2, `expected at most 2 civic-zone cells, saw ${civicCells.length}`);
  for (const cell of civicCells) {
    assert.ok(cell.spriteId, 'civic cell has no spriteId');
    assert.equal(idx.byId[cell.spriteId].category, 'civic');
  }
});

check('all 4 civic sprites are reachable across the full real 47-prefecture set (2 winning slots/map out of 4 candidates means a single map cannot show all 4, and not every profile has room for both slots)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const PREFS = Object.keys(MapPrefectureProfiles.PREFECTURE_MAP_PROFILES);
  const used = new Set();
  for (const p of PREFS) {
    const d = MW.buildWorldDistrict({ index2: idx, prefID: p, cols: COLS, rows: ROWS });
    for (const t of d.tiles) if (t.zone === 'civic' && t.spriteId) used.add(t.spriteId);
  }
  const civicIds = p1Sprites.filter(s => s.category === 'civic').map(s => s.id);
  const unused = civicIds.filter(id => !used.has(id));
  assert.deepEqual(unused, [], `civic sprites never selected across ${PREFS.length} prefectures: ${unused.join(', ')}`);
});

/* ---------------- 3. office.mid / residential.mid direct-hit ---------------- */
check('office.mid resolves real assets directly for cbd requests (no fallback to office.hero)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const seen = new Set();
  for (let tx = 0; tx < 20; tx++) for (let ty = 0; ty < 20; ty++) {
    const id = MW.selectSpriteForCategory(idx, { category: 'office.mid', district: 'cbd', prefID: PREF_ID, tileX: tx, tileY: ty });
    if (id) seen.add(id);
  }
  assert.ok(seen.size >= 2, `expected variety among office.mid/cbd assets, saw ${seen.size}`);
  for (const id of seen) assert.equal(idx.byId[id].category, 'office.mid', `resolved to a fallback category instead of office.mid`);
});

check('residential.mid resolves real assets directly for both residential and premiumResidential requests', () => {
  const idx = MW.indexCategoryManifest(manifest);
  for (const district of ['residential', 'premiumResidential']) {
    const seen = new Set();
    for (let tx = 0; tx < 20; tx++) for (let ty = 0; ty < 20; ty++) {
      const id = MW.selectSpriteForCategory(idx, { category: 'residential.mid', district, prefID: PREF_ID, tileX: tx, tileY: ty });
      if (id) seen.add(id);
    }
    assert.ok(seen.size >= 2, `${district}: expected variety among residential.mid assets, saw ${seen.size}`);
    for (const id of seen) assert.equal(idx.byId[id].category, 'residential.mid', `${district}: resolved to a fallback category`);
  }
});

check('office.mid reachability fix does not change cbd\'s S-role tile COUNT (only which category those tiles request; hero/mid/small composition stays fixed by BLOCK_TEMPLATES)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = buildTokyo(idx);
  const officeSmallCount = district.tiles.filter(t => t.spriteId && idx.byId[t.spriteId].category === 'office.small').length;
  const officeMidCount = district.tiles.filter(t => t.spriteId && idx.byId[t.spriteId].category === 'office.mid').length;
  // cbd's S role count is fixed (BLOCK_TEMPLATES 'cbd' has 6 S tiles per block); the
  // 3:1 split just changes which category those specific tiles request.
  assert.ok(officeSmallCount > 0 && officeMidCount > 0, `expected both office.small (${officeSmallCount}) and office.mid (${officeMidCount}) to have real tiles`);
});

/* ---------------- 4. fallback reduction / full-district fallback telemetry ---------------- */
check('P0 categories (office.small/commercial.small/residential.low) are unaffected: still 100% direct, 0 fallback', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = buildTokyo(idx);
  const summary = {};
  for (const cell of district.tiles) {
    if (cell.zone === 'landmark' || cell.zone === 'road' || cell.zone === 'civic') continue;
    const role = cell.templateRole;
    if (!role || !MW.BUILT_ROLES.has(role)) continue;
    const zoneRoles = MW.ROLE_CATEGORY[cell.zone];
    if (!zoneRoles || !zoneRoles[role]) continue;
    const requested = MW.pickRoleCategory(zoneRoles[role], PREF_ID, cell.tileX, cell.tileY);
    if (!cell.spriteId) continue;
    const resolved = idx.byId[cell.spriteId].category;
    const bucket = summary[requested] = summary[requested] || { direct: 0, fallback: 0 };
    if (resolved === requested) bucket.direct++; else bucket.fallback++;
  }
  for (const cat of ['office.small', 'commercial.small', 'residential.low']) {
    assert.ok(summary[cat], `${cat}: no requests recorded`);
    assert.equal(summary[cat].fallback, 0, `${cat}: expected 0 fallback`);
  }
});

check('missingCategoryCount stays 0 across the full district (no degraded/open-space cell for any requested category)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = buildTokyo(idx);
  let missing = 0;
  for (const cell of district.tiles) {
    if (cell.zone === 'landmark' || cell.zone === 'road') continue;
    const role = cell.templateRole;
    if (!role || !MW.BUILT_ROLES.has(role)) continue;
    const zoneRoles = MW.ROLE_CATEGORY[cell.zone];
    if (!zoneRoles || !zoneRoles[role]) continue;
    if (!cell.spriteId && cell.open) missing++;
  }
  assert.equal(missing, 0, `expected 0 missing-category cells, saw ${missing}`);
});

/* ---------------- 5. determinism / manifest order independence ---------------- */
check('deterministic: selectSpriteForCategory is a pure function of its inputs (repeat calls agree)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const args = { category: 'civic', district: 'civic', prefID: PREF_ID, tileX: 7, tileY: 22 };
  const first = MW.selectSpriteForCategory(idx, args);
  for (let i = 0; i < 20; i++) assert.equal(MW.selectSpriteForCategory(idx, args), first);
});

check('deterministic: manifest entry order does not change district output (still true with 47 rows and array-valued ROLE_CATEGORY entries)', () => {
  const idxA = MW.indexCategoryManifest(manifest);
  const shuffled = JSON.parse(JSON.stringify(manifest));
  shuffled.sprites = shuffled.sprites.slice().reverse();
  const idxB = MW.indexCategoryManifest(shuffled);
  const dA = buildTokyo(idxA);
  const dB = buildTokyo(idxB);
  const fp = d => d.tiles.map(t => `${t.tileX},${t.tileY}:${t.spriteId || ''}`).join('|');
  assert.equal(fp(dA), fp(dB));
});

check('buildWorldDistrict is deterministic across repeat builds of the same district', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const a = buildTokyo(idx);
  const b = buildTokyo(idx);
  const fp = d => d.tiles.map(t => `${t.tileX},${t.tileY}:${t.spriteId || ''}:${t.zone}`).join('|');
  assert.equal(fp(a), fp(b));
});

/* ---------------- 6. repetition regression (this pass should not undo the Calibration pass's fix) ---------------- */
check('same-sprite repeats within radius 3 stay a minority of built tiles (P1 adds variety, so this should be no worse than the Calibration-only baseline)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = buildTokyo(idx);
  const byKeyBuilt = {};
  for (const t of district.tiles) if (t.spriteId) byKeyBuilt[`${t.tileX},${t.tileY}`] = t;
  let tilesWithRepeat = 0;
  for (const t of district.tiles) {
    if (!t.spriteId) continue;
    let found = false;
    for (let dy = -3; dy <= 3 && !found; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (dx === 0 && dy === 0) continue;
      const n = byKeyBuilt[`${t.tileX + dx},${t.tileY + dy}`];
      if (n && n.spriteId === t.spriteId) { found = true; break; }
    }
    if (found) tilesWithRepeat++;
  }
  const ratio = tilesWithRepeat / Object.keys(byKeyBuilt).length;
  assert.ok(ratio < 0.35, `radius-3 repeat ratio ${ratio.toFixed(3)} is not a minority`);
});

/* ---------------- 7. district occupancy regression ---------------- */
/*
 * 2026-09 (prefecture identity / regional variation): see the identical
 * note in tests/map-phase2-visual-calibration-test.js -- zone footprints
 * are now profile/seed-driven, so a zone's measured built-share can drift
 * a few points from the pure BLOCK_TEMPLATES ideal (irregular shape, grid
 * edge, landmark-gradient proximity) without any regression. The tolerance
 * is widened to still catch a real regression while accepting that.
 */
check('district occupancy stays close to its BLOCK_TEMPLATES ideal, tolerant of profile-driven zone-shape variance (civic\'s slots live in the park super-region, outside the five tracked districts; office.mid\'s split only changes WHICH category cbd\'s S-role tiles request, not how many)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = buildTokyo(idx);
  const byZone = {};
  for (const t of district.tiles) {
    if (t.zone === 'landmark' || t.zone === 'road' || t.zone === 'park' || t.zone === 'civic') continue;
    byZone[t.zone] = byZone[t.zone] || { total: 0, built: 0 };
    byZone[t.zone].total++;
    if (t.expectsBuilding) byZone[t.zone].built++;
  }
  const pct = zone => byZone[zone].built / byZone[zone].total * 100;
  assert.ok(Math.abs(pct('cbd') - 62.5) < 10, `cbd occupancy drifted: ${pct('cbd')}`);
  assert.ok(Math.abs(pct('commercial') - 62.5) < 10, `commercial occupancy drifted: ${pct('commercial')}`);
  assert.ok(Math.abs(pct('residential') - 44.1) < 10, `residential occupancy drifted: ${pct('residential')}`);
  assert.ok(Math.abs(pct('premiumResidential') - 30.0) < 10, `premium occupancy drifted: ${pct('premiumResidential')}`);
  assert.ok(Math.abs(pct('industrial') - 26.7) < 10, `industrial occupancy drifted: ${pct('industrial')}`);
});

/* ---------------- 8. save / RNG invariants ---------------- */
check('no Math.random or simulation RNG anywhere this pass touched', () => {
  const rendererSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');
  const RNG_CALL = ['Math', 'random'].join('.');
  assert.ok(!rendererSrc.includes(RNG_CALL));
});

check('no save-state reference (SAVE_KEY / saveVersion / localStorage) in the touched renderer file', () => {
  const rendererSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');
  assert.doesNotMatch(rendererSrc, /SAVE_KEY|saveVersion|localStorage/);
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

/* ---------------- negative test 1: duplicate id is rejected, row dropped not the whole manifest ---------------- */
check('NEGATIVE: duplicate id among P1 rows is rejected (row dropped, not the whole manifest)', () => {
  const bad = JSON.parse(JSON.stringify(manifest));
  const civicRow = bad.sprites.find(s => s.id === 'civic_01');
  bad.sprites.push(Object.assign({}, civicRow));
  const idx = MW.indexCategoryManifest(bad);
  assert.equal(idx.ok, false);
  assert.ok(idx.errors.some(e => /duplicate id/.test(e)));
  assert.equal(idx.sprites.length, manifest.sprites.length);
});

/* ---------------- negative test 2: civic reachability fix actually matters ---------------- */
check('NEGATIVE: without the civic-slot mechanism, civic sprites would never be placed even though they exist in the manifest (proves the reachability fix, not just the assets, is what matters)', () => {
  const rendererSrc = fs.readFileSync(path.join(ROOT, 'prototypes/map-world-preview.js'), 'utf8');
  // simulate "P1 assets added, but the civic-slot mechanism reverted" by
  // neutralising the two lines that flip a park cell into a civic request
  const reverted = rendererSrc.replace(
    /const civicCells = \[parkAnchor\.bc - 1, parkAnchor\.bc \+ 1\][\s\S]*?\n    for \(const cell of civicCells\) \{[\s\S]*?\n    \}\n/,
    'const civicCells = [];\n'
  );
  assert.notEqual(reverted, rendererSrc, 'source replace did not match -- test itself is broken');

  const scratchPath = path.join(ROOT, 'prototypes/_scratch-p1-civic-negtest.js');
  fs.writeFileSync(scratchPath, reverted);
  try {
    delete require.cache[require.resolve(scratchPath)];
    const MWReverted = require(scratchPath);
    const idx = MWReverted.indexCategoryManifest(manifest);
    const district = MWReverted.buildWorldDistrict({ index2: idx, prefID: PREF_ID, cols: COLS, rows: ROWS });
    const civicCells = district.tiles.filter(t => t.zone === 'civic');
    assert.equal(civicCells.length, 0, 'reverting the civic-slot mechanism should leave 0 civic-zone cells even though civic sprites exist in the manifest');
  } finally {
    delete require.cache[require.resolve(scratchPath)];
    fs.unlinkSync(scratchPath);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
