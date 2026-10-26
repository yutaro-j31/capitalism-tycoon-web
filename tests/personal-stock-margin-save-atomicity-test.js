'use strict';
// P3-4 family safety: exported margin liquidation/weekly processing use the installed transaction.
const assert=require('node:assert/strict');
const {fixture,invoke,snapshot,economic,SETTLEMENT}=require('./fixtures/personal-stock-margin-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
function command(s){return s.game.runTransaction(()=>!!invoke(s));}
function success(before,after,s){
 for(const key of ['companyCash','companyDebt','companyStocks','finance','simulationRng','sharesOut','founderShares','treasuryBuybackShares'])assert.deepEqual(after[key],before[key],`${key}: company/issuer/RNG unchanged`);
 const interest=s.variant==='liquidate'?0:1000*(s.variant==='interest'?1:10);
 assert.equal(after.personalMarginLoan.interestCapitalized,before.personalMarginLoan.interestCapitalized+interest);
 if(s.variant==='interest'){
  assert.equal(after.personalMarginLoan.balance,1000000+interest);assert.deepEqual(after.personalStocks,before.personalStocks);assert.deepEqual(after.market,before.market);assert.equal(after.personalCash,0);assert.equal(after.personalDebt,before.personalDebt);
 }else{
  for(const id of ['CPTY','EXT']){
   assert.deepEqual(before.personalStocks[id],{qty:20000,avg:1000},'pinned pre-command lot');
   assert.equal(before.market.find(x=>x.id===id).price,100);assert.equal(before.market.find(x=>x.id===id).issuedShares,1000000);
  }
  const raised=SETTLEMENT.raised;
  assert.equal(after.realizedPersonalStockPL-before.realizedPersonalStockPL,SETTLEMENT.realizedPL,'pinned realized P&L');
  assert.equal(after.personalMarginLoan.balance,0);assert.equal(after.personalMarginLoan.liquidatedCount,1);
  assert.equal(after.personalDebt-before.personalDebt,before.personalMarginLoan.balance+interest-raised);
  assert.equal(after.personalCash,0);assert.equal(Object.keys(after.personalStocks).length,0,'all lots sold once');
  for(const stock of after.market.filter(x=>['CPTY','EXT'].includes(x.id))){assert.equal(stock.price,SETTLEMENT.priceAfter,'pinned price impact');assert.equal(stock.marketCap,SETTLEMENT.marketCapAfter);}
 }
 assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(after))).ok,true);
}
const harness=makeTransactionFaultCase({name:'margin',fixture,command,snapshot,economic,expectSuccess:success});
(async()=>{
 // Raw helpers intentionally rely on the enclosing command/week transaction.
 await harness.rejected('liquidate','save-false');
 for(const variant of ['liquidate','weekly','interest']){
  for(const fault of FAULT_KINDS){if(fault==='notify'&&variant==='interest')continue;await harness.rejected(variant,fault);}
  for(const fault of ['save-false','save-throw'])for(const options of [{nested:true},{pending:true}])await harness.rejected(variant,fault,options);
  const s=await fixture(variant),before=snapshot(s.game);let saves=0;const save=s.game.save;
  s.game.save=function(...args){saves++;return save.apply(this,args);};
  let settlement;const result=s.game.runTransaction(()=>{settlement=invoke(s);return !!settlement;});assert.ok(result);if(variant!=='interest'){assert.equal(settlement.raised,SETTLEMENT.raised);assert.equal(settlement.repaid,SETTLEMENT.raised);}assert.equal(saves,1,'one outer commit');success(before,snapshot(s.game),s);await s.backend.flush();await harness.loaded(s,s.game.g);
  const stable=snapshot(s.game),bytes=s.backend.readSync(s.key),count=saves;
  assert.deepEqual(s.variant==='liquidate'?JSON.parse(JSON.stringify(invoke(s))):invoke(s),s.variant==='liquidate'?{raised:0,repaid:0,shortfall:0}:null);
  assert.deepEqual(snapshot(s.game),stable,'repeated call is a no-op');assert.equal(saves,count);assert.equal(s.backend.readSync(s.key),bytes);
 }
 // The installed weekly caller remains inside one outer transaction, not one save per lot.
 const s=await fixture('weekly'),before=snapshot(s.game);let saves=0;const save=s.game.save;s.game.save=function(...args){saves++;return save.apply(this,args);};
 assert.ok(s.game.runTransaction(()=>invoke(s)));assert.equal(saves,1);success(before,snapshot(s.game),s);
 // The real canonical advanceWeek caller reaches the margin helper and owns the commit.
 for(const kind of ['saved','save-throw']){
  const full=makeTransactionFaultCase({name:'canonical margin week',fixture:async()=>{const s=await fixture('weekly');const module=s.modules.personalStockMargin;s.marginCalls=0;s.modules.personalStockMargin={...module,processWeek(e){s.marginCalls++;return module.processWeek(e);}};return s;},
   command:s=>{const calls=s.marginCalls;try{return s.game.advanceWeek(false);}finally{assert.ok(s.marginCalls>calls,'canonical week reaches the installed margin writer before fault');}},snapshot,economic,expectSuccess:(before,after,s)=>{assert.ok(s.marginCalls>0);assert.equal(after.personalMarginLoan.liquidatedCount,1);assert.equal(after.personalMarginLoan.balance,0);assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(after))).ok,true);}});
  await full.rejected('weekly',kind);
 }
 // Canonical weeks emit 'week', not the scoped command's 'change'. Inject that actual event.
 {
  const s=await fixture('weekly'),before=snapshot(s.game),bytes=s.backend.readSync(s.key),emit=s.game.emit;let hits=0;
  s.game.emit=function(type,...args){if(type==='week'){assert.equal(this.g.personalMarginLoan.liquidatedCount,1);hits++;throw Error('canonical margin week notification threw');}return emit.call(this,type,...args);};
  assert.throws(()=>s.game.advanceWeek(false),/canonical margin week notification threw/);s.game.emit=emit;assert.equal(hits,1);
  assert.deepEqual(snapshot(s.game),before);assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.ctx.__localStorageData.get(s.key),bytes);
  await s.backend.flush();assert.equal(s.durable.get(s.key),bytes);await harness.loaded(s,before);
  assert.equal(s.game.advanceWeek(false),true);assert.equal(s.game.g.personalMarginLoan.liquidatedCount,1);await s.backend.flush();await harness.loaded(s,s.game.g);
  const control=await fixture('weekly');assert.equal(control.game.advanceWeek(false),true);
  assert.deepEqual(economic(s.game.g),economic(control.game.g),'rollback + retry reproduces the uninterrupted same-seed week');
 }
 // Reproduce the review's coherent half-proceeds mutant in an isolated loaded module.
 {
  const fs=require('node:fs'),vm=require('node:vm'),s=await fixture('weekly'),before=snapshot(s.game);
  const source=fs.readFileSync('js/personal-stock-margin.js','utf8'),needle='const proceeds=quote.cashAmount;';
  assert.equal(source.split(needle).length,2,'mutation target is unique');delete s.modules.personalStockMargin;
  vm.runInContext(source.replace(needle,'const proceeds=quote.cashAmount/2;'),s.ctx);s.margin=s.modules.personalStockMargin;
  assert.equal(command(s),true);const after=snapshot(s.game);
  const circularRaised=after.realizedPersonalStockPL-before.realizedPersonalStockPL+40000000;
  assert.equal(after.personalDebt-before.personalDebt,10010000-circularRaised,'the old output-derived identity still accepts this mutant');
  assert.throws(()=>success(before,after,s),/pinned realized P&L/,'independent pins reject half proceeds');
 }
 // Negative control: disable rollback only in a fresh test fixture; the oracle must reject it.
 const broken=makeTransactionFaultCase({name:'broken margin rollback',fixture:async()=>{const s=await fixture('weekly');s.game.restoreTransactionSnapshot=()=>{};return s;},command,snapshot,economic,expectSuccess:success});
 await assert.rejects(broken.rejected('weekly','save-false'),/full live rollback/);
 console.log('Personal stock margin enclosing-transaction fault evidence PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
