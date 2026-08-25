'use strict';

// QA監査(docs/QA_AUDIT_2026-08-25.md C4)の修正確認。修正前は役員報酬(state.executives、
// CEO/CFO等)が4週ごと(年13回)に支払われるのに、1回あたりの支払額が年俸÷12(月割り)で
// 計算されており、13×(年俸/12)=年俸×13/12≒108.3%が実際に支払われていた。
// 4週ごとの支払いは13回でちょうど52週になるため、年俸÷13が正しい。

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function gameWithExecutives(random) {
  const { engineModule, modules } = loadGame({ random });
  const engine = new engineModule.TycoonEngine();
  engine.configure({ playerName: '検証者', companyName: '役員報酬検証商事', difficulty: 'normal', scenario: 'standard', founderPrefID: 'fukuoka', founderTraitID: 'merchant' });
  engine.g.executives = { CEO: { name: 'CEO検証', salary: 13_000_000, skill: 80 }, CFO: { name: 'CFO検証', salary: 6_500_000, skill: 80 } };
  // Isolate the payroll formula from unrelated crisis/bankruptcy mechanics: a large cash
  // buffer means the ~19.5M/year salary drain alone cannot trigger the reserve/crisis system.
  // Seeded through a real finance.event so the ledger balances (finance.validate) before
  // any payroll runs, rather than an untracked direct assignment to companyCash.
  const seedAmount = 500_000_000;
  modules.finance.event(engine.g, 'equityFinancing', seedAmount, { cashEffect: seedAmount, equityEffect: seedAmount, sourceType: 'testSeed', sourceID: 'seed', operationID: 'seed', idempotencyKey: 'seed', description: 'test seed capital' });
  const ledger = modules.finance.ensureFinance(engine.g);
  ledger.balances.capitalSurplus = (ledger.balances.capitalSurplus || 0) + seedAmount;
  engine.g.companyCash += seedAmount;
  return { engine, modules };
}

// 1. 実際に52週(4週ごと13回払い)分積み上がる役員報酬取引の合計は、宣言された年俸の
// 合計とほぼ一致する(以前は年俸×13/12≒108.3%になっていた)。
{
  const { engine, modules } = gameWithExecutives(() => 0.5);
  const annualSalaryTotal = Object.values(engine.g.executives).reduce((a, e) => a + e.salary, 0);
  const txBefore = engine.g.finance.transactions.length;
  for (let i = 0; i < 52; i++) engine.advanceWeek(false);
  const payrollTxs = engine.g.finance.transactions.slice(txBefore).filter(t => t.sourceType === 'weekly-execPayroll');
  const paidTotal = payrollTxs.reduce((a, t) => a + t.amount, 0);
  assert.equal(payrollTxs.length, 13, '役員報酬の取引が13件記録される');
  assert.ok(Math.abs(paidTotal - annualSalaryTotal) < 1, `52週の役員報酬総額(${paidTotal})が年俸合計(${annualSalaryTotal})とほぼ一致する`);
  // 旧式(÷12)なら年俸×13/12の過払いになっていたはずで、その値とは明確に異なる。
  const oldFormulaTotal = annualSalaryTotal * 13 / 12;
  assert.ok(Math.abs(paidTotal - oldFormulaTotal) > 1_000_000, '旧式(月割り÷12)の過払い額とは一致しない');
  const validationErrors = modules.finance.validate(engine.g).errors;
  assert.equal(validationErrors.length, 0, `会計整合性が保たれる: ${JSON.stringify(validationErrors)}`);
}

// 3. 決定論: 同一入力なら同一の支払総額になる。
{
  const run = () => {
    const { engine } = gameWithExecutives(() => 0.5);
    for (let i = 0; i < 13 * 4; i++) engine.advanceWeek(false);
    return engine.g.companyCash;
  };
  assert.equal(run(), run(), '同一入力なら同一結果になる');
}

console.log('executive payroll annual total tests passed');
