'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

// 重役への業務委任トグル（Coffee Inc 2化 item 3の1本目）。
// CI2のCFO画面には「銀行融資」「経理部門管理」等、個々の業務をCFOに任せるか
// プレイヤー自身が判断するかのトグルが並んでいる。この実装は新しい判断ロジックを
// 発明するのではなく、既にプレイヤーが手動実行できる機能
// （engine.executeCapitalAllocationThresholdDebtAction() / engine.hireDepartmentStaff()）を
// CFOが在籍かつ委任オンのときだけ毎週自動実行するだけに留める。「新株発行」は
// 会社側にそもそも手動実行できる機能が存在しないため、この委任トグルの対象に含めない
// （docs/feature-requests.mdに記録）。

function publicGame(modules, cash = 200_000_000, debt = 270_000_000, revenue = 100_000_000) {
  const { engine, finance } = modules, state = engine.createInitialState({ configured: true });
  state.week = 27; state.publicCompany = true; state.selectedTab = 'market';
  state.companyCash = cash; state.companyDebt = debt;
  state.sharesOut = 1_000_000; state.founderShares = 600_000; state.stockPrice = 100; state.ticker = 'CPTY';
  state.market = state.market.filter(x => x.id !== 'CPTY');
  state.market.push({ id: 'CPTY', name: state.companyName, sector: 'コングロマリット', price: 100, previous: 100, dividendYield: 0, volatility: 0, trend: 0, marketCap: 100_000_000, per: 20, pbr: 2, issuedShares: 1_000_000, dividendPerShare: 0, shareholders: {}, description: 'test', listingMarket: '東証グロース', priceHistory: [{ week: 27, price: 100 }] });
  state.finance = finance.defaultFinanceState(state);
  finance.event(state, 'revenue', revenue, { week: 27, cashEffect: 0, profitEffect: revenue, receivableAmount: revenue, sourceType: 'executiveDelegationFixture', sourceID: 'baseline-revenue', idempotencyKey: `executive-delegation-revenue-${revenue}`, description: '売掛売上' });
  state.finance.loans = [{ id: 'test-loan', loanID: 'test-loan', status: 'active', principal: debt, outstandingPrincipal: debt, interestRate: .12, maturityWeek: 104 }];
  finance.rebuildSnapshotForWeek(state, 27);
  const e = new engine.TycoonEngine(state);
  e.g.hasHeadOffice = true; e.g.officeCapacity = 50;
  return e;
}

function hiredCFO(engine) {
  engine.g.executives.CFO = { id: 'cfo-1', name: 'テストCFO', role: 'CFO', rank: 'A', skill: 80, salary: 20_000_000, hired: true, hireWeek: 1 };
  return engine.g.executives.CFO;
}

// 1. トグルは在籍していない重役には無効。在籍していれば反転し通知する。
{
  const { modules } = loadGame();
  const engine = new modules.engine.TycoonEngine();
  engine.g.configured = true;
  assert.equal(engine.toggleExecutiveDelegation('CFO'), false, '未在籍の重役には委任できない');
  hiredCFO(engine);
  assert.equal(engine.toggleExecutiveDelegation('CFO'), true);
  assert.equal(engine.g.executives.CFO.delegated, true);
  assert.equal(engine.toggleExecutiveDelegation('CFO'), true, '再度呼ぶとオフに戻る');
  assert.equal(engine.g.executives.CFO.delegated, false);
}

// 2. 委任オフはstrict no-op（資本配分のしきい値是正返済機会があっても何もしない）。
{
  const { modules } = loadGame();
  const engine = publicGame(modules);
  hiredCFO(engine);
  const preview = engine.capitalAllocationThresholdDebtActionPreview('balanced');
  assert.equal(preview.canExecute, true, 'このフィクスチャは実際に返済機会を再現できていること');
  const cashBefore = engine.g.companyCash;
  engine.processExecutiveDelegation();
  assert.equal(engine.g.companyCash, cashBefore, '委任オフなら現金は動かない');
}

// 3. 委任オンなら、プレイヤーが手動実行した場合と全く同じ額を自動実行する
// （画面の予告=capitalAllocationThresholdDebtActionPreview()と実行結果が一致することの担保）。
{
  const { modules } = loadGame();
  const engine = publicGame(modules);
  hiredCFO(engine);
  engine.toggleExecutiveDelegation('CFO');
  const preview = engine.capitalAllocationThresholdDebtActionPreview('balanced');
  const cashBefore = engine.g.companyCash;
  engine.processExecutiveDelegation();
  const actualPaid = cashBefore - engine.g.companyCash;
  assert.equal(actualPaid, preview.executableAmount, `委任した返済額は試算と一致すること（試算 ${preview.executableAmount} / 実測 ${actualPaid}）`);
  console.log(`executive delegation: CFO auto-repaid ${actualPaid} (matches preview)`);
}

// 4. 経理部門が逼迫（utilization>1）していれば、委任オンのCFOが1名採用する。
// 逼迫していない・委任オフ・のいずれでも採用は起きない。
{
  const { modules } = loadGame();
  const engine = new modules.engine.TycoonEngine();
  engine.g.configured = true; engine.g.hasHeadOffice = true; engine.g.officeCapacity = 50; engine.g.companyCash = 100_000_000; engine.g.stores = [];
  engine.g.workforceMigrationV7Applied = true;
  assert.ok(engine.establishDepartment('accounting'));
  hiredCFO(engine);

  engine.g.workforceResultsByDepartmentID.accounting = { departmentID: 'accounting', utilization: 1.4 };
  const staffBeforeOff = engine.g.departmentStaff.accounting;
  engine.processExecutiveDelegation();
  assert.equal(engine.g.departmentStaff.accounting, staffBeforeOff, '委任オフでは逼迫していても採用しない');

  engine.toggleExecutiveDelegation('CFO');
  engine.g.workforceResultsByDepartmentID.accounting = { departmentID: 'accounting', utilization: .5 };
  const staffBeforeUnderload = engine.g.departmentStaff.accounting;
  engine.processExecutiveDelegation();
  assert.equal(engine.g.departmentStaff.accounting, staffBeforeUnderload, '逼迫していなければ委任オンでも採用しない');

  engine.g.workforceResultsByDepartmentID.accounting = { departmentID: 'accounting', utilization: 1.4 };
  const staffBefore = engine.g.departmentStaff.accounting;
  engine.processExecutiveDelegation();
  assert.equal(engine.g.departmentStaff.accounting, staffBefore + 1, '委任オンかつ逼迫していれば1名採用する');
}

// 5. advanceWeek()に統合されていること。委任オンのままゲームを進めてもクラッシュせず、
// Math.randomを消費しない（決定論を維持する）。
{
  const { modules } = loadGame();
  const engine = new modules.engine.TycoonEngine();
  engine.g.configured = true; engine.g.hasHeadOffice = true; engine.g.officeCapacity = 50; engine.g.companyCash = 100_000_000; engine.g.stores = [];
  engine.g.workforceMigrationV7Applied = true;
  hiredCFO(engine);
  engine.toggleExecutiveDelegation('CFO');
  assert.ok(engine.establishDepartment('accounting'));

  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    for (let i = 0; i < 3; i++) assert.notEqual(engine.advanceWeek(false), false);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, '重役への業務委任はMath.randomを消費しない');
}

// 6. 旧セーブ互換: `delegated`フィールドが存在しない在籍済みCFOでもクラッシュしない。
// saveVersionは9のまま。
{
  const { modules } = loadGame();
  const engine = new modules.engine.TycoonEngine();
  engine.g.configured = true; engine.g.hasHeadOffice = true; engine.g.officeCapacity = 50; engine.g.companyCash = 100_000_000;
  hiredCFO(engine);
  delete engine.g.executives.CFO.delegated;
  assert.notEqual(engine.advanceWeek(false), false, '旧セーブのCFOレコードでも週送りがクラッシュしない');
  assert.equal(engine.g.saveVersion, 9);
}

// 7. UIから到達できること（トグルボタン・アクションスイッチの配線）。
{
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(app, /data-action="toggle-executive-delegation"|'toggle-executive-delegation'/, 'toggle-executive-delegation アクションが app.js に存在する');
  assert.match(app, /case 'toggle-executive-delegation':/, 'toggle-executive-delegation がアクションスイッチで処理される');
}

console.log('executive delegation tests passed');
