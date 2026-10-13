'use strict';
// #966: a listed subsidiary's market catch-up (price index, valuation, quarterly parent dividend) used to run
// from render paths (renderSection / allSnapshots / the portfolio dashboard) and from load (normalize -> ensure),
// outside the canonical week transaction, and load normalization also rewrote the parent's book value. A
// quarter-week render or reload then failed the NEXT week's standalone close (P2-CLOSE-WEEKLY-CASH 658435 /
// P2-CLOSE-BS-IDENTITY 0.21) and the game could not advance. The catch-up now runs only inside the week; render
// and load leave economic state untouched. Production writers only (VC subsidiary -> IPO preparation -> IPO).
const assert=require('node:assert/strict');
const {snapshot,economic,boot,advance,listedGame,listedDividendRows,dividendRows}=require('./fixtures/subsidiary-quarter-close');

const WEEKS=60;
// Economic fields a render or a load must never change: parent cash and ledger, the listed market (price index,
// valuation, listing valuation, dividend record) and the parent's book value.
const economicView=(g,id)=>{const s=g.subsidiaries.find(x=>x.id===id);return JSON.stringify({cash:g.companyCash,tx:(g.finance?.transactions||[]).length,
 index:s.marketPriceIndex,valuation:s.valuation,listing:s.marketListingValuation,book:s.carryingBookValue,
 dividends:s.parentDividendsReceived,lastDividend:s.lastDividendWeek,marketWeek:s.marketLastWeek});};
// Other modules' load normalizers (group restructuring, synergy allocation, follow-on offering) still round the
// subsidiary's own cash pool to the yen and its ownership to 1e-6. That is pre-existing, never reaches the parent
// balance sheet and is reported separately; a reload may move them by less than those units, never more.
function nearlyUnchanged(before,after,id,label){const a=before.subsidiaries.find(x=>x.id===id),b=after.subsidiaries.find(x=>x.id===id);
 assert.ok(Math.abs(a.subsidiaryCash-b.subsidiaryCash)<1,`${label}: subsidiaryCash within 1 yen`);assert.ok(Math.abs(a.ownership-b.ownership)<=1e-6,`${label}: ownership within 1e-6`);}
// The listed market's own read paths (renderSection / allSnapshots / snapshot), three times over.
function renderMarket(c){
 const g=c.game.g,tab=g.selectedTab;g.selectedTab='venture';const market=c.modules.listedSubsidiaryMarket;
 for(let i=0;i<3;i++){market.allSnapshots(g);market.renderSection(c.game);c.game.listedSubsidiaryMarketSnapshot(c.subsidiaryID);}
 g.selectedTab=tab;
}
// The portfolio dashboard also reads allSnapshots; it may initialise its own default fields (mandate), but no
// economic field.
function renderDashboard(c){
 const g=c.game.g,tab=g.selectedTab;g.selectedTab='venture';
 for(let i=0;i<3;i++)c.modules.listedSubsidiaryPortfolioDashboard?.renderSection?.(c.game);
 g.selectedTab=tab;
}
function reload(c){
 assert.equal(c.game.save(),true);const saved=c.ctx.__localStorageData.get(c.key);
 const fresh=boot();fresh.ctx.__localStorageData.set(fresh.key,saved);
 return {...fresh,game:fresh.engineModule.TycoonEngine.load(),subsidiaryID:c.subsidiaryID};
}

function run(){
 let c=listedGame(17);const id=c.subsidiaryID,quarters=[];
 assert.ok(c.game.g.subsidiaries.find(x=>x.id===id).publicCompany,'listed through production writers');
 while(c.game.g.week<WEEKS){
  const before=c.game.g.week;advance(c.game);const g=c.game.g;
  assert.equal(g.week,before+1);
  assert.equal(c.modules.finance.validate(snapshot(c.game)).ok,true,`week ${g.week} accounting`);
  assert.equal(dividendRows(g).length,0,`week ${g.week}: no #971 subsidiary dividend`);
  const s=g.subsidiaries.find(x=>x.id===id);
  assert.equal(s.marketLastWeek,g.week,`week ${g.week}: market caught up inside the week`);
  // Every week: the render paths (three times over) leave economic state untouched.
  const view=economicView(g,id),full=JSON.stringify(g.subsidiaries.find(x=>x.id===id));renderMarket(c);
  assert.equal(JSON.stringify(c.game.g.subsidiaries.find(x=>x.id===id)),full,`week ${g.week}: the listed market render writes nothing to the subsidiary`);
  renderDashboard(c);assert.equal(economicView(c.game.g,id),view,`week ${g.week}: render is economically read-only`);
  if(g.week%13===0){
   const rows=listedDividendRows(g,id,g.week);
   assert.ok(rows.length<=1,`week ${g.week}: listed dividend at most once`);
   assert.equal(listedDividendRows(g,id).length,quarters.reduce((a,q)=>a+q.rows,0)+rows.length,'no dividend for another week appears');
   quarters.push({week:g.week,rows:rows.length,amount:rows[0]?.cashEffect||0});
   // A quarter-week reload changes nothing economic, and the next week still closes.
   const loaded=reload(c);
   assert.equal(economicView(loaded.game.g,id),view,`week ${g.week}: load is economically read-only`);nearlyUnchanged(g,loaded.game.g,id,`week ${g.week} reload`);
   assert.equal(loaded.modules.finance.validate(snapshot(loaded.game)).ok,true,`week ${g.week} accounting after reload`);
   c={...loaded,game:loaded.game};
  }
 }
 assert.deepEqual(quarters.map(q=>q.week),[26,39,52],'quarters after the week-17 IPO');
 assert.ok(quarters.some(q=>q.rows===1&&q.amount>0),'at least one quarterly listed dividend was paid');
 return c;
}

const first=run(),second=run();
assert.deepEqual(economic(second.game.g),economic(first.game.g),'deterministic 60-week replay with renders and quarter-week reloads');
assert.equal(first.host.draws+second.host.draws,0,'no host RNG draws');
console.log(`listed subsidiary weeks 17-${WEEKS} / in-week catch-up / quarterly dividend at most once / render x3 read-only every week / quarter-week reload read-only / deterministic PASS`);

// Older saves never caught the market up unless something rendered, so a save written before any render has no
// market fields at all. It loads with no economic change and catches up from the listing week, with the quarter
// dividend, inside the next week, where the close accounts for it.
{
 const c=listedGame(25),state=snapshot(c.game),legacy=state.subsidiaries.find(x=>x.id===c.subsidiaryID),listedWeek=legacy.ipoPreparation.listedWeek;
 for(const key of ['marketLastWeek','lastDividendWeek','marketPriceIndex','marketListingValuation','marketVolatility','dividendPolicyID','parentDividendsReceived'])delete legacy[key];
 assert.equal(listedDividendRows(state,legacy.id).length,0,'no quarter has passed yet');
 const ctx=boot();const game=new ctx.engineModule.TycoonEngine(state),sub=game.g.subsidiaries.find(x=>x.id===legacy.id);
 assert.equal(sub.marketLastWeek,listedWeek,'load sets the market clock to the listing week without catching up');
 for(const key of ['companyCash','personalCash'])assert.equal(game.g[key],state[key],`load moves no ${key}`);
 assert.equal(sub.valuation,legacy.valuation,'load changes no valuation');assert.equal(sub.carryingBookValue,legacy.carryingBookValue,'load changes no book value');
 assert.equal(game.g.finance.transactions.length,state.finance.transactions.length,'load books nothing');
 assert.notEqual(game.advanceWeek(false),false);
 assert.equal(game.g.week,26);assert.equal(sub.marketLastWeek,26,'caught up from the listing week inside week 26');
 assert.ok(listedDividendRows(game.g,sub.id,26).length<=1,'the week-26 dividend at most once');
 assert.equal(ctx.modules.finance.validate(snapshot(game)).ok,true,'catch-up week closes');
 assert.notEqual(game.advanceWeek(false),false);assert.equal(game.g.week,27,'and the next week closes too');
 console.log(`legacy listed save without market fields / load unchanged / catch-up from week ${listedWeek} inside week 26 / week 27 PASS`);
}
// Older saves whose market lags: actions that would change what the pending catch-up computes for the missed
// quarters (dividend policy, stake trades, follow-on, tender offer) are refused, fail-closed and rolled back, with a
// message; unrelated actions still run; once the week advance has settled the market, the same actions run.
{
 const c=listedGame(25),state=snapshot(c.game),legacy=state.subsidiaries.find(x=>x.id===c.subsidiaryID);
 for(const key of ['marketLastWeek','lastDividendWeek','marketPriceIndex','marketListingValuation','marketVolatility','dividendPolicyID','parentDividendsReceived'])delete legacy[key];
 const ctx=boot();const game=new ctx.engineModule.TycoonEngine(state),id=legacy.id,errors=[];
 const fail=game.fail;game.fail=function(message){errors.push(message);return fail.call(this,message);};
 assert.equal(JSON.stringify(ctx.modules.listedSubsidiaryMarket.lagging(game.g).map(x=>x.id)),JSON.stringify([id]),'legacy listed market lags');
 const attempts={policy:()=>game.setListedSubsidiaryDividendPolicy(id,'income'),buy:()=>game.buyListedSubsidiaryStake(id,.05),
  followOn:()=>game.executeListedSubsidiaryFollowOnOffering?.(id,(game.listedSubsidiaryFollowOnOfferingPreview?.(id)?.options||[])[0]?.id||'balanced'),
  tender:()=>game.launchListedSubsidiaryTenderOffer?.(id)};
 const notices=[],emit=game.emit;game.emit=function(type='change',detail,...rest){if(type==='notify')notices.push(String(detail?.severity||''));return emit.call(this,type,detail,...rest);};
 for(const [name,run] of Object.entries(attempts)){
  const before=JSON.stringify(game.g),count=errors.length,seen=notices.length,result=run();
  assert.ok(!notices.slice(seen).includes('success'),`${name}: a refused action shows no success notification`);
  assert.notEqual(result,true,`${name}: refused while the market lags`);
  assert.equal(JSON.stringify(game.g),before,`${name}: state rolled back`);
  if(name==='policy'||name==='buy')assert.match(errors.slice(count).join(' '),/市場更新が未完了[\s\S]*週を進め/,`${name}: the message says to advance the week`);
 }
 // The guard sits on the shared transaction boundary, so any writer is covered: a change to a lagging listed
 // subsidiary's catch-up inputs is refused, a change elsewhere commits.
 {const before=JSON.stringify(game.g),count=errors.length;
  assert.equal(game.runTransaction(()=>{game.g.subsidiaries.find(x=>x.id===id).ownership-=.01;return true;}),false,'any writer changing the ownership is refused');
  assert.equal(JSON.stringify(game.g),before,'and rolled back');assert.match(errors.slice(count).join(' '),/市場更新が未完了/);
  assert.equal(game.runTransaction(()=>{game.g.news.unshift('unrelated');return true;}),true,'a change elsewhere commits');}
 {const seen=notices.length;assert.equal(game.setGroupHoldingPolicy?.('growth')??true,true,'an unrelated action still runs');
  if(game.setGroupHoldingPolicy)assert.ok(notices.slice(seen).includes('success'),'an accepted action still shows its success notification');}
 assert.notEqual(game.advanceWeek(false),false);assert.equal(game.g.week,26);
 assert.equal(ctx.modules.listedSubsidiaryMarket.lagging(game.g).length,0,'the week advance settled the market');
 assert.equal(game.setListedSubsidiaryDividendPolicy(id,'income'),true,'the policy change runs after the market is settled');
 assert.equal(ctx.modules.finance.validate(snapshot(game)).ok,true);
 assert.notEqual(game.advanceWeek(false),false,'and the next week closes');
 console.log('legacy lagging listed market / policy, stake, follow-on, tender refused and rolled back / unrelated action runs / allowed after the week settles PASS');
}
// A new game never lags, so the same actions run immediately between weeks.
{
 const c=listedGame(30),g=c.game.g;
 assert.equal(c.modules.listedSubsidiaryMarket.lagging(g).length,0,'a new game never lags');
 assert.equal(c.game.setListedSubsidiaryDividendPolicy(c.subsidiaryID,'income'),true,'new game: policy change runs at once');
 assert.notEqual(c.game.advanceWeek(false),false);assert.equal(c.modules.finance.validate(snapshot(c.game)).ok,true);
 console.log('new game listed market never lags / policy change runs at once PASS');
}
// The IPO removes a whole-yen book value, so the parent's book stays an integer; a later group-restructuring
// disposal (which settles whole yen) then matches the ledger exactly and the next week still closes.
{
 const c=listedGame(36),g=c.game.g,sub=g.subsidiaries.find(x=>x.id===c.subsidiaryID);
 assert.ok(Number.isInteger(sub.carryingBookValue),`book value after the IPO is whole yen (${sub.carryingBookValue})`);
 const ipo=g.finance.transactions.find(t=>t.sourceType==='ipoSubsidiary');assert.ok(Number.isInteger(ipo.assetEffect),'IPO book removal is whole yen');
 assert.equal(c.game.executeGroupRestructuringSale(c.subsidiaryID),true,'production group-restructuring sale after the lockup');
 assert.equal(c.modules.finance.validate(snapshot(c.game)).ok,true,'accounting after the disposal');
 assert.notEqual(c.game.advanceWeek(false),false);assert.equal(g.week,37,'the week after the disposal closes');
 console.log('listed subsidiary IPO whole-yen book / group-restructuring sale / next week closes PASS');
}
console.log('Listed subsidiary market week PASS');
