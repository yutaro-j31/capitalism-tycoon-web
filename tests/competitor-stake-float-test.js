'use strict';
// D4 (Track A, Owner-approved rule): a competitor buys player-company shares from the external float only, never
// from the founder, up to the 49% aggregate cap, in whole shares. A desired quantity above what is available fills
// partially; the cash paid is filled × price; a zero fill changes nothing. The aggregate competitor ratio (of
// issued − treasury) and the buyer's own holding move by the same filled quantity; founder + competitor + external
// stays 1. The weekly path (updateCompetitors) draws exactly the same RNG as before; no existing save is repaired.
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const EPS=1e-9;
function engine(seed=97531,setup=()=>{}){
 let state=seed;const host={draws:0};
 const s=loadGame({headless:true,random:()=>{host.draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}});
 const e=new s.engineModule.TycoonEngine(s.engineModule.createInitialState({configured:true}));
 Object.assign(e.g,{publicCompany:true,stockPrice:1000,sharesOut:1000000,treasuryBuybackShares:50000,founderShares:700000,competitorOwnedRatio:.1});
 setup(e.g);e.updateOwnershipRatios();for(const c of e.g.competitors)c.cash=Math.max(finite(c.cash),1e9);
 e.save=()=>true;return {...s,e,host};
}
const finite=v=>Number.isFinite(Number(v))?Number(v):0;
// Competitor cash is a float; compare money to a tenth of a yen (floating-point subtraction only).
const money=(a,b,label)=>assert.ok(Math.abs(a-b)<.1,`${label}: ${a} != ${b}`);
const outstanding=g=>g.sharesOut-g.treasuryBuybackShares;
const sum=g=>g.founderOwnershipRatio+g.competitorOwnedRatio+g.externalShareholderRatio;
function buy(s,c,label,expectFilled){
 const g=s.e.g,o=outstanding(g),held=g.competitorOwnedRatio*o,cash=c.cash,own=finite(c.ownedPlayerShares),founder=g.founderShares,rng=JSON.stringify(g.simulationRng);
 const filled=s.e.buyCompetitorStake(c);s.e.updateOwnershipRatios();
 assert.equal(filled,expectFilled,`${label}: filled`);
 money(cash-c.cash,filled*g.stockPrice,`${label}: cash paid = filled × price`);if(!filled)assert.equal(c.cash,cash,`${label}: zero fill leaves cash exactly`);
 assert.equal(c.ownedPlayerShares,own+filled,`${label}: buyer holding +filled`);
 assert.ok(Math.abs(g.competitorOwnedRatio*o-(held+filled))<EPS*o,`${label}: aggregate ratio +filled/outstanding`);
 assert.equal(g.founderShares,founder,`${label}: founder shares untouched`);
 assert.ok(Math.abs(sum(g)-1)<EPS,`${label}: ratios sum to 1`);
 assert.ok(g.competitorOwnedRatio<=.49+EPS,`${label}: 49% cap`);
 assert.equal(JSON.stringify(g.simulationRng),rng,`${label}: no RNG drawn`);
}
(async()=>{
 // 1. The purchase rule on the installed engine method.
 {const s=engine(),c=s.e.g.competitors[0];buy(s,c,'normal fill (5M / ¥1,000)',5000);}
 {const s=engine(97531,g=>{g.founderShares=850000;g.competitorOwnedRatio=.1;}),c=s.e.g.competitors[0];// float = 950k−850k−95k = 5,000
  c.cash=1e9;buy(s,c,'float-limited partial fill',5000);buy(s,c,'float exhausted: zero fill',0);}
 {const s=engine(97531,g=>{g.founderShares=850000;g.competitorOwnedRatio=.1;g.stockPrice=2500;}),c=s.e.g.competitors[0];// desired 2,000; float 5,000
  buy(s,c,'desired below float',2000);buy(s,c,'desired below float again',2000);buy(s,c,'remaining float 1,000 fills partially',1000);buy(s,c,'then nothing',0);}
 {const s=engine(97531,g=>{g.founderShares=480000;g.competitorOwnedRatio=.48;}),c=s.e.g.competitors[0];// cap room = 0.49×950k − 456k = 9,500
  buy(s,c,'cap room above desired',5000);buy(s,c,'cap-limited partial fill',4500);buy(s,c,'at the cap: zero fill',0);}
 {const s=engine(97531,g=>{g.stockPrice=3333;}),c=s.e.g.competitors[0];buy(s,c,'whole shares (5M / 3,333 → 1,500)',1500);}
 {const s=engine(),c=s.e.g.competitors[0];c.cash=4_200;buy(s,c,'cash buys 0 whole shares at ¥1,000 (10% of 4,200)',0);}
 {const s=engine(),g=s.e.g;g.publicCompany=true;const c=g.competitors[0];delete c.ownedPlayerShares;buy(s,c,'legacy competitor without ownedPlayerShares',5000);}
 // Own-ticker shares the founder bought personally are founder beneficial holding, not float (P3-2 reconciliation).
 {const s=engine(97531,g=>{g.founderShares=600000;g.competitorOwnedRatio=0;g.treasuryBuybackShares=0;g.ticker='CPTY';g.personalStocks={CPTY:{qty:396000,avg:1000}};}),c=s.e.g.competitors[0];
  buy(s,c,'float = 1,000,000 − 600,000 − 396,000 personal = 4,000',4000);buy(s,c,'then nothing',0);}
 // Unrelated third-party portfolio holdings (unadopted aliases of other issuers) do not block the purchase.
 {const s=engine(97531,g=>{g.ticker='CPTY';g.personalStocks={EXT:{qty:2000,avg:900}};g.companyStocks={EXT:{qty:3000,avg:900}};}),c=s.e.g.competitors[0];
  assert.ok(s.modules.economicReadModel.ownershipReconciliation(s.e.g).unresolvedAliases.length>0,'fixture has third-party aliases');
  buy(s,c,'third-party holdings only: normal fill',5000);}
 // Own-ticker shares held by the company are an unadopted alias in the reconciliation: unknown ownership, zero fill.
 {const s=engine(97531,g=>{g.ticker='CPTY';g.companyStocks={CPTY:{qty:1000,avg:1000}};}),c=s.e.g.competitors[0],before=JSON.stringify(s.e.g);
  assert.equal(s.e.buyCompetitorStake(c),0,'company own-ticker alias: zero fill');assert.equal(JSON.stringify(s.e.g),before);}
 {const s=engine(97531,g=>{g.founderShares=600000;g.competitorOwnedRatio=0;g.treasuryBuybackShares=0;g.ticker='CPTY';g.personalStocks={CPTY:{qty:400000,avg:1000}};}),c=s.e.g.competitors[0],before=JSON.stringify(s.e.g);
  assert.equal(s.e.buyCompetitorStake(c),0,'founder beneficial 100%: no float');assert.equal(JSON.stringify(s.e.g),before);}
 for(const price of [0,NaN,-5]){const s=engine(97531,g=>{g.stockPrice=price;}),c=s.e.g.competitors[0],before=JSON.stringify(s.e.g);
  assert.equal(s.e.buyCompetitorStake(c),0,`invalid price ${price}: zero fill`);assert.equal(JSON.stringify(s.e.g),before,`invalid price ${price}: nothing changes`);}
 // Malformed ownership evidence is unknown ownership: no purchase, nothing changes (no guessed float).
 for(const [label,mutate] of [['personal own-ticker qty not a number',g=>{g.ticker='CPTY';g.personalStocks={CPTY:{qty:'not-a-number',avg:1}};}],
  ['company own-ticker qty NaN',g=>{g.ticker='CPTY';g.companyStocks={CPTY:{qty:NaN,avg:1}};}],['negative personal own-ticker qty',g=>{g.ticker='CPTY';g.personalStocks={CPTY:{qty:-5,avg:1}};}],
  ['personal own-ticker holding with qty null',g=>{g.ticker='CPTY';g.personalStocks={CPTY:{qty:null,avg:1}};}],['company own-ticker holding without qty',g=>{g.ticker='CPTY';g.companyStocks={CPTY:{avg:1}};}],
  ['buyer named stake malformed',g=>{g.competitors[0].ownedPlayerShares='bad';}],['buyer named stake present null',g=>{g.competitors[0].ownedPlayerShares=null;}],['competitor ratio present null',g=>{g.competitorOwnedRatio=null;}],['buyer named stake negative',g=>{g.competitors[0].ownedPlayerShares=-1;}],
  ['missing ticker binding with a real own-ticker holding',g=>{g.personalStocks={CPTY:{qty:1000,avg:1}};g.ticker='';}],['ticker null',g=>{g.ticker=null;}],
  ['founderShares NaN',g=>{g.founderShares=NaN;}],['competitor ratio NaN',g=>{g.competitorOwnedRatio=NaN;}],['issued ≤ treasury',g=>{g.treasuryBuybackShares=g.sharesOut;}]]){
  const s=engine();mutate(s.e.g);const c=s.e.g.competitors[0],before=JSON.stringify(s.e.g);
  assert.equal(s.e.buyCompetitorStake(c),0,`${label}: zero fill`);assert.equal(JSON.stringify(s.e.g),before,`${label}: nothing changes`);}
 console.log('purchase rule: float only (founder incl. personal own-ticker, company own-ticker excluded), 49% cap, whole shares, partial fill, cash = filled × price, zero fill / invalid price no change PASS');

 // 2. A legacy save that is already broken (founder + competitor > 1) is not repaired and gets no new purchase.
 {const s=engine(97531,g=>{g.founderShares=900000;g.competitorOwnedRatio=.2;}),g=s.e.g,c=g.competitors[0],before=JSON.stringify(g);
  assert.equal(s.e.buyCompetitorStake(c),0);assert.equal(JSON.stringify(g),before,'no repair, no purchase');
  console.log('legacy founder + competitor > 1: no purchase and no automatic repair PASS');}

 // 3. Unattributed aggregate stake (e.g. raised by a hostile-offer decline) bounds the float; named holdings are not invented.
 {const s=engine(),g=s.e.g;g.inboundBuyoutOffers=[{id:'o1',status:'pending',hostile:true,bidderName:'Rival'}];
  assert.equal(s.e.declineInboundBuyoutOffer('o1'),true);const named=g.competitors.reduce((a,c)=>a+finite(c.ownedPlayerShares),0);
  assert.equal(named,0,'decline raises the aggregate ratio without named shares');const c=g.competitors[0];buy(s,c,'after a decline',5000);
  assert.equal(g.competitors.reduce((a,x)=>a+finite(x.ownedPlayerShares),0),5000,'only the filled purchase is attributed');
  console.log('decline-raised aggregate stake: float bounded by the aggregate, unattributed stake left unattributed PASS');}

 // 3b. Composite scenarios (Owner): issuance and a treasury buyback before a purchase keep the rule exact.
 {const s=engine(97531,g=>{g.founderShares=850000;g.competitorOwnedRatio=.1;}),g=s.e.g,c=g.competitors[0];
  // D3 share-swap issuance of 100,000 shares to external holders: founder/competitor diluted, float grows by 100,000.
  const before=s.modules.economicReadModel.ownershipReconciliation(g).securityClasses[0].unallocatedOutstandingQuantity-g.competitorOwnedRatio*outstanding(g);
  s.e.issueSharesToExternalHolders(100000);
  const after=s.modules.economicReadModel.ownershipReconciliation(g).securityClasses[0].unallocatedOutstandingQuantity-g.competitorOwnedRatio*outstanding(g);
  assert.ok(Math.abs(after-(before+100000))<1e-6,'issuance adds exactly the new shares to the float');assert.ok(Math.abs(sum(g)-1)<EPS);
  buy(s,c,'after a share-swap issuance',5000);
  console.log('composite: share-swap issuance → competitor purchase PASS');}
 {const s=engine(97531,g=>{g.founderShares=850000;g.competitorOwnedRatio=.1;g.companyCash=1e9;g.finance=undefined;}),g=s.e.g,c=g.competitors[0];
  g.finance=s.modules.finance.defaultFinanceState(g);const treasury=g.treasuryBuybackShares;
  assert.equal(s.e.buybackOwnShares(2_000_000),true,'production buyback');assert.ok(g.treasuryBuybackShares>treasury,'treasury grew');
  const r=s.modules.economicReadModel.ownershipReconciliation(g);assert.equal(r.ok,true);
  const float=Math.floor(r.securityClasses[0].unallocatedOutstandingQuantity-g.competitorOwnedRatio*outstanding(g));
  buy(s,c,'after a treasury buyback (float = reconciled unallocated − aggregate stake)',Math.max(0,Math.min(5000,float)));
  assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(g))).ok,true,'accounting valid after buyback + purchase');
  console.log(`composite: treasury buyback → competitor purchase (float ${float}) PASS`);}

 // 4. The production weekly path: every purchase obeys the rule; ratios stay 1 through advanceWeek; the RNG count per
 //    week is unchanged by the rule (the probability draw happens before the fill, exactly as before).
 const weekly=(seed,setup,weeks=120)=>{const s=engine(seed,setup),calls=[],base=s.e.buyCompetitorStake;
  s.e.buyCompetitorStake=function(c){const cash=c.cash,price=this.g.stockPrice,f=base.call(this,c);calls.push({paid:cash-c.cash,f,price});return f;};
  for(let w=0;w<weeks;w++){assert.notEqual(s.e.advanceWeek(false),false,`week ${w}`);assert.ok(Math.abs(sum(s.e.g)-1)<EPS,`week ${w}: ratios sum to 1`);assert.ok(s.e.g.competitorOwnedRatio<=.49+EPS);}
  for(const x of calls)money(x.paid,x.f*x.price,'weekly purchase cash = filled × price');
  return {s,calls};};
 {const {s,calls}=weekly(97531,g=>{g.founderShares=850000;g.competitorOwnedRatio=.1;});
  assert.ok(calls.length>0,'the weekly path reached the purchase');assert.ok(calls.reduce((a,x)=>a+x.f,0)<=5000,'float bound held');
  assert.ok(s.e.g.founderShares===850000,'founder never sells');
  console.log(`weekly path: ${calls.length} purchase attempts over 120 weeks, filled ${calls.reduce((a,x)=>a+x.f,0)} shares, ratios sum 1 every week PASS`);}
 // Determinism: two identical runs give identical states and RNG.
 {const a=weekly(424242,undefined,60),b=weekly(424242,undefined,60),eco=g=>{const c=JSON.parse(JSON.stringify(g));delete c.lastSaveDate;delete c.saveSequence;return JSON.stringify(c);};
  assert.equal(eco(a.s.e.g),eco(b.s.e.g),'deterministic');assert.equal(a.s.host.draws,b.s.host.draws);
  // Reload equals live (ratios, holdings).
  const g=a.s.e.g,r=new a.s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(g))).g,k=x=>JSON.stringify([x.competitorOwnedRatio,x.founderOwnershipRatio,x.externalShareholderRatio,x.competitors.map(c=>[c.id,c.ownedPlayerShares,c.cash])]);
  assert.equal(k(r),k(g),'reload equals live');
  assert.equal(a.s.modules.finance.validate(JSON.parse(JSON.stringify(g))).ok,true,'player accounting valid (competitor cash is not on the player ledger)');
  console.log('weekly path deterministic, reload equals live, accounting valid PASS');}
 // P3-4 W-WEEK-COMPETITOR: real persisted week, unlike engine() above whose save is stubbed.
 const {scenario,snapshot,economic}=require('./fixtures/stock-split-atomicity');
 const {injectFault,SOFT_FAILURES}=require('./helpers/transaction-fault-case');
 const {indexedDBFor}=require('./fixtures/pe-fund-acquisition-faults');
 async function persistedWeek(){
  const s=await scenario('own'),g=s.game.g;delete g.companyStocks.CPTY;
  Object.assign(g,{founderShares:700000,treasuryBuybackShares:50000,competitorOwnedRatio:.1});
  for(const c of g.competitors)c.cash=1e9;
  g.finance=s.modules.finance.defaultFinanceState(g);s.game.updateOwnershipRatios();s.modules.simulationRng.reseed(g,225);
  s.game=new s.engineModule.TycoonEngine(snapshot(s.game));
  assert.equal(s.game.save(),true);await s.backend.flush();return s;
 }
 async function restored(s,expected){
  const wanted=economic(new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(expected))).g);
  assert.deepEqual(economic(s.engineModule.TycoonEngine.load().g),wanted,'production load preserves weekly ownership/accounting');
  const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
  assert.deepEqual(economic(fresh.engineModule.TycoonEngine.load().g),wanted,'fresh durable-only weekly hydration');
 }
 let reference;
 // Keep the original actual-save cases; also cover storage admission and post-save dispatch.
 // notify can precede the purchase during the week and requires a separate call-site witness.
 // The outer transaction dispatches `week`, not the helper harness's generic `change` event.
 const cases=['normal','save-false','save-throw','save-before-throw','mirror','enqueue-false','enqueue-throw','saved','week'].map(mode=>({mode,pending:false}));
 cases.push({mode:'save-false',pending:true},{mode:'save-throw',pending:true});
 for(const {mode,pending} of cases){
  const s=await persistedWeek(),game=s.game;
  if(pending){
   s.control.holdPut=true;assert.equal(game.save(),true);
   for(let i=0;i<100&&!s.control.release;i++)await new Promise(resolve=>setImmediate(resolve));
   assert.equal(typeof s.control.release,'function','predecessor durable put is really in flight');
  }
  const prior=snapshot(game),bytes=s.backend.readSync(s.key),durable=s.durable.get(s.key),puts=s.control.attempts.length,draws=s.host.draws,records=[];
  const base=game.buyCompetitorStake;
  game.buyCompetitorStake=function(c){
   assert.equal(this.inTransaction(),true,'actual weekly caller owns the transaction');assert.match(new Error().stack,/updateCompetitors/);
   const cash=c.cash,own=finite(c.ownedPlayerShares),ratio=this.g.competitorOwnedRatio,o=outstanding(this.g),price=this.g.stockPrice;
   const before=snapshot(this),filled=base.call(this,c);
   assert.equal(c.id,'competitor-1');assert.equal(filled,4988,'seed225 must actually purchase the pinned quantity');
   assert.equal(c.ownedPlayerShares,own+4988);money(cash-c.cash,4988*price,'weekly helper NPC charge');
   assert.ok(Math.abs((this.g.competitorOwnedRatio-ratio)*o-4988)<1e-6,'aggregate and named quantity increase together');
   for(const key of ['sharesOut','founderShares','treasuryBuybackShares','companyCash','personalCash','companyDebt','personalDebt','companyStocks','personalStocks','finance','simulationRng'])
    assert.deepEqual(snapshot(this)[key],before[key],'NPC purchase alone preserves player '+key);
   records.push({id:c.id,filled,price});return filled;
  };
  let injection;
  if(mode==='week'){
   const emit=game.emit;let hits=0;
   game.emit=function(type,...args){if(type==='week'&&!this.inTransaction()){hits++;throw new Error('weekly event threw');}return emit.call(this,type,...args);};
   injection={hits:()=>hits,restore(){game.emit=emit;}};
  }else injection=mode==='normal'?null:injectFault(s,mode);
  try{
   if(mode==='normal'||SOFT_FAILURES.includes(mode))assert.equal(game.advanceWeek(false),mode==='normal');
   else assert.throws(()=>game.advanceWeek(false),mode==='save-throw'?/save accepted then threw/:/threw/);
  }finally{injection?.restore();}
  assert.equal(records.length,1,'the seeded week really reached one purchase');assert.equal(s.host.draws,draws,'weekly simulation draws no host RNG');
  if(injection){
   assert.ok(injection.hits()>0);assert.deepEqual(snapshot(game),prior,'whole rejected week including NPC cash/shares/player ledger/RNG restored');
   assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.ctx.localStorage.getItem(s.key),bytes);
   assert.equal(s.durable.get(s.key),durable,'failed week leaves the prior durable version intact while pending');
   s.control.release?.();await s.backend.flush();
   assert.equal(s.durable.get(s.key),bytes);assert.equal(s.control.attempts.length,puts,'failed weekly put never starts');await restored(s,prior);
   records.length=0;assert.equal(game.advanceWeek(false),true,'same seeded week retries successfully');assert.equal(records.length,1);
  }
  assert.equal(game.g.week,13);assert.equal(game.g.competitors.find(c=>c.id==='competitor-1').ownedPlayerShares,4988);
  assert.equal(game.g.sharesOut,1000000);assert.equal(game.g.founderShares,700000);assert.equal(game.g.treasuryBuybackShares,50000);
  assert.ok(Math.abs(game.g.competitorOwnedRatio*950000-99988)<1e-6,'95,000 prior aggregate +4,988 filled');
  assert.ok(Math.abs(sum(game.g)-1)<EPS);assert.equal(s.modules.finance.validate(snapshot(game)).ok,true);
  if(reference)assert.deepEqual(economic(game.g),reference,'failed week + retry equals uninterrupted week including persisted RNG');else reference=economic(game.g);
  await s.backend.flush();assert.equal(s.control.attempts.length,puts+1,'one successful weekly durable put, including after retry');await restored(s,game.g);
  console.log('weekly competitor purchase '+mode+' pending='+pending+': real commit / full rollback / retry / fresh fake-IDB PASS');
 }
 console.log('Competitor stake float PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
