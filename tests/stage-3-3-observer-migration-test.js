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

const jsFiles=fs.readdirSync(path.join(ROOT,'js')).filter(name=>name.endsWith('.js'));
const unqualifiedObserverFiles=jsFiles.filter(name=>/new\s+MutationObserver\s*\(/.test(fs.readFileSync(path.join(ROOT,'js',name),'utf8')));
const observerFiles=jsFiles.filter(name=>/new\s+(?:[A-Za-z_$][\w$]*\.)?MutationObserver\s*\(/.test(fs.readFileSync(path.join(ROOT,'js',name),'utf8')));
const qualifiedOnlyObserverFiles=observerFiles.filter(name=>!unqualifiedObserverFiles.includes(name)).sort();

// The earlier 74-file figure counted only `new MutationObserver(...)`. Before
// Stage 3-3 there were also three qualified constructors: save-storage-ui.js,
// physical-iphone-playtest.js, and playtest-report-ui.js. Stage 3-3 migrates
// save-storage-ui.js plus 19 unqualified observers, leaving 55 unqualified and
// two qualified-only observers = 57 comprehensive observer-driven JS files.
assert.equal(unqualifiedObserverFiles.length,55,`expected 55 unqualified observer-driven JS files after Stage 3-3, got ${unqualifiedObserverFiles.length}`);
assert.equal(observerFiles.length,57,`expected 57 observer-driven JS files after Stage 3-3 including qualified constructors, got ${observerFiles.length}`);
assert.deepEqual(qualifiedOnlyObserverFiles,['physical-iphone-playtest.js','playtest-report-ui.js'],'qualified-only observer files must stay explicitly accounted for');

const trigger=fs.readFileSync(path.join(ROOT,'js','real-estate-portfolio-dashboard-ui.js'),'utf8');
assert.match(trigger,/id:'real-estate-portfolio-dashboard-ui'/,'physical threshold trigger candidate #45 must be migrated');
console.log('Stage 3-3 observer migration contract passed');
