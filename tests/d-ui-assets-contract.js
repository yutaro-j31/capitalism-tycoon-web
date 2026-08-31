'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const assetsPath = path.join(ROOT, 'css', 'd-ui-assets.css');
const mobilePath = path.join(ROOT, 'css', 'd-ui-mobile-company.css');
const appPath = path.join(ROOT, 'js', 'app.js');

assert.ok(fs.existsSync(assetsPath), 'D UI assets stylesheet is required');
const assetsStyle = fs.readFileSync(assetsPath, 'utf8');
const mobileStyle = fs.readFileSync(mobilePath, 'utf8');
const appScript = fs.readFileSync(appPath, 'utf8');

assert.match(mobileStyle, /@import url\("\.\/d-ui-assets\.css"\);/, 'assets stylesheet must load from the D UI import chain');
assert.match(assetsStyle, /\[data-screen="assets"\]/, 'assets CSS must stay scoped to the assets screen');
assert.match(assetsStyle, /var\(--d-gold2\)/, 'assets reskin must reuse the existing D UI gold token');
assert.doesNotMatch(assetsStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'assets reskin must not hide existing information');
assert.doesNotMatch(assetsStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'assets reskin must not create page-level viewport overflow');
assert.doesNotMatch(assetsStyle, /Math\.random|MutationObserver|registerUIEnhancer/, 'assets reskin must not add RNG, observers, or enhancers');
assert.match(appScript, /function renderAssets\(\)/, 'existing renderAssets function must remain the source of asset values');
assert.match(appScript, /function renderAssetTab\(\)/, 'existing renderAssetTab function must remain the source of asset tab contents');
for (const tab of ['property','investment','luxury','sports']) {
  assert.ok(appScript.includes(`['${tab}'`), `asset tab ${tab} must remain present`);
}
for (const action of ['asset-tab','build-property','sell-property','buy-personal-investment','sell-personal-investment','buy-luxury','sell-luxury','buy-team-personal','buy-team-company','sell-team']) {
  assert.ok(appScript.includes(`'${action}'`), `asset action ${action} must remain wired`);
}
assert.match(assetsStyle, /subtabs button\{[^}]*min-height:44px/, 'asset subtabs must keep 44px tap targets');
assert.match(assetsStyle, /\.btn\.small,[^\n]*\.btn\{min-height:44px/, 'asset actions must keep 44px tap targets');
assert.match(assetsStyle, /@media\(max-width:820px\)[\s\S]*grid-template-columns:1fr!important/, 'asset two-column layouts must collapse to one column on iPhone');
console.log('D UI assets contract passed');
