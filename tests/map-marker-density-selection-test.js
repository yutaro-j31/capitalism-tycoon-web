'use strict';
/*
 * Marker visual density / selection UX contract.
 *
 * Real-device report this locks down: with every marker painting a category
 * placard ("テナント募集" / "売物件" / "オフィス募集") at all times, a 390px
 * screen showed a dozen opaque plates over the street grid and the city
 * underneath stopped being readable. Finding a property is not worth failing
 * to see the city it sits in.
 *
 * So the resting state is a bare, small pin and nothing else, and the label
 * comes back only for the marker a player is actually pointing at. Two
 * separate ideas have to hold at once for that to be safe:
 *
 *   1. the pin a player SEES got smaller (so the city shows through), and
 *   2. the button a player TAPS did not (>=44px, iOS minimum, both axes).
 *
 * They are only separable because the pin's clip-path lives on ::before --
 * clip-path clips hit testing too, so while it sat on the button the visible
 * badge and the tap target were forced to be one box.
 *
 * Run directly: node tests/map-marker-density-selection-test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const markersCss = read('css/d-ui-map-phase2-markers.css');
const baseCss = read('css/d-ui.css');
const referenceCss = read('css/d-ui-reference-fidelity.css');
const shellSrc = read('js/d-ui-shell.js');
const canvasSrc = read('js/map-phase2-canvas.js');
/* Declarations only: several rules are also NAMED inside explanatory
   comments, which would otherwise satisfy a selector regex. */
const markersRules = markersCss.replace(/\/\*[\s\S]*?\*\//g, '');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS:', name); pass += 1; }
  catch (error) { console.log('FAIL:', name, '--', error.message); fail += 1; }
}

function ruleFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markersRules.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `could not locate the CSS rule for ${selector}`);
  return match[1];
}
function px(declarations, property) {
  const match = declarations.match(new RegExp(`(?:^|;)${property}:(\\d+(?:\\.\\d+)?)px`));
  assert.ok(match, `${property} must be declared in "${declarations}"`);
  return Number(match[1]);
}
/* Deliberately does NOT require a leading `const`: several of these share
   one declaration (`const MARKER_CLAMP_HALF_W=14,MARKER_CLAMP_HALF_H=17;`),
   so anchoring on `const` silently matches nothing for the second name. */
function constant(name) {
  const match = canvasSrc.match(new RegExp(`\\b${name}=(\\d+)`));
  assert.ok(match, `could not locate ${name} in js/map-phase2-canvas.js`);
  return Number(match[1]);
}

/* The sizes this pass inherited, so "smaller" is measured, not asserted. */
const PREVIOUS_PIN_W = 34, PREVIOUS_PIN_H = 42;

const buttonRule = ruleFor('.d-map-marker');
const pinRule = ruleFor('.d-map-marker:before');
const buttonW = px(buttonRule, 'width'), buttonH = px(buttonRule, 'height');
const pinW = px(pinRule, 'width'), pinH = px(pinRule, 'height');

/* ================= PRIORITY A: SMALLER PIN, INTACT TAP TARGET ================= */

check('the visible pin shrank by 20-35% on each axis against the size this pass inherited (34x42)', () => {
  const shrinkW = 1 - pinW / PREVIOUS_PIN_W, shrinkH = 1 - pinH / PREVIOUS_PIN_H;
  assert.ok(shrinkW >= 0.20 && shrinkW <= 0.35,
    `width shrank ${(shrinkW * 100).toFixed(1)}% (${PREVIOUS_PIN_W} -> ${pinW}), outside the requested 20-35% band`);
  assert.ok(shrinkH >= 0.20 && shrinkH <= 0.35,
    `height shrank ${(shrinkH * 100).toFixed(1)}% (${PREVIOUS_PIN_H} -> ${pinH}), outside the requested 20-35% band`);
});

check('the tap target stays at or above the 44px iOS minimum on BOTH axes', () => {
  assert.ok(buttonW >= 44, `button width ${buttonW}px is below the 44px minimum`);
  assert.ok(buttonH >= 44, `button height ${buttonH}px is below the 44px minimum`);
});

check('the tap target is genuinely the whole button: nothing clips it (clip-path clips hit testing too)', () => {
  assert.match(buttonRule, /clip-path:none/,
    'the button must drop the inherited clip-path or its real hit area is smaller than its box');
  assert.match(pinRule, /clip-path:polygon/,
    'the pin shape must be drawn by ::before so the badge can be smaller than the tap target');
});

check('the visible pin is strictly smaller than the tap target on both axes -- the two are not one box', () => {
  assert.ok(pinW < buttonW && pinH < buttonH,
    `pin ${pinW}x${pinH} must be smaller than button ${buttonW}x${buttonH}`);
});

check('the pin stays centred on the button centre, so shrinking it did not move the anchor', () => {
  assert.match(pinRule, /left:50%/);
  assert.match(pinRule, /top:50%/);
  assert.match(pinRule, /transform:translate\(-50%,-50%\)/);
});

check('the category cascade cannot repaint the transparent 44px button behind the 26x32 pin', () => {
  assert.match(markersRules,
    /body\.d-ui-active \[data-screen="map"\] \.d-map-marker\.store,[\s\S]*?\.d-map-marker\.realestate\{background:none\}/,
    'all four category selectors must clear the button at category-rule specificity');
  assert.match(ruleFor('body.d-ui-active [data-screen="map"] .d-map-marker'), /background:none/);
  assert.match(ruleFor('body.d-ui-active [data-screen="map"] .d-map-marker'), /filter:none/,
    'the inherited large-button drop shadow must not reveal the hit target');
});

check('the glyph-to-pin ratio is readable without enlarging the resting pin', () => {
  const glyphRule = ruleFor('.d-map-marker span');
  const glyphSize = px(glyphRule, 'font-size');
  assert.ok(glyphSize >= 16 && glyphSize <= 18, `glyph ${glyphSize}px should be readable but restrained`);
  assert.match(glyphRule, /font-weight:800/);
  assert.match(glyphRule, /text-shadow:/, 'glyph needs a dark edge over every category fill');
  assert.equal(pinW, 26);
  assert.equal(pinH, 32);
});

check('selected/focused pins get a bounded pin-only ring and stack above resting neighbours', () => {
  const selected = ruleFor('body.d-ui-active [data-screen="map"] .d-map-marker.selected');
  assert.match(selected, /z-index:27/);
  assert.match(selected, /outline:none/, 'the 44px button must not expose a large selected outline');
  assert.match(markersRules, /\.d-map-marker\.selected:before,[\s\S]*?\.d-map-marker:focus-visible:before\{[^}]*scale\(1\.08\)[^}]*border-color:#ffe39a[^}]*drop-shadow/,
    'selection emphasis must stay on the small visible pin and work for keyboard focus');
});

check('the decorative "★★★" overlay is suppressed -- three fixed stars carry no information and are pure noise at this pin size', () => {
  assert.match(referenceCss, /content:"★★★"/, 'sanity: the inherited decoration still exists to suppress');
  assert.match(ruleFor('.d-map-marker:after'), /display:none/);
});

/* ================= PRIORITY B: SELECTION-SCOPED LABEL ================= */

check('the resting state paints NO label: the city, not the placards, is what a player sees by default', () => {
  assert.match(ruleFor('.d-map-marker small'), /display:none/,
    'the default label rule must be display:none');
  assert.doesNotMatch(markersRules, /\.d-map-marker small\{display:block/,
    'no unconditional always-on label rule may exist');
  assert.doesNotMatch(markersRules, /\.d-map-marker small\{[^}]*opacity:1/,
    'the default label rule must not force the label visible either');
});

check('the label returns for the selected marker, and for hover / keyboard focus', () => {
  const reveal = markersRules.match(/([^{}]*\.d-map-marker\.selected small[^{]*)\{([^}]*)\}/);
  assert.ok(reveal, 'a reveal rule scoped to .selected must exist');
  assert.match(reveal[2], /display:block/, 'the revealed label must actually be painted');
  assert.match(reveal[1], /:hover small/, 'hover should also reveal (desktop affordance)');
  assert.match(reveal[1], /:focus-visible small/, 'keyboard focus must reveal it too (accessibility)');
});

check('the selected label names the entity, not only its category', () => {
  assert.match(shellSrc, /function placardName\(entity\)/);
  assert.match(shellSrc, /<small aria-hidden="true"><b>\$\{esc\(placardLabel\(entity\)\)\}<\/b>\$\{esc\(placardName\(entity\)\)\}<\/small>/,
    'the placard must render category and name as two parts');
  assert.match(markersRules, /\.d-map-marker small b\{[^}]*display:block/,
    'the category must sit on its own line above the name');
});

check('placardName reads only fields buildMapViewModel already sets, and never repeats the category line', () => {
  const body = shellSrc.split('function placardName(entity){')[1].split('\n}')[0];
  assert.match(body, /entity\.name\|\|entity\.label/, 'must reuse the existing name/label fields');
  assert.match(body, /===placardLabel\(entity\)\?'':name/,
    'a store, whose category line IS its name, must not print the name twice');
  assert.doesNotMatch(body, /Math\s*\.\s*random|engine\./, 'must stay a pure read of the view model');
});

check('hiding the label did not cost assistive technology anything: the button name carries category AND name', () => {
  assert.match(shellSrc, /function markerAriaLabel\(entity\)/);
  assert.match(shellSrc, /aria-label="\$\{esc\(markerAriaLabel\(entity\)\)\}"/);
  const body = shellSrc.split('function markerAriaLabel(entity){')[1].split('\n}')[0];
  assert.match(body, /placardLabel\(entity\)/);
  assert.match(body, /placardName\(entity\)|name/);
  assert.match(shellSrc, /<small aria-hidden="true">/,
    'the now-decorative visible label must be hidden from the accessibility tree to avoid double-reading');
});

/* ================= PRIORITY C: ANCHORING AND CHROME STAY INTACT ================= */

check('the anchor-integrity cap (PR #618) is unchanged, and the collision box tracks the smaller pin', () => {
  const cap = constant('MAX_ANCHOR_OFFSET');
  const halfW = constant('MARKER_CLAMP_HALF_W');
  const halfH = constant('MARKER_CLAMP_HALF_H');
  assert.equal(cap, 56, 'the cap must stay 56 -- see the chrome-escape check below for why it was NOT tightened');
  assert.ok(halfW * 2 >= pinW && halfH * 2 >= pinH, 'the collision box must cover the whole visible pin');
  assert.ok(halfW * 2 < buttonW && halfH * 2 < buttonH,
    'the collision box must be smaller than the button, or shrinking the pin bought nothing');
});

check('one declutter ring still clears a head-on collision inside the cap', () => {
  const cap = constant('MAX_ANCHOR_OFFSET');
  const step = constant('DECLUTTER_STEP');
  const halfH = constant('MARKER_CLAMP_HALF_H');
  const needed = halfH * 2;
  const rings = Math.ceil(needed / step);
  assert.ok(rings * step <= cap,
    `clearing a head-on collision needs ${rings * step}px, above the ${cap}px cap`);
});

check('the chrome-avoidance nudge can still travel far enough to clear the real iPhone nav strip', () => {
  // .iphone-map-nav (css/iphone-playtest-fixes.js chrome) is a full-width
  // strip whose own button is min-height:46px. A marker centred in it must
  // move roughly half that plus its own half-height to get clear. This is
  // exactly why MAX_ANCHOR_OFFSET was NOT tightened in this pass: a smaller
  // cap silently caps this nudge below what the strip needs and re-opens the
  // PR #616 "marker swallows the filter tap" regression.
  const cap = constant('MAX_ANCHOR_OFFSET');
  const halfH = constant('MARKER_CLAMP_HALF_H');
  const stepMatch = canvasSrc.match(/const CLAMP_NUDGE_STEP=([A-Za-z_]+|\d+)/);
  assert.ok(stepMatch, 'the chrome nudge step must be declared');
  const step = /^\d+$/.test(stepMatch[1]) ? Number(stepMatch[1]) : constant(stepMatch[1]);
  const reach = Math.floor(cap / step) * step;
  const navHalf = 46 / 2;
  assert.ok(reach >= navHalf + halfH,
    `the nudge reaches only ${reach}px but needs ${navHalf + halfH}px to clear .iphone-map-nav`);
});

check('building affinity (PR #619) and the tap->detail wiring (PR #617) are untouched by this pass', () => {
  assert.match(canvasSrc, /const KIND_SURFACES=\{/);
  assert.match(canvasSrc, /const PROPERTY_KIND_SURFACES=\{/);
  assert.match(canvasSrc, /function surfaceOfCell\(cell,byId\)/);
  assert.match(shellSrc, /function selectedDetail\(entity,g\)/);
  assert.match(shellSrc, /revealContextPanel\(\)/);
  assert.match(markersRules, /\.d-map-marker\{z-index:25\}/, 'markers must still out-rank the iPhone chrome');
});

check('no RNG and no save writes were introduced by this pass', () => {
  assert.doesNotMatch(canvasSrc, /Math\s*\.\s*random/);
  for (const fn of ['placardName', 'markerAriaLabel']) {
    const body = shellSrc.split(`function ${fn}(entity){`)[1].split('\n}')[0];
    assert.doesNotMatch(body, /Math\s*\.\s*random|localStorage|save/i, `${fn} must stay pure`);
  }
});

/* ================= NEGATIVE TESTS ================= */

check('NEGATIVE: restoring the always-on label rule fails the resting-state check', () => {
  const mutated = markersRules.replace(/\.d-map-marker small\{display:none/, '.d-map-marker small{display:block;opacity:1');
  assert.notEqual(mutated, markersRules, 'sanity: the mutation must apply');
  assert.match(mutated, /\.d-map-marker small\{display:block/,
    'the mutated source must trip the very regex the resting-state check forbids');
});

check('NEGATIVE: shrinking the button below 44px fails the tap-target check', () => {
  const mutated = buttonRule.replace(/width:\d+px;height:\d+px/, 'width:36px;height:40px');
  assert.notEqual(mutated, buttonRule, 'sanity: the mutation must apply');
  assert.ok(px(mutated, 'width') < 44 && px(mutated, 'height') < 44,
    'the mutated rule must be what the >=44px assertion rejects');
});

check('NEGATIVE: dropping the .selected reveal leaves a marker with no way to ever show its label', () => {
  const mutated = markersRules.replace(/\.d-map-marker\.selected small[^{]*\{[^}]*\}/, '');
  assert.notEqual(mutated, markersRules, 'sanity: the mutation must apply');
  assert.doesNotMatch(mutated, /\.d-map-marker\.selected small/,
    'the mutated source must fail the reveal check');
});

check('NEGATIVE: putting the clip-path back on the button collapses pin and tap target into one box', () => {
  const mutated = buttonRule.replace('clip-path:none', 'clip-path:polygon(50% 0,93% 18%,93% 68%,50% 100%,7% 68%,7% 18%)');
  assert.notEqual(mutated, buttonRule, 'sanity: the mutation must apply');
  assert.doesNotMatch(mutated, /clip-path:none/,
    'the mutated rule must fail the unclipped-button check');
});

check('NEGATIVE: a pin that only shrank 10% would fail the 20-35% band this pass promised', () => {
  const shrunk = Math.round(PREVIOUS_PIN_W * 0.9);
  assert.ok(1 - shrunk / PREVIOUS_PIN_W < 0.20,
    'sanity: a 10% reduction must read as outside the band the positive check enforces');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
