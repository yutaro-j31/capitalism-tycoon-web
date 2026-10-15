'use strict';
// W-DEFENSE (Owner decision 2026-10-15): a takeover defense makes the competitors sell player-company shares to outside
// market investors. Only shares backed by named competitor holdings are sold (pro rata, whole shares, up to the 5% / 9% /
// 2.5% target of outstanding = issued − treasury); each seller receives price × its sold shares; the company pays only
// the defense cost (one headOfficeExpense row). Founder shares, treasury shares, the stock price and the RNG never move,
// and the ratios are recomputed (founder + competitor + external = 1, live = reload). Shares that exist only in the
// aggregate ratio get no invented seller or proceeds. With nothing sellable, poison pill / white knight are refused at
// no cost and IR still runs (reputation only). Unknown or contradictory ownership is fail-closed with no change and no
// repair of the save.
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {createScenario,customPlan,selectAndApprove}=require('./ma-acquisition-financing-fixture');
const EPS=1e-9,COST={poisonPill:12_000_000,whiteKnight:25_000_000,irCampaign:6_000_000},TARGET={poisonPill:.05,whiteKnight:.09,irCampaign:.025};
const clone=v=>JSON.parse(JSON.stringify(v));
const outstanding=g=>g.sharesOut-g.treasuryBuybackShares;
const comp=g=>g.competitorOwnedRatio??0;// an absent field (very old save) is 0
const sum=g=>g.founderOwnershipRatio+comp(g)+g.externalShareholderRatio;
const named=g=>g.competitors.map(c=>c.ownedPlayerShares??0);
const ratios=g=>[g.founderOwnershipRatio,g.competitorOwnedRatio,g.externalShareholderRatio];
function engine({ratio,holdings=[60000,30000],seed=24680,setup=()=>{}}={}){
 let state=seed;const host={draws:0};
 const s=loadGame({headless:true,random:()=>{host.draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}});
 const e=new s.engineModule.TycoonEngine(s.engineModule.createInitialState({configured:true}));
 Object.assign(e.g,{publicCompany:true,stockPrice:1000,sharesOut:1000000,treasuryBuybackShares:50000,founderShares:700000,companyReputation:50});
 // The own listed row, as the IPO creates it (stock split and buyback read it).
 e.g.market=e.g.market.filter(x=>x.id!==e.g.ticker);e.g.market.push({id:e.g.ticker,name:e.g.companyName,sector:'コングロマリット',price:1000,previous:1000,dividendYield:0,volatility:.08,trend:.003,marketCap:1000*1000000,per:20,pbr:2,issuedShares:1000000,dividendPerShare:0,shareholders:{}});
 // Fund the defenses through the ledger (equity financing) so the book stays valid.
 const fund=492_000_000,f=s.modules.finance;e.g.companyCash+=fund;f.event(e.g,'equityFinancing',fund,{cashEffect:fund,equityEffect:fund,sourceType:'testFunding',sourceID:'defense'});f.ensureFinance(e.g).balances.capitalSurplus=(Number(f.ensureFinance(e.g).balances.capitalSurplus)||0)+fund;
 e.g.competitors.forEach((c,i)=>{c.ownedPlayerShares=holdings[i]??0;c.cash=10_000_000;});
 e.g.competitorOwnedRatio=ratio??holdings.reduce((a,x)=>a+x,0)/outstanding(e.g);
 setup(e.g);e.updateOwnershipRatios();e.save=()=>true;return {...s,e,host};
}
const shares=(s,a,b)=>s.e.g.competitors.map((_,i)=>i===0?a:i===1?b:0);
const reload=s=>new s.engineModule.TycoonEngine(clone(s.e.g)).g;
// Apply one defense and check every invariant; returns the shares sold.
function defend(s,kind,label,{expectSold,expectShares}={}){
 const g=s.e.g,o=outstanding(g),held=(g.competitorOwnedRatio??0)*o,before=named(g),cash=g.competitors.map(c=>c.cash);
 const company=g.companyCash,founder=g.founderShares,treasury=g.treasuryBuybackShares,price=g.stockPrice,rng=JSON.stringify(g.simulationRng),draws=s.host.draws,rows=g.finance.transactions.length,rep=g.companyReputation;
 assert.equal(s.e.activateDefense(kind),true,`${label}: defense runs`);
 const sold=Math.round(before.reduce((a,x)=>a+x,0)-named(g).reduce((a,x)=>a+x,0));
 if(expectSold!==undefined)assert.equal(sold,expectSold,`${label}: shares sold`);
 if(expectShares)assert.deepEqual(named(g),expectShares,`${label}: pro rata named holdings`);
 assert.ok(sold<=Math.floor(TARGET[kind]*o),`${label}: never above the target`);
 g.competitors.forEach((c,i)=>{assert.ok(Math.abs(c.cash-cash[i]-(before[i]-named(g)[i])*price)<.01,`${label}: seller ${i} receives price × its sold shares`);assert.ok(named(g)[i]>=0&&Number.isInteger(before[i]-named(g)[i]),`${label}: each seller sells whole shares and keeps a non-negative holding`);});
 assert.ok(Math.abs(comp(g)*o-(held-sold))<EPS*o,`${label}: aggregate stake −sold`);
 assert.equal(g.companyCash,company-COST[kind],`${label}: company pays the defense cost only`);
 assert.equal(g.finance.transactions.length,rows+1,`${label}: one ledger row`);assert.equal(g.finance.transactions.at(-1).sourceType,'activateDefense',`${label}: the row is the defense cost`);
 assert.equal(g.founderShares,founder,`${label}: founder shares unchanged`);assert.equal(g.treasuryBuybackShares,treasury,`${label}: treasury unchanged`);
 assert.equal(g.stockPrice,price,`${label}: stock price unchanged`);
 assert.equal(JSON.stringify(g.simulationRng),rng,`${label}: no simulation RNG`);assert.equal(s.host.draws,draws,`${label}: no host RNG`);
 assert.equal(g.companyReputation,Math.min(100,rep+(kind==='irCampaign'?2:0)),`${label}: reputation`);
 assert.ok(Math.abs(sum(g)-1)<EPS,`${label}: ratios sum to 1 (${sum(g)})`);
 assert.deepEqual(ratios(reload(s)),ratios(g),`${label}: live = reload`);
 assert.ok(named(g).reduce((a,x)=>a+x,0)<=comp(g)*o+1e-6,`${label}: named ≤ aggregate`);
 assert.equal(s.modules.finance.validate(clone(g)).ok,true,`${label}: accounting valid`);
 return sold;
}
// A refused defense changes nothing at all.
function refused(s,kind,label){
 const before=clone(s.e.g),draws=s.host.draws;
 assert.equal(s.e.activateDefense(kind),false,`${label}: refused`);
 assert.deepEqual(clone(s.e.g),before,`${label}: no change (cash, shares, ratios, journal, RNG)`);assert.equal(s.host.draws,draws,`${label}: no host RNG`);
}
(async()=>{
 // 1. Named holdings = aggregate stake (90,000 of 950,000): the three defenses, pro rata by largest remainder.
 {const s=engine();defend(s,'poisonPill','poison pill',{expectSold:47500,expectShares:shares(s,60000-31667,30000-15833)});}
 {const s=engine();defend(s,'whiteKnight','white knight',{expectSold:85500,expectShares:shares(s,3000,1500)});}
 {const s=engine();defend(s,'irCampaign','IR campaign',{expectSold:23750,expectShares:shares(s,60000-15833,30000-7917)});}
 {const s=engine();defend(s,'whiteKnight','white knight (1)',{expectSold:85500});defend(s,'whiteKnight','white knight (2): partial up to the 4,500 left',{expectSold:4500,expectShares:named(s.e.g).map(()=>0)});
  refused(s,'whiteKnight','white knight (3): nothing sellable');refused(s,'poisonPill','poison pill: nothing sellable');defend(s,'irCampaign','IR with nothing sellable',{expectSold:0});}
 console.log('W-DEFENSE three defenses: target in whole shares, pro rata sellers paid price × shares, company pays the cost only, sum 1, live = reload PASS');
 // 2. Named < aggregate (part of the stake has no named holder, e.g. from declined buyouts): only named shares are sold.
 {const s=engine({ratio:142500/950000,holdings:[20000,10000]});const sold=defend(s,'whiteKnight','named 30,000 < aggregate 142,500',{expectSold:30000,expectShares:named(s.e.g).map(()=>0)});
  assert.ok(Math.abs(s.e.g.competitorOwnedRatio*950000-112500)<1e-6,'the unnamed 112,500 stay unattributed in the aggregate');assert.equal(sold,30000);}
 {const s=engine({ratio:142500/950000});defend(s,'poisonPill','named 90,000 < aggregate 142,500, target below named',{expectSold:47500});}
 // 3. Aggregate only (no named holder) and no competitor stake: poison pill / white knight refused at no cost; IR runs.
 for(const [label,ratio] of [['aggregate only',.1],['no competitor stake',0]]){
  const s=engine({ratio,holdings:[0,0]});refused(s,'poisonPill',`${label}: poison pill`);refused(s,'whiteKnight',`${label}: white knight`);
  const held=s.e.g.competitorOwnedRatio;defend(s,'irCampaign',`${label}: IR`,{expectSold:0});assert.equal(s.e.g.competitorOwnedRatio,held,`${label}: IR moves no shares`);}
 console.log('W-DEFENSE named < aggregate, aggregate-only and zero stake: no invented seller; refused at no cost; IR reputation only PASS');
 // 4. Unknown or contradictory ownership: fail-closed for every defense, no repair.
 const corrupt=[
  ['named above aggregate',g=>{g.competitorOwnedRatio=47500/950000;}],
  ['ratio null',g=>{g.competitorOwnedRatio=null;}],['ratio NaN',g=>{g.competitorOwnedRatio=NaN;}],['ratio string',g=>{g.competitorOwnedRatio='0.1';}],
  ['ratio negative',g=>{g.competitorOwnedRatio=-.1;}],['ratio above 49%',g=>{g.competitorOwnedRatio=.6;}],
  ['founder + competitor above outstanding',g=>{g.founderShares=900000;}],
  ['named null',g=>{g.competitors[0].ownedPlayerShares=null;}],['named string',g=>{g.competitors[0].ownedPlayerShares='60000';}],['named negative',g=>{g.competitors[0].ownedPlayerShares=-1;}],
  ['competitors missing',g=>{g.competitors=null;}],['ticker missing',g=>{g.ticker=null;}],['price zero',g=>{g.stockPrice=0;}],['price NaN',g=>{g.stockPrice=NaN;}],
  ['company own-share alias',g=>{g.companyStocks[g.ticker]={qty:1000,avg:1000};}],
 ];
 for(const [label,mutate] of corrupt){const s=engine();mutate(s.e.g);for(const kind of ['poisonPill','whiteKnight','irCampaign'])refused(s,kind,`${label}: ${kind}`);}
 // A very old save without the ratio / named fields: absent means 0 (nothing sellable), IR runs, nothing is repaired.
 {const s=engine({holdings:[0,0]});delete s.e.g.competitorOwnedRatio;s.e.g.competitors.forEach(c=>delete c.ownedPlayerShares);
  refused(s,'whiteKnight','absent fields: white knight');defend(s,'irCampaign','absent fields: IR',{expectSold:0});assert.equal('competitorOwnedRatio' in s.e.g,false,'absent field is not written (no repair)');}
 console.log(`W-DEFENSE ${corrupt.length} unknown / contradictory ownership states fail closed for all three defenses with no change PASS`);
 // 4b. Fractional named holdings from old saves (pre-D4 purchases wrote spend / price): only whole shares are sold, every
 //     sold share has a seller and proceeds; the fractional remainder stays with its holder and in the aggregate.
 {const s=engine({holdings:[100.5,100.5]});const sold=defend(s,'whiteKnight','fractional 100.5 + 100.5',{expectSold:200});
  assert.deepEqual(clone(named(s.e.g).slice(0,2)),[.5,.5],'fractional remainders stay');assert.ok(Math.abs(s.e.g.competitorOwnedRatio*950000-1)<1e-6,'aggregate keeps the 1 unsold share');assert.equal(sold,200);
  defend(s,'irCampaign','after the fractional sale IR still runs',{expectSold:0});}
 {const s=engine({holdings:[.4,.4,.4]});refused(s,'poisonPill','fractional 0.4 × 3: poison pill');refused(s,'whiteKnight','fractional 0.4 × 3: white knight');defend(s,'irCampaign','fractional 0.4 × 3: IR',{expectSold:0});}
 // Seller cash must be a finite number (proceeds are not a repair); an unknown defense kind is refused.
 for(const [label,cash] of [['seller cash NaN',NaN],['seller cash string','500'],['seller cash missing',undefined],['seller cash null',null]]){
  const s=engine();if(cash===undefined)delete s.e.g.competitors[0].cash;else s.e.g.competitors[0].cash=cash;for(const kind of ['poisonPill','whiteKnight','irCampaign'])refused(s,kind,`${label}: ${kind}`);}
 {const s=engine();refused(s,'unknownDefense','unknown kind');refused(s,undefined,'missing kind');}
 console.log('W-DEFENSE fractional named holdings sell whole shares only; invalid seller cash and unknown kinds fail closed PASS');
 // 5. Composites with the other ownership writers (each step keeps sum 1, live = reload, named ≤ aggregate).
 const check=(s,label,{namedBound=true}={})=>{const g=s.e.g;assert.ok(Math.abs(sum(g)-1)<EPS,`${label}: sum 1`);assert.deepEqual(ratios(reload(s)),ratios(g),`${label}: live = reload`);if(namedBound)assert.ok(named(g).reduce((a,x)=>a+x,0)<=g.competitorOwnedRatio*outstanding(g)+1e-6,`${label}: named ≤ aggregate`);assert.equal(s.modules.finance.validate(clone(g)).ok,true,`${label}: accounting`);};
 {// D3 share swap (shared dilution helper) before and after: sold shares are fixed counts of the current outstanding.
  const a=engine();a.e.issueSharesToExternalHolders(100000);check(a,'D3 issuance');defend(a,'whiteKnight','D3 → defense: target 94,500 capped at the 90,000 named',{expectSold:90000});check(a,'D3 → defense');
  const b=engine();defend(b,'whiteKnight','defense → D3',{expectSold:85500});b.e.issueSharesToExternalHolders(100000);check(b,'defense → D3');
  assert.ok(Math.abs(b.e.g.competitorOwnedRatio*1050000-4500)<1e-6,'defense → D3: the competitor keeps its 4,500 shares through the dilution');}
 {// D4 purchase then defense: the bought shares are named and sellable.
  const s=engine({holdings:[0,0],ratio:0}),c=s.e.g.competitors[0];c.cash=1e9;const filled=s.e.buyCompetitorStake(c);s.e.updateOwnershipRatios();assert.ok(filled>0,'D4 filled');check(s,'D4');
  defend(s,'poisonPill','D4 → defense',{expectSold:Math.min(filled,47500)});check(s,'D4 → defense');
  const t=engine();defend(t,'poisonPill','defense → D4');const d=t.e.g.competitors[0];d.cash=1e9;t.e.buyCompetitorStake(d);t.e.updateOwnershipRatios();check(t,'defense → D4');}
 {// Stock split: named holdings are not rescaled by the split (known P2), so after a split named < aggregate and only named shares sell.
  const s=engine();assert.equal(s.e.stockSplit(s.e.g.ticker,2),true,'split');s.e.updateOwnershipRatios();check(s,'split');
  defend(s,'whiteKnight','split → defense',{expectSold:90000});check(s,'split → defense');
  const t=engine();defend(t,'whiteKnight','defense → split');assert.equal(t.e.stockSplit(t.e.g.ticker,2),true);t.e.updateOwnershipRatios();check(t,'defense → split');}
 {// Buyback then defense, and defense then buyback (real shareholder-returns writer).
  // Known P2 (W-BUYBACK): a buyback keeps the competitor ratio while outstanding shrinks, so the aggregate stake falls
  // below the named 90,000. That is contradictory evidence: the defense fails closed (no repair), as the Owner decided.
  const s=engine();s.e.shareholderReturnCapacity?.();assert.equal(s.e.buybackOwnShares(5_000_000),true,'buyback');
  assert.ok(named(s.e.g).reduce((a,x)=>a+x,0)>s.e.g.competitorOwnedRatio*outstanding(s.e.g),'after a buyback named > aggregate');
  for(const kind of ['poisonPill','whiteKnight','irCampaign'])refused(s,kind,`buyback → ${kind}: contradictory evidence`);
  const t=engine();defend(t,'irCampaign','IR → buyback',{expectSold:23750});t.e.shareholderReturnCapacity?.();assert.equal(t.e.buybackOwnShares(1_000_000),true,'IR → buyback (the defense cost lowers the distributable amount)');check(t,'IR → buyback',{namedBound:false});}// the buyback itself shrinks the aggregate stake (known P2)
 {// Declined hostile buyout adds an aggregate stake without a named holder; the defense sells named shares only.
  const s=engine();s.e.g.inboundBuyoutOffers=[{id:'hostile-1',status:'pending',hostile:true,bidderName:'競合',price:1}];assert.equal(s.e.declineInboundBuyoutOffer('hostile-1'),true,'decline');check(s,'decline');
  defend(s,'whiteKnight','decline → defense',{expectSold:85500});check(s,'decline → defense');}
 {// #994: a real financed M&A closing with a public equity raise, then the defense.
  const m=createScenario({loadOptions:{headless:true}});const g=m.game.g;Object.assign(g,{treasuryBuybackShares:50000});g.competitors[0].ownedPlayerShares=90000;g.competitorOwnedRatio=90000/outstanding(g);m.game.updateOwnershipRatios();
  selectAndApprove(m,customPlan({equity:20_000_000,cash:40_000_000}));m.game.save=()=>true;assert.equal(m.game.closeMADeal(m.deal.id),true,'#994 financed closing');
  const o=outstanding(g);assert.ok(Math.abs(g.competitorOwnedRatio*o-90000)<1e-6,'#994 keeps the competitor share count');
  const company=g.companyCash,held=g.competitorOwnedRatio*o;assert.equal(m.game.activateDefense('poisonPill'),true,'#994 → defense');
  assert.ok(Math.abs(g.competitorOwnedRatio*o-(held-Math.floor(.05*o)))<1e-6,'#994 → defense: sold 5% of the new outstanding');assert.equal(g.companyCash,company-12_000_000);
  assert.ok(Math.abs(sum(g)-1)<EPS,'#994 → defense: sum 1');assert.equal(m.modules.finance.validate(clone(g)).ok,true,'#994 → defense: accounting');}
 console.log('W-DEFENSE composites with D3, D4, #994, stock split, buyback and declined buyout keep sum 1, live = reload, named ≤ aggregate PASS');
 // 6. Determinism.
 {const run=()=>{const s=engine();for(const k of ['poisonPill','irCampaign','whiteKnight'])s.e.activateDefense(k);const c=clone(s.e.g);delete c.lastSaveDate;delete c.saveSequence;return JSON.stringify(c);};assert.equal(run(),run(),'deterministic');}
 console.log('W-DEFENSE ownership ratios PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
