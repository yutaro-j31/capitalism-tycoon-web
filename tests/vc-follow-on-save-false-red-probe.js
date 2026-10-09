'use strict';
// Diagnostic only; deliberately unregistered in canonical CI. Do not merge a RED probe.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const resultRows = [];
for (const account of ['company', 'personal']) {
  const loaded = loadGame({ headless: true });
  const e = new loaded.engineModule.TycoonEngine();
  e.g.configured = true;
  e.g.companyCash = 500e6;
  e.g.personalCash = 500e6;
  e.g.departments.investment = { level: 1 };
  delete e.g.finance;
  e.normalize();
  const s = e.g.startups[0];
  s.stage = 'Series A';
  s.valuation = 300e6;
  s.ownedCompany = .12;
  s.ownedPersonal = .05;
  s.runwayWeeks = 7;
  s.fundingOpen = true;
  e.g.startupFundingHistory[s.id] = [];
  assert.equal(e.openStartupFundingRound(s), true, account + ': valid open round');
  const plan = e.getStartupFundingRoundPlan(s.id);
  assert.ok(plan, account + ': plan exists');
  const amount = plan[account].proRataRequired / 2;
  assert.ok(amount > 0 && Number.isFinite(amount), account + ': positive follow-on amount');
  assert.equal(e.save(), true, account + ': baseline persistence');
  const key = loaded.engineModule.SAVE_KEY;
  const before = JSON.stringify(e.g);
  const mirror = loaded.ctx.__localStorageData.get(key);
  assert.ok(mirror, account + ': baseline mirror exists');
  let hits = 0, returned, error;
  const oldSave = e.save;
  e.save = () => { hits++; return false; };
  try { returned = e.participateStartupFundingRound(s.id, amount, account); }
  catch (caught) { error = caught; }
  finally { e.save = oldSave; }
  const was = JSON.parse(before), now = JSON.parse(JSON.stringify(e.g));
  const prior = was.startups.find(v => v.id === s.id), later = now.startups.find(v => v.id === s.id);
  resultRows.push({
    account, saveHits: hits, returned, error: error?.stack || null,
    amount, companyCashDelta: now.companyCash - was.companyCash,
    personalCashDelta: now.personalCash - was.personalCash,
    contributionBefore: prior.activeFundingRound['contributed' + (account === 'company' ? 'Company' : 'Personal')],
    contributionAfter: later.activeFundingRound['contributed' + (account === 'company' ? 'Company' : 'Personal')],
    totalInvestedBefore: prior['totalInvested' + (account === 'company' ? 'Company' : 'Personal')],
    totalInvestedAfter: later['totalInvested' + (account === 'company' ? 'Company' : 'Personal')],
    historyBefore: (was.startupFundingHistory[s.id] || []).length,
    historyAfter: (now.startupFundingHistory[s.id] || []).length,
    financeTransactionsDelta: now.finance.transactions.length - was.finance.transactions.length,
    liveUnchanged: JSON.stringify(e.g) === before,
    mirrorUnchanged: loaded.ctx.__localStorageData.get(key) === mirror
  });
}
console.log('VC follow-on save rejection evidence:', JSON.stringify(resultRows));
for (const row of resultRows) {
  assert.ok(row.saveHits > 0, row.account + ': injected save fault must be reached');
  assert.equal(row.error, null, row.account + ': no unexpected exception');
  assert.equal(row.returned, false, row.account + ': save rejection must return false');
  assert.equal(row.liveUnchanged, true, row.account + ': complete live state rollback');
  assert.equal(row.mirrorUnchanged, true, row.account + ': old persisted mirror remains');
}
console.log('VC follow-on save rejection atomicity PASS');
