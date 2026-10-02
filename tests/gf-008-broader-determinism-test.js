'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./harness');

const SEED=0x47f00821;
const clone=value=>JSON.parse(JSON.stringify(value));
const economicRows=rows=>(rows||[]).map(row=>{
  const out={};
  for(const key of Object.keys(row).sort())if(!/^(?:name|title|description|reason|message|label|text|activistName)$/.test(key))out[key]=row[key];
  return out;
});
function projection(g){
  return clone({
    companyCash:g.companyCash,personalCash:g.personalCash,companyDebt:g.companyDebt,personalDebt:g.personalDebt,
    sharesOut:g.sharesOut,founderShares:g.founderShares,founderOwnershipRatio:g.founderOwnershipRatio,
    businesses:economicRows(g.businesses),stores:economicRows(g.stores),properties:economicRows(g.properties),
    loans:economicRows(g.finance?.loans),transactions:economicRows(g.finance?.transactions),finance:g.finance?.balances,
    competitors:economicRows(g.competitorStates),startups:economicRows(g.startups),targets:economicRows(g.acquisitionTargets),
    peDeals:economicRows(g.peDeals),maSubsidiaries:economicRows(g.maSubsidiaries),activism:economicRows(g.shareholderProposals),
    simulationRng:g.simulationRng
  });
}
function prepare(random,identity){
  const loaded=loadGame({headless:true,random});
  const state=loaded.engineModule.createInitialState({configured:true,seed:SEED,companyName:'base',playerName:'base'});
  Object.assign(state,identity,{companyCash:900_000_000,publicCompany:true,week:140,difficulty:'normal',boardGovernanceQuality:0,founderControlPressure:30,lastActivistCampaignWeek:0});
  state.sharesOut=10_000;state.founderShares=2_800;state.stockPrice=200;state.ipoPrice=400;state.dividendPerShare=0;
  const engine=new loaded.engineModule.TycoonEngine(clone(state));
  engine.save=()=>{};engine.emit=()=>{};engine.notify=()=>{};
  const reserve=loaded.modules.shareholderActivism.operatingReserve(engine.g);
  engine.g.activistCapitalUseHistory=Array.from({length:26},(_,i)=>({week:114+i,excessCash:800_000_000,operatingReserve:reserve,investment:0,shareholderReturns:0}));
  return{loaded,engine};
}
function run(runtime){
  const {loaded,engine}=runtime;
  engine.generateMATargets(true);
  engine.refreshStartupDealFlow();
  const before=clone(engine.g.simulationRng);
  const campaign=loaded.modules.shareholderActivism.maybeStart(engine);
  assert(campaign,'fixture must exercise the repaired keyed decision');
  assert.equal(JSON.stringify(engine.g.simulationRng),JSON.stringify(before),'keyed campaign decision must consume no sequential draw');
  return projection(engine.g);
}

const identityA={companyName:'Alpha Holdings',playerName:'Alice',ticker:'AAA'};
const identityB={companyName:'Zulu Display',playerName:'Zed',ticker:'ZZZ'};
const a=run(prepare(()=>.01,identityA));
const b=run(prepare(()=>.99,identityB));
assert.deepEqual(a,b,'company/player/ticker and host Math.random must not affect the economic projection');

// Save/reload replay includes generated IDs, finance transaction identities, and RNG state/draws.
const original=prepare(()=>.13,identityA),payload=JSON.stringify(original.engine.g);
const first=run(original);
const reloaded=prepare(()=>.87,identityA);
reloaded.engine=new reloaded.loaded.engineModule.TycoonEngine(JSON.parse(payload));
reloaded.engine.save=()=>{};reloaded.engine.emit=()=>{};reloaded.engine.notify=()=>{};
assert.deepEqual(run(reloaded),first,'the same modern save and action sequence must replay exactly');

// Keyed entropy is rooted in the seed, ignores display identity and sequential stream position.
const keyed=prepare(()=>.2,identityA),rng=keyed.loaded.modules.simulationRng,g=keyed.engine.g;
const value=rng.keyedUnit(g,'fixture-decision','entity-7',140);
rng.next(g);rng.next(g);
assert.equal(rng.keyedUnit(g,'fixture-decision','entity-7',140),value);
g.companyName='renamed';g.playerName='renamed';g.ticker='NEW';
assert.equal(rng.keyedUnit(g,'fixture-decision','entity-7',140),value);

// Equal-score economic candidates use stable ID order, independent of locale APIs/insertion order.
const candidates=[{id:'entity-20',score:5},{id:'entity-10',score:5}];
candidates.sort((x,y)=>y.score-x.score||rng.stableCompare(x.id,y.id));
assert.deepEqual(candidates.map(x=>x.id),['entity-10','entity-20']);

// Legacy identity-derived migration is a one-time bridge; modern streams never rederive it.
const legacy={week:8,companyName:'Legacy Co',playerName:'Founder',selectedPref:'tokyo'};
rng.ensure(legacy);const migrated=clone(legacy.simulationRng);
legacy.companyName='Later Rename';legacy.playerName='Later Founder';legacy.selectedPref='osaka';rng.ensure(legacy);
assert.equal(JSON.stringify(legacy.simulationRng),JSON.stringify(migrated));

assert.equal(reloaded.engine.g.saveVersion,9);
assert.equal(fs.readFileSync(path.join(__dirname,'../js/engine.js'),'utf8').includes("capitalism_tycoon_web_v1"),true);
assert.deepEqual(loadedNonFinite(first),[]);
assert(reloaded.loaded.modules.finance.validate(reloaded.engine.g).ok,'finance validation must pass');
function loadedNonFinite(value,path='$',out=[]){if(typeof value==='number'&&!Number.isFinite(value))out.push(path);else if(value&&typeof value==='object')for(const key of Object.keys(value))loadedNonFinite(value[key],`${path}.${key}`,out);return out;}

console.log('GF-008 broader determinism differential/replay tests passed');
