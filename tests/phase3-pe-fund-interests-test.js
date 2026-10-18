'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {projectPEFundInterests:project}=require('../js/phase3-pe-fund-interests.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const deal=()=>({id:'d1',status:'active',fundPortion:25,coinvestPortion:10,investedAmount:35});
const fund=()=>({id:'f1',status:'investing',size:100,gpCommit:2,lpContributed:98,deals:[deal()],gpDistributed:3,lpDistributed:4,gpCarryPaid:1,managementFeesPaid:2});
const state=()=>({saveVersion:9,companyCash:123,personalCash:456,simulationRng:{seed:17},peFirm:{funds:[fund()]}});
const input=state(),before=JSON.stringify(input),out=project(input);
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
 const s=state();s.peFirm.funds[0].status='closed';const r=project(s);assert.equal(r.fundInterests[0].current,false);assert.equal(r.portfolioParticipations[0].current,true);assert.equal(r.portfolioParticipations[0].fundProceedsFraction,25/35);
}
let reads=0;
for(const key of ['size','gpCommit','status','deals']){
 const s=state();Object.defineProperty(s.peFirm.funds[0],key,{get(){reads++;throw Error('getter');}});assert.doesNotThrow(()=>project(s));
}
const s=state();Object.defineProperty(s.peFirm.funds,'0',{get(){reads++;throw Error('array getter');}});project(s);assert.equal(reads,0);
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
 const closed=project(copy(e.g));assert.equal(closed.portfolioParticipations[0].current,true);assert.equal(closed.portfolioParticipations[0].fundProceedsFraction,25/35);
 f.deals[0].status='exited';assert.equal(project(copy(e.g)).portfolioParticipations[0].fundProceedsFraction,null);
}
console.log('PASS P3-7 fund interests: account separation, source-exact capital, coinvest, historical distributions, malformed evidence, purity, v9 and installed writer');
