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
 // Own-ticker shares the founder bought personally and the company holds are not float (P3-2 beneficial founder holding).
 {const s=engine(97531,g=>{g.founderShares=600000;g.competitorOwnedRatio=0;g.treasuryBuybackShares=0;g.ticker='CPTY';g.personalStocks={CPTY:{qty:396000,avg:1000}};g.companyStocks={CPTY:{qty:1000,avg:1000}};}),c=s.e.g.competitors[0];
  buy(s,c,'float = 1,000,000 − 600,000 − 396,000 personal − 1,000 company = 3,000',3000);buy(s,c,'then nothing',0);}
 {const s=engine(97531,g=>{g.founderShares=600000;g.competitorOwnedRatio=0;g.treasuryBuybackShares=0;g.ticker='CPTY';g.personalStocks={CPTY:{qty:400000,avg:1000}};}),c=s.e.g.competitors[0],before=JSON.stringify(s.e.g);
  assert.equal(s.e.buyCompetitorStake(c),0,'founder beneficial 100%: no float');assert.equal(JSON.stringify(s.e.g),before);}
 for(const price of [0,NaN,-5]){const s=engine(97531,g=>{g.stockPrice=price;}),c=s.e.g.competitors[0],before=JSON.stringify(s.e.g);
  assert.equal(s.e.buyCompetitorStake(c),0,`invalid price ${price}: zero fill`);assert.equal(JSON.stringify(s.e.g),before,`invalid price ${price}: nothing changes`);}
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
 console.log('Competitor stake float PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
