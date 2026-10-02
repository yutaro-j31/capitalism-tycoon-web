'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./harness');
const phase05=require('../scripts/phase0-5-harness');
const clone=value=>structuredClone(value);
const loaded=loadGame({headless:true,random:()=>.5});
const api=loaded.modules.semanticHashV2;
const hash=api.semanticHashV2;
function state(){
  const g=loaded.engineModule.createInitialState({configured:true,seed:0x90090009,companyName:'Display Co',playerName:'Display Founder'});
  Object.assign(g,{ticker:'DSP',companyCash:1000,personalCash:2000,companyDebt:300,personalDebt:40,companyHQPrefID:'fukuoka',founderHomePrefID:'osaka',sharesOut:100,founderShares:60,nextProjectSeq:7});
  g.stores=[{id:'store-b',name:'B Display',prefID:'osaka',status:'open',inventory:4},{id:'store-a',name:'A Display',prefID:'tokyo',status:'open',inventory:2}];
  g.properties=[{id:'property-1',name:'Tower',prefID:'tokyo',owner:'company',bookValue:500,marketValue:600}];
  g.realEstateDevelopment={projects:[{projectID:'cip-1',propertyID:'property-1',paidCost:80,totalCost:200,status:'active'}],nextProjectSequence:2};
  g.newBusinessResearch={projects:[{projectID:'research-1',investedCost:30,status:'active'}],nextProjectSequence:2};
  g.internalVentures=[{id:'venture-1',invested:20,status:'operating'}];
  g.peFirm={funds:[{id:'fund-1',cash:90,deals:[{dealID:'deal-1',invested:10}]}],coinvestCapital:5};
  g.competitorStates=[{competitorID:'competitor-1',cash:70,debt:8,marketPresence:[{presenceID:'presence-1',prefID:'tokyo',capacity:3}]}];
  g.finance={balances:{cash:1000},loans:[{id:'loan-1',remainingPrincipal:300}],transactions:[{id:'tx-1',week:1,cashEffect:10},{id:'tx-2',week:2,cashEffect:-4}]};
  return g;
}
function changes(base,cases){for(const [label,mutate] of cases){const changed=clone(base);mutate(changed);assert.notEqual(hash(base),hash(changed),`${label} must affect v2`);}}
const base=state(),identical=clone(base),before=JSON.stringify(base);
assert.equal(hash(base),hash(identical),'deep-cloned economic state hashes equally');
assert.equal(JSON.stringify(base),before,'projection/hash is structurally pure');
assert.equal(JSON.stringify(base.simulationRng),JSON.stringify(JSON.parse(before).simulationRng),'hashing consumes no RNG');
const ui=clone(base);Object.assign(ui,{selectedPref:'hokkaido',selectedArea:'hokkaido',selectedTab:'settings',selectedBusiness:'ui-only',selectedListingMarket:'ui-filter',companyName:'Renamed',playerName:'Renamed Founder',ticker:'NEW',lastSaveDate:'2099-01-01',saveSequence:999,reports:[{value:999}],news:[{value:999}]});ui.stores[0].name='Renamed Store';
assert.equal(hash(base),hash(ui),'GF-012 transient geography, UI, identity labels, metadata and display names are excluded');
changes(base,[['company cash',g=>g.companyCash+=1],['personal cash',g=>g.personalCash+=1],['debt',g=>g.companyDebt+=1],['RNG seed',g=>g.simulationRng.seed+=1],['RNG state',g=>g.simulationRng.state+=1],['RNG draws',g=>g.simulationRng.draws+=1],['ownership',g=>g.founderShares-=1],['store economics',g=>g.stores[0].inventory+=1],['property book value',g=>g.properties[0].bookValue+=1],['CIP paid cost',g=>g.realEstateDevelopment.projects[0].paidCost+=1],['research',g=>g.newBusinessResearch.projects[0].investedCost+=1],['internal venture',g=>g.internalVentures[0].invested+=1],['PE fund',g=>g.peFirm.funds[0].cash+=1],['competitor',g=>g.competitorStates[0].cash+=1],['next ID',g=>g.nextProjectSeq+=1]]);
const reordered=clone(base);reordered.stores.reverse();assert.equal(hash(base),hash(reordered),'stores are a set-like ID collection');
const chronology=clone(base);chronology.finance.transactions.reverse();assert.notEqual(hash(base),hash(chronology),'transaction chronology is order-semantic');
const special=[NaN,Infinity,-Infinity,null,undefined].map(value=>api.canonicalSerializeV2({value}));
assert.equal(new Set(special).size,5,'special values have distinct canonical representations');
assert.deepEqual(special,['O1:{S5:valueN:NaN}','O1:{S5:valueN:+Infinity}','O1:{S5:valueN:-Infinity}','O1:{S5:valueL}','O1:{S5:valueU}']);
assert.equal(phase05.STATE_HASH_VERSION,1);assert.equal(phase05.SEMANTIC_HASH_V2,2);
assert.notEqual(phase05.semanticStateHash(base),phase05.semanticStateHash(ui));assert.equal(phase05.semanticStateHash(base,2),phase05.semanticStateHash(ui,2));
const scenario=phase05.createScenario({requestedScenarioSeed:0x90090009,durationWeeks:2,stateHashVersion:2});assert.equal(scenario.stateHashVersion,2);assert(scenario.scenarioFeatures.includes('semantic-state-hash-v2'));
const roundTrip=JSON.parse(JSON.stringify(base));assert.equal(roundTrip.saveVersion,9);assert.equal(hash(base),hash(roundTrip));
const runtime=phase05.createRuntime({...scenario,durationWeeks:0},{sourceMainSha:'ec9bdaaa74975dddeaf9041c040f59a42665b920'});const persisted=phase05.persistRuntime(runtime,{savedAt:'2000-01-01T00:00:00.000Z'});const reloaded=phase05.loadRuntimeFromPayload(runtime,persisted.payload);assert.equal(phase05.semanticStateHash(runtime.engine.g,2),phase05.semanticStateHash(reloaded.engine.g,2),'production save/load keeps v2 stable');
const report=phase05.runScenario({...scenario,durationWeeks:1},{sourceMainSha:'ec9bdaaa74975dddeaf9041c040f59a42665b920'});assert.equal(report.stateHashVersion,2);assert.equal(report.semanticProjectionId,'economic-state-v2');assert.equal(report.requestedScenarioSeed,0x90090009);
function replay(){const e=new loaded.engineModule.TycoonEngine(clone(loaded.engineModule.createInitialState({configured:true,seed:0x90090009})));e.save=()=>{};e.emit=()=>{};e.notify=()=>{};e.advanceWeek(false);e.advanceWeek(false);return e.g;}
const runA=replay(),runB=replay();assert.equal(hash(runA),hash(runB),'same seed and actions replay');runB.companyCash-=1;assert.notEqual(hash(runA),hash(runB),'economic action divergence is detected');
const source=fs.readFileSync(path.join(__dirname,'../js/semantic-hash-v2.js'),'utf8');assert(source.includes('ROOT_KEYS'));assert(!source.includes('localeCompare('));assert(!source.includes('Math.random('));assert(!source.includes('Date.now('));assert(!/JSON\.stringify\(state\)/.test(source));
console.log('GF-009 Semantic Hash v2 differential/replay/purity tests passed');
