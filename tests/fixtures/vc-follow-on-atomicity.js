'use strict';
const {random,economic}=require('./vc-initial-investment-atomicity');
function fixture(m,account,variant='split'){
 const e=new m.engine.TycoonEngine();e.g.configured=true;e.g.companyCash=500e6;e.g.personalCash=500e6;e.g.departments.investment={level:1};delete e.g.finance;e.normalize();
 const s=e.g.startups[0];s.stage='Series A';s.valuation=300e6;s.ownedCompany=.12;s.ownedPersonal=.05;s.runwayWeeks=7;s.fundingOpen=true;e.g.startupFundingHistory[s.id]=[];
 if(!e.openStartupFundingRound(s))throw new Error('fixture: valid funding round refused');
 const plan=e.getStartupFundingRoundPlan(s.id);if(!plan)throw new Error('fixture: missing plan');
 const required=plan[account].proRataRequired;
 if(variant==='tail'&&e.participateStartupFundingRound(s.id,required/4,account)!==true)throw new Error('fixture: prior normal contribution refused');
 const amount=variant==='split'?required/2:e.getStartupFundingRoundPlan(s.id)[account].remaining;
 return{e,id:s.id,amount,account,variant};
}
// Match Node's full deep equality in the browser: object key insertion order is not
// economic state. Preserve every field value and the order of every array/history.
function snapshot(value){if(Array.isArray(value))return value.map(snapshot);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,snapshot(value[key])]));return value;}
module.exports={random,economic,fixture,snapshot};
