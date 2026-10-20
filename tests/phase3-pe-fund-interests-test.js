'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {projectPEFundInterests:project}=require('../js/phase3-pe-fund-interests.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const deal=()=>({id:'d1',status:'active',fundPortion:25,coinvestPortion:10,investedAmount:35});
const fund=()=>({id:'f1',status:'investing',size:100,gpCommit:2,lpContributed:98,cash:0,deals:[deal()],gpDistributed:3,lpDistributed:4,gpCarryPaid:1,managementFeesPaid:2});
const state=()=>({saveVersion:9,companyCash:123,personalCash:456,simulationRng:{seed:17},peFirm:{funds:[fund()]}});
const input=state(),before=JSON.stringify(input),out=project(input);
for(const bad of [null,{}, {peFirm:{funds:[{...fund(),size:'100'}]}}]){
 const r=project(bad);for(const reason of r.issues){
  assert.equal(typeof reason.message,'string');assert(reason.message.length>0);
  assert.deepEqual(reason.evidenceRefs,[reason.path]);assert(Object.isFrozen(reason.evidenceRefs));
 }
}
for(const amount of [Number.MAX_VALUE,1e100,Number.MAX_SAFE_INTEGER/100+1]){
 const s=state(),f=s.peFirm.funds[0];f.size=amount;f.gpCommit=0;f.lpContributed=amount;f.gpDistributed=amount;
 const r=project(s);assert.equal(r.fundInterests[0].status,'unresolved');
 assert.equal(r.fundInterests[0].contributionRatio,null);assert.equal(r.distributionEvidence[0].gpDistributed,null);
 for(const key of ['size','lpContributed','gpDistributed'])assert(r.issues.some(x=>x.path==='peFirm.funds[0].'+key&&x.code==='AMOUNT_UNKNOWN'));
}
for(const key of ['gpDistributed','lpDistributed','gpCarryPaid','managementFeesPaid']){
 const s=state();s.peFirm.funds[0][key]=1e100;
 const r=project(s);assert.equal(r.distributionEvidence[0][key],null);
 assert(r.issues.some(x=>x.path==='peFirm.funds[0].'+key));
 assert.equal(r.fundInterests[0].status,'observed','invalid historical payment does not erase independently supported current capital');
}
{
 const s=state(),f=s.peFirm.funds[0];f.size=Number.MAX_SAFE_INTEGER/100;f.gpCommit=0;f.lpContributed=f.size;
 assert.equal(project(s).fundInterests[0].status,'observed','cent-safe boundary is supported');
}
for(const cash of [undefined,null,'5',NaN,Infinity,-1,1e100]){
 const s=state(),f=s.peFirm.funds[0];f.status='closed';f.deals=[];
 if(cash===undefined)delete f.cash;else f.cash=cash;
 const r=project(s);assert.equal(r.fundInterests[0].status,'unresolved');
 assert.equal(r.managementRelationships[0].status,'unresolved');
 assert(r.issues.some(x=>x.code==='AMOUNT_UNKNOWN'&&x.path==='peFirm.funds[0].cash'));
 assert.equal(r.fundInterests[0].current,false,'unknown cash cannot prove a current claim');
}
{
 const s=state(),f=s.peFirm.funds[0];f.status='closed';delete f.cash;
 const r=project(s);assert.equal(r.fundInterests[0].current,true,'valid active deal is independent current evidence');
 assert.equal(r.fundInterests[0].status,'unresolved','unknown cash remains explicit even with a live deal');
 let reads=0;Object.defineProperty(f,'cash',{get(){reads++;throw Error('getter');}});
 assert.doesNotThrow(()=>project(s));assert.equal(reads,0);
}
assert.equal(out.fundInterests[0].contributionRatio,.02);
assert.equal(out.portfolioParticipations[0].fundProceedsFraction,25/35);
assert.equal(out.portfolioParticipations[0].externalCoinvestProceedsFraction,10/35);
assert.equal(out.portfolioParticipations[0].founderBeneficialFraction,null);
assert.equal(out.portfolioParticipations[0].legalEquityFraction,null);
assert.equal(out.portfolioParticipations[0].votingFraction,null);
assert.equal(out.fundInterests[0].wealthValue,null);
assert.equal(out.distributionEvidence[0].isReceivable,false);
assert.equal(out.complete,false);assert.equal(out.commandEligible,false);assert.equal(out.wealthComplete,false);
assert.equal(JSON.stringify(input),before);assert.deepEqual(project(copy(input)),out);
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
assert.deepEqual(project(freeze(copy(input))),out);assert(Object.isFrozen(out.portfolioParticipations[0]));
assert.equal(project({saveVersion:9}).fundInterests.length,0);
for(const mutate of [f=>{f.size=0;},f=>{f.gpCommit=101;},f=>{f.lpContributed=99;},f=>{f.gpCommit='2';},f=>{f.status='unknown';}]){
 const s=state();mutate(s.peFirm.funds[0]);const r=project(s);
 assert.equal(r.fundInterests[0].contributionRatio,null);assert.equal(r.portfolioParticipations[0].current,false);
}
{
 const s=state();s.peFirm.funds.push(fund());const r=project(s);
 assert(r.fundInterests.every(f=>f.contributionRatio===null));assert(r.portfolioParticipations.every(d=>d.fundProceedsFraction===null));
}
{
 const s=state();s.peFirm.funds[0].deals.push(deal());assert(project(s).portfolioParticipations.every(d=>!d.current));
}
for(const change of [d=>d.status='exited',d=>d.settlement={},d=>d.investedAmount=36,d=>d.coinvestPortion=NaN]){
 const s=state();change(s.peFirm.funds[0].deals[0]);assert.equal(project(s).portfolioParticipations[0].fundProceedsFraction,null);
}
{
 const s=state();s.peFirm.funds[0].status='closed';const r=project(s);assert.equal(r.fundInterests[0].current,true);assert.equal(r.managementRelationships[0].current,true);assert.equal(r.fundInterests[0].fundStatus,'closed');assert.equal(r.portfolioParticipations[0].current,true);assert.equal(r.portfolioParticipations[0].fundProceedsFraction,25/35);
 s.peFirm.funds[0].deals[0].status='exited';assert.equal(project(s).fundInterests[0].current,false);assert.equal(project(s).managementRelationships[0].current,false);
 s.peFirm.funds[0].cash=5;assert.equal(project(s).fundInterests[0].current,true);
}
// A malformed settlement marker is neither proof of settlement nor of a current participation.
for(const marker of ['corrupt',1,true,[]]){
 const s=state();s.peFirm.funds[0].deals[0].settlement=marker;const r=project(s);
 assert.equal(r.portfolioParticipations[0].current,false);assert.equal(r.portfolioParticipations[0].fundProceedsFraction,null);
 assert(r.issues.some(i=>i.code==='INPUT_INVALID'&&i.path.endsWith('.deals[0].settlement')),'malformed settlement is reported');
}
{const s=state();s.peFirm.funds[0].deals[0].settlement=null;assert.equal(project(s).portfolioParticipations[0].current,true,'null settlement is the unsettled default');}
let reads=0;
for(const key of ['size','gpCommit','status','deals']){
 const s=state();Object.defineProperty(s.peFirm.funds[0],key,{get(){reads++;throw Error('getter');}});assert.doesNotThrow(()=>project(s));
}
const s=state();Object.defineProperty(s.peFirm.funds,'0',{get(){reads++;throw Error('array getter');}});project(s);assert.equal(reads,0);
// Selected record evidence must survive JSON serialization to be attested.
for(const key of ['id','status','size','gpCommit','lpContributed']){
 const x=state(),f=x.peFirm.funds[0];
 Object.defineProperty(f,key,{value:f[key],enumerable:false});
 const raw=project(x),reloaded=project(copy(x));
 assert.equal(raw.fundInterests[0].contributionRatio,null,key);
 assert.equal(raw.fundInterests[0].current,false,key);
 assert.equal(reloaded.fundInterests[0].contributionRatio,null,key+' JSON');
 assert.equal(reloaded.fundInterests[0].current,false,key+' JSON');
 assert(raw.issues.some(i=>i.code==='INPUT_INVALID'&&i.path==='peFirm.funds[0].'+key));
}
for(const key of ['gpDistributed','lpDistributed','gpCarryPaid','managementFeesPaid']){
 const x=state(),f=x.peFirm.funds[0];Object.defineProperty(f,key,{value:f[key],enumerable:false});
 assert.equal(project(x).distributionEvidence[0][key],null);
 assert.equal(project(copy(x)).distributionEvidence[0][key],null);
}
for(const location of ['root','funds','fund-index','deals','deal-index','fraction']){
 const x=state(),f=x.peFirm.funds[0],d=f.deals[0];
 const [obj,key]=location==='root'?[x,'peFirm']:location==='funds'?[x.peFirm,'funds']:
  location==='fund-index'?[x.peFirm.funds,'0']:location==='deals'?[f,'deals']:
  location==='deal-index'?[f.deals,'0']:[d,'fundPortion'];
 Object.defineProperty(obj,key,{value:obj[key],enumerable:false});
 const r=project(x);assert(r.issues.some(i=>i.code==='INPUT_INVALID'),location);
 assert(r.portfolioParticipations.every(d=>d.fundProceedsFraction===null),location);
}
const src=fs.readFileSync(require.resolve('../js/phase3-pe-fund-interests.js'),'utf8');
const ctx={__capitalismTycoonModules:{}};vm.runInNewContext(src,ctx);assert.equal(typeof ctx.__capitalismTycoonModules.phase3PeFundInterests.projectPEFundInterests,'function');
assert.throws(()=>vm.runInNewContext(src,ctx),/already registered/);
// Match the installed fund writer's subtraction, including floating-point values.
{
 const ctx={console,EventTarget,Event,CustomEvent,localStorage:{getItem(){return null;},setItem(){},removeItem(){}},document:{addEventListener(){}},setTimeout(){},clearTimeout(){}};ctx.window=ctx;
 for(const file of ['runtime','data','store-market-environment','workforce','supply','competitor','competitor-projects','competitor-entry','competitor-credit','competitor-distress','market','finance','simulation-rng','engine','save-v9','completion','pe-fund'])vm.runInNewContext(fs.readFileSync(require.resolve('../js/'+file+'.js'),'utf8'),ctx);
 const m=ctx.__capitalismTycoonModules,e=new m.engine.TycoonEngine();e.g.personalCash=1e9;
 const f=m.peFund.createFund(e.g,{size:30000000.1,gpCommit:2000000.2});assert(f);
 const r=project(copy(e.g));assert.equal(r.fundInterests[0].contributionRatio,f.gpCommit/f.size);
 f.deals.push(deal());m.peFund.processFundsWeek(e.g,f.deadlineWeek);
 assert.equal(f.status,'closed');assert.equal(f.deals[0].status,'active');
 const closed=project(copy(e.g));assert.equal(closed.fundInterests[0].current,true);assert.equal(closed.managementRelationships[0].current,true);assert.equal(closed.portfolioParticipations[0].current,true);assert.equal(closed.portfolioParticipations[0].fundProceedsFraction,25/35);
 f.deals[0].status='exited';assert.equal(project(copy(e.g)).portfolioParticipations[0].fundProceedsFraction,null);
}
console.log('PASS P3-7 fund interests: account separation, source-exact capital, coinvest, historical distributions, malformed evidence, purity, v9 and installed writer');
