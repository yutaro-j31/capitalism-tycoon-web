'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const venturePath = path.join(ROOT, 'css', 'd-ui-venture.css');
const mobilePath = path.join(ROOT, 'css', 'd-ui-mobile-company.css');
const appPath = path.join(ROOT, 'js', 'app.js');

assert.ok(fs.existsSync(venturePath), 'D UI venture stylesheet is required');
const ventureStyle = fs.readFileSync(venturePath, 'utf8');
const mobileStyle = fs.readFileSync(mobilePath, 'utf8');
const appScript = fs.readFileSync(appPath, 'utf8');

assert.match(mobileStyle, /@import url\("\.\/d-ui-venture\.css"\);/, 'venture stylesheet must load from the D UI import chain');
assert.match(ventureStyle, /\[data-screen="venture"\]/, 'venture CSS must stay scoped to the venture screen');
assert.match(ventureStyle, /var\(--d-gold2\)/, 'venture reskin must reuse the existing D UI gold token');
assert.doesNotMatch(ventureStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'venture reskin must not hide existing information');
assert.doesNotMatch(ventureStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'venture reskin must not create page-level viewport overflow');
assert.doesNotMatch(ventureStyle, /Math\.random|MutationObserver|registerUIEnhancer/, 'venture CSS must not add RNG, observers, or enhancers');
assert.match(appScript, /function renderVenture\(\)/, 'existing renderVenture function must remain the source of venture values');
for (const action of ['conduct-startup-dd','invest-startup-company','invest-startup-personal','make-subsidiary','sell-startup-secondary-confirm','ipo-subsidiary']) {
  assert.ok(appScript.includes(`'${action}'`), `venture action ${action} must remain wired`);
}
assert.match(ventureStyle, />\.card:first-child \.stat strong\{[^}]*font-size:clamp\(/, 'venture portfolio KPIs must be promoted to D UI hero values');
assert.match(ventureStyle, /\.notice\[data-startup-funding-round\]/, 'funding round notice must receive a dedicated D UI treatment');
assert.match(ventureStyle, /\.button-row>\.btn\{[^}]*min-width:0;min-height:44px/, 'venture action buttons must keep a 44px tap target');
assert.match(ventureStyle, /@media\(max-width:820px\)\{[\s\S]*?>\.grid\.two,[^}]*>section>\.grid\.two\{grid-template-columns:1fr!important/, 'venture two-column grids must collapse to one column on iPhone');
assert.match(ventureStyle, /@media\(max-width:520px\)\{[\s\S]*?\.button-row\{grid-template-columns:1fr\}/, 'narrow iPhone venture actions must become single-column controls');

console.log('D UI venture contract passed');
