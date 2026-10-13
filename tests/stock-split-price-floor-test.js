'use strict';
// A stock split must not push the price below the weekly market floor (updateMarket clamps every
// listed price with Math.max(10, ...)). Rejections use the existing fail() contract and leave the
// live state, mirror, IDB cache, durable store, saveSequence and RNG untouched.
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {scenario,economic,snapshot,assertSplit}=require('./fixtures/stock-split-atomicity');
const {indexedDBFor}=require('./fixtures/pe-fund-acquisition-faults');
const {makeTransactionFaultCase,FAULT_KINDS}=require('./helpers/transaction-fault-case');
const FLOOR=10;
// saveSequence is storage metadata (#726): it exists only in the stored payload, never in live state.
const sequenceOf=s=>Number(/"saveSequence":(\d+)/.exec(s.backend.readSync(s.key)||'')?.[1]);
async function priced(family,{price=100,ownStockPrice}={}){
 const s=await scenario(family),g=s.game.g;
 for(const stock of g.market.filter(x=>x.id==='CPTY'||x.id==='EXT')){stock.price=price;stock.previous=price;stock.marketCap=price*stock.issuedShares;}
 g.stockPrice=ownStockPrice??price;
 assert.equal(s.game.save(),true);await s.backend.flush();
 const events=[];const emit=s.game.emit;s.game.emit=function(type='change',...args){events.push({type,severity:args[0]?.severity,message:args[0]?.message});return emit.call(this,type,...args);};
 return {...s,events};
}
async function loaded(s,expected){
 const wanted=economic(new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(expected))).g);
 assert.deepEqual(economic(s.engineModule.TycoonEngine.load().g),wanted,'production reload');
 const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
 assert.deepEqual(economic(fresh.engineModule.TycoonEngine.load().g),wanted,'fresh durable-only hydration');await fresh.modules.saveStorageIDB.flush();
}
// Full no-op proof for a rejected split: same live state, no save, no put, no RNG, one fail() notify.
async function assertRejected(s,stockID,ratio,label,{notify=true}={}){
 await s.backend.flush();
 const before=snapshot(s.game),bytes=s.backend.readSync(s.key),mirror=s.ctx.__localStorageData.get(s.key),durable=s.durable.get(s.key),puts=s.control.attempts.length,draws=s.host.draws,sequence=sequenceOf(s),events=s.events.length;
 let result,error;try{result=s.game.stockSplit(stockID,ratio);}catch(ex){error=ex;}
 assert.equal(error,undefined,`${label}: rejection must not throw`);assert.equal(result,false,`${label}: rejection returns false`);
 assert.deepEqual(snapshot(s.game),before,`${label}: no share/price/holding/dividend/history/cash/ledger/RNG change`);
 assert.ok(Number.isSafeInteger(sequence));assert.equal(sequenceOf(s),sequence,`${label}: saveSequence unchanged`);assert.equal(s.host.draws,draws,`${label}: RNG unchanged`);
 assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.ctx.__localStorageData.get(s.key),mirror);
 await s.backend.flush();assert.equal(s.durable.get(s.key),durable,`${label}: nothing persisted`);assert.equal(s.control.attempts.length,puts,`${label}: no IDB put`);
 const emitted=s.events.slice(events);
 if(notify)assert.deepEqual(emitted.map(e=>[e.type,e.severity]),[['notify','error']],`${label}: existing fail() contract`);
 else assert.deepEqual(emitted,[],`${label}: silent legacy rejection`);
 await loaded(s,before);
 return emitted[0]?.message;
}
function assertAccepted(s,stockID,ratio,label){
 const before=snapshot(s.game),draws=s.host.draws,sequence=sequenceOf(s);
 assert.equal(s.game.stockSplit(stockID,ratio),true,`${label}: split accepted`);
 const after=snapshot(s.game);assertSplit(before,after,stockID,ratio);
 assert.equal(s.host.draws,draws);assert.ok(sequenceOf(s)>sequence,`${label}: committed split saves`);
 const stock=after.market.find(x=>x.id===stockID);assert.ok(stock.price>=FLOOR,`${label}: post-split price respects floor`);
 for(const key of ['personalStocks','companyStocks'])assert.ok(Number.isSafeInteger(after[key][stockID].qty),`${label}: ${key} qty integral`);
 assert.ok(Number.isSafeInteger(stock.issuedShares),`${label}: issued shares integral`);
 if(stockID==='CPTY')for(const key of ['sharesOut','founderShares','treasuryBuybackShares'])assert.ok(Number.isSafeInteger(after[key]),`${label}: ${key} integral`);
 return after;
}
async function weeklyFloorIsTen(){
 // 1. The weekly market floor really is 10 for ordinary, microcap and own listed stocks.
 const s=await priced('own',{price:10.5});const g=s.game.g;
 const ext=s.game.stock('EXT'),own=s.game.stock('CPTY');
 for(const stock of [ext,own]){stock.trend=-.9;stock.volatility=0;}
 const micro={...JSON.parse(JSON.stringify(ext)),id:'MCFLOOR',name:'MCFLOOR',microcap:true,trend:-.9,volatility:0};g.market.push(micro);
 g.lastReport={...(g.lastReport||{}),profit:0};
 s.game.updateMarket();
 for(const stock of [ext,own,micro])assert.equal(stock.price,FLOOR,`${stock.id} weekly floor is exactly 10`);
 assert.equal(g.stockPrice,FLOOR);
 console.log('weekly updateMarket floor = 10 (ordinary / microcap / own) PASS');
}
async function boundaries(family){
 const id=family==='own'?'CPTY':'EXT';
 // 2. exactly 10 is allowed, 3. just below 10 is rejected (1:2 and 1:3).
 for(const [price,ratio,ok] of [[20,2,true],[19.98,2,false],[30,3,true],[29.99,3,false]]){
  const s=await priced(family,{price}),label=`${family} ${price}/1:${ratio}`;
  if(ok){const after=assertAccepted(s,id,ratio,label);assert.equal(after.market.find(x=>x.id===id).price,FLOOR);await s.backend.flush();await loaded(s,s.game.g);}
  else{const message=await assertRejected(s,id,ratio,label);assert.match(message,/10/);}
 }
 // 4. consecutive splits reach the floor, then the next one is rejected; retry with a legal ratio is not possible.
 const s=await priced(family,{price:40});
 assertAccepted(s,id,2,`${family} 40->20`);assertAccepted(s,id,2,`${family} 20->10`);
 await assertRejected(s,id,2,`${family} 10->5 rejected`);
 const history=snapshot(s.game).stockSplitHistory.filter(x=>x.stockID===id);
 assert.deepEqual(history.map(x=>x.ratio),[2,2],'5. split history only records accepted splits');
 const prices=s.game.stock(id).priceHistory.map(x=>x.price);assert.ok(prices.every(p=>p>=FLOOR/4),'price history rescaled once per accepted split');
 await s.backend.flush();await loaded(s,s.game.g);
 // 6. weekly price processing after a split at the floor keeps price >= floor and market cap consistent.
 assert.notEqual(s.game.advanceWeek(false),false);
 const stock=s.game.stock(id);assert.ok(stock.price>=FLOOR);assert.equal(stock.marketCap,stock.price*stock.issuedShares);
 assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true);
 console.log(`stockSplit price floor ${family} boundaries/consecutive/history/weekly PASS`);
}
async function ownPriceSources(){
 // 7. own company: neither stock.price nor g.stockPrice may be used to dodge the floor.
 for(const [marketPrice,ownStockPrice] of [[25,15],[15,25]]){
  const s=await priced('own',{price:marketPrice,ownStockPrice});
  await assertRejected(s,'CPTY',2,`own market=${marketPrice} stockPrice=${ownStockPrice}`);
 }
 const s=await priced('own',{price:25,ownStockPrice:21});assertAccepted(s,'CPTY',2,'own both sources >= floor');
 console.log('stockSplit price floor own stock.price/g.stockPrice consistency PASS');
}
async function invalidRatios(){
 // 8. invalid ratios (non-number, non-finite, non-integer, <2, overflow) are rejected without any change.
 const cases=[['zero',0,true],['one',1,true],['negative',-2,true],['NaN',NaN,true],['Infinity',Infinity,true],['-Infinity',-Infinity,true],
  ['string','2',true],['null',null,true],['object',{},true],['boolean',true,true],['non-integer',2.5,true],['huge',1e20,true],['unsafe',Number.MAX_SAFE_INTEGER+1,true]];
 for(const family of ['own','external']){
  const s=await priced(family,{price:1e12}),id=family==='own'?'CPTY':'EXT';
  for(const [label,ratio,notify] of cases)await assertRejected(s,id,ratio,`${family} ratio ${label}`,{notify});
  // A share-count overflow is rejected even when the price would stay above the floor.
  const overflow=Math.ceil(Number.MAX_SAFE_INTEGER/s.game.stock(id).issuedShares)+1;
  await assertRejected(s,id,overflow,`${family} share-count overflow`);
  assertAccepted(s,id,2,`${family} legal ratio still accepted`);
 }
 const s=await priced('external');await assertRejected(s,'MISSING',2,'missing stock',{notify:false});
 console.log('stockSplit invalid ratio / overflow rejection PASS');
}
async function dividendCoexistence(){
 // The floor and the dividend rescale (#951) apply together: an accepted split rescales dividends,
 // a rejected one leaves every per-share term untouched.
 for(const family of ['own','external']){
  const s=await priced(family,{price:20}),id=family==='own'?'CPTY':'EXT';
  s.game.stock('EXT').dividendPerShare=30;assert.equal(s.game.setDividend(6),true);await s.backend.flush();
  const before=snapshot(s.game);
  assertAccepted(s,id,2,`${family} floor split with dividends`);
  const after=snapshot(s.game);
  assert.equal(after.market.find(x=>x.id===id).dividendPerShare,before.market.find(x=>x.id===id).dividendPerShare/2);
  assert.equal(after.dividendPerShare,before.dividendPerShare/(family==='own'?2:1));
  await assertRejected(s,id,2,`${family} below floor keeps rescaled dividends`);
  assert.equal(s.game.stock(id).dividendPerShare,after.market.find(x=>x.id===id).dividendPerShare);
 }
 console.log('stockSplit price floor coexists with dividend rescale PASS');
}
async function faultRollbackAtFloor(){
 // A split that lands exactly on the floor keeps the full save-failure contract (shared harness).
 for(const family of ['own','external']){
  const id=family==='own'?'CPTY':'EXT';
  const h=makeTransactionFaultCase({name:'split',fixture:()=>priced(family,{price:20}),command:s=>s.game.stockSplit(id,2),snapshot,economic,
   expectSuccess:(before,after)=>{assertSplit(before,after,id,2);assert.equal(after.market.find(x=>x.id===id).price,FLOOR);},
   label:(v,kind,{pending,nested})=>`stockSplit price floor ${family} at-floor ${kind}/pending=${pending}/nested=${nested}`});
  for(const kind of FAULT_KINDS)await h.rejected(family,kind);
  await h.rejected(family,'save-false',{nested:true});await h.rejected(family,'save-throw',{pending:true});
 }
}
async function deterministic(){
 // 9. deterministic replay: identical inputs produce identical saves, including rejected attempts.
 const run=async()=>{const s=await priced('external',{price:40});for(const r of [2,2,2,3,NaN,2.5])s.game.stockSplit('EXT',r);await s.backend.flush();const stored=JSON.parse(s.backend.readSync(s.key));delete stored.lastSaveDate;return {state:economic(s.game.g),stored,draws:s.host.draws};};
 assert.deepEqual(await run(),await run());
 console.log('stockSplit price floor deterministic replay PASS');
}
(async()=>{
 await weeklyFloorIsTen();
 for(const family of ['own','external'])await boundaries(family);
 await ownPriceSources();
 await invalidRatios();
 await deterministic();
 await dividendCoexistence();
 await faultRollbackAtFloor();
 console.log('Stock split price floor PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
