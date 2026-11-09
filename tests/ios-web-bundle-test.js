'use strict';

// Contract for the iOS shell (ios/App + ios/project.yml + scripts/build-ios-web-bundle.js).
// It proves what can be proven without a Swift toolchain: the bundled snapshot
// contains every file the game loads, the game files are byte-identical to the
// repository, and the shell serves every file type the snapshot contains.
// Compilation and launch are proven separately by the iOS Build workflow.
//
// Not registered in tests/run-all.js: the canonical registry size is pinned by
// retained shard evidence (scripts/parallel-shard-*-evidence-audit*.cjs), so this
// contract runs in .github/workflows/ios-build.yml instead.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const { build, indexReferences, lazyReferences } = require('../scripts/build-ios-web-bundle.js');

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function walk(directory, base = directory, out = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ios-web-bundle-'));
try {
  const result = build(out);
  assert.equal(path.basename(result.webDirectory), 'web');

  // 1. Shell sources are present and the project bundles the snapshot as a
  //    folder reference, which keeps the directory tree the game's URLs expect.
  for (const name of ['TycoonApp.swift', 'GameWebView.swift', 'BundleSchemeHandler.swift']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'ios', 'App', name)), `ios/App/${name} exists`);
  }
  const project = fs.readFileSync(path.join(ROOT, 'ios', 'project.yml'), 'utf8');
  assert.match(project, /- path: build\/web\n\s+type: folder\n\s+buildPhase: resources/, 'build/web is bundled as a folder reference');
  assert.match(project, /iOS: "16\.0"/, 'deployment target is declared');

  // 2. Every startup and lazily loaded file exists in the snapshot.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const startup = indexReferences(html);
  assert.ok(startup.length > 200, `index.html references are discovered (${startup.length})`);
  assert.ok(startup.includes('js/app.js') && startup.includes('css/app.css'));
  assert.ok(!startup.some(reference => reference.includes('?')), 'asset revision stamps are stripped');
  const lazy = lazyReferences(path.join(ROOT, 'js'));
  assert.ok(lazy.includes('assets/vendor/three-r160.min.js'), 'the vendored 3D library is treated as a runtime file');
  for (const reference of [...startup, ...lazy]) {
    assert.ok(fs.existsSync(path.join(result.webDirectory, reference)), `${reference} is in the package`);
  }

  // 3. Game files are copied byte-for-byte: the app runs the same code as the web build.
  for (const reference of startup) {
    assert.equal(sha(path.join(result.webDirectory, reference)), sha(path.join(ROOT, reference)), `${reference} is unmodified`);
  }

  // 4. The scheme handler knows a MIME type for every file type the game requests.
  const handler = fs.readFileSync(path.join(ROOT, 'ios', 'App', 'BundleSchemeHandler.swift'), 'utf8');
  const served = new Set([...handler.matchAll(/^\s*"([a-z0-9]+)":\s*"[^"]+",?$/gm)].map(match => match[1]));
  const requested = new Set(
    walk(result.webDirectory)
      .filter(file => file !== 'build-info.json')
      .map(file => path.extname(file).slice(1).toLowerCase())
      .filter(Boolean)
  );
  for (const extension of requested) {
    assert.ok(served.has(extension), `BundleSchemeHandler serves .${extension} files with a MIME type`);
  }

  // 5. The shell supplies the browser features the game depends on.
  const view = fs.readFileSync(path.join(ROOT, 'ios', 'App', 'GameWebView.swift'), 'utf8');
  const gameSource = fs.readdirSync(path.join(ROOT, 'js')).filter(name => name.endsWith('.js')).sort()
    .map(name => fs.readFileSync(path.join(ROOT, 'js', name), 'utf8')).join('\n');
  assert.match(gameSource, /\bconfirm\(/, 'the game still uses confirm(); update this contract if that changes');
  assert.match(view, /runJavaScriptConfirmPanelWithMessage/, 'confirm() dialogs are presented');
  assert.match(view, /completionHandler\(false\)/, 'an undisplayable confirmation is never treated as consent');
  assert.match(gameSource, /\.download\s*=/, 'the game still exports files through download links');
  assert.match(view, /WKDownloadDelegate/, 'download links (save backups) are handled');
  assert.match(view, /websiteDataStore = \.default\(\)/, 'saves use the persistent data store');
  assert.match(handler, /hasPrefix\(root\.path \+ "\/"\)/, 'requests cannot escape the bundled web directory');

  // 6. Reference discovery ignores external links and strips revision stamps.
  assert.deepEqual(indexReferences('<script src="./js/a.js?rev=1"></script><a href="https://example.com/x">x</a>'), ['js/a.js']);

  console.log(`ios-web-bundle-test: PASS (${startup.length} startup files, ${lazy.length} lazy references, ${requested.size} file types)`);
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}
