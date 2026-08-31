'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('css/d-ui-mobile-company.css', 'utf8');
const shell = fs.readFileSync('js/d-ui-shell.js', 'utf8');
const marker = '/* D UI v2: persistent five-tab iPhone navigation.';
const start = css.indexOf(marker);
assert.ok(start >= 0, 'D UI v2 mobile navigation override must exist');
const mobile = css.slice(start);

const primaryMatch = shell.match(/const PRIMARY_NAV=\[([\s\S]*?)\];/);
assert.ok(primaryMatch, 'PRIMARY_NAV must remain defined');
const primary = primaryMatch[1];
for (const tab of ['home','report','business','market']) {
  assert.match(primary, new RegExp(`\\['${tab}'`), `PRIMARY_NAV must expose ${tab} for the iPhone bottom navigation`);
  assert.match(mobile, new RegExp(`\\[data-tab="${tab}"\\]`), `mobile navigation must style ${tab} as a primary tab`);
}

assert.match(mobile, /grid-template-columns:minmax\(0,4fr\) minmax\(0,1fr\)!important/, 'mobile shell must reserve four equal route slots plus one menu slot');
assert.match(mobile, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/, 'the four route tabs must use equal-width columns');
assert.match(mobile, /\.d-menu-toggle\{[\s\S]*?grid-column:2!important;[\s\S]*?min-height:60px!important/, 'menu must occupy the fifth slot with a 60px touch target');
assert.match(mobile, /\.d-nav-button\[data-tab="home"\],[\s\S]*?min-height:60px!important/, 'primary mobile tabs must keep a 60px touch target');
// The four route tabs carry explicit grid-column values, but PRIMARY_NAV lists business and
// market before home and report. Grid auto-placement walks items in DOM order and cannot move
// back to an earlier column of the row it already passed, so without an explicit row the later
// DOM items (home, report) landed on an implicit second row that the 70px bar clipped away --
// ホーム and 財務 were invisible and untappable on iPhone. Pin every route tab to row 1.
// `[^{}]*` and `[^}]*` keep this inside the one rule block: an unbounded [\s\S]*? would happily
// match the nav container's own grid-row:1 further down the file and pass even when the fix is gone.
assert.match(mobile, /\[data-tab="home"\],[^{}]*\[data-tab="market"\]\{[^}]*grid-row:1!important/, 'route tabs must be pinned to the first grid row so none wraps out of the bar');
// Columns 1-4 must stay inside the four-column track, in ホーム/財務/企業/市場 reading order.
for (const [tab, column] of [['home', 1], ['report', 2], ['business', 3], ['market', 4]]) {
  assert.match(mobile, new RegExp(`\\[data-tab="${tab}"\\]\\{grid-column:${column}!important\\}`), `mobile ${tab} tab must occupy column ${column} of the four-column bar`);
}
assert.match(mobile, /\.d-nav-button\.active\{[\s\S]*?color:#9a7cff!important;[\s\S]*?box-shadow:inset 0 2px 0 #7c5cff!important/, 'normal mobile active navigation must use the violet interaction accent');
assert.match(mobile, /\.d-menu-toggle\[aria-expanded="true"\]\{[\s\S]*?color:#9a7cff!important/, 'open menu state must use the same violet interaction accent');
assert.match(mobile, /#d-ui-dock\{display:none!important\}/, 'legacy floating help dock must not compete with the five-tab iPhone navigation');

for (const [tab, label] of [['home','ホーム'],['report','財務'],['business','企業'],['market','市場']]) {
  assert.match(mobile, new RegExp(`\\[data-tab="${tab}"\\]>b::after\\{content:"${label}"`), `mobile ${tab} tab must expose the ${label} label`);
}
assert.match(mobile, /\.d-menu-toggle::after\{content:"メニュー"/, 'fifth mobile slot must be labelled メニュー');

function px(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `missing CSS declaration: ${label}`);
  return Number(match[1]);
}

const navHeight = px(mobile, /#d-ui-sidebar\{[\s\S]*?height:calc\((\d+)px \+ env\(safe-area-inset-bottom,0px\)\)!important/, 'five-tab navigation height');
const screenPad = px(mobile, /body\.d-ui-active \.screen\{padding-bottom:calc\((\d+)px \+ env\(safe-area-inset-bottom,0px\)\)!important\}/, 'screen bottom clearance');
assert.ok(screenPad >= navHeight + 12, `screen padding-bottom (${screenPad}px) must clear the ${navHeight}px mobile navigation with breathing room`);

const browserBottom = px(mobile, /body\.iphone-browser-mode\.d-ui-active #d-ui-sidebar\{bottom:(\d+)px!important\}/, 'browser-mode navigation offset');
const browserScreenPad = px(mobile, /body\.iphone-browser-mode\.d-ui-active \.screen\{padding-bottom:calc\((\d+)px \+ env\(safe-area-inset-bottom,0px\)\)!important\}/, 'browser-mode screen bottom clearance');
assert.ok(browserScreenPad >= browserBottom + navHeight + 12, `browser-mode screen padding-bottom (${browserScreenPad}px) must clear navigation top edge (${browserBottom + navHeight}px) with breathing room`);

assert.doesNotMatch(mobile, /\b(?:width|min-width|max-width)\s*:\s*100vw\b/, 'five-tab navigation must not create page-level viewport overflow');
console.log('D UI v2 mobile navigation contract passed');
