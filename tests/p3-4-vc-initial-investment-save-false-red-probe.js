'use strict';
// Diagnostic only. NOT registered with canonical CI; it may intentionally be RED.
// Run: node tests/p3-4-vc-initial-investment-save-false-red-probe.js
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const observations = [];
for (const account of ['company', 'personal']) {
  // Separate installed runtime VM for each account, same method as real VC UI dispatch.
  const { engineModule, modules, ctx } = loadGame({ headless: true, isolatedLegacyIndex: true });
  const game = new engineModule.TycoonEngine();
  game.g.configured = true;
  game.g.companyCash = 2_000_000_000;
  game.g.personalCash = 2_000_000_000;
  game.g.departments.investment = { name: 'Investment', established: true };
  game.g.finance = modules.finance.defaultFinanceState(game.g);
  const target = game.g.startups.find(s => s?.alive && !s.subsidiary && s.activeFundingRound?.status !== 'open');
  assert.ok(target, account + ': investment target must exist');
  const amount = Math.max(1, Number(target.minTicket) || 0);
  assert.ok(Number.isFinite(amount) && amount > 0, account + ': valid ticket');
  assert.ok(game.g[account === 'company' ? 'companyCash' : 'personalCash'] > amount, account + ': sufficient cash');
  assert.equal(game.save(), true, account + ': initial committed baseline');
  const before = JSON.stringify(game.g);
  const key = engineModule.SAVE_KEY;
  const mirrorBefore = ctx.__localStorageData.get(key);
  assert.ok(mirrorBefore, account + ': persisted baseline exists');

  const realSave = game.save;
  let saveHits = 0, returned, error;
  game.save = () => { saveHits++; return false; };
  try { returned = game.investStartup(target.id, amount, account); }
  catch (caught) { error = caught; }
  finally { game.save = realSave; }

  const after = JSON.stringify(game.g);
  const was = JSON.parse(before), now = JSON.parse(after);
  const oldStartup = was.startups.find(s => s.id === target.id);
  const newStartup = now.startups.find(s => s.id === target.id);
  const mirrorAfter = ctx.__localStorageData.get(key);
  observations.push({
    account, saveHits, returned, error: error?.stack || null,
    companyCashDelta: now.companyCash - was.companyCash,
    personalCashDelta: now.personalCash - was.personalCash,
    equityBefore: [oldStartup.ownedCompany, oldStartup.ownedPersonal],
    equityAfter: [newStartup.ownedCompany, newStartup.ownedPersonal],
    totalInvestedBefore: [oldStartup.totalInvestedCompany, oldStartup.totalInvestedPersonal],
    totalInvestedAfter: [newStartup.totalInvestedCompany, newStartup.totalInvestedPersonal],
    valuationDelta: newStartup.valuation - oldStartup.valuation,
    financeTransactionDelta: now.finance.transactions.length - was.finance.transactions.length,
    runwayDelta: newStartup.runwayWeeks - oldStartup.runwayWeeks,
    rngChanged: JSON.stringify(was.simulationRng) !== JSON.stringify(now.simulationRng),
    liveUnchanged: after === before,
    mirrorUnchanged: mirrorAfter === mirrorBefore
  });
}
console.log('VC initial investment save-rejection diagnostics:', JSON.stringify(observations));
for (const result of observations) {
  assert.ok(result.saveHits > 0, result.account + ': injected save rejection must be reached');
  assert.equal(result.error, null, result.account + ': no unexpected exception');
  assert.equal(result.returned, false, result.account + ': rejected save must not return success');
  assert.equal(result.liveUnchanged, true, result.account + ': rejected save must restore entire live state');
  assert.equal(result.mirrorUnchanged, true, result.account + ': rejected save must preserve last committed mirror');
}
console.log('VC initial investment save-rejection atomicity PASS');
