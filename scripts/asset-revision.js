'use strict';
/*
 * Deterministic static-asset revision -- the single source of truth for the
 * `?rev=` cache-busting stamps that keep a returning browser from mixing a
 * freshly fetched index.html with stale, separately cached JS/CSS.
 *
 * Why this exists (real production incident): index.html referenced every
 * asset by an unversioned URL (`./js/d-ui-shell.js`), and play.html appends
 * a Date.now() `v=` param that busts ONLY index.html. A returning iPhone
 * therefore reliably fetched the newest HTML while reusing whatever JS/CSS
 * generation it already had cached -- markers rendered with old CSS (abstract
 * pins, no placard label) and old JS (no tap handling), which is exactly the
 * "旧marker UI・旧tap不能挙動" reported on a real device AFTER the fixes had
 * already merged and published. GitHub Pages' own byte-level publication
 * checks passed the whole time (scripts/verify-published-pages.js), which
 * confirms the server was correct and the staleness was client-side.
 *
 * The revision is a content hash, not a timestamp, a commit SHA, or a random
 * value:
 *   - Deterministic: the same working tree always produces the same revision,
 *     so two people (or CI and a laptop) stamp identically. Date.now() and
 *     Math.random() are unusable here for the same reason they are banned
 *     everywhere else in this codebase.
 *   - Self-invalidating: it changes exactly when a versioned asset's real
 *     content changes, so a release can never forget to bust a cache, and an
 *     unrelated release can never needlessly bust one.
 *   - Checkable: tests/static-asset-cache-coherence-test.js recomputes it and
 *     fails if any stamp drifted, so a stale stamp is a red test rather than a
 *     silently broken production cache.
 *
 * A commit SHA cannot be used: the stamp has to be committed, and the commit
 * SHA is not known until after the commit exists.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');

/*
 * The map-critical asset set. Every one of these participates in rendering or
 * interacting with the Phase 2 production map, so a stale copy of any single
 * one reproduces the reported symptom. They all share ONE revision on purpose:
 * per-file revisions are what allow a mixed generation in the first place.
 */
const DIRECT_SCRIPTS = [
  'js/map-phase2-canvas.js',
  'js/d-ui-shell.js',
  'js/iphone-playtest-fixes.js',
];
const DIRECT_STYLES = [
  'css/d-ui-mobile-company.css',
  'css/iphone-playtest-fixes.css',
];
/* Reached only through css/d-ui-mobile-company.css's @import list, so the
   browser caches each one independently of index.html -- versioning the
   importer alone would still serve a stale marker stylesheet. */
const NESTED_STYLES = [
  'css/d-ui-reference-fidelity.css',
  'css/d-ui-map-focus.css',
  'css/d-ui-map-depth.css',
  'css/d-ui-map.css',
  'css/d-ui-map-phase2-canvas.css',
  'css/d-ui-map-phase2-markers.css',
  'css/d-ui-map-phase2-pan.css',
];
/* Injected at runtime by js/map-phase2-canvas.js, so index.html's own cache
   state says nothing about which generation of these the browser holds. */
const LAZY_RUNTIME = [
  'prototypes/map-canvas-renderer.js',
  'prototypes/map-prefecture-profiles.js',
  'prototypes/map-world-preview.js',
];
const SPRITE_MANIFEST = 'assets/map-sprites/phase2/sprites.json';

const VERSIONED_ASSETS = [
  ...DIRECT_SCRIPTS, ...DIRECT_STYLES, ...NESTED_STYLES, ...LAZY_RUNTIME, SPRITE_MANIFEST,
];

const REVISION_PATTERN = '[0-9a-f]{12}';
const REVISION_RE = new RegExp(`^${REVISION_PATTERN}$`);

/*
 * Three files both CONTAIN stamps and ARE versioned assets themselves
 * (js/map-phase2-canvas.js, css/d-ui-mobile-company.css,
 * css/d-ui-map-phase2-markers.css). Hashing their raw bytes would make the
 * revision depend on itself -- stamping would change the content, which would
 * change the revision, which would require re-stamping, forever. Hashing the
 * CANONICAL form (every stamp value blanked out) breaks that cycle: the
 * revision depends only on real content, so stamping is idempotent and
 * re-running it on an already-stamped tree is a no-op.
 */
function canonical(text) {
  return String(text)
    .replace(new RegExp(`\\?rev=${REVISION_PATTERN}`, 'g'), '')
    .replace(new RegExp(`__STATIC_ASSET_REVISION='${REVISION_PATTERN}'`, 'g'), "__STATIC_ASSET_REVISION=''")
    .replace(new RegExp(`--d-map-asset-revision:"${REVISION_PATTERN}"`, 'g'), '--d-map-asset-revision:""');
}

function computeRevision(root = ROOT) {
  const hash = crypto.createHash('sha256');
  // Fixed iteration order (not readdir order) so the revision is reproducible
  // across filesystems.
  for (const asset of VERSIONED_ASSETS) {
    const file = path.join(root, asset);
    if (!fs.existsSync(file)) throw new Error(`versioned asset is missing: ${asset}`);
    hash.update(asset);
    hash.update('\0');
    hash.update(canonical(fs.readFileSync(file, 'utf8')));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

/*
 * Where each stamp physically lives. `refs` are the exact URL strings as they
 * appear in that container, so stamping never has to guess at relative-path
 * resolution: index.html reaches css/ and js/ from the repository root, while
 * d-ui-mobile-company.css's @import list is relative to css/ itself.
 */
function stampTargets() {
  return [
    { file: 'index.html', refs: [...DIRECT_SCRIPTS, ...DIRECT_STYLES].map(asset => `./${asset}`) },
    { file: 'css/d-ui-mobile-company.css', refs: NESTED_STYLES.map(asset => `./${path.basename(asset)}`) },
    { file: 'js/map-phase2-canvas.js', refs: [...LAZY_RUNTIME.map(asset => `./${asset}`), '/sprites.json'] },
  ];
}

function escapeRe(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* Adds the stamp when absent and replaces it when present, so this is safe to
   re-run and never accumulates `?rev=a?rev=b`. */
function applyStamps(text, refs, revision) {
  let output = String(text);
  for (const ref of refs) {
    const re = new RegExp(`${escapeRe(ref)}(?:\\?rev=${REVISION_PATTERN})?`, 'g');
    output = output.replace(re, `${ref}?rev=${revision}`);
  }
  return output;
}

/* Runtime diagnostics (see requirement 21): the published WebKit test reads
   these back to prove the browser is actually running one generation. They are
   deliberately inert -- never saved, never in localStorage, never part of
   game state. */
function applyRuntimeRevision(text, revision) {
  return String(text).replace(
    new RegExp(`__STATIC_ASSET_REVISION='(?:${REVISION_PATTERN})?'`, 'g'),
    `__STATIC_ASSET_REVISION='${revision}'`
  );
}
function applyStyleRevision(text, revision) {
  return String(text).replace(
    new RegExp(`--d-map-asset-revision:"(?:${REVISION_PATTERN})?"`, 'g'),
    `--d-map-asset-revision:"${revision}"`
  );
}

function stampedContent(root, revision) {
  const results = new Map();
  for (const target of stampTargets()) {
    const file = path.join(root, target.file);
    results.set(target.file, applyStamps(fs.readFileSync(file, 'utf8'), target.refs, revision));
  }
  const canvasKey = 'js/map-phase2-canvas.js';
  results.set(canvasKey, applyRuntimeRevision(results.get(canvasKey), revision));
  const markersKey = 'css/d-ui-map-phase2-markers.css';
  const markersFile = path.join(root, markersKey);
  results.set(markersKey, applyStyleRevision(fs.readFileSync(markersFile, 'utf8'), revision));
  return results;
}

/* Returns a human-readable list of files whose committed stamps do not match
   the revision their own content implies. Empty means the tree is coherent. */
function verifyStamps(root = ROOT) {
  const revision = computeRevision(root);
  const problems = [];
  for (const [relative, expected] of stampedContent(root, revision)) {
    const actual = fs.readFileSync(path.join(root, relative), 'utf8');
    if (actual !== expected) problems.push(relative);
  }
  return { revision, problems };
}

function writeStamps(root = ROOT) {
  const revision = computeRevision(root);
  const changed = [];
  for (const [relative, expected] of stampedContent(root, revision)) {
    const file = path.join(root, relative);
    if (fs.readFileSync(file, 'utf8') === expected) continue;
    fs.writeFileSync(file, expected);
    changed.push(relative);
  }
  return { revision, changed };
}

module.exports = {
  ROOT, VERSIONED_ASSETS, DIRECT_SCRIPTS, DIRECT_STYLES, NESTED_STYLES, LAZY_RUNTIME, SPRITE_MANIFEST,
  REVISION_RE, canonical, computeRevision, stampTargets, applyStamps, verifyStamps, writeStamps,
};
