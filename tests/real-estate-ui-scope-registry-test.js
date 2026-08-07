'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {ROOT,readIndex}=require('./harness');

const read=name=>fs.readFileSync(path.join(ROOT,'js',name),'utf8');
const index=readIndex();
const baseName='real-estate-ui.js';
const base=read(baseName);
const assetsSelector="document.querySelector('[data-screen=\"assets\"]')";

assert.doesNotMatch(base,/MutationObserver/,'base real-estate UI must not retain its app-wide observer');
assert.doesNotMatch(base,/queueMicrotask/,'base real-estate UI must not retain microtask redraw scheduling');
assert.match(base,/uiEnhancerRegistry\.registerUIEnhancer/,'base real-estate UI must register with the central enhancer registry');
assert.match(base,/id:['"]real-estate-ui['"]/,'base real-estate UI must use a stable enhancer id');
assert.ok(base.includes(assetsSelector),'base real-estate UI must remain scoped to the assets screen');

const satellites=[
  'real-estate-tenant-renewals-ui.js',
  'real-estate-tenant-collections-ui.js',
  'real-estate-rent-guarantee-ui.js',
  'real-estate-security-deposits-ui.js',
  'real-estate-property-insurance-ui.js',
  'real-estate-maintenance-reserves-ui.js',
  'real-estate-property-taxes-ui.js',
  'real-estate-mortgage-refinancing-ui.js',
  'real-estate-property-disposals-ui.js',
  'real-estate-redevelopment-projects-ui.js',
  'real-estate-property-management-ui.js',
  'real-estate-property-maintenance-ui.js',
  'real-estate-portfolio-dashboard-ui.js',
  'real-estate-rent-pricing-ui.js',
  'real-estate-rent-performance-ui.js',
  'real-estate-capex-roi-ui.js',
  'real-estate-capex-actuals-ui.js',
  'real-estate-complete-cycle-ui.js'
];
const basePosition=index.indexOf(`src="./js/${baseName}"`);
assert.ok(basePosition>=0,'base real-estate UI must stay connected in index.html');
for(const name of satellites){
  const position=index.indexOf(`src="./js/${name}"`);
  assert.ok(position>basePosition,`${name} must load after the base real-estate UI so registry order is deterministic`);
}

const topDashboards=[
  'real-estate-portfolio-dashboard-ui.js',
  'real-estate-rent-performance-ui.js',
  'real-estate-capex-roi-ui.js',
  'real-estate-capex-actuals-ui.js',
  'real-estate-complete-cycle-ui.js'
];
for(const name of topDashboards){
  const code=read(name);
  assert.ok(code.includes(assetsSelector),`${name} must resolve the assets screen explicitly`);
  assert.doesNotMatch(code,/document\.getElementById\(['"]app['"]\)/,`${name} must not render directly against #app`);
  assert.doesNotMatch(code,/\bapp\.prepend\s*\(/,`${name} must not fall back to app.prepend`);
  assert.match(code,/\bscreen\.(?:prepend|querySelector)\b/,`${name} must render inside the assets screen`);
}

const jsFiles=fs.readdirSync(path.join(ROOT,'js')).filter(name=>name.endsWith('.js'));
const unqualified=jsFiles.filter(name=>/new\s+MutationObserver\s*\(/.test(read(name)));
const comprehensive=jsFiles.filter(name=>/new\s+(?:[A-Za-z_$][\w$]*\.)?MutationObserver\s*\(/.test(read(name)));
const qualifiedOnly=comprehensive.filter(name=>!unqualified.includes(name)).sort();
assert.equal(unqualified.length,35,`expected 35 unqualified observer-driven JS files after base real-estate UI migration, got ${unqualified.length}`);
assert.equal(comprehensive.length,36,`expected 36 comprehensive observer-driven JS files after base real-estate UI migration, got ${comprehensive.length}`);
assert.deepEqual(qualifiedOnly,['physical-iphone-playtest.js'],'physical-iphone-playtest.js must remain the only qualified-only observer file');

console.log('Real-estate UI assets-scope and registry-order contract passed');
