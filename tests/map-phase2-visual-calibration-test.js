'use strict';
/*
 * Focused contract test for the Phase 2 "Visual Calibration" pass. This pass
 * does not add assets -- it only widens Phase 2's own local same-sprite
 * exclusion radius (WORLD_NO_REPEAT_RADIUS, prototypes/map-world-preview.js)
 * from Base's NO_REPEAT_RADIUS=2 to 3, to reduce unnaturally close repeats of
 * the same P0 sprite now that office.small/commercial.small/residential.low
 * have real multi-sprite pools. Base's own NO_REPEAT_RADIUS/buildDistrict()
 * in prototypes/map-canvas-renderer.js is untouched.
 *
 * These assertions protect the INTENDED CONTRACT (repeats stay a minority,
 * fallback/occupancy/composition are unaffected, spawnWeight's real scope is
 * documented) rather than the exact tuned numbers measured during this pass,
 * per the calibration instruction's own warning against overfitting tests to
 * one-off tuned values.
 *
 * Run directly: node tests/map-phase2-visual-calibration-test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const MW = require(path.join(ROOT, 'prototypes/map-world-preview.js'));
const manifestPath = path.join(ROOT, 'assets/map-sprites/phase2/sprites.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const rendererPath = path.join(ROOT, 'prototypes/map-world-preview.js');
const rendererSrc = fs.readFileSync(rendererPath, 'utf8');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS:', name); pass++; }
  catch (e) { console.log('FAIL:', name, '--', e.message); fail++; }
}

const COLS = 32, ROWS = 28, PREF_ID = 'tokyo';

function buildTokyo(idx) {
  return MW.buildWorldDistrict({ index2: idx, prefID: PREF_ID, cols: COLS, rows: ROWS });
}

function repetitionCount(district, radius) {
  const byKeyBuilt = {};
  for (const t of district.tiles) if (t.spriteId) byKeyBuilt[`${t.tileX},${t.tileY}`] = t;
  let tilesWithRepeat = 0;
  for (const t of district.tiles) {
    if (!t.spriteId) continue;
    let found = false;
    for (let dy = -radius; dy <= radius && !found; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        const n = byKeyBuilt[`${t.tileX + dx},${t.tileY + dy}`];
        if (n && n.spriteId === t.spriteId) { found = true; break; }
      }
    }
    if (found) tilesWithRepeat++;
  }
  return { tilesWithRepeat, totalBuiltTiles: Object.keys(byKeyBuilt).length };
}

function requestedCategoryFor(cell) {
  if (cell.zone === 'landmark' || cell.zone === 'road') return null;
  const role = cell.templateRole;
  if (!role || !MW.BUILT_ROLES.has(role)) return null;
  const zoneRoles = MW.ROLE_CATEGORY[cell.zone];
  if (!zoneRoles || !zoneRoles[role]) return null;
  return MW.pickRoleCategory(zoneRoles[role], 'tokyo', cell.tileX, cell.tileY);
}

function categoryRequestCounts(district) {
  const counts = {};
  for (const cell of district.tiles) {
    const category = requestedCategoryFor(cell);
    if (!category) continue;
    counts[category] = (counts[category] || 0) + 1;
  }
  return counts;
}

function fallbackSummary(district, idx) {
  const summary = {};
  for (const cell of district.tiles) {
    const requestedCategory = requestedCategoryFor(cell);
    if (!requestedCategory || !cell.spriteId) continue;
    const resolvedCategory = idx.byId[cell.spriteId].category;
    const bucket = summary[requestedCategory] = summary[requestedCategory] || { direct: 0, fallback: 0 };
    if (resolvedCategory === requestedCategory) bucket.direct++; else bucket.fallback++;
  }
  return summary;
}

/* ---------------- 1. deterministic distribution ---------------- */
check('buildWorldDistrict is deterministic: repeat builds of the same district agree exactly', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const a = buildTokyo(idx);
  const b = buildTokyo(idx);
  const fp = d => d.tiles.map(t => `${t.tileX},${t.tileY}:${t.spriteId || ''}`).join('|');
  assert.equal(fp(a), fp(b));
});

/* ---------------- 2. manifest order independence ---------------- */
check('manifest entry order does not change district output (still true after the radius change)', () => {
  const idxA = MW.indexCategoryManifest(manifest);
  const shuffled = JSON.parse(JSON.stringify(manifest));
  shuffled.sprites = shuffled.sprites.slice().reverse();
  const idxB = MW.indexCategoryManifest(shuffled);
  const dA = buildTokyo(idxA);
  const dB = buildTokyo(idxB);
  const fp = d => d.tiles.map(t => t.spriteId || '').join('|');
  assert.equal(fp(dA), fp(dB));
});

/* ---------------- 3. fallback telemetry ---------------- */
check('P0 categories (office.small/commercial.small/residential.low) still resolve 100% direct, 0 fallback across the full district', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = buildTokyo(idx);
  const summary = fallbackSummary(district, idx);
  for (const cat of ['office.small', 'commercial.small', 'residential.low']) {
    assert.ok(summary[cat], `${cat}: no requests recorded`);
    assert.equal(summary[cat].fallback, 0, `${cat}: expected 0 fallback, saw ${summary[cat].fallback}`);
    assert.ok(summary[cat].direct > 0, `${cat}: expected direct hits`);
  }
});

/* ---------------- 4. P0 category direct-hit (full-district, not sampled) ---------------- */
check('no missing-category / open-space degradation anywhere in the full district (missingCategoryCount stays 0)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = buildTokyo(idx);
  let missing = 0;
  for (const cell of district.tiles) {
    if (!requestedCategoryFor(cell)) continue;
    if (!cell.spriteId && cell.open) missing++;
  }
  assert.equal(missing, 0, `expected 0 missing-category cells, saw ${missing}`);
});

/*
 * ---------------- 5. sprite distribution: all 20 P0 sprites used ----------------
 * Scoped to P0's own 3 categories, not `!s.placeholder` -- the P1 pass
 * later added its own non-placeholder sprites (civic/office.mid/
 * residential.mid) to this same manifest. civic in particular has only 2
 * winning slots per map out of 4 sprites, so "every non-placeholder sprite
 * appears in a single Tokyo build" is not a fair contract for it (P1's own
 * test file covers civic's usage with a multi-prefecture check instead).
 */
const P0_CATEGORIES = new Set(['office.small', 'commercial.small', 'residential.low']);
check('all 20 P0 (non-placeholder) sprites are actually selected somewhere in a full Tokyo district build', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = buildTokyo(idx);
  const used = new Set(district.tiles.map(t => t.spriteId).filter(Boolean));
  const p0Ids = manifest.sprites.filter(s => !s.placeholder && P0_CATEGORIES.has(s.category)).map(s => s.id);
  const unused = p0Ids.filter(id => !used.has(id));
  assert.deepEqual(unused, [], `unused P0 sprites: ${unused.join(', ')}`);
});

/* ---------------- 6. duplicate/repetition metric ---------------- */
check('WORLD_NO_REPEAT_RADIUS is wired at Phase 2\'s own sprite-selection call site', () => {
  assert.match(rendererSrc, /const WORLD_NO_REPEAT_RADIUS\s*=\s*3\s*;/);
  assert.match(rendererSrc, /nearbySpriteIds\(byKey,\s*cell\.tileX,\s*cell\.tileY,\s*WORLD_NO_REPEAT_RADIUS\)/);
});

check("Base's own NO_REPEAT_RADIUS (Phase 1 / map-canvas-renderer.js) stays 2 -- this pass owns a local override only", () => {
  assert.equal(MW.NO_REPEAT_RADIUS, 2);
});

check('same-sprite repeats within radius 3 stay a minority of built tiles (generous, non-overfit threshold)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = buildTokyo(idx);
  const r3 = repetitionCount(district, 3);
  const ratio = r3.tilesWithRepeat / r3.totalBuiltTiles;
  assert.ok(ratio < 0.35, `radius-3 repeat ratio ${ratio.toFixed(3)} (${r3.tilesWithRepeat}/${r3.totalBuiltTiles}) is not a minority`);
});

/* ---------------- 7. spawnWeight semantics (documents the "A" conclusion) ---------------- */
check('spawnWeight only shifts selection WITHIN a resolved category+district pool -- it never changes which category a role requests or the hero/mid/small TILE COUNT (fixed by BLOCK_TEMPLATES, not the manifest)', () => {
  const idxBefore = MW.indexCategoryManifest(manifest);
  const districtBefore = buildTokyo(idxBefore);
  const countsBefore = categoryRequestCounts(districtBefore);

  const boosted = JSON.parse(JSON.stringify(manifest));
  const officeSmall = boosted.sprites.filter(s => s.category === 'office.small');
  assert.ok(officeSmall.length >= 2, 'need a multi-sprite office.small pool for this test to be meaningful');
  officeSmall[0].spawnWeight = 100000; // drastic, deliberately absurd boost

  const idxAfter = MW.indexCategoryManifest(boosted);
  const districtAfter = buildTokyo(idxAfter);
  const countsAfter = categoryRequestCounts(districtAfter);

  // role -> category request counts (== hero/mid/small tile counts) are a
  // pure function of BLOCK_TEMPLATES + ROLE_CATEGORY, not the manifest.
  assert.deepEqual(countsBefore, countsAfter, 'category/tile-count composition changed after a spawnWeight edit -- spawnWeight must not control tier composition');

  // sanity: the boosted sprite's own within-category share DID increase,
  // proving spawnWeight does control something (variety within the pool).
  const shareOf = (district, id) => district.tiles.filter(t => t.spriteId === id).length;
  const boostedId = officeSmall[0].id;
  const shareBefore = shareOf(districtBefore, boostedId);
  const shareAfter = shareOf(districtAfter, boostedId);
  assert.ok(shareAfter > shareBefore, `boosting spawnWeight should increase ${boostedId}'s own selection count (before=${shareBefore}, after=${shareAfter})`);
});

/* ---------------- 8. no Math.random / simulation RNG ---------------- */
check('no Math.random or simulation RNG in the touched file', () => {
  const RNG_CALL = ['Math', 'random'].join('.');
  assert.ok(!rendererSrc.includes(RNG_CALL));
});

/* ---------------- 9. save invariants ---------------- */
check('no save-state reference (SAVE_KEY / saveVersion / localStorage) in the touched file', () => {
  assert.doesNotMatch(rendererSrc, /SAVE_KEY|saveVersion|localStorage/);
});

/* ---------------- 10. occupancy regression ---------------- */
/*
 * 2026-09 (prefecture identity / regional variation): occupancy used to be
 * pinned to a tight tolerance because Tokyo's cbd/commercial/etc block
 * areas were a fixed-corner rectangle far from the landmark, so the raw
 * BLOCK_TEMPLATES built-share (10/16=62.5% for cbd, etc) came through with
 * no boundary effects. Zone footprints are now profile/seed-driven (see
 * prototypes/map-prefecture-profiles.js) -- a zone can now be irregularly
 * shaped, reach the grid's truncated edge blocks, or sit adjacent to the
 * landmark's distance-gradient, all of which nudge the measured ratio a
 * few points off the template's ideal without indicating any regression.
 * The tolerance is widened to still catch a real regression (occupancy
 * collapsing toward 0% or 100%) while accepting this legitimate variance --
 * measured across all 47 real profiles, the largest observed drift from
 * the template ideal is ~6.6 points (commercial); 10 points leaves margin.
 */
check('district occupancy percentages stay close to their BLOCK_TEMPLATES ideal (tolerant of profile-driven zone-shape variance)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  const district = buildTokyo(idx);
  const byZone = {};
  for (const t of district.tiles) {
    if (t.zone === 'landmark' || t.zone === 'road' || t.zone === 'park') continue;
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

/* ---------------- 11. Phase 1 foundation regression ---------------- */
check("Phase 1 foundation (map-canvas-renderer.js) is untouched by this pass", () => {
  const { execSync } = require('child_process');
  let diffFiles;
  try {
    diffFiles = execSync('git diff --name-only origin/main...HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch (e) {
    diffFiles = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  }
  assert.ok(!diffFiles.includes('prototypes/map-canvas-renderer.js'), 'prototypes/map-canvas-renderer.js was touched by this pass');
  assert.ok(!diffFiles.some(f => f.startsWith('index.html') || f.startsWith('js/') || f.startsWith('css/')), 'a production file was touched by this pass');
});

/* ---------------- 12. P0 asset regression (lightweight; full 23-check regression lives in map-phase2-p0-assets-test.js) ---------------- */
check("P0's own 20 sprites are unchanged within the manifest (office.small=6/commercial.small=8/residential.low=6; later passes may add rows on top, so the manifest total itself is not pinned here)", () => {
  const p0 = manifest.sprites.filter(s => !s.placeholder && P0_CATEGORIES.has(s.category));
  assert.ok(manifest.sprites.length >= 35, `expected at least 35 rows (15 legacy + 20 P0), saw ${manifest.sprites.length}`);
  assert.equal(p0.length, 20);
  const counts = {};
  for (const s of p0) counts[s.category] = (counts[s.category] || 0) + 1;
  assert.equal(counts['office.small'], 6);
  assert.equal(counts['commercial.small'], 8);
  assert.equal(counts['residential.low'], 6);
});

/* ---------------- negative test 1: revert the fix, confirm it actually mattered ---------------- */
check('NEGATIVE: reverting WORLD_NO_REPEAT_RADIUS to 2 measurably worsens the radius-3 repeat ratio (proves the repetition test has teeth)', () => {
  const reverted = rendererSrc.replace(
    /const WORLD_NO_REPEAT_RADIUS\s*=\s*3\s*;/,
    'const WORLD_NO_REPEAT_RADIUS = 2;'
  );
  assert.notEqual(reverted, rendererSrc, 'source replace did not match -- test itself is broken');

  const scratchPath = path.join(ROOT, 'prototypes/_scratch-visual-calibration-negtest.js');
  fs.writeFileSync(scratchPath, reverted);
  try {
    delete require.cache[require.resolve(scratchPath)];
    const MWReverted = require(scratchPath);
    const idx = MWReverted.indexCategoryManifest(manifest);
    const district = MWReverted.buildWorldDistrict({ index2: idx, prefID: PREF_ID, cols: COLS, rows: ROWS });

    const byKeyBuilt = {};
    for (const t of district.tiles) if (t.spriteId) byKeyBuilt[`${t.tileX},${t.tileY}`] = t;
    let tilesWithRepeat = 0;
    for (const t of district.tiles) {
      if (!t.spriteId) continue;
      let found = false;
      for (let dy = -3; dy <= 3 && !found; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (dx === 0 && dy === 0) continue;
          const n = byKeyBuilt[`${t.tileX + dx},${t.tileY + dy}`];
          if (n && n.spriteId === t.spriteId) { found = true; break; }
        }
      }
      if (found) tilesWithRepeat++;
    }
    const revertedRatio = tilesWithRepeat / Object.keys(byKeyBuilt).length;

    const idxReal = MW.indexCategoryManifest(manifest);
    const realDistrict = buildTokyo(idxReal);
    const real = repetitionCount(realDistrict, 3);
    const realRatio = real.tilesWithRepeat / real.totalBuiltTiles;

    assert.ok(revertedRatio > realRatio, `reverting to radius=2 should worsen the radius-3 repeat ratio (reverted=${revertedRatio.toFixed(3)}, real=${realRatio.toFixed(3)})`);
    /*
     * 2026-09 (prefecture identity / regional variation): a fixed absolute
     * threshold (was "must cross the same 0.35 the positive test passes")
     * stopped being meaningful once zone footprints became profile/seed-
     * driven -- Tokyo's own cbd/commercial zones are now much larger
     * contiguous areas than the old fixed corner, which gives even radius=2
     * far more sprite-position diversity to work with (measured real-code
     * radius-3 ratio dropped to ~0.03 from a previous, much higher
     * baseline). A no-op "revert" would leave the ratio unchanged (~1x);
     * requiring it at least double instead pins the actual claim being
     * tested -- radius=3 measurably helps -- without coupling to a
     * constant tuned for geometry this PR intentionally changed.
     */
    assert.ok(revertedRatio > realRatio * 2, `reverted-to-2 ratio (${revertedRatio.toFixed(3)}) should be measurably (not just marginally) worse than the real radius-3 ratio (${realRatio.toFixed(3)}) -- otherwise the threshold test above is not actually protecting anything`);
  } finally {
    delete require.cache[require.resolve(scratchPath)];
    fs.unlinkSync(scratchPath);
  }
});

/* ---------------- negative test 2: the "never empty the pool" guard is load-bearing ---------------- */
check('NEGATIVE: excluding every sprite in a single-sprite category pool must NOT empty the selection (guards against a stricter-but-wrong exclusion rewrite)', () => {
  const idx = MW.indexCategoryManifest(manifest);
  // logistics has exactly one sprite in this manifest (a legacy
  // placeholder, unaffected by P0/P1) -- confirm that premise, then prove
  // the guard holds. (residential.mid was this test's original example,
  // but the P1 pass gave it 4 more sprites, so it no longer fits.)
  const pool = manifest.sprites.filter(s => s.category === 'logistics');
  assert.equal(pool.length, 1, 'this test assumes logistics is still a single-sprite category; re-check if that changes');
  const onlyId = pool[0].id;

  const withoutExclude = MW.selectSpriteForCategory(idx, { category: 'logistics', district: 'logistics', prefID: PREF_ID, tileX: 3, tileY: 3 });
  const withExcludeEverything = MW.selectSpriteForCategory(idx, { category: 'logistics', district: 'logistics', prefID: PREF_ID, tileX: 3, tileY: 3, excludeIds: new Set([onlyId]) });

  assert.equal(withoutExclude, onlyId);
  assert.equal(withExcludeEverything, onlyId, 'excluding the only sprite in the pool must still return it, not null/undefined -- an empty pool means a missing building');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
