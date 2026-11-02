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
 const before=JSON.stringify(x),r=project(x),link=r.conversionLinks[0];
 assert(r.observations.every(row=>row.assetRole==='historical'));
 assert.equal(link.status,'source-observed');assert.equal(link.assetRole,'lifecycle-source-link');
 assert.equal(link.startupSourceId,'s');assert.equal(link.listedAlias,'listed');assert.equal(link.startupInterestCurrent,false);
 assert.equal(link.listedLotStatus,'unverified');assert.equal(link.shareClassStatus,'unproven');
 for(const key of ['issuerEntityId','securityClassId','ownershipKey','quantity','votingFraction','wealthValue'])assert.equal(link[key],null);
 assert.deepEqual(plain(link.reasons),[{code:'LISTED_LOT_UNVERIFIED',path:'startups[0].ipoStockID'}]);
 assert.equal(JSON.stringify(x),before);assert(Object.isFrozen(link));assert.deepEqual(plain(project(plain(x))),plain(r));
 const conflict=plain(x);conflict.startups[0].ownedPersonal=.1;
 const unresolved=project(conflict).conversionLinks[0];assert.equal(unresolved.status,'unresolved');assert.equal(unresolved.startupInterestCurrent,null);
 assert.equal(unresolved.reasons[0].code,'CONVERSION_CONFLICT');
}
{
 let reads=0;const x=fixture();Object.defineProperty(x.startups[0],'ownedPersonal',{get(){reads++;throw Error('getter');}});
 assert.equal(project(x).issues[0].code,'INPUT_INVALID');assert.equal(reads,0);
 const a=fixture();Object.defineProperty(a.startups,'0',{get(){reads++;throw Error('getter');}});assert.equal(project(a).issues[0].code,'INPUT_INVALID');assert.equal(reads,0);
 class Exotic{};assert.equal(project(new Exotic()).issues[0].code,'INPUT_INVALID');
 const b=fixture();b.startups.length=2;assert.equal(project(b).issues[0].code,'INPUT_INVALID');
}
// P3-8 pending capital is reported separately; it is never current equity or verified cash.
{
 const pending=()=>{const x=fixture();x.startups[0].activeFundingRound={id:'round-1',status:'open',round:'Series B',openedWeek:3,closesWeek:7,
  preMoneyValuation:100,targetRaise:25,postMoneyValuation:125,preRoundOwnedCompany:.6,preRoundOwnedPersonal:.1,contributedCompany:3,contributedPersonal:2};return x;};
 const x=pending(),before=JSON.stringify(x),r=project(x),personal=r.roundObservations.find(x=>x.account==='personal');
 assert.equal(personal.reportedContributionJPY,2);assert.equal(personal.reportedPreRoundFraction,.1);
 assert.equal(personal.paymentStatus,'unverified');assert.equal(personal.assetRole,'pending-capital-evidence');
 assert.equal(personal.quantity,null);assert.equal(personal.wealthValue,null);assert.equal(personal.votingFraction,null);
 assert.equal(personal.parentGenerationStatus,'unproven');assert.equal(personal.issuerEntityId,null);assert.equal(personal.ownershipKey,null);
 assert(r.observations.every(x=>x.status==='unresolved'&&x.economicFraction===null),'pending amount never becomes current shares');
 assert.equal(r.roundObservations.find(x=>x.account==='company').reportedContributionJPY,3);
 assert.equal(JSON.stringify(x),before);assert(Object.isFrozen(personal));assert(!Object.isFrozen(x.startups[0].activeFundingRound));
 assert.deepEqual(plain(project(frozen(plain(x)))),plain(r));
 for(const change of [
  t=>t.startups[0].activeFundingRound.postMoneyValuation=126,
  t=>t.startups[0].activeFundingRound.preRoundOwnedPersonal=.2,
  t=>t.startups[0].activeFundingRound.contributedPersonal=-1,
  t=>t.startups[0].activeFundingRound.contributedCompany='3',
  t=>t.startups[0].activeFundingRound.contributedPersonal=Infinity,
  t=>t.startups[0].activeFundingRound.contributedCompany=26,
  t=>t.startups[0].activeFundingRound.targetRaise=Number.MAX_SAFE_INTEGER,
  t=>t.startups[0].activeFundingRound.closesWeek=3,
  t=>t.startups[0].activeFundingRound.status='closed',
  t=>t.startups.push({...t.startups[0],id:'other'}),
  t=>t.startups[0].alive=false,
  t=>t.startups[0].subsidiary=true,
  t=>t.subsidiaries=[{id:'sub',startupID:'s',ownership:.6,status:'active'}]
 ]){const bad=pending();change(bad);const v=project(bad);assert(v.roundObservations.length>0);assert(v.roundObservations.every(x=>x.status==='unresolved'&&x.reportedContributionJPY===null));}
 let reads=0;const getter=pending();Object.defineProperty(getter.startups[0].activeFundingRound,'contributedPersonal',{get(){reads++;throw Error('getter');}});
 const invalid=project(getter);assert.equal(reads,0);assert.equal(invalid.issues[0].code,'INPUT_INVALID');assert.equal(invalid.roundObservations.length,0);
 const closed=pending();closed.startups[0].activeFundingRound=null;assert.equal(project(closed).roundObservations.length,0);
}
// Selected evidence must be own enumerable JSON data; hidden claims cannot certify fractions.
for(const location of ['root','startup-index','id','ownedPersonal','alive','subsidiary-root','subsidiary-index','subsidiary-ownership']){
 const s=fixture();let obj,key;
 if(location==='root'){obj=s;key='startups';}
 else if(location==='startup-index'){obj=s.startups;key='0';}
 else if(location.startsWith('subsidiary-')){
  s.startups[0].subsidiary=true;s.subsidiaries=[{id:'sub',startupID:'s',ownership:.6,status:'active'}];
  if(location==='subsidiary-root'){obj=s;key='subsidiaries';}
  else if(location==='subsidiary-index'){obj=s.subsidiaries;key='0';}
  else{obj=s.subsidiaries[0];key='ownership';}
 }else{obj=s.startups[0];key=location;}
 Object.defineProperty(obj,key,{value:obj[key],enumerable:false});
 const r=project(s);assert.equal(r.issues[0]?.code,'INPUT_INVALID',location);
 assert.equal(r.observations.length,0,location+' hidden data supplies no current equity');
 assert.equal(r.roundObservations.length,0);
 if(!location.endsWith('-index')){const account=location.startsWith('subsidiary-')?'company':'personal',stake=account==='company'?.6:.1;
  assert(!project(plain(s)).observations.some(row=>row.account===account&&row.economicFraction===stake),location+' JSON omission cannot certify the hidden claim');
 }
}
{
 const s=fixture();s.startups[0].activeFundingRound={id:'round',status:'open'};
 Object.defineProperty(s.startups[0].activeFundingRound,'contributedPersonal',{value:2,enumerable:false});
 const r=project(s);assert.equal(r.issues[0].code,'INPUT_INVALID');assert.equal(r.roundObservations.length,0);
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
const pendingRound=project(e).roundObservations.filter(r=>r.startupSourceId===other.id);
assert.equal(pendingRound.length,2);assert(pendingRound.every(r=>r.status==='source-observed'&&r.reportedContributionJPY===0));
assert.equal(pendingRound.find(r=>r.account==='personal').reportedPreRoundFraction,.05);

const plan=engine.getStartupFundingRoundPlan(other.id);e.week=plan.closesWeek;assert.equal(engine.closeStartupFundingRound(other),true);
assert(project(e).observations.filter(r=>r.startupSourceId===other.id).every(r=>r.status==='source-matched'));
assert.equal(project(e).roundObservations.filter(r=>r.startupSourceId===other.id).length,0,'closed capital is not a second pending asset');
assert.notEqual(engine.listStartup(other),false);
const listed=project(e);assert(listed.observations.filter(r=>r.startupSourceId===other.id).every(r=>r.assetRole==='historical'));
const conversion=listed.conversionLinks.find(r=>r.startupSourceId===other.id);assert(conversion);
assert.equal(conversion.status,'source-observed');assert.equal(conversion.listedAlias,other.ipoStockID);
assert.equal(conversion.quantity,null);assert.equal(conversion.wealthValue,null);assert.equal(conversion.listedLotStatus,'unverified');
assert.deepEqual(plain(project(plain(e))),plain(project(e)));
console.log('PASS P3-8 VC source interests: separate accounts, conservative lifecycle/aliases, unsupported rounds/rights, installed writers, purity and v9');
