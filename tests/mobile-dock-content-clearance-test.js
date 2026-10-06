'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('css/d-ui-mobile-company.css', 'utf8');
const shell = fs.readFileSync('js/d-ui-shell.js', 'utf8');
const marker = '/* City Lab UI-1: production five-tab iPhone navigation';
const start = css.indexOf(marker);
assert.ok(start >= 0, 'City Lab UI-1 mobile navigation override must exist');
const mobile = css.slice(start);

const primaryMatch = shell.match(/const PRIMARY_NAV=\[([\s\S]*?)\];/);
assert.ok(primaryMatch, 'PRIMARY_NAV must remain defined');
const primary = primaryMatch[1];
for (const tab of ['map','business','market','report']) {
  assert.match(primary, new RegExp(`\\['${tab}'`), `PRIMARY_NAV must expose ${tab} for the iPhone bottom navigation`);
  assert.match(mobile, new RegExp(`\\[data-tab="${tab}"\\]`), `mobile navigation must style ${tab} as a primary tab`);
}
assert.doesNotMatch(mobile, /\[data-tab="home"\]/, 'Home must move to MENU rather than compete with the map-first primary dock');

assert.match(mobile, /grid-template-columns:minmax\(0,4fr\) minmax\(0,1fr\)!important/, 'mobile shell must reserve four equal route slots plus one menu slot');
assert.match(mobile, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/, 'the four route tabs must use equal-width columns');
assert.match(mobile, /\.d-menu-toggle\{[\s\S]*?grid-column:2!important;[\s\S]*?min-height:60px!important/, 'menu must occupy the fifth slot with a 60px touch target');
assert.match(mobile, /\.d-nav-button\[data-tab="map"\],[\s\S]*?min-height:60px!important/, 'primary mobile tabs must keep a 60px touch target');
assert.match(mobile, /\[data-tab="map"\],[^{}]*\[data-tab="report"\]\{[^}]*grid-row:1!important/, 'route tabs must be pinned to the first grid row so none wraps out of the bar');

for (const [tab, column] of [['map', 1], ['business', 2], ['market', 3], ['report', 4]]) {
  assert.match(mobile, new RegExp(`\\[data-tab="${tab}"\\]\\{grid-column:${column}!important\\}`), `mobile ${tab} tab must occupy column ${column} of the four-column bar`);
}
for (const [tab, label] of [['map','MAP'],['business','企業'],['market','市場'],['report','財務']]) {
  assert.match(mobile, new RegExp(`\\[data-tab="${tab}"\\]>b::after\\{content:"${label}"`), `mobile ${tab} tab must expose the ${label} label`);
}
assert.match(mobile, /\.d-menu-toggle::after\{content:"メニュー"/, 'fifth mobile slot must be labelled メニュー');
assert.match(mobile, /\.d-nav-button\.active\{[\s\S]*?color:#9a7cff!important;[\s\S]*?box-shadow:inset 0 2px 0 #7c5cff!important/, 'normal mobile active navigation must use the violet interaction accent');
assert.match(mobile, /\.d-menu-toggle\[aria-expanded="true"\]\{[\s\S]*?color:#9a7cff!important/, 'open menu state must use the same violet interaction accent');
assert.match(mobile, /#d-ui-dock\{display:none!important\}/, 'legacy floating help dock must not compete with the five-tab iPhone navigation');

assert.match(mobile, /env\(safe-area-inset-top,0px\)/, 'compact header must respect the top safe area');
assert.match(mobile, /env\(safe-area-inset-bottom,0px\)/, 'bottom dock must respect the bottom safe area');
assert.match(mobile, /\.d-kpi-strip \.d-kpi-company-cash\{[\s\S]*?min-height:44px!important/, 'company cash must remain visible in the compact header');
assert.match(mobile, /\.d-advance\{[\s\S]*?min-height:44px!important/, 'week advance must retain a 44px touch target');

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
console.log('City Lab UI-1 mobile navigation contract passed');
