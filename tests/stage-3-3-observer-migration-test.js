'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {ROOT,readIndex}=require('./harness');

const migrated=[
  'industry-event-response-plans-ui.js',
  'save-storage-ui.js',
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
assert.equal(migrated.length,20,'Stage 3-3 must migrate exactly 20 files');
const index=readIndex();
let previous=-1;
for(const name of migrated){
  const file=path.join(ROOT,'js',name);
  const code=fs.readFileSync(file,'utf8');
  assert.doesNotMatch(code,/MutationObserver/,`${name} must not retain MutationObserver`);
  assert.doesNotMatch(code,/queueMicrotask/,`${name} must not retain queueMicrotask scheduling`);
  assert.match(code,/uiEnhancerRegistry\.registerUIEnhancer/,`${name} must register with the central UI enhancer pipeline`);
  assert.match(code,/uiEnhancerRegistry\.runUIEnhancers|registerUIEnhancer/,`${name} must route UI refresh through the central pipeline`);
  const position=index.indexOf(`src="./js/${name}"`);
  assert.ok(position>=0,`${name} must remain statically connected in index.html`);
  assert.ok(position>previous,`${name} must preserve deterministic index.html registration order`);
  previous=position;
}
const observerFiles=fs.readdirSync(path.join(ROOT,'js')).filter(name=>name.endsWith('.js')).filter(name=>/new\s+(?:[A-Za-z_$][\w$]*\.)?MutationObserver\s*\(/.test(fs.readFileSync(path.join(ROOT,'js',name),'utf8')));
assert.equal(observerFiles.length,54,`expected 54 observer-driven JS files after Stage 3-3, got ${observerFiles.length}`);
const trigger=fs.readFileSync(path.join(ROOT,'js','real-estate-portfolio-dashboard-ui.js'),'utf8');
assert.match(trigger,/id:'real-estate-portfolio-dashboard-ui'/,'physical threshold trigger candidate #45 must be migrated');
console.log('Stage 3-3 observer migration contract passed');
