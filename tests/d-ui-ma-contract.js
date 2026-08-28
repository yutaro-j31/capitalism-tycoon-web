'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const maPath = path.join(ROOT, 'css', 'd-ui-ma.css');
const mobilePath = path.join(ROOT, 'css', 'd-ui-mobile-company.css');
const appPath = path.join(ROOT, 'js', 'app.js');

assert.ok(fs.existsSync(maPath), 'D UI M&A stylesheet is required');
const maStyle = fs.readFileSync(maPath, 'utf8');
const mobileStyle = fs.readFileSync(mobilePath, 'utf8');
const appScript = fs.readFileSync(appPath, 'utf8');

assert.match(mobileStyle, /@import url\("\.\/d-ui-ma\.css"\);/, 'M&A stylesheet must load from the D UI import chain');
assert.match(maStyle, /\[data-screen="ma"\]/, 'M&A CSS must stay scoped to the M&A screen');
assert.match(maStyle, /var\(--d-gold2\)/, 'M&A reskin must reuse the existing D UI gold token');
assert.doesNotMatch(maStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'M&A reskin must not hide existing information');
assert.doesNotMatch(maStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'M&A reskin must not create page-level viewport overflow');
assert.doesNotMatch(maStyle, /Math\.random|MutationObserver|registerUIEnhancer/, 'M&A CSS must not add RNG, observers, or enhancers');
assert.match(appScript, /function renderMA\(\)/, 'existing renderMA function must remain the source of M&A values');
for (const action of ['generate-ma','ma-open-deal','ma-start-dd','ma-submit-offer','ma-accept-counter','ma-close-deal','ma-withdraw-deal','start-ma-pmi','support-ma-pmi','sell-ma','transport-rebuild']) {
  assert.ok(appScript.includes(`'${action}'`), `M&A action ${action} must remain wired`);
}
assert.match(maStyle, />\.card:first-child \.stat strong\{[^}]*font-size:clamp\(/, 'M&A dashboard KPIs must be promoted to D UI hero values');
assert.match(maStyle, /\.ma-deal-room\{[^}]*border:[^}]*background:/, 'deal rooms must receive a dedicated D UI surface');
assert.match(maStyle, /\.ma-dd-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, 'desktop DD scope cards must use a structured three-column grid');
assert.match(maStyle, /\.ma-valuation-bridge\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, 'valuation bridge must use a structured desktop grid');
assert.match(maStyle, /\.ma-deal-room \.button-row>\.btn\{[^}]*min-width:0;min-height:44px/, 'deal-room actions must keep a 44px tap target');
assert.match(maStyle, /@media\(max-width:820px\)\{[\s\S]*?>section>\.grid\.two\{grid-template-columns:1fr!important/, 'M&A candidate grid must collapse to one column on iPhone');
assert.match(maStyle, /@media\(max-width:820px\)\{[\s\S]*?\.ma-deal-room \.filters,[^}]*\.ma-dd-grid,[^}]*\.ma-pmi-options,[^}]*\.ma-valuation-bridge\{grid-template-columns:1fr\}/, 'M&A nested analysis grids must collapse to one column on iPhone');
assert.match(maStyle, /@media\(max-width:520px\)\{[\s\S]*?\.ma-deal-room \.button-row,[^}]*\.ma-pmi-supports\{grid-template-columns:1fr\}/, 'narrow iPhone M&A actions must become single-column controls');

console.log('D UI M&A contract passed');
