'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css', 'd-ui-business.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

assert.match(css, /D UI v2: company \/ store management/, 'business stylesheet declares D UI v2 scope');
for (const token of ['--d2-business-violet','--d2-business-blue','--d2-business-cyan','--d2-business-good','--d2-business-danger']) {
  assert.ok(css.includes(token), `${token} must remain part of the business semantic palette`);
}
assert.match(css, /\[data-screen="business"\]/, 'styles remain scoped to the business screen');
assert.match(css, /business-selector select,[\s\S]*?business-selector \.btn\{min-height:44px\}/, 'desktop business selector controls keep a 44px target');
assert.match(css, /button-grid>\.btn\{[\s\S]*?min-height:44px/, 'store management actions keep a 44px minimum target');
assert.match(css, /\[data-store-comparison\]>summary\{[\s\S]*?min-height:44px/, 'store comparison disclosure keeps a 44px target');
assert.match(css, /\.action-row\{[\s\S]*?min-height:52px/, 'idle-business actions remain comfortably tappable');
assert.match(css, /env\(safe-area-inset-bottom\)/, 'iPhone safe-area handling remains explicit');
assert.match(css, /prefers-reduced-motion:reduce/, 'reduced-motion fallback remains explicit');
assert.ok(!css.includes('100vw'), 'business v2 must not introduce page-level 100vw overflow');
assert.ok(!css.includes('scrollbar-width:none'), 'business v2 must not hide scrollbars to conceal overflow');
assert.ok(!css.includes('display:none'), 'business v2 must not hide existing information or actions');

const start = app.indexOf('function businessFullCard');
const end = app.indexOf('${renderFranchiseSection()}`;', start);
assert.ok(start >= 0 && end > start, 'business render block remains discoverable');
const businessBlock = app.slice(start, end);
assert.ok(businessBlock.includes('business-invest'), 'existing business investment action remains wired');
for (const label of ['運営中の事業','出店できる業種','資金が足りない業種']) {
  assert.ok(businessBlock.includes(label), `${label} remains discoverable`);
}
assert.ok(businessBlock.includes('engine.businessPortfolio()'), 'business screen continues using the read-only business portfolio model');
assert.ok(businessBlock.includes('businessIdleRow'), 'idle businesses continue using the compact route-to-map action row');
assert.ok(businessBlock.includes('data-store-comparison'), 'store comparison remains available inside operating business cards');

console.log('D UI business v2 contract passed');
