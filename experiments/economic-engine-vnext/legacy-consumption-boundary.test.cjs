'use strict';
const assert=require('node:assert/strict');
const {install,verify,runAuthenticated}=require('./legacy-consumption-boundary.cjs');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
const clone=x=>JSON.parse(JSON.stringify(x));
const lot=book=>({lotID:'lot-1',materialID:'noodles',purchaseOrderID:'po-1',
 supplierContractID:null,receivedWeek:1,status:'available',quantity:book,bookValue:book});
function fixture(){
 const o={observedStore:{id:'store'},observedWeeks:[5,17],storeWeeklyRows:[]};
 const events=[];
 for(let i=0;i<13;i++){
  const week=i+5,before=[lot(100-i)],after=[lot(99-i)];
  events.push({observerID:'supply-boundary-'+(i+1),week,storeID:'store',
   before,consumptionOpening:clone(before),after,returnedCOGSMinor:100,receipts:[]});
  o.storeWeeklyRows.push({week,category:'costOfSales',operationID:'cogs-'+week,amount:1});
 }
 return {o,events};
}
function rejects(edit,reason){const x=fixture();edit(x);
 const r=verify(x.events,x.o);assert.equal(r.status,'EVIDENCE_BLOCKED');
 assert.ok(r.reasons.includes(reason),JSON.stringify(r));}
test('13 boundary calls link to financial COGS without canonical postings',()=>{
 const {events,o}=fixture(),r=verify(events,o);
 assert.equal(r.status,'BOUNDARY_CONTRACT_ONLY');assert.equal(r.totalCOGSMinor,1300);
 assert.equal(r.productionConsumptionEventIDs,0);assert.equal(r.newCanonicalPostings,0);
});
test('verification does not mutate source evidence',()=>{
 const x=fixture(),before=JSON.stringify(x);verify(x.events,x.o);assert.equal(JSON.stringify(x),before);
});
test('mock boundaries cannot claim source authentication',()=>{
 const x=fixture();x.o.consumptionBoundaryEvidence=x.events;
 assert.equal(runAuthenticated(x.o).status,'EVIDENCE_BLOCKED');
});
test('missing boundary fails closed',()=>rejects(x=>x.events.pop(),'expected-13-boundaries'));
test('reordered boundary ID fails closed',()=>rejects(x=>x.events[0].observerID='supply-boundary-2','observer-sequence'));
test('foreign store fails closed',()=>rejects(x=>x.events[0].storeID='foreign','boundary-scope'));
test('wrong week fails closed',()=>rejects(x=>x.events[0].week=6,'boundary-scope'));
test('missing source COGS fails closed',()=>rejects(x=>x.o.storeWeeklyRows.shift(),'expected-one-source-COGS'));
test('duplicate source COGS fails closed',()=>rejects(x=>x.o.storeWeeklyRows.push(x.o.storeWeeklyRows[0]),'expected-one-source-COGS'));
test('one-cent returned expense mismatch fails closed',()=>rejects(x=>x.events[0].returnedCOGSMinor++,'boundary-COGS-mismatch'));
test('one-cent net lot mismatch fails closed',()=>rejects(x=>x.events[0].after[0].bookValue+=.01,'boundary-COGS-mismatch'));
test('merged PO ancestry stays blocked',()=>rejects(x=>{
 x.events[0].before[0].purchaseOrderID='merged';
 x.events[0].consumptionOpening[0].purchaseOrderID='merged';
},'unresolved-consumption-PO'));
test('PO replacement during boundary fails closed',()=>rejects(x=>x.events[0].after[0].purchaseOrderID='po-2','boundary-lot-identity-changed'));
test('new unexplained lot fails closed',()=>rejects(x=>x.events[0].after.push({...lot(1),lotID:'lot-2'}),'new-lot-during-consumption'));
test('book increase during consumption fails closed',()=>rejects(x=>x.events[0].after[0].bookValue=101,'lot-increased-during-consumption'));
test('negative lot amount fails closed',()=>rejects(x=>x.events[0].after[0].bookValue=-1,'negative-lot-book'));
test('duplicate lot IDs fail closed',()=>rejects(x=>x.events[0].after.push(x.events[0].after[0]),'invalid-or-duplicate-lot'));
test('unobserved replacement of consumption opening fails closed',()=>rejects(x=>x.events[0].consumptionOpening[0].quantity--,'unobserved-opening-replacement'));
test('unknown receipt must match source finance',()=>rejects(x=>x.events[0].receipts.push({operationID:'fake',amountMinor:1}),'receipt-source-mismatch'));
test('source-linked emergency receipt separated from consumption',()=>{
 const x=fixture(),e=x.events[0];e.before=[lot(98)];
 e.receipts=[{operationID:'receipt',sourceType:'emergency-receipt-cash',amountMinor:200}];
 x.o.storeWeeklyRows.push({week:5,operationID:'receipt',sourceType:'emergency-receipt-cash',amount:2});
 assert.equal(verify(x.events,x.o).status,'BOUNDARY_CONTRACT_ONLY');
});
function hooks(){
 const g={week:5,inventoryByStoreID:{store:{materials:{noodles:{lots:[lot(100)]}}}}};
 const finance={event:function(){assert.equal(this,finance);return 'receipt-result';}};
 const supply={applyConstraint:function(game,store,mr,f){
  assert.equal(this,supply);assert.equal(store.id,'store');
  if(mr.receipt){game.inventoryByStoreID.store.materials.noodles.lots[0].bookValue+=2;
   assert.equal(f.event(game,'workingCapitalIncrease',2,{storeID:'store',operationID:'receipt',sourceType:'emergency-receipt-cash'}),'receipt-result');}
  if(mr.throw)throw Error('original-failure');
  game.inventoryByStoreID.store.materials.noodles.lots[0].bookValue-=1;
  return mr;
 }};
 return {g,modules:{supply,finance}};
}
test('observer delegates once and restores exact original functions',()=>{
 const {g,modules}=hooks(),a=modules.supply.applyConstraint,f=modules.finance.event;
 const obs=install(modules,'store'),result={totalCostOfSales:1,receipt:true};
 assert.equal(modules.supply.applyConstraint(g,{id:'store'},result,modules.finance),result);
 const trace=obs.snapshot();assert.equal(trace.length,1);
 assert.equal(trace[0].before[0].bookValue,100);
 assert.equal(trace[0].consumptionOpening[0].bookValue,102);
 assert.equal(trace[0].after[0].bookValue,101);
 trace[0].after[0].bookValue=0;assert.equal(obs.snapshot()[0].after[0].bookValue,101);
 obs.restore();obs.restore();assert.equal(modules.supply.applyConstraint,a);assert.equal(modules.finance.event,f);
});
test('original throw propagates without a completed observation',()=>{
 const {g,modules}=hooks(),obs=install(modules,'store');
 assert.throws(()=>modules.supply.applyConstraint(g,{id:'store'},{throw:true},modules.finance),/original-failure/);
 assert.deepEqual(obs.snapshot(),[]);obs.restore();
});
test('restoration refuses to overwrite another observer',()=>{
 const {modules}=hooks(),obs=install(modules,'store');modules.finance.event=()=>{};
 assert.throws(()=>obs.restore(),/observation-hook-replaced/);
});
test('missing harness hooks cannot silently disable tracing',()=>assert.throws(()=>install({},'store'),/missing-observation-hooks/));
console.log('SPIKE-8G boundary observation: '+count+' tests PASS; mock contracts only.');
