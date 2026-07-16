const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let seed = 0x6b100001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const { engineModule, modules } = loadGame({ random });
const { finance } = modules;
const game = new engineModule.TycoonEngine();

game.configure({
  playerName: '通常進行監査者',
  companyName: '通常IPO商事',
  difficulty: 'normal',
  scenario: 'standard',
  founderPrefID: 'fukuoka',
  founderTraitID: 'merchant'
});

assert.equal(game.g.companyCash, 8_000_000, 'normal difficulty must start with exactly 8,000,000 yen');
assert.equal(game.g.companyDebt, 0, 'normal route must not start with company debt');
assert.equal(game.g.reports.length, 0, 'normal route must not inject historical reports');

const RESERVE = 500_000;
const MAX_WEEKS = 208;
const TARGET_STORES = 4;

function totalStoreCost(tenant, businessID = 'ramen') {
  return game.business(businessID).storeCost + tenant.deposit;
}

function availableRamenTenants() {
  return game.g.tenants
    .filter(row => !row.occupiedBy)
    .map(row => ({ row, cost: totalStoreCost(row), score: (Number(row.traffic) || 0) / Math.max(1, totalStoreCost(row)) }))
    .sort((a, b) => b.score - a.score || a.cost - b.cost);
}

function openAffordableStore() {
  if (game.g.stores.length >= TARGET_STORES) return false;
  const choices = availableRamenTenants();
  const choice = choices.find(entry => game.g.companyCash >= entry.cost + RESERVE)
    || choices.find(entry => game.g.stores.length < 3 && game.g.companyCash >= entry.cost);
  if (!choice) return false;
  return game.openStore({
    tenantID: choice.row.id,
    businessID: 'ramen',
    name: `通常IPOラーメン${game.g.stores.length + 1}号店`,
    operatingHours: 3
  });
}

function cheapestOffice() {
  return [...game.g.rentalOffices].sort((a, b) => a.deposit - b.deposit || a.rent - b.rent)[0];
}

function hireRole(role) {
  if (game.g.executives[role]) return true;
  const candidate = game.g.executiveMarket.find(row => row.role === role);
  if (!candidate) return false;
  const salary = Math.ceil((candidate.desiredSalary || candidate.salary) * 1.5);
  const so = Math.max(candidate.desiredSO || 0, 0.04);
  for (let attempt = 0; attempt < 8 && !game.g.executives[role]; attempt += 1) {
    game.hireExecutive(candidate.id, salary, so);
  }
  return Boolean(game.g.executives[role]);
}

function maybeBuildRoute() {
  while (openAffordableStore()) {}

  if (!game.g.hasHeadOffice) {
    const office = cheapestOffice();
    if (office && game.g.companyCash >= office.deposit + RESERVE) game.contractOffice(office.id);
  }

  if (game.g.hasHeadOffice && !game.g.departments.accounting) {
    const accounting = game.g.businesses && modules.data.MASTER.departments.find(row => row.id === 'accounting');
    if (accounting && game.g.companyCash >= accounting.setupCost + RESERVE) game.establishDepartment('accounting');
  }

  if (game.g.companyCash >= 1_000_000) {
    hireRole('CEO');
    hireRole('CFO');
  }

  if (!game.g.boardEstablished && game.g.executives.CEO && game.g.executives.CFO && game.g.companyCash >= 5_000_000 + RESERVE) {
    game.establishBoard();
  }
}

let ipoWeek = null;
for (let i = 0; i < MAX_WEEKS && !game.g.gameOver && !game.g.publicCompany; i += 1) {
  maybeBuildRoute();
  if (game.ipoMissingReasons().length === 0) {
    assert.equal(game.executeIPO('東証グロース', 100_000), true, 'IPO execution must succeed once all conditions are met');
    ipoWeek = game.g.week;
    break;
  }
  assert.notEqual(game.advanceWeek(false), false, `week ${game.g.week + 1} must advance`);
}

const annualProfit = game.g.reports.slice(-52).reduce((sum, row) => sum + Number(row.profit || 0), 0);
const audit = {
  week: game.g.week,
  ipoWeek,
  publicCompany: game.g.publicCompany,
  gameOver: game.g.gameOver,
  gameOverReason: game.g.gameOverReason,
  companyCash: Math.round(game.g.companyCash),
  companyDebt: Math.round(game.g.companyDebt),
  companyValue: Math.round(game.companyValue()),
  stores: game.g.stores.length,
  openStores: game.g.stores.filter(row => row.status === 'open').length,
  annualProfit: Math.round(annualProfit),
  hasHeadOffice: game.g.hasHeadOffice,
  accounting: Boolean(game.g.departments.accounting),
  boardEstablished: game.g.boardEstablished,
  CEO: Boolean(game.g.executives.CEO),
  CFO: Boolean(game.g.executives.CFO),
  missing: game.ipoMissingReasons()
};
console.log(`NORMAL_IPO_AUDIT ${JSON.stringify(audit)}`);

assert.equal(game.g.gameOver, false, `normal route must not end in bankruptcy: ${JSON.stringify(audit)}`);
assert.equal(game.g.publicCompany, true, `normal 8,000,000-yen route must reach IPO within ${MAX_WEEKS} weeks: ${JSON.stringify(audit)}`);
assert.ok(ipoWeek >= 52 && ipoWeek <= MAX_WEEKS, `IPO week must reflect the 52-week profit gate: ${ipoWeek}`);
assert.equal(game.g.companyDebt, 0, 'baseline audit should remain reachable without mandatory borrowing');
assert.ok(game.g.stores.length >= 3, 'IPO route must retain at least three stores');
assert.ok(game.g.reports.length >= 52, 'IPO route must produce at least 52 organic weekly reports');
assert.equal(finance.validate(game.g).ok, true, finance.validate(game.g).errors.join('\n'));
assert.deepEqual(findStateIssues(game.g).filter(issue => !issue.startsWith('g.finance.lastStatements.ratios.')), []);

console.log('normal-start IPO balance audit passed');
