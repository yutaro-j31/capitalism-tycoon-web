'use strict';
// Standalone diagnostic only. Deliberately NOT registered in canonical test runner.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const results = [];
for (const account of ['company','personal']) {
  const { ctx, modules, engineModule } = loadGame({ headless: true, isolatedLegacyIndex: true });
  const game = new engineModule.TycoonEngine();
  game.g.configured = true;
  game.g.companyCash = 1_000_000_000;
  game.g.personalCash = 1_000_000_000;
  game.g.departments.investment = { established: true };
  game.g.finance = modules.finance.defaultFinanceState(game.g);
  const s = game.g.startups.find(x => x?.alive && !x.subsidiary && !x.activeFundingRound);
  assert.ok(s, account + ': active target exists');
  assert.equal(game.investStartup(s.id,s.minTicket,account), true, account + ': fixture purchase succeeds');
  assert.ok(game.previewStartupSecondarySale(s.id,account), account + ': sale is available');
  assert.equal(game.save(),true,account + ': baseline save');
  const before = JSON.stringify(game.g);
  const key = engineModule.SAVE_KEY;
  const mirror = ctx.__localStorageData.get(key);
  assert.ok(mirror, account + ': saved baseline present');
  const originalSave = game.save;
  let hits=0, returned, error;
  game.save = () => { hits++; return false; };
  try { returned = game.sellStartupSecondary(s.id,account); }
  catch(caught) { error=caught; }
  finally { game.save = originalSave; }
  const after=JSON.stringify(game.g);
  const old=JSON.parse(before), now=JSON.parse(after);
  const oldS=old.startups.find(x=>x.id===s.id), newS=now.startups.find(x=>x.id===s.id);
  results.push({
    account, saveHits:hits, returned, error:error?.stack||null,
    cashDelta: now[account==='company'?'companyCash':'personalCash']-old[account==='company'?'companyCash':'personalCash'],
    otherCashDelta: now[account==='company'?'personalCash':'companyCash']-old[account==='company'?'personalCash':'companyCash'],
    ownership:[oldS[account==='company'?'ownedCompany':'ownedPersonal'],newS[account==='company'?'ownedCompany':'ownedPersonal']],
    investedBasis:[oldS[account==='company'?'totalInvestedCompany':'totalInvestedPersonal'],newS[account==='company'?'totalInvestedCompany':'totalInvestedPersonal']],
    financeDelta:now.finance.transactions.length-old.finance.transactions.length,
    rngChanged:JSON.stringify(now.simulationRng)!==JSON.stringify(old.simulationRng),
    liveUnchanged:after===before,
    mirrorUnchanged:ctx.__localStorageData.get(key)===mirror
  });
}
console.log('VC secondary sale save-rejection diagnostics:',JSON.stringify(results));
for(const x of results){
  assert.ok(x.saveHits>0,x.account+': injected save failure reached');
  assert.equal(x.error,null,x.account+': unexpected thrown error');
  assert.equal(x.returned,false,x.account+': rejected save may not report successful sale');
  assert.equal(x.liveUnchanged,true,x.account+': full rollback');
  assert.equal(x.mirrorUnchanged,true,x.account+': last good mirror preserved');
}
console.log('VC secondary sale atomic save-rejection PASS');
