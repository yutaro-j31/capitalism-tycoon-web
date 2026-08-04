'use strict';
const assert = require('node:assert');
const { loadGame } = require('./harness');

function summarize(label, isolatedLegacyIndex) {
  let seed = 0x296001;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
  const loaded = loadGame({ random, isolatedLegacyIndex });
  const { engineModule, modules } = loaded;
  const state = engineModule.createInitialState({ configured: true });
  state.configured = true;
  state.companyCash = 20_000_000;
  state.companyDebt = 0;
  state.companyCredit = 80;
  state.finance = modules.finance.defaultFinanceState(state);
  const game = new engineModule.TycoonEngine(state);
  const fn = game.borrowFromBank;
  const before = {
    companyCash: game.g.companyCash,
    companyDebt: game.g.companyDebt,
    companyCredit: game.g.companyCredit,
    bankDebt: game.g.bankDebt,
    loans: (game.g.finance?.loans || []).length,
    transactions: (game.g.finance?.transactions || []).length
  };
  let result = null;
  let error = null;
  try { result = typeof fn === 'function' ? fn.call(game, 1_000_000, 52) : undefined; }
  catch (err) { error = String(err?.stack || err); }
  const afterBorrow = {
    companyCash: game.g.companyCash,
    companyDebt: game.g.companyDebt,
    companyCredit: game.g.companyCredit,
    bankDebt: game.g.bankDebt,
    loans: (game.g.finance?.loans || []).length,
    bankFinancingLoans: (game.g.bankFinancing?.loans || []).length,
    transactions: (game.g.finance?.transactions || []).length,
    validation: modules.finance.validate(game.g)
  };
  const cashAfterBorrow = game.g.companyCash;
  for (let i = 0; i < 4; i += 1) game.advanceWeek(false);
  const afterRepayment = {
    week: game.g.week,
    companyCash: game.g.companyCash,
    companyDebt: game.g.companyDebt,
    bankDebt: game.g.bankDebt,
    cashPaid: cashAfterBorrow - game.g.companyCash,
    loans: (game.g.finance?.loans || []).length,
    bankFinancingLoans: (game.g.bankFinancing?.loans || []).map(row => ({ balance: row.balance, status: row.status, remainingWeeks: row.remainingWeeks })),
    transactions: (game.g.finance?.transactions || []).length,
    validation: modules.finance.validate(game.g)
  };
  const summary = { label, isolatedLegacyIndex, functionHead: String(fn).slice(0, 500), before, result, error, afterBorrow, afterRepayment };
  console.log(`ISSUE296_${label}=${JSON.stringify(summary)}`);
  return summary;
}

const legacy = summarize('LEGACY', true);
const connected = summarize('CONNECTED', false);
assert.equal(typeof legacy.result, 'boolean', 'legacy borrowFromBank should return a boolean');
assert.equal(typeof connected.result, 'boolean', 'connected borrowFromBank should return a boolean');
console.log('issue 296 core overwrite diagnostic completed');
