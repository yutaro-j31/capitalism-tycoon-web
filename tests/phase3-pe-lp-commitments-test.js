'use strict';
const assert=require('node:assert/strict');
const {projectLPCommitments:project,projectPEFundInterests}=require('../js/phase3-pe-fund-interests');
const copy=x=>JSON.parse(JSON.stringify(x));
const fund=()=>({id:'f1',size:100,gpCommit:2,lpContributed:98,status:'investing',deals:[],lps:[{lpTypeID:'type-b',committedAmount:58},{lpTypeID:'type-a',committedAmount:40}]});
const state=()=>({saveVersion:9,companyCash:12,personalCash:34,simulationRng:{seed:17},peFirm:{funds:[fund()]}});
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const s=state(),before=JSON.stringify(s),old=projectPEFundInterests(s),out=project(s);
{
 const x=state(),f=x.peFirm.funds[0],limit=Number.MAX_SAFE_INTEGER/100;
 Object.assign(f,{size:limit,gpCommit:0,lpContributed:limit,lps:[{lpTypeID:'a',committedAmount:limit},{lpTypeID:'b',committedAmount:limit}]});
 const r=project(x);assert.equal(r.funds[0].observedCommitmentTotal,null,'safe rows cannot create an unsafe monetary sum');
 assert(r.issues.some(i=>i.code==='AMOUNT_UNKNOWN'&&i.path==='peFirm.funds[0].lps'));
 assert(r.issues.every(i=>typeof i.message==='string'&&i.evidenceRefs.includes(i.path)));
}
assert.equal(out.funds[0].observedCommitmentTotal,98);assert.equal(out.funds[0].commitmentTotalMatchesDeclaredLP,true);
assert.deepEqual(out.commitments.map(r=>r.lpTypeID),['type-a','type-b']);
for(const r of out.commitments){assert.equal(r.kind,'commitment-only');for(const k of ['paidCapital','legalLPId','beneficialOwnerId','economicFraction','votingFraction','wealthValue'])assert.equal(r[k],null);}
assert.equal(out.complete,false);assert.equal(out.commandEligible,false);assert.equal(out.wealthComplete,false);assert.equal(out.funds[0].paidCapitalAllocated,false);
assert.equal(JSON.stringify(s),before);assert.deepEqual(project(copy(s)),out);assert.deepEqual(project(freeze(copy(s))),out);assert(Object.isFrozen(out.commitments[0]));
assert.deepEqual(projectPEFundInterests(s),old,'existing API unchanged');
for(const value of [undefined,null,{},'98']){const x=state();x.peFirm.funds[0].lps=value;assert.equal(project(x).funds[0].observedCommitmentTotal,null);}
{const x=state();delete x.peFirm.funds[0].lps;assert(project(x).issues.some(i=>i.code==='SOURCE_UNKNOWN'));}
{const x=state();x.peFirm.funds[0].lps=[];assert.equal(project(x).funds[0].commitmentTotalMatchesDeclaredLP,false);}
for(const change of [f=>f.status='unknown',f=>delete f.id,f=>f.gpCommit=99]){
 const x=state(),f=x.peFirm.funds[0];Object.assign(f,{gpCommit:100,lpContributed:0,lps:[]});change(f);
 assert.equal(project(x).funds[0].commitmentTotalMatchesDeclaredLP,null,'invalid fund cannot reconcile an empty LP list');
}
{const x=state();Object.assign(x.peFirm.funds[0],{size:1.5e308,gpCommit:0,lpContributed:1.5e308,lps:[{lpTypeID:'a',committedAmount:1e308},{lpTypeID:'b',committedAmount:1e308}]});assert.equal(project(x).funds[0].observedCommitmentTotal,null,'sum overflow fails closed');}
for(const amount of [-1,Infinity,NaN,'40']){const x=state();x.peFirm.funds[0].lps[0].committedAmount=amount;assert.equal(project(x).funds[0].observedCommitmentTotal,null);}
{const x=state();x.peFirm.funds[0].lps.push(copy(x.peFirm.funds[0].lps[0]));const r=project(x);assert.equal(r.funds[0].observedCommitmentTotal,null);assert(r.commitments.filter(c=>c.lpTypeID==='type-b').every(c=>c.status==='unresolved'));}
{const x=state();x.peFirm.funds.push(fund());assert(project(x).commitments.every(c=>c.status==='unresolved'));}
{const x=state();const f=fund();f.id='f2';f.status='closed';x.peFirm.funds.push(f);assert(project(x).funds.every(f=>f.commitmentTotalMatchesDeclaredLP));assert(project(x).commitments.every(c=>c.paidCapital===null));}
{const x=state();Object.assign(x.peFirm.funds[0],{size:1,gpCommit:.7,lpContributed:.3,lps:[{lpTypeID:'a',committedAmount:.1},{lpTypeID:'b',committedAmount:.2}]});assert.equal(project(x).funds[0].commitmentTotalMatchesDeclaredLP,null,'inexact fund source is not repaired');}
let reads=0;
for(const at of ['root','fund','array','row','amount']){
 const x=state(),f=x.peFirm.funds[0],lp=f.lps[0],target=at==='root'?x:at==='fund'?f:at==='array'?f.lps:lp,key=at==='root'?'peFirm':at==='fund'?'lps':at==='array'?'0':at==='row'?'lpTypeID':'committedAmount';
 Object.defineProperty(target,key,{get(){reads++;throw Error('getter');}});assert.doesNotThrow(()=>project(x));
}assert.equal(reads,0);
{class Exotic{};const x=state();x.peFirm.funds[0].lps[0]=Object.assign(new Exotic(),x.peFirm.funds[0].lps[0]);assert.equal(project(x).funds[0].observedCommitmentTotal,null);}
{const x=state();x.peFirm.funds[0].lps[0].lpTypeID=x;assert.equal(project(x).funds[0].observedCommitmentTotal,null,'selected cycle is invalid, not traversed');}
{const x=state();x.peFirm.funds[0].lps=Array(101).fill({lpTypeID:'a',committedAmount:0});assert(project(x).issues.some(i=>i.code==='INPUT_LIMIT_EXCEEDED'));}
const random=Math.random;Math.random=()=>{throw Error('RNG read');};try{assert.deepEqual(project(s),out);}finally{Math.random=random;}
(async()=>{
 const {scenario}=require('./fixtures/stock-split-atomicity'),s=await scenario('own');s.game.g.personalCash=1e9;
 const lpTypeID=s.modules.peFund.LP_TYPE_IDS[0];assert(lpTypeID);
 const f=s.modules.peFund.createFund(s.game.g,{size:100_000_000,gpCommit:2_000_000,lps:[{lpTypeID,committedAmount:98_000_000}]});
 assert(f);const raw=copy(s.game.g),r=project(raw);assert.equal(JSON.stringify(raw),JSON.stringify(s.game.g));
 assert.equal(r.commitments.find(c=>c.fundId===f.id).lpTypeID,lpTypeID);
 assert.equal(r.funds.find(c=>c.fundId===f.id).commitmentTotalMatchesDeclaredLP,true);
 assert(r.commitments.every(c=>c.paidCapital===null));assert.equal(r.funds[0].paidCapitalAllocated,false);
 assert.deepEqual(copy(s.modules.phase3PeFundInterests.projectLPCommitments(s.game.g)),r,'installed browser module agrees with CommonJS on actual writer state');
 assert.equal(JSON.stringify(raw),JSON.stringify(s.game.g),'installed read consumes no RNG/state');
 console.log('PASS P3-7 LP commitments: source totals, duplicate quarantine, legacy gaps, no paid-capital/title inference, immutable/v9/installed writer');
})().catch(e=>{console.error(e);process.exitCode=1;});
