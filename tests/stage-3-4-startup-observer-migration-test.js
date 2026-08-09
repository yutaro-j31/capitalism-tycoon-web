'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {ROOT,readIndex}=require('./harness');

const migrated=[
  'capital-allocation-decision-memo.js',
  'capital-allocation-forecast.js',
  'capital-allocation-policy.js',
  'capital-allocation-recovery-funding-outcome.js',
  'capital-allocation-score.js',
  'competitor-dashboard-ui.js',
  'group-capital-allocation-execution.js',
  'group-capital-allocation-plan.js',
  'inter-subsidiary-synergy-performance.js',
  'ma-portfolio-summary-ui.js',
  'new-business-market-analysis.js',
  'player-crisis-creditor-ui.js',
  'player-crisis-ui.js',
  'player-turnaround-plan-ui.js',
  'playtest-report-ui.js',
  'release-diagnostics-ui.js',
  'shareholder-returns.js',
  'subsidiary-mandate-apply.js',
  'treasury-prepayment.js',
  'treasury-refinancing-policy.js'
];
assert.equal(migrated.length,20,'Stage 3-4 must migrate exactly 20 physical-startup observer files');
const index=readIndex();
const indexPositions=[];
for(const name of migrated){
  const code=fs.readFileSync(path.join(ROOT,'js',name),'utf8');
  assert.doesNotMatch(code,/MutationObserver/,`${name} must not retain MutationObserver`);
  assert.doesNotMatch(code,/queueMicrotask/,`${name} must not retain queueMicrotask scheduling`);
  assert.match(code,new RegExp(`id:['\"]${name.replace(/\.js$/,'')}['\"]`),`${name} must statically register its enhancer id`);
  assert.match(code,/registerUIEnhancer|registerEnhancer/,`${name} must route rendering through the central enhancer registry`);
  const position=index.indexOf(`src="./js/${name}"`);
  assert.ok(position>=0,`${name} must remain statically connected in index.html`);
  indexPositions.push(position);
}
assert.equal(new Set(indexPositions).size,migrated.length,'migrated modules must remain uniquely connected in index.html');

const registryPath=path.join(ROOT,'js','ui-enhancer-registry.js');
const registry=fs.readFileSync(registryPath,'utf8');
assert.match(registry,/__capitalismTycoonPendingUIEnhancers/,'registry must support static pre-registry enhancer registrations');
assert.match(registry,/queue\.splice\(0\)/,'registry must empty the pending queue before processing it');
assert.match(registry,/pendingIDs\.has\(id\)/,'registry must deduplicate repeated pre-init enhancer ids');
assert.doesNotMatch(registry,/MutationObserver|queueMicrotask|requestAnimationFrame/,'registry must remain observer- and async-render-loop free');

// Exercise the pending path directly: FIFO order, duplicate suppression, and an empty queue after drain.
const app={innerHTML:''};
const sandbox={
  console:{error(){}},
  document:{getElementById(id){return id==='app'?app:null;}},
  __capitalismTycoonModules:{},
  __capitalismTycoonPendingUIEnhancers:[
    {id:'startup-a',enhance(){}},
    {id:'startup-a',enhance(){throw new Error('duplicate enhancer must not run');}},
    {id:'startup-b',enhance(){}}
  ]
};
sandbox.globalThis=sandbox;
vm.runInNewContext(registry,sandbox,{filename:'ui-enhancer-registry.js'});
const installed=sandbox.__capitalismTycoonModules.uiEnhancerRegistry;
assert.deepEqual(Array.from(installed.registeredIDs()),['startup-a','startup-b'],'pending enhancer order must remain FIFO with duplicate ids registered once');
assert.equal(sandbox.__capitalismTycoonPendingUIEnhancers.length,0,'pending queue must be empty after registry initialization');

// Aggregate residual observer counts intentionally belong to the latest migration-stage contract.
// Later stages must be free to reduce that count without breaking this Stage 3-4 regression test.
console.log('Stage 3-4 startup observer migration contract passed');
