'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {scenario,economic,snapshot,assertSplit}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase}=require('./helpers/transaction-fault-case');
const parity=[];
const faultCase=makeTransactionFaultCase({
 name:'split',
 fixture:family=>scenario(family),
 command:s=>s.game.stockSplit(s.stockID,2),
 snapshot,economic,
 expectSuccess:(before,after,s)=>assertSplit(before,after,s.stockID,2),
 label:(family,kind,{pending,nested})=>`stockSplit ${family}/${kind}/pending=${pending}/nested=${nested}`,
});
const loaded=faultCase.loaded;
const rejected=(family,kind,pending=false,nested=false)=>faultCase.rejected(family,kind,{pending,nested});
async function normal(family,legacy){
 const s=await scenario(family,legacy),events=[],emit=s.game.emit,save=s.game.save;let saves=0;
 s.game.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};s.game.save=function(...args){if(!this.inTransaction())saves++;return save.apply(this,args);};
 for(const ratio of [2,2,3]){const before=snapshot(s.game),draws=s.host.draws;assert.equal(s.game.stockSplit(s.stockID,ratio),true);assertSplit(before,snapshot(s.game),s.stockID,ratio);assert.equal(s.host.draws,draws);}
 assert.equal(saves,3);assert.deepEqual(events,['notify','saved','change','notify','saved','change','notify','saved','change']);
 const before=snapshot(s.game),bytes=s.backend.readSync(s.key);
 for(const [id,ratio] of [[s.stockID,1],[s.stockID,0],['MISSING',2]])assert.equal(s.game.stockSplit(id,ratio),false);
 assert.deepEqual(snapshot(s.game),before);assert.equal(s.backend.readSync(s.key),bytes);assert.equal(saves,3);
 for(const account of ['company','personal']){assert.equal(s.game.buyStock(s.stockID,1000,account),true);assert.equal(s.game.sellStock(s.stockID,1000,account),true);}
 assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true);await s.backend.flush();await loaded(s,s.game.g);
 const stored=JSON.parse(s.backend.readSync(s.key));delete stored.lastSaveDate;
 parity.push({family,legacy,state:economic(s.game.g),stored,events,saves,draws:s.host.draws});
 console.log(`stockSplit ${family}/legacy=${legacy} repeat/trades/history/cash/ledger/RNG/reload PASS`);
}
(async()=>{
 for(const family of ['own','external']){
  if(!process.env.STOCK_SPLIT_PARITY_ONLY){
   for(const nested of [false,true])for(const kind of ['save-false','save-before-throw','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify'])await rejected(family,kind,false,nested);
   for(const kind of ['save-false','save-throw','saved','change'])await rejected(family,kind,true);
   const s=await scenario(family);s.game.g.publicCompany=false;const before=snapshot(s.game);assert.equal(s.game.stockSplit('CPTY',2),false);assert.deepEqual(snapshot(s.game),before);
  }
  for(const legacy of [false,true])await normal(family,legacy);
 }
 if(process.env.STOCK_SPLIT_PARITY_OUTPUT)fs.writeFileSync(process.env.STOCK_SPLIT_PARITY_OUTPUT,JSON.stringify(parity));
 console.log('Stock split save atomicity PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
