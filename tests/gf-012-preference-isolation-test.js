'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./harness');
const clone=value=>JSON.parse(JSON.stringify(value));
const {engineModule,modules}=loadGame({headless:true,random:()=>.25,isolatedLegacyIndex:true});
const {TycoonEngine}=engineModule;

function setup(){
  const e=new TycoonEngine();
  e.configure({playerName:'GF012',companyName:'Isolation',difficulty:'normal',simulationSeed:0x120012,founderPrefID:'fukuoka'});
  e.save=()=>{};e.emit=()=>{};e.notify=()=>{};e.g.companyCash=500_000_000;e.g.personalCash=50_000_000;
  const tenant=e.g.tenants.find(row=>row.prefID==='osaka'&&row.businessID==='ramen');
  assert(tenant);assert.equal(e.openStore({tenantID:tenant.id,businessID:'ramen',name:'大阪店'}),true);
  e.g.stores[0].status='open';e.g.stores[0].openingWeek=e.g.week;
  const property=e.g.properties.find(row=>row.prefID==='tokyo');property.owner='company';property.value=property.price;
  return e;
}
function projection(g){
  return clone({companyCash:g.companyCash,personalCash:g.personalCash,companyDebt:g.companyDebt,personalDebt:g.personalDebt,
    finance:g.finance,loans:g.bankFinancing,transactions:g.finance?.transactions,stores:g.stores,properties:g.properties,
    competitors:g.competitorStates,targets:g.acquisitionTargets,startups:g.startups,peDeals:g.peDeals,peNetwork:g.peNetwork,
    ownership:{sharesOut:g.sharesOut,founderShares:g.founderShares,founderOwnershipRatio:g.founderOwnershipRatio},
    ids:{nextCompetitorStateSeq:g.nextCompetitorStateSeq,nextCompetitorPresenceSeq:g.nextCompetitorPresenceSeq,nextCompetitorActionSeq:g.nextCompetitorActionSeq,nextCompetitorInvestmentSeq:g.nextCompetitorInvestmentSeq},
    simulationRng:g.simulationRng,companyHQPrefID:g.companyHQPrefID});
}
function from(state,selectedPref){const e=new TycoonEngine(clone(state));e.save=()=>{};e.emit=()=>{};e.notify=()=>{};e.g.selectedPref=selectedPref;e.g.selectedArea=e.pref(selectedPref).areaID;return e;}

const original=setup(),base=clone(original.g);
assert.equal(base.companyHQPrefID,'fukuoka','founding choice is persisted as company headquarters');
assert.equal(base.stores[0].prefID,'osaka');
const property=base.properties.find(row=>row.owner==='company');assert.equal(property.prefID,'tokyo');
const a=from(base,'tokyo'),b=from(base,'fukuoka');
for(const e of [a,b]){
  assert.equal(e.borrow(1_000_000,'company'),true);
  modules.peNetworkSourcing.onSupplierContract(e.g,{offerID:'gf012-supplier',businessID:'ramen',week:e.g.week});
  modules.peNetworkSourcing.onExecutiveHire(e.g,{candidateID:'gf012-cfo',role:'CFO',week:e.g.week});
  e.advanceWeek(false);e.advanceWeek(false);
}
assert.deepEqual(projection(a.g),projection(b.g),'transient prefecture/area selection must not alter economics, IDs, or RNG');
assert.equal(a.g.companyHQPrefID,'fukuoka');assert.equal(a.g.stores[0].prefID,'osaka');
assert.equal(a.g.properties.find(row=>row.owner==='company').prefID,'tokyo');
for(const node of a.g.peNetwork.nodes.filter(row=>['supplier:gf012-supplier:ramen','executive:gf012-cfo'].includes(row.sourceKey)))assert.equal(node.regionTag,'fukuoka');
assert.deepEqual(a.g.simulationRng,b.g.simulationRng);

// Save/reload retains entity and HQ geography; changing the map after reload remains harmless.
const saved=JSON.stringify(a.g),reloaded=new TycoonEngine(JSON.parse(saved));reloaded.save=()=>{};reloaded.emit=()=>{};reloaded.notify=()=>{};
reloaded.g.selectedPref='hokkaido';reloaded.g.selectedArea='hokkaido';reloaded.advanceWeek(false);
assert.equal(reloaded.g.companyHQPrefID,'fukuoka');assert.equal(reloaded.g.stores[0].prefID,'osaka');assert.equal(reloaded.g.properties.find(row=>row.owner==='company').prefID,'tokyo');

// Explicit persisted geography still drives regional economics.
const tokyo=clone(base),osaka=clone(base);tokyo.stores=[{...base.stores[0],id:'explicit',prefID:'tokyo'}];osaka.stores=[{...base.stores[0],id:'explicit',prefID:'osaka'}];
const tokyoMarket=modules.market.calculateMarkets(tokyo).byStore.explicit,osakaMarket=modules.market.calculateMarkets(osaka).byStore.explicit;
assert.notEqual(tokyoMarket.potentialDemand,osakaMarket.potentialDemand,'explicit entity geography must retain regional effects');

// Missing explicit entity geography rejects without creating PE state or consuming IDs/RNG.
const missing=clone(base);delete missing.peNetwork;const before=JSON.stringify(missing);
assert.equal(modules.peNetworkSourcing.onTenantContract(missing,{tenantID:'missing-pref',week:1}),null);
assert.equal(JSON.stringify(missing),before,'missing geography rejection must be atomic');

// Legacy competitor/default geography is deterministic and independent of the UI selection.
for(const selectedPref of ['tokyo','fukuoka']){
  const legacy=clone(base);delete legacy.companyHQPrefID;legacy.founderHomePrefID='osaka';legacy.selectedPref=selectedPref;
  legacy.competitorMigrationV8Applied=false;legacy.competitorStates=[];legacy.competitors=[{id:'legacy',name:'Legacy',areaID:'missing-area',businessID:'ramen',stores:1,brand:20,quality:20}];
  modules.competitor.ensure(legacy);assert.equal(legacy.competitorStates[0].marketPresence[0].prefID,'osaka');
}

// Saves created before companyHQPrefID existed must preserve founder geography.
// Cover both the v8 -> v9 migration boundary and already-v9 payloads written before GF-012.
for(const saveVersion of [8,9]){
  const legacySave=clone(base);delete legacySave.companyHQPrefID;legacySave.saveVersion=saveVersion;legacySave.founderHomePrefID='osaka';legacySave.selectedPref='tokyo';legacySave.selectedArea='kanto';
  const migratedLegacy=new TycoonEngine(legacySave);
  assert.equal(migratedLegacy.g.companyHQPrefID,'osaka',`v${saveVersion} founder geography must backfill company HQ before defaults`);
  assert.equal(migratedLegacy.g.founderHomePrefID,'osaka');
}

// Focused static contract: economic modules may not consult transient geography. The RNG bridge
// and configure-time explicit founding capture are intentionally outside this list.
const forbidden={
  'js/competitor.js':/selectedPref|selectedArea/,
  'js/market.js':/selectedPref|selectedArea/,
  'js/pe-network-sourcing.js':/selectedPref|selectedArea/,
};
for(const [file,pattern] of Object.entries(forbidden))assert.equal(pattern.test(fs.readFileSync(path.join(__dirname,'..',file),'utf8')),false,`${file} reads transient geography`);
const engineSource=fs.readFileSync(path.join(__dirname,'../js/engine.js'),'utf8');
assert(!/prefID:state\.selectedPref|areaID:state\.selectedArea/.test(engineSource),'entity defaults must not use UI geography');
assert(engineSource.includes("SAVE_KEY = 'capitalism_tycoon_web_v1'"));
assert(fs.readFileSync(path.join(__dirname,'../js/save-v9.js'),'utf8').includes('const SAVE_VERSION=9'));
console.log('GF-012 preference/region isolation tests passed');
