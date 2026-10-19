'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../js/phase3-vc-source-interests.js'),'utf8'),ctx={__capitalismTycoonModules:{}};
vm.runInNewContext(code,ctx);const project=ctx.__capitalismTycoonModules.phase3VCSourceInterests.projectVCSourceInterests;
const plain=x=>JSON.parse(JSON.stringify(x));
const frozen=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;};
const fixture=()=>({saveVersion:9,companyCash:5,personalCash:7,simulationRng:{seed:33},startups:[{id:'s',alive:true,subsidiary:false,ownedCompany:.6,ownedPersonal:.1}]});
const row=(s,a='personal')=>project(s).observations.find(x=>x.account===a);
const s=fixture(),before=JSON.stringify(s),result=project(s);
assert.equal(row(s).economicFraction,.1);assert.equal(row(s,'company').economicFraction,.6);
assert.equal(row(s).assetRole,'economic-interest');assert.equal(JSON.stringify(s),before);assert(!Object.isFrozen(s));
assert.deepEqual(plain(project(frozen(plain(s)))),plain(result));assert(Object.isFrozen(result.observations[0]));
for(const k of ['complete','wealthComplete','commandEligible'])assert.equal(result[k],false);
for(const r of result.observations)for(const k of ['quantity','votingFraction','issuerEntityId','securityClassId','ownershipKey'])assert.equal(r[k],null);
assert.equal(result.sourceSnapshotToken,null);assert.equal(project({saveVersion:9}).observations.length,0);
// A rounded Number sum must not hide a real positive excess above one.
for(const [company,personal,valid] of [[1,0,true],[1,2**-54,false],[1,Number.MIN_VALUE,false],[1-2**-52,2**-52,true],[1-2**-52,2**-51,false],[.5,.5,true]]){
 const x=fixture();x.startups[0].ownedCompany=company;x.startups[0].ownedPersonal=personal;
 assert.equal(row(x).status,valid?'source-matched':'unresolved');
}
for(const change of [
 x=>x.startups.push({...x.startups[0]}),x=>delete x.startups[0].id,
 x=>x.startups[0].ownedCompany=.95,x=>x.startups[0].ownedPersonal=NaN,
 x=>x.startups[0].ownedPersonal=-.1,x=>x.startups[0].ownedCompany='0.6',
 x=>x.startups[0].ddNegotiatedOwnedPersonal=.2,x=>x.startups[0].ipoStockID='listed',
 x=>x.startups[0].activeFundingRound={},x=>x.startups[0].alive=false,
 x=>delete x.startups[0].alive,x=>x.startups[0].ipoStockID={}
]){const x=fixture();change(x);assert(project(x).observations.every(r=>r.status==='unresolved'));assert(project(x).issues.length>0);}
{
 const x=fixture();x.startups[0].subsidiary=true;x.subsidiaries=[{id:'sub',startupID:'s',ownership:.6,status:'active'}];
 assert.equal(row(x,'company').assetRole,'relationship-only');assert.equal(row(x).assetRole,'economic-interest');
 assert.equal(row(x,'company').aliasSourcePath,'subsidiaries[0]');
 for(const key of ['peDealID','sourcePEFundID','sourcePEDealID','internalVentureID','sourceCompetitorID','acquisitionDealID','restructuredWeek','restructuredFrom'])for(const value of ['other',null,undefined]){
  const a=plain(x);a.subsidiaries[0][key]=value;assert.equal(row(a,'company').status,'unresolved');assert.equal(row(a).economicFraction,.1);
 }
 for(const source of ['pe','internalVenture']){
  const a=plain(x);a.subsidiaries[0].source=source;assert.equal(row(a,'company').status,'unresolved');assert.equal(row(a).economicFraction,.1);
 }
 for(const change of [
  a=>a.subsidiaries.push({...a.subsidiaries[0]}),a=>a.subsidiaries[0].ownership=.7,
  a=>a.subsidiaries[0].restructuredFrom=['a','b'],a=>a.subsidiaries[0].status='sold',
  a=>a.startups[0].subsidiary=false,a=>a.subsidiaries=[]
 ]){const a=plain(x);change(a);assert.equal(row(a,'company').status,'unresolved');assert.equal(row(a).economicFraction,.1);}
}
{
 const x=fixture();Object.assign(x.startups[0],{ipoStockID:'listed',alive:false,ownedCompany:0,ownedPersonal:0});
 assert(project(x).observations.every(r=>r.assetRole==='historical'));
}
{
 let reads=0;const x=fixture();Object.defineProperty(x.startups[0],'ownedPersonal',{get(){reads++;throw Error('getter');}});
 assert.equal(project(x).issues[0].code,'INPUT_INVALID');assert.equal(reads,0);
 const a=fixture();Object.defineProperty(a.startups,'0',{get(){reads++;throw Error('getter');}});assert.equal(project(a).issues[0].code,'INPUT_INVALID');assert.equal(reads,0);
 class Exotic{};assert.equal(project(new Exotic()).issues[0].code,'INPUT_INVALID');
 const b=fixture();b.startups.length=2;assert.equal(project(b).issues[0].code,'INPUT_INVALID');
}
assert.throws(()=>vm.runInNewContext(code,ctx),/already registered/);
// Reuse production harness and actual installed conversion/round writers.
const {loadGame}=require('./harness');let seed=1,draws=0;
const loaded=loadGame({headless:true,random:()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;}});
const engine=new loaded.engineModule.TycoonEngine(),e=engine.g,source=e.startups[0];
e.configured=true;e.companyCash=e.personalCash=500e6;e.departments.investment={level:1};delete e.finance;engine.normalize();
Object.assign(source,{alive:true,subsidiary:false,stage:'Series A',valuation:300e6,ownedCompany:.6,ownedPersonal:.1,totalInvestedCompany:50e6,totalInvestedPersonal:5e6,runwayWeeks:40});
function observed(){const snap=JSON.stringify(e),n=draws,r=loaded.modules.phase3VCSourceInterests.projectVCSourceInterests(e);assert.equal(JSON.stringify(e),snap);assert.equal(draws,n);return r.observations.filter(r=>r.startupSourceId===source.id);}
assert(observed().every(r=>r.status==='source-matched'));
assert.equal(engine.makeSubsidiary(source.id),true);assert.equal(observed().find(r=>r.account==='company').assetRole,'relationship-only');assert.equal(observed().find(r=>r.account==='personal').economicFraction,.1);
// A distinct normal startup follows the installed funding/open/close/IPO path.
const other=e.startups[1];Object.assign(other,{alive:true,subsidiary:false,stage:'Series A',valuation:300e6,ownedCompany:.12,ownedPersonal:.05,runwayWeeks:7,fundingOpen:true});e.startupFundingHistory[other.id]=[];
assert.equal(engine.openStartupFundingRound(other),true);
assert(project(e).observations.filter(r=>r.startupSourceId===other.id).every(r=>r.status==='unresolved'));
const plan=engine.getStartupFundingRoundPlan(other.id);e.week=plan.closesWeek;assert.equal(engine.closeStartupFundingRound(other),true);
assert(project(e).observations.filter(r=>r.startupSourceId===other.id).every(r=>r.status==='source-matched'));
assert.notEqual(engine.listStartup(other),false);
assert(project(e).observations.filter(r=>r.startupSourceId===other.id).every(r=>r.assetRole==='historical'));
assert.deepEqual(plain(project(plain(e))),plain(project(e)));
console.log('PASS P3-8 VC source interests: separate accounts, conservative lifecycle/aliases, unsupported rounds/rights, installed writers, purity and v9');
