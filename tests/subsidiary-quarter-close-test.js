'use strict';
// #971: a VC or M&A subsidiary used to pay a quarterly "dividend" straight into companyCash with no ledger
// event, on top of the subsidiary profit the weekly record already books as parent cash and profit. The
// quarter-week standalone close then failed (P2-CLOSE-BS-IDENTITY etc. by exactly that amount) and rolled the
// week back, so a company holding a subsidiary could never pass week 13. Owner decision (option C): the
// subsidiary profit reaches the parent once, weekly; there is no second quarterly cash distribution.
// Everything here runs through production writers and the production week boundary.
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {snapshot,economic,boot,advance,liveGame,subsidiaryOf,dividendRows}=require('./fixtures/subsidiary-quarter-close');

const QUARTERS=[13,26,39,52];
const WEEKS=60;

// Runs the production week to WEEKS and checks every week, plus the quarter closes, on the way.
function run(kind){
 const c=liveGame(kind,1),g=c.game.g,finance=c.modules.finance,id=c.subsidiaryID;
 const start=JSON.parse(JSON.stringify(subsidiaryOf(g,kind,id)));
 let cumulative=Number(start.retainedEarnings)||0;const quarters=[];
 while(g.week<WEEKS){
  const cash=g.companyCash;advance(c.game);
  const sub=subsidiaryOf(g,kind,id);cumulative+=sub.weeklyProfit;
  const check=finance.validate(snapshot(c.game));
  assert.equal(check.ok,true,`${kind} week ${g.week} accounting: ${JSON.stringify(check.errors)}`);
  assert.equal(dividendRows(g).length,0,`${kind} week ${g.week}: no subsidiary dividend is booked`);
  // retainedEarnings is cumulative subsidiary profit: no quarterly pseudo-dividend is deducted from it.
  assert.ok(Math.abs(sub.retainedEarnings-cumulative)<1e-6,`${kind} week ${g.week} retainedEarnings ${sub.retainedEarnings} vs cumulative profit ${cumulative}`);
  for(const key of ['ownership','carryingBookValue','investedCost','acquisitionPrice'])assert.equal(sub[key],start[key],`${kind} week ${g.week} ${key} unchanged`);
  if(QUARTERS.includes(g.week))quarters.push({week:g.week,cashDelta:g.companyCash-cash});
 }
 assert.deepEqual(quarters.map(q=>q.week),QUARTERS,`${kind}: every quarter week committed`);
 const close=finance.standaloneClose(JSON.parse(JSON.stringify(g)),'52');
 assert.equal(close?.ok,true,`${kind} week ${WEEKS} standalone close: ${JSON.stringify(close?.errors||close)}`);
 return {c,quarters};
}

for(const kind of ['vc','ma']){
 const first=run(kind),second=run(kind);
 const g=first.c.game.g;
 assert.equal(g.week,WEEKS);
 // Same seed, same writers: an identical 60-week result, with no host Math.random draws.
 assert.deepEqual(economic(second.c.game.g),economic(g),`${kind}: deterministic 60-week replay`);
 assert.equal(first.c.host.draws,0,`${kind}: no host RNG draws`);assert.equal(second.c.host.draws,0);
 console.log(`${kind} subsidiary weeks 1-${WEEKS} / quarter closes ${QUARTERS.join(',')} / no dividend row / cumulative retainedEarnings / deterministic replay PASS`);

 // A save taken mid-run reloads and keeps closing every quarter. Load normalization adds module defaults and
 // rounds a few stored figures (pre-existing reload behaviour), so the resumed game is held to: the same RNG
 // stream as the uninterrupted game, cash and retainedEarnings within 1 yen of it, valid accounting every week,
 // and an identical result when the same save is resumed twice.
 const mid=liveGame(kind,30);assert.equal(mid.game.save(),true);const saved=mid.ctx.__localStorageData.get(mid.key);
 const resume=()=>{const fresh=boot();fresh.ctx.__localStorageData.set(fresh.key,saved);const game=fresh.engineModule.TycoonEngine.load();assert.equal(game.g.week,30);
  while(game.g.week<WEEKS){advance(game);assert.equal(fresh.modules.finance.validate(snapshot(game)).ok,true,`${kind} resumed week ${game.g.week} accounting`);assert.equal(dividendRows(game.g).length,0);}
  assert.equal(fresh.host.draws,0);return game;};
 const resumed=resume(),again=resume();
 assert.deepEqual(economic(again.g),economic(resumed.g),`${kind}: resuming the same save twice is deterministic`);
 assert.equal(JSON.stringify(resumed.g.simulationRng),JSON.stringify(g.simulationRng),`${kind}: resumed RNG stream matches the uninterrupted game`);
 assert.ok(Math.abs(resumed.g.companyCash-g.companyCash)<1,`${kind}: resumed cash within 1 yen`);
 assert.ok(Math.abs(subsidiaryOf(resumed.g,kind,first.c.subsidiaryID).retainedEarnings-subsidiaryOf(g,kind,first.c.subsidiaryID).retainedEarnings)<1,`${kind}: resumed retainedEarnings within 1 yen`);
 console.log(`${kind} subsidiary save at week 30 / reload / continue to week ${WEEKS} PASS`);
}

// An existing save carrying a retainedEarnings figure written by the old quarterly deduction loads unchanged
// (no implicit repair) and advances through the next quarter.
{
 const c=liveGame('vc'),state=snapshot(c.game),sub=state.subsidiaries.at(-1);
 sub.retainedEarnings=12_345.67;
 const loaded=loadGame({headless:true});
 const game=new loaded.engineModule.TycoonEngine(state);
 assert.equal(game.g.saveVersion,9);assert.equal(game.g.subsidiaries.at(-1).retainedEarnings,12_345.67,'legacy retainedEarnings preserved on load');
 assert.notEqual(game.advanceWeek(false),false);assert.equal(game.g.week,13);
 const after=game.g.subsidiaries.at(-1);
 assert.ok(Math.abs(after.retainedEarnings-(12_345.67+after.weeklyProfit))<1e-6,'legacy figure only accumulates');
 assert.equal(loaded.modules.finance.validate(snapshot(game)).ok,true);
 console.log('legacy save retainedEarnings preserved / week 13 PASS');
}

// Listed subsidiary: the production IPO route. Its quarterly dividend comes only from the separate
// listed-subsidiary-market writer (paid from subsidiaryCash, booked as dividendIncome); this fix adds no second
// one. That writer runs from render/load paths, outside the week transaction (#966): a quarter-week render or
// reload followed by the next week fails that week's close (recorded on #966, not fixed here). The weekly loop
// therefore never renders; the render path is exercised once, at the final quarter, for its own invariants.
{
 const c=liveGame('vc',1,{largest:true}),g=c.game.g,id=c.subsidiaryID,market=c.modules.listedSubsidiaryMarket,finance=c.modules.finance;
 const sub=()=>g.subsidiaries.find(x=>x.id===id);
 assert.equal(c.game.startSubsidiaryIPOPreparation(id),true,'production IPO preparation');
 while(!sub().publicCompany&&g.week<40){
  advance(c.game);
  if(c.game.subsidiaryIPOPreparationSnapshot(id).canAdvance)c.game.advanceSubsidiaryIPOPreparation(id);
  if(c.game.subsidiaryIPOPreparationSnapshot(id).ready&&!sub().publicCompany)assert.equal(c.game.ipoSubsidiary(id),true,'production subsidiary IPO');
 }
 assert.equal(sub().publicCompany,true,'subsidiary listed through production writers');
 const listedWeek=g.week,quarters=[];
 while(g.week<52){
  advance(c.game);
  if(g.week%13)continue;
  quarters.push(g.week);
  assert.equal(dividendRows(g).length,0,`listed week ${g.week}: no in-week subsidiary dividend`);
  assert.equal(finance.validate(snapshot(c.game)).ok,true,`listed week ${g.week} accounting`);
 }
 assert.deepEqual(quarters,[26,39,52],'listed subsidiary crossed three quarter closes');
 // catchUp books every quarter missed since the last market read (here 26, 39 and 52) in one call (#966).
 const rows=()=>g.finance.transactions.filter(t=>t.sourceType==='listedSubsidiaryDividend'&&String(t.operationID).startsWith(`listedSubsidiaryDividend-${id}-`));
 const before=rows().length,cash=g.companyCash;market.allSnapshots(g);const once=g.companyCash,added=rows().slice(before);
 market.allSnapshots(g);market.allSnapshots(g);
 assert.equal(g.companyCash,once,'repeated render-path reads do not move cash again');
 assert.equal(rows().length,before+added.length,'no further listed dividend rows on repeated reads');
 assert.equal(new Set(added.map(t=>t.operationID)).size,added.length,'one listed dividend row per quarter');
 assert.ok(added.length<=quarters.length,'at most one listed dividend per quarter crossed');
 assert.ok(Math.abs((once-cash)-added.reduce((a,t)=>a+t.cashEffect,0))<0.01,'listed dividend cash equals its ledger rows');
 const booked=added.length;
 assert.equal(dividendRows(g).length,0,'still no #971-style subsidiary dividend');
 assert.equal(finance.validate(snapshot(c.game)).ok,true,'accounting after the render path');
 console.log(`listed subsidiary IPO at week ${listedWeek} / quarter closes ${quarters.join(',')} / single listed dividend writer (${booked} row) / render-count independent PASS`);
}
console.log('Subsidiary quarter close PASS');
