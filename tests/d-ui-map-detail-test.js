'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(root, 'js', 'd-ui-shell.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'd-ui-map-buildings.css'), 'utf8');
const legacyCSS = fs.readFileSync(path.join(root, 'css', 'd-ui-map-depth.css'), 'utf8');
const helperMatch = shell.match(/function isoCityBuildingsSVG\(g\)\{([\s\S]*?)\n\}\nfunction renderMapWorkspace/);

assert.ok(helperMatch, 'pure isometric city renderer is defined before renderMapWorkspace');
const helper = helperMatch[1];
assert.match(helper, /hash\(/, 'isometric city variations use the existing hash helper');
assert.doesNotMatch(helper, /Math\.random\s*\(/, 'isometric city does not use Math.random');
assert.doesNotMatch(helper, /engine\.rand|chance\s*\(/, 'isometric city does not consume simulation RNG');
for (const className of ['d-iso-city', 'd-iso-top', 'd-iso-left', 'd-iso-right', 'd-iso-window', 'd-iso-bridge', 'd-iso-tree', 'd-iso-car']) {
  assert.ok(helper.includes(className), `${className} is emitted by the SVG renderer`);
}
assert.match(helper, /aria-hidden="true"/, 'decorative SVG is hidden from assistive technology');

assert.match(shell, /Array\.from\(\{length:34\}/, 'legacy 34-block generation remains present');
assert.match(shell, /<div class="d-city-blocks">\$\{blocks\}<\/div>\$\{isoCityBuildingsSVG\(g\)\}\$\{positions/, 'SVG is inserted after legacy blocks and before map markers');
assert.ok(shell.includes('data-d-ui-marker'), 'interactive marker contract remains present');

for (const className of ['d-iso-city', 'd-iso-building', 'd-iso-top', 'd-iso-left', 'd-iso-right', 'd-iso-window', 'd-iso-bridge', 'd-iso-tree', 'd-iso-car']) {
  assert.match(css, new RegExp(`\\.${className}(?:[\\s,{.:#]|$)`), `${className} has a CSS rule`);
}
assert.match(css, /\.d-iso-city\{[^}]*pointer-events:none[^}]*\}/, 'SVG visual layer never intercepts marker input');
assert.ok(legacyCSS.includes('.d-city-blocks i::before'), 'legacy block roof styling remains present');
assert.ok(legacyCSS.includes('.d-city-blocks i::after'), 'legacy block window styling remains present');

console.log('d-ui map detail tests passed');
