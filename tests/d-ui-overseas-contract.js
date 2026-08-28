'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const overseasPath = path.join(ROOT, 'css', 'd-ui-overseas.css');
const mobilePath = path.join(ROOT, 'css', 'd-ui-mobile-company.css');
const appPath = path.join(ROOT, 'js', 'app.js');

assert.ok(fs.existsSync(overseasPath), 'D UI overseas stylesheet is required');
const overseasStyle = fs.readFileSync(overseasPath, 'utf8');
const mobileStyle = fs.readFileSync(mobilePath, 'utf8');
const appScript = fs.readFileSync(appPath, 'utf8');

assert.match(mobileStyle, /@import url\("\.\/d-ui-overseas\.css"\);/, 'overseas stylesheet must load from the D UI import chain');
assert.match(overseasStyle, /\[data-screen="overseas"\]/, 'overseas CSS must stay scoped to the overseas screen');
assert.match(overseasStyle, /var\(--d-gold2\)/, 'overseas reskin must reuse the existing D UI gold token');
assert.doesNotMatch(overseasStyle, /(?:^|[;{])\s*display\s*:\s*none\b/m, 'overseas reskin must not hide existing information');
assert.doesNotMatch(overseasStyle, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'overseas reskin must not create page-level viewport overflow');
assert.doesNotMatch(overseasStyle, /Math\.random|MutationObserver|registerUIEnhancer/, 'overseas CSS must not add RNG, observers, or enhancers');
assert.match(appScript, /function renderOverseas\(\)/, 'existing renderOverseas function must remain the source of overseas values');
for (const action of ['open-overseas','overseas-action']) {
  assert.ok(appScript.includes(`'${action}'`), `overseas action ${action} must remain wired`);
}
assert.match(overseasStyle, />\.grid\.three \{?/, 'overseas country cards must receive a dedicated D UI grid treatment');
assert.match(overseasStyle, /select\{min-height:44px/, 'overseas business selectors must keep a 44px tap target');
assert.match(overseasStyle, /\.btn\[data-action="open-overseas"\]\{[^}]*min-height:44px/, 'overseas establishment actions must keep a 44px tap target');
assert.match(overseasStyle, />\.card:last-child \.button-row>\.btn\{[^}]*min-width:0;min-height:44px/, 'overseas subsidiary actions must keep 44px tap targets');
assert.match(overseasStyle, /@media\(max-width:820px\)\{[\s\S]*?>\.grid\.three\{grid-template-columns:1fr!important\}/, 'overseas country grid must collapse to one column on iPhone');
assert.match(overseasStyle, /@media\(max-width:520px\)\{[\s\S]*?>\.card:last-child \.button-row\{grid-template-columns:1fr\}/, 'narrow iPhone overseas subsidiary actions must become single-column controls');

console.log('D UI overseas contract passed');
