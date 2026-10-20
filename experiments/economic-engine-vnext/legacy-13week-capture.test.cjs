'use strict';
const assert=require('node:assert/strict');
const {capture13Weeks,evaluateCapture}=require('./legacy-13week-capture.cjs');
const fixture=require('./fixtures/13-week-retail.json');
let passed=0;
function test(name,run){run();passed++;console.log('PASS '+name);}
function mockEngine({noncash=false,rentMinor=0,unsupported=false,brokenWeek=0,failAt=0,gameOverAt=0}={}){
 const g={week:1,companyCash:250000,stores:[{id:'ramen',businessID:'ramen',status:'open'}],
   gameOver:false,finance:{transactions:[],balances:{inventory:100},lastValidation:{ok:true}}};
 const makeRow=(week,cat,suffix,cash,profit,amount)=>{
  const op='week-'+week+'-store-ramen-'+suffix;
  return {week,storeID:'ramen',businessID:'ramen',category:cat,
   sourceType:'weekly-store-'+suffix,sourceID:'ramen',operationID:op,
   idempotencyKey:op,amount:amount/100,cashEffect:cash/100,profitEffect:profit/100};
 };
 return {g,advanceWeek(){
  const relative=g.week;
  if(relative===failAt)return false;
  if(relative===gameOverAt){g.gameOver=true;return false;}
  g.week++;
  const row=fixture.weeks[relative-1];
  if(!row)throw Error('fixture-exhausted');
  const sales=row.salesMinor,materials=row.materialsMinor,wages=row.wagesMinor;
  const entries=[
    makeRow(g.week,'revenue','revenue',sales,sales,sales),
    makeRow(g.week,'costOfSales','cogs',noncash?0:-materials,-materials,materials),
    makeRow(g.week,'rent','rent',-rentMinor,-rentMinor,rentMinor),
    makeRow(g.week,'payroll','payroll',-wages,-wages,wages),
    makeRow(g.week,'maintenance','maintenance',0,0,0)
  ];
  if(brokenWeek===g.week)entries.pop();
  g.finance.transactions.push(...entries);
  if(unsupported)g.finance.transactions.push(makeRow(g.week,'depreciation','dep',0,-100,100));
  const delta=entries.reduce((a,r)=>a+r.cashEffect,0);
  g.companyCash+=delta;
  return true;
 }};
}
const options={storeID:'ramen',businessID:'ramen'};
test('observes thirteen genuine advanceWeek calls in stub adapter',()=>{
 const game=mockEngine(),record=capture13Weeks(game,options);
 assert.equal(record.startingWeek,1);assert.equal(record.endingWeek,14);
 assert.equal(record.records.length,13);
 assert.equal(record.records[0].week,2);assert.equal(record.records[12].week,14);
});
test('all five categories recorded per observed week',()=>{
 const r=capture13Weeks(mockEngine(),options);
 for(const w of r.records){assert.equal(w.storeRows.length,5);assert.equal(w.storeFinanceCategoryCounts.revenue,1);}
});
test('independently reconstructed mock scenario reconciles',()=>{
 const c=capture13Weeks(mockEngine(),options);
 const result=evaluateCapture(c,fixture);
 assert.equal(result.status,'MATCH');
 assert.equal(result.observedAbsoluteWeeks[0],2);
});
test('supply-aware noncash COGS yields UNSUPPORTED',()=>{
 const c=capture13Weeks(mockEngine({noncash:true}),options);
 const result=evaluateCapture(c,fixture);
 assert.equal(result.status,'UNSUPPORTED');
 assert.ok(result.reasons.includes('inventory-cogs-not-cash'));
});
test('rent yields UNSUPPORTED even if aggregate cash reconciles',()=>{
 const c=capture13Weeks(mockEngine({rentMinor:100}),options);
 const result=evaluateCapture(c,fixture);
 assert.equal(result.status,'UNSUPPORTED');assert.ok(result.reasons.includes('rent-not-modeled'));
});
test('unrecognized extra store row yields EVIDENCE_BLOCKED',()=>{
 const c=capture13Weeks(mockEngine({unsupported:true}),options);
 assert.equal(evaluateCapture(c,fixture).status,'EVIDENCE_BLOCKED');
});
test('missing mandatory week row yields EVIDENCE_BLOCKED',()=>{
 const c=capture13Weeks(mockEngine({brokenWeek:8}),options);
 assert.equal(evaluateCapture(c,fixture).status,'EVIDENCE_BLOCKED');
});
test('a failed game advance aborts capture',()=>assert.throws(()=>capture13Weeks(mockEngine({failAt:3}),options),/advance-week-failed/));
test('existing game over blocks continuation',()=>{
 const e=mockEngine();e.g.gameOver=true;
 assert.throws(()=>capture13Weeks(e,options),/game-over-before-week/);
});
test('missing store identity blocks capture',()=>assert.throws(()=>capture13Weeks(mockEngine(),{storeID:'unknown',businessID:'ramen'}),/store-not-open/));
test('capture does not itself issue new share capital',()=>{
 const e=mockEngine();capture13Weeks(e,options);
 assert.equal(Object.keys(e.g).includes('sharesOut'),false);
});
test('snapshot changes do not mutate captured records',()=>{
 const e=mockEngine(),capture=capture13Weeks(e,options);
 e.g.finance.transactions[0].amount=99999;
 assert.notEqual(capture.records[0].storeRows[0].amount,99999);
});
test('store row differences are explicit, not hidden by comparison',()=>{
 const e=mockEngine();const c=capture13Weeks(e,options);
 c.records[4].storeRows.find(x=>x.category==='revenue').amount+=1;
 c.records[4].storeRows.find(x=>x.category==='revenue').cashEffect+=1;
 c.records[4].storeRows.find(x=>x.category==='revenue').profitEffect+=1;
 const result=evaluateCapture(c,fixture);
 assert.equal(result.status,'MISMATCH');
 assert.ok(result.differences.some(x=>x.week===5&&x.metric==='sales'));
});
test('unaccounted cash delta recorded instead of silently forced to zero',()=>{
 const e=mockEngine(),original=e.advanceWeek;
 e.advanceWeek=function(){const result=original.call(this);this.g.companyCash+=5;return result;};
 const c=capture13Weeks(e,options);
 assert.equal(c.records[0].unassignedCompanyCashDeltaJPY,5);
});
test('no output file or real save API required for synthetic capture',()=>{
 const e=mockEngine();e.save=()=>{throw Error('must not call save');};
 assert.equal(capture13Weeks(e,options).records.length,13);
});
console.log('SPIKE-3.7 legacy observation tests: '+passed+' PASS; mock engine only, not production execution.');
