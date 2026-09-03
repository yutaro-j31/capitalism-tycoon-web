'use strict';
/*
 * Old contract (this file's original purpose): proved the legacy
 * isometric-city SVG renderer (isoCityBuildingsSVG() in js/d-ui-shell.js,
 * plus css/d-ui-map-buildings.css) existed, was deterministic, and was
 * inserted into the map markup after the legacy .d-city-blocks layer.
 *
 * New contract (production promotion, see docs/map-phase2-production-
 * integration-audit.md section 6, PR D): that whole renderer is gone --
 * Phase 2's own Canvas draws terrain/roads/greenery for every prefecture,
 * so a second, independent isometric facade layer over legacy blocks that
 * no longer exist would only ever compete with it. This file now proves
 * the removal is real (function, CSS classes, and the CSS file itself are
 * all gone), not that the feature exists.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(root, 'js', 'd-ui-shell.js'), 'utf8');

assert.doesNotMatch(shell, /function isoCityBuildingsSVG\(/, 'the legacy isometric-city SVG renderer must be gone, not merely unreferenced');
assert.doesNotMatch(shell, /isoCityBuildingsSVG\(g\)/, 'renderMapWorkspace must not call the removed renderer');
assert.doesNotMatch(shell, /d-iso-city|d-iso-building|d-iso-legacy-cover/, 'no isometric-city CSS class name should remain in the markup generator');
assert.doesNotMatch(shell, /Array\.from\(\{length:34\}/, 'the legacy 34-block generation this renderer decorated is also gone (production promotion removed .d-city-blocks itself)');
assert.ok(shell.includes('data-d-ui-marker'), 'interactive marker contract remains present');

assert.ok(!fs.existsSync(path.join(root, 'css', 'd-ui-map-buildings.css')), 'css/d-ui-map-buildings.css (the isometric-city stylesheet) must be deleted, not just unimported');

const depthCSS = fs.readFileSync(path.join(root, 'css', 'd-ui-map-depth.css'), 'utf8');
assert.doesNotMatch(depthCSS, /\.d-city-blocks|\.d-water|\.d-road-grid/, 'legacy block/water/road CSS must be gone from css/d-ui-map-depth.css -- only the renderer-agnostic .d-city-surface depth overlay remains');
assert.match(depthCSS, /\.d-city-surface::after/, 'the renderer-agnostic depth overlay (applies to the Phase 2 surface too) must stay');

const referenceFidelityCSS = fs.readFileSync(path.join(root, 'css', 'd-ui-reference-fidelity.css'), 'utf8');
assert.doesNotMatch(referenceFidelityCSS, /\.d-city-blocks|\.d-water|\.d-road-grid/, 'legacy block/water/road CSS must be gone from css/d-ui-reference-fidelity.css too');

console.log('d-ui map detail tests passed (legacy isometric-city renderer removal contract)');
