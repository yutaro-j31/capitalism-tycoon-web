const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const src=fs.readFileSync('js/real-estate-maintenance-reserves.js','utf8');
const loader=fs.readFileSync('js/real-estate-property-insurance.js','utf8');
assert(!src.includes('Math.random'));
assert(!src.includes('Date.now'));
assert(!src.includes('updateParityWeekly'));
assert(!src.includes('finance?.event'));
assert(!src.includes('real-estate-maintenance-reserves-ui.js'));
assert.doesNotMatch(loader,/document\.createElement\(\s*['"]script['"]\s*\)/);

const state={week:12,companyCash:2e7,properties:[{id:'p1',maintenanceReserve:5000}]};
let insuranceEnsureCalls=0,maintenanceEnsureCalls=0,processCalls=0;
const insuranceEnsureResult={source:'property-insurance'};
const insurance={ensure(g){insuranceEnsureCalls++;assert.strictEqual(g,state);return insuranceEnsureResult;}};
const modules={realEstatePropertyInsurance:insurance};
const context={globalThis:{__capitalismTycoonModules:modules}};
vm.runInNewContext(src,context);
const bridge=modules.realEstateMaintenanceReserves;

assert.equal(bridge.VERSION,0);
assert.equal(bridge.LEGACY_COMPATIBILITY,true);
assert.notStrictEqual(bridge.ensure,insurance.ensure,'bridge wrapper is part of the public compatibility contract');
assert.throws(()=>bridge.HISTORY_LIMIT,/single maintenance source/);
assert.throws(()=>bridge.POLICIES,/single maintenance source/);

const policies=Object.freeze({preventive:{id:'preventive'}});
const maintenance={
  HISTORY_LIMIT:500,
  POLICIES:policies,
  ensure(g){maintenanceEnsureCalls++;return g;},
  processWeek(){processCalls++;return['source'];}
};
modules.realEstatePropertyMaintenance=maintenance;
assert.equal(bridge.HISTORY_LIMIT,500);
assert.strictEqual(bridge.POLICIES,policies);
assert.notStrictEqual(bridge.ensure,maintenance.ensure);
assert.deepEqual(Array.from(bridge.processWeek({g:state})),[]);
assert.equal(processCalls,0);
assert.strictEqual(bridge.ensure(state),insuranceEnsureResult,'ensure must return the property-insurance delegation result');
assert.equal(insuranceEnsureCalls,1);
assert.equal(maintenanceEnsureCalls,0);
assert.equal(state.companyCash,2e7);
assert.equal(state.properties[0].maintenanceReserve,5000);

maintenance.HISTORY_LIMIT=250;
maintenance.POLICIES=Object.freeze({reactive:{id:'reactive'}});
assert.equal(bridge.HISTORY_LIMIT,250,'metadata must be resolved lazily');
assert.strictEqual(bridge.POLICIES,maintenance.POLICIES,'policies must be resolved lazily');
console.log('real-estate-maintenance-reserves compatibility: ok');
