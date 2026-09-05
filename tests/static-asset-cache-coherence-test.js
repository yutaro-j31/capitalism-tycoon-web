'use strict';
/*
 * Static-asset cache coherence contract.
 *
 * Real production incident this locks down: PR #615/#616 shipped a working
 * marker UI (always-visible placards) and a working marker tap, CI was green,
 * and scripts/verify-published-pages.js confirmed GitHub Pages was serving
 * bytes identical to main -- yet a real iPhone kept rendering the OLD abstract
 * pins with no placard text and dead taps. The server was never wrong; the
 * BROWSER was mixing generations.
 *
 * Mechanism: index.html referenced every asset by an unversioned URL
 * ('./js/d-ui-shell.js'), while play.html redirects to index.html with a
 * Date.now() `v=` param. So the HTML was reliably fresh and every JS/CSS file
 * it pointed at was reliably served from whatever the browser had cached --
 * the exact "HTMLだけ新しい / d-ui-shell.jsだけ古い" split. Nested @import
 * stylesheets and the lazily injected prototypes/ runtime were even further
 * out of reach, since index.html's own cache state says nothing about them.
 *
 * The fix is a single content-derived revision stamped onto every
 * map-critical URL (scripts/asset-revision.js). A content hash rather than a
 * timestamp/commit SHA means the revision is deterministic, changes exactly
 * when real content changes, and can be recomputed here -- so a forgotten
 * re-stamp is a red test instead of a silently stale production cache.
 *
 * Run directly: node tests/static-asset-cache-coherence-test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const revisionModule = require('../scripts/asset-revision');
const {
  ROOT, VERSIONED_ASSETS, DIRECT_SCRIPTS, DIRECT_STYLES, NESTED_STYLES, LAZY_RUNTIME,
  SPRITE_MANIFEST, canonical, computeRevision, verifyStamps,
} = revisionModule;

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS:', name); pass += 1; }
  catch (error) { console.log('FAIL:', name, '--', error.message); fail += 1; }
}

const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const indexHtml = read('index.html');
const loaderCss = read('css/d-ui-mobile-company.css');
const canvasJs = read('js/map-phase2-canvas.js');
const markersCss = read('css/d-ui-map-phase2-markers.css');
const revisionScript = read('scripts/asset-revision.js');
const REV = '[0-9a-f]{12}';

/* ===================== DETERMINISM ===================== */

check('the revision is deterministic: recomputing it over the same tree yields the identical value', () => {
  assert.equal(computeRevision(), computeRevision());
  assert.match(computeRevision(), new RegExp(`^${REV}$`));
});

check('the revision is derived from content, never from a clock or a random source', () => {
  // Comments in that file legitimately DISCUSS Date.now()/Math.random() (they
  // explain why neither is usable here), so the executable code is what gets
  // checked -- exactly the distinction this contract cares about.
  const code = revisionScript.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /Date\s*\.\s*now/, 'a timestamp would re-bust every cache on every release, and would differ between two machines stamping the same tree');
  assert.doesNotMatch(code, /Math\s*\.\s*random/);
  assert.match(code, /createHash/, 'the revision must be a content hash');
});

check('the revision actually responds to content: changing a versioned asset changes it, and changing an unrelated file does not', () => {
  const before = computeRevision();
  const target = path.join(ROOT, 'css/d-ui-map-phase2-markers.css');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(target, `${original}\n/* cache-coherence probe */\n`);
    assert.notEqual(computeRevision(), before, 'editing a versioned asset must produce a new revision, otherwise a real change would ship behind a stale cache');
  } finally {
    fs.writeFileSync(target, original);
  }
  assert.equal(computeRevision(), before, 'restoring the file must restore the revision (pure function of content)');
});

check('stamping is a fixpoint: the hash ignores the stamp values themselves, so re-stamping an already-stamped tree is a no-op', () => {
  // Without this, writing the revision into a file that is itself hashed would
  // change that file, which would change the revision, forever.
  const stamped = canonical(canvasJs);
  assert.doesNotMatch(stamped, new RegExp(`\\?rev=${REV}`), 'canonical() must strip ?rev= stamps before hashing');
  assert.doesNotMatch(stamped, new RegExp(`__STATIC_ASSET_REVISION='${REV}'`), 'canonical() must blank the runtime revision before hashing');
  assert.doesNotMatch(canonical(markersCss), new RegExp(`--d-map-asset-revision:"${REV}"`), 'canonical() must blank the stylesheet revision before hashing');
});

/* ===================== COVERAGE ===================== */

check('every map-critical asset is in the versioned set: direct JS, direct CSS, nested @import CSS, lazy runtime, and the sprite manifest', () => {
  for (const asset of [
    'js/map-phase2-canvas.js', 'js/d-ui-shell.js', 'js/iphone-playtest-fixes.js',
    'css/d-ui-mobile-company.css', 'css/iphone-playtest-fixes.css',
    'css/d-ui-reference-fidelity.css', 'css/d-ui-map-focus.css', 'css/d-ui-map-depth.css',
    'css/d-ui-map.css', 'css/d-ui-map-phase2-canvas.css', 'css/d-ui-map-phase2-markers.css',
    'css/d-ui-map-phase2-pan.css',
    'prototypes/map-canvas-renderer.js', 'prototypes/map-prefecture-profiles.js', 'prototypes/map-world-preview.js',
    'assets/map-sprites/phase2/sprites.json',
  ]) {
    assert.ok(VERSIONED_ASSETS.includes(asset), `${asset} must be versioned -- a stale copy of it alone reproduces the reported symptom`);
    assert.ok(fs.existsSync(path.join(ROOT, asset)), `${asset} must exist`);
  }
});

check('the committed stamps are current -- nothing drifted since the last content change', () => {
  const { problems, revision } = verifyStamps();
  assert.deepEqual(problems, [], `these files carry a stale revision (expected ${revision}); run: node scripts/stamp-asset-revision.js`);
});

/* ===================== ONE GENERATION ===================== */

function stampsIn(text) {
  return [...text.matchAll(new RegExp(`\\?rev=(${REV})`, 'g'))].map(match => match[1]);
}

check('direct scripts and stylesheets in index.html all carry the revision', () => {
  for (const asset of [...DIRECT_SCRIPTS, ...DIRECT_STYLES]) {
    assert.ok(
      indexHtml.includes(`./${asset}?rev=${computeRevision()}`),
      `index.html must reference ./${asset} with the current revision`
    );
  }
});

check('nested @import stylesheets carry the revision -- versioning only the importer would still serve a stale marker stylesheet', () => {
  for (const asset of NESTED_STYLES) {
    const base = path.basename(asset);
    assert.match(loaderCss, new RegExp(`@import url\\("\\./${base.replace(/\./g, '\\.')}\\?rev=${REV}"\\);`), `${base} must be imported with a revision`);
  }
});

check('the lazily injected prototypes runtime and the sprite manifest carry the revision -- index.html cache state says nothing about them', () => {
  for (const asset of LAZY_RUNTIME) {
    assert.ok(canvasJs.includes(`./${asset}?rev=${computeRevision()}`), `${asset} must be injected with a revision`);
  }
  assert.match(canvasJs, new RegExp(`\\$\\{ASSET_BASE\\}/sprites\\.json\\?rev=${REV}`), `${SPRITE_MANIFEST} must be fetched with a revision`);
});

check('ALL map-critical URLs share ONE revision -- per-file revisions are what allow a mixed generation in the first place', () => {
  const all = [...stampsIn(indexHtml), ...stampsIn(loaderCss), ...stampsIn(canvasJs)];
  assert.ok(all.length >= VERSIONED_ASSETS.length - 1, `expected a stamp per versioned asset reference, saw ${all.length}`);
  assert.equal(new Set(all).size, 1, `every map-critical URL must carry the same revision, saw: ${[...new Set(all)].join(', ')}`);
  assert.equal(all[0], computeRevision());
});

/* ===================== RUNTIME DIAGNOSTICS ===================== */

check('the runtime exposes the revision from BOTH a script and a stylesheet, so a published test can detect a stale JS or a stale CSS independently', () => {
  const revision = computeRevision();
  assert.ok(canvasJs.includes(`globalThis.__STATIC_ASSET_REVISION='${revision}'`), 'js/map-phase2-canvas.js must expose the revision it was built with');
  assert.ok(markersCss.includes(`--d-map-asset-revision:"${revision}"`), 'the marker stylesheet must expose the revision it was built with');
});

check('the revision diagnostic never touches save state, browser storage, or gameplay', () => {
  const block = canvasJs.slice(canvasJs.indexOf('__STATIC_ASSET_REVISION'), canvasJs.indexOf('const ASSET_BASE'));
  assert.doesNotMatch(block, /localStorage|sessionStorage|SAVE_KEY|saveVersion/);
  assert.doesNotMatch(block, /engine\.|\bg\./);
});

/* ===================== INVARIANTS ===================== */

check('css/app.css is NOT versioned -- it is byte-frozen against tests/fixtures/extracted-css-baseline.css', () => {
  assert.ok(!VERSIONED_ASSETS.includes('css/app.css'));
  assert.match(indexHtml, /href="\.\/css\/app\.css"/, 'app.css must keep its unversioned URL');
  assert.equal(
    fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'tests/fixtures/extracted-css-baseline.css'), 'utf8'),
    'css/app.css must stay byte-identical to its baseline'
  );
});

check('SAVE_KEY / saveVersion are untouched by asset versioning', () => {
  assert.ok(read('js/engine.js').includes('capitalism_tycoon_web_v1'), 'SAVE_KEY must stay capitalism_tycoon_web_v1');
  // js/save-v9.js is the module that owns the current save version.
  assert.match(read('js/save-v9.js'), /const SAVE_VERSION=9;/, 'saveVersion must stay 9');
});

/* ===================== NEGATIVE TESTS ===================== */

check('NEGATIVE 1: an unversioned marker stylesheet is rejected (the "HTML new / marker CSS old" mix that produced the old pins)', () => {
  const unversioned = loaderCss.replace(new RegExp(`(d-ui-map-phase2-markers\\.css)\\?rev=${REV}`), '$1');
  assert.notEqual(unversioned, loaderCss, 'sanity: the mutation must actually remove a stamp');
  assert.ok(
    !new RegExp(`@import url\\("\\./d-ui-map-phase2-markers\\.css\\?rev=${REV}"\\);`).test(unversioned),
    'the coherence check above would pass this mutated content, which would let a cached marker stylesheet survive a release'
  );
});

check('NEGATIVE 2: a drifted js/d-ui-shell.js revision is rejected (the "d-ui-shell old / CSS new" mix that produced dead taps)', () => {
  const drifted = indexHtml.replace(
    new RegExp(`(\\./js/d-ui-shell\\.js)\\?rev=${REV}`),
    '$1?rev=000000000000'
  );
  assert.notEqual(drifted, indexHtml, 'sanity: the mutation must actually change a stamp');
  const stamps = new Set(stampsIn(drifted));
  assert.ok(stamps.size > 1, 'a drifted stamp must break the single-generation invariant the real file satisfies');
  assert.ok(stamps.has('000000000000'));
});

check('NEGATIVE 3: a stale committed stamp is rejected -- editing a versioned asset without re-stamping fails verifyStamps()', () => {
  const target = path.join(ROOT, 'prototypes/map-world-preview.js');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(target, `${original}\n/* stale-stamp probe */\n`);
    const { problems } = verifyStamps();
    assert.ok(problems.length > 0, 'changing a versioned asset without re-stamping must be reported, otherwise the release ships behind the previous revision');
  } finally {
    fs.writeFileSync(target, original);
  }
  assert.deepEqual(verifyStamps().problems, [], 'sanity: restoring the file must restore coherence');
});

check('NEGATIVE 4: a lazily injected prototype left unversioned is rejected (index.html freshness says nothing about it)', () => {
  const unversioned = canvasJs.replace(new RegExp(`(\\./prototypes/map-world-preview\\.js)\\?rev=${REV}`), '$1');
  assert.notEqual(unversioned, canvasJs, 'sanity: the mutation must actually remove a stamp');
  assert.ok(!unversioned.includes(`./prototypes/map-world-preview.js?rev=${computeRevision()}`));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
