'use strict';

// The completion.js player actions spend or refund company cash. Each one must write the matching
// company-ledger transaction, or finance.validate() reports a cash / balance-sheet mismatch for
// the rest of the game (found through the #769 long-run fork test).

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seedValue) {
  let seed = seedValue >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
}

function freshGame() {
  const loaded = loadGame({ headless: true, random: lcg(0x76900001) });
  const { modules } = loaded;
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Ledger', companyName: 'Ledger Co', difficulty: 'normal', scenario: 'free' });
  modules.simulationRng.reseed(engine.g, 0x769769);
  const contribution = 2_000_000_000 - engine.g.companyCash;
  engine.g.personalCash += contribution;
  assert.equal(engine.contributeFounderCapital(contribution), true, 'company cash arrives through the ledger');
  engine.g.hasHeadOffice = true;
  engine.g.officeCapacity = 32;
  assertValid(modules, engine, 'setup');
  return { modules, engine };
}

function assertValid(modules, engine, label) {
  const validation = modules.finance.validate(engine.g);
  assert.equal(validation.ok, true, `${label}: finance.validate: ${validation.errors.join(' / ')}`);
}

// Run one action and return the cash it moved and the transactions it wrote.
function measure(modules, engine, label, action) {
  const before = engine.g.companyCash;
  const ids = new Set(engine.g.finance.transactions.map(t => t.transactionID));
  assert.equal(action(), true, `${label} succeeds`);
  const added = engine.g.finance.transactions.filter(t => !ids.has(t.transactionID));
  const moved = engine.g.companyCash - before;
  const recorded = added.reduce((sum, t) => sum + t.cashEffect, 0);
  assert.notEqual(moved, 0, `precondition: ${label} moves company cash`);
  assert.ok(Math.abs(moved - recorded) < 1, `${label}: company cash moved ${moved} but the ledger recorded ${recorded}`);
  assertValid(modules, engine, label);
  return added;
}

// 1. Media action: an advertising expense.
{
  const { modules, engine } = freshGame();
  const [row] = measure(modules, engine, 'startMediaAction(social)', () => engine.startMediaAction('social'));
  assert.equal(row.category, 'advertising');
  assert.equal(row.profitEffect, row.cashEffect, 'the media spend is expensed');
  assert.equal(row.sourceType, 'startMediaAction');
  assert.equal(row.sourceID, 'social', 'the transaction names the media action');
}

// 2. Branch office: the deposit is an asset; closing refunds 60% and books the rest as a loss.
{
  const { modules, engine } = freshGame();
  const office = engine.g.rentalOffices.find(o => !o.contracted && o.id !== engine.g.contractedOfficeID);
  assert.ok(office?.deposit > 0, 'precondition: a rental office with a deposit is available');
  const [open] = measure(modules, engine, 'contractBranchOffice', () => engine.contractBranchOffice(office.id));
  assert.equal(open.category, 'otherInvesting');
  assert.equal(open.assetEffect, office.deposit, 'the deposit is held as an asset');
  assert.equal(open.profitEffect || 0, 0, 'paying a deposit is not an expense');
  const branch = engine.g.branchOffices.at(-1);
  assert.equal(open.sourceID, branch.id, 'the transaction names the branch office');
  const [close] = measure(modules, engine, 'closeBranchOffice', () => engine.closeBranchOffice(branch.id));
  assert.equal(close.category, 'assetSale');
  assert.equal(close.cashEffect, office.deposit * .6);
  assert.equal(close.assetEffect, -office.deposit, 'the deposit asset is released');
  assert.equal(close.profitEffect, -office.deposit * .4, 'the kept 40% is a loss');
}

// 3. Employee complaint: the paid approaches are head-office expenses; "strict" costs nothing.
{
  const { modules, engine } = freshGame();
  engine.ensureCompletionDefaults();
  engine.g.employeeComplaintLog.push({ id: 'complaint-invest', status: 'open', week: engine.g.week, text: '残業が多い' });
  const [row] = measure(modules, engine, 'resolveEmployeeComplaint(invest)', () => engine.resolveEmployeeComplaint('complaint-invest', 'invest'));
  assert.equal(row.category, 'headOfficeExpense');
  assert.equal(row.cashEffect, -1_500_000);
  assert.equal(row.profitEffect, -1_500_000);
  engine.g.employeeComplaintLog.push({ id: 'complaint-strict', status: 'open', week: engine.g.week, text: '評価が不透明' });
  const count = engine.g.finance.transactions.length, cash = engine.g.companyCash;
  assert.equal(engine.resolveEmployeeComplaint('complaint-strict', 'strict'), true);
  assert.equal(engine.g.companyCash, cash, 'the strict approach costs nothing');
  assert.equal(engine.g.finance.transactions.length, count, 'and writes no zero transaction');
  assertValid(modules, engine, 'resolveEmployeeComplaint(strict)');
}

// 4. Transport rebuild on a logistics subsidiary: an expense.
{
  const { modules, engine } = freshGame();
  engine.g.subsidiaries.push({ id: 'sub-logistics', name: 'ロジ子会社', domain: 'logistics', industry: '物流', valuation: 500_000_000, status: 'active', weeklyProfit: 0, growth: .02, risk: .1, ownership: 1, retainedEarnings: 0, acquiredWeek: engine.g.week });
  const action = modules.completion.TRANSPORT_REBUILD_ACTIONS[0];
  const [row] = measure(modules, engine, `startTransportRebuild(${action.id})`, () => engine.startTransportRebuild('sub-logistics', action.id));
  assert.equal(row.category, 'headOfficeExpense');
  assert.equal(row.sourceID, engine.g.transportRebuildProjects.at(-1).id, 'the transaction names the project');
}

console.log('completion actions ledger tests passed');
