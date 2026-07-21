'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, readIndex, loadGame } = require('./harness');

const manifestPath = path.join(ROOT, 'release-candidate.json');
assert.ok(fs.existsSync(manifestPath), 'release-candidate.json is required');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.schemaVersion, 1, 'release candidate schema must remain version 1');
assert.match(manifest.version, /^2\.0\.0-rc\.\d+$/, 'release candidate version must use 2.0.0-rc.N');
assert.equal(manifest.tag, `v${manifest.version}`, 'release tag must match the candidate version');
assert.equal(manifest.channel, 'release-candidate');
assert.equal(manifest.repository, 'yutaro-j31/capitalism-tycoon-web');
assert.equal(manifest.sourceBranch, 'main');
assert.equal(manifest.entrypoint, './index.html');
assert.equal(manifest.releaseGate, 'npm run test:release');
assert.deepEqual(manifest.deployment, {
  provider: 'github-pages',
  url: 'https://yutaro-j31.github.io/capitalism-tycoon-web/'
});

const requiredSmokeChecks = [
  'fresh-start',
  'json-save-recovery',
  'one-week-advance',
  'four-week-advance',
  'save-export-import',
  'iphone-safe-area-navigation',
  'market-capital-allocation-cards'
];
assert.deepEqual(manifest.manualSmokeChecks, requiredSmokeChecks, 'manual smoke contract changed');

const entrypoint = path.resolve(ROOT, manifest.entrypoint);
assert.ok(entrypoint.startsWith(`${ROOT}${path.sep}`), 'entrypoint must remain inside the repository');
assert.ok(fs.existsSync(entrypoint), 'release entrypoint is missing');

const html = readIndex();
assert.match(html, /<html\b[^>]*\blang="ja"/i, 'Japanese document language is required');
assert.match(html, /<title>資本主義ポケット TYCOON v2\.0<\/title>/, 'document title must match the 2.0 release line');
assert.match(html, /<link\b[^>]*href="\.\/css\/app\.css"/i, 'release CSS must use a Pages-safe relative URL');
assert.match(html, /<script\b[^>]*src="\.\/js\/boot-recovery\.js"/i,
  'boot recovery must use a Pages-safe relative URL');
assert.match(html, /<script\b[^>]*src="\.\/js\/runtime\.js"/i, 'runtime entry script must use a Pages-safe relative URL');
assert.match(html, /<script\b[^>]*src="\.\/js\/playtest-report-ui\.js"/i,
  'playtest report module must use a Pages-safe relative URL');
const bootIndex = html.indexOf('src="./js/boot-recovery.js"');
const runtimeIndex = html.indexOf('src="./js/runtime.js"');
const diagnosticsIndex = html.indexOf('src="./js/release-diagnostics-ui.js"');
const playtestIndex = html.indexOf('src="./js/playtest-report-ui.js"');
const recoveryIndex = html.indexOf('src="./js/runtime-recovery-ui.js"');
assert.ok(bootIndex !== -1 && runtimeIndex > bootIndex,
  'boot recovery must load before the runtime entry script');
assert.ok(diagnosticsIndex !== -1 && playtestIndex > diagnosticsIndex,
  'playtest reporting must load after release diagnostics');
assert.ok(recoveryIndex > playtestIndex,
  'runtime recovery must load after playtest reporting');
assert.doesNotMatch(html, /<base\b/i, 'a base tag could break GitHub Pages project paths');
assert.doesNotMatch(html, /https?:\/\/[^"']+\.js/i, 'release must not depend on external JavaScript');

const { engineModule, modules } = loadGame();
assert.equal(engineModule.SAVE_KEY, manifest.save.key, 'release manifest save key drifted from runtime');
assert.equal(engineModule.SAVE_VERSION, manifest.save.version, 'release manifest save version drifted from runtime');
assert.ok(manifest.save.compatibleFromVersion <= manifest.save.version, 'save compatibility floor is invalid');
assert.equal(modules.playtestReportUI.SCHEMA_VERSION, 1, 'playtest report schema drifted');
assert.equal(modules.playtestReportUI.KIND, 'capitalism-tycoon-playtest-report');
assert.equal(modules.playtestReportUI.MAX_ACTIONS, 30, 'playtest breadcrumb limit drifted');

console.log(JSON.stringify({
  version: manifest.version,
  tag: manifest.tag,
  deployment: manifest.deployment.url,
  saveKey: manifest.save.key,
  saveVersion: manifest.save.version,
  smokeChecks: manifest.manualSmokeChecks.length
}, null, 2));
console.log('release candidate contract passed');
