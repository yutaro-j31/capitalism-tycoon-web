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

const MAX_WEEKS = 208;
const STORE_ROUTE = ['fukuoka', 'osaka', 'tokyo'];
const STORE_RESERVES = [500_000, 4_000_000, 5_000_000];
const actionLog = [];

function totalStoreCost(tenant, businessID = 'ramen') {
  return game.business(businessID).storeCost + tenant.deposit;
}

function routeTenant(index) {
  const prefID = STORE_ROUTE[index];
  return game.g.tenants
    .filter(row => row.prefID === prefID && !row.occupiedBy)
    .sort((a, b) => b.traffic - a.traffic || a.deposit - b.deposit)[0];
}

function maybeOpenNextStore() {
  const index = game.g.stores.length;
  if (index >= STORE_ROUTE.length) return false;
  if (index > 0 && (!game.g.stores.every(row => row.status === 'open') || Number(game.g.lastReport?.profit || 0) <= 0)) return false;
  const tenant = routeTenant(index);
  if (!tenant) return false;
  const cost = totalStoreCost(tenant);
  const reserve = STORE_RESERVES[index];
  if (game.g.companyCash < cost + reserve) return false;
  const result = game.openStore({
    tenantID: tenant.id,
    businessID: 'ramen',
    name: `通常IPOラーメン${index + 1}号店`,
    operatingHours: 3
  });
  if (result) actionLog.push({ week: game.g.week, action: 'openStore', prefID: tenant.prefID, cash: Math.round(game.g.companyCash) });
  return result;
}

function cheapestOffice() {
  return [...game.g.rentalOffices].sort((a, b) => a.deposit - b.deposit || a.rent - b.rent)[0];
}

function roleOffer(role) {
  const candidate = game.g.executiveMarket.find(row => row.role === role);
  if (!candidate) return null;
  const salary = Math.ceil((candidate.desiredSalary || candidate.salary) * 1.5);
  return { candidate, salary, so: Math.max(candidate.desiredSO || 0, 0.04), bonus: salary * 0.25 };
}

function hireRole(role) {
  if (game.g.executives[role]) return true;
  const offer = roleOffer(role);
  if (!offer) return false;
  for (let attempt = 0; attempt < 8 && !game.g.executives[role]; attempt += 1) {
    game.hireExecutive(offer.candidate.id, offer.salary, offer.so);
  }
  if (game.g.executives[role]) actionLog.push({ week: game.g.week, action: `hire${role}`, cash: Math.round(game.g.companyCash) });
  return Boolean(game.g.executives[role]);
}

function maybeBuildRoute() {
  maybeOpenNextStore();
  const openStores = game.g.stores.filter(row => row.status === 'open').length;
  if (openStores < 3) return;

  if (!game.g.hasHeadOffice) {
    const office = cheapestOffice();
    if (office && game.g.companyCash >= office.deposit + 5_000_000 && game.contractOffice(office.id)) {
      actionLog.push({ week: game.g.week, action: 'contractOffice', cash: Math.round(game.g.companyCash) });
    }
    return;
  }

  if (!game.g.departments.accounting) {
    const accounting = modules.data.MASTER.departments.find(row => row.id === 'accounting');
    if (accounting && game.g.companyCash >= accounting.setupCost + 5_000_000 && game.establishDepartment('accounting')) {
      actionLog.push({ week: game.g.week, action: 'establishAccounting', cash: Math.round(game.g.companyCash) });
    }
    return;
  }

  if (!game.g.executives.CEO || !game.g.executives.CFO) {
    const missingOffers = ['CEO', 'CFO'].filter(role => !game.g.executives[role]).map(roleOffer).filter(Boolean);
    const requiredCash = missingOffers.reduce((sum, offer) => sum + offer.bonus, 0) + 5_000_000 + 4_000_000;
    if (game.g.companyCash >= requiredCash) {
      hireRole('CEO');
      hireRole('CFO');
    }
    return;
  }

  if (!game.g.boardEstablished && game.g.companyCash >= 8_000_000 && game.establishBoard()) {
    actionLog.push({ week: game.g.week, action: 'establishBoard', cash: Math.round(game.g.companyCash) });
  }
}

let ipoWeek = null;
for (let i = 0; i < MAX_WEEKS && !game.g.gameOver && !game.g.publicCompany; i += 1) {
  maybeBuildRoute();
  if (game.ipoMissingReasons().length === 0) {
    assert.equal(game.executeIPO('東証グロース', 100_000), true, 'IPO execution must succeed once all conditions are met');
    ipoWeek = game.g.week;
    actionLog.push({ week: game.g.week, action: 'executeIPO', cash: Math.round(game.g.companyCash) });
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
  reports: game.g.reports.length,
  annualProfit: Math.round(annualProfit),
  hasHeadOffice: game.g.hasHeadOffice,
  accounting: Boolean(game.g.departments.accounting),
  boardEstablished: game.g.boardEstablished,
  CEO: Boolean(game.g.executives.CEO),
  CFO: Boolean(game.g.executives.CFO),
  missing: game.ipoMissingReasons(),
  actionLog
};
console.log(`NORMAL_IPO_AUDIT ${JSON.stringify(audit)}`);

assert.equal(game.g.gameOver, false, `normal route must not end in bankruptcy: ${JSON.stringify(audit)}`);
assert.equal(game.g.publicCompany, true, `normal 8,000,000-yen route must reach IPO within ${MAX_WEEKS} weeks: ${JSON.stringify(audit)}`);
assert.ok(ipoWeek >= 53 && ipoWeek <= MAX_WEEKS, `IPO week must reflect the 52 organic-report gate: ${ipoWeek}`);
assert.equal(game.g.companyDebt, 0, 'baseline audit should remain reachable without mandatory borrowing');
assert.equal(game.g.stores.length, 3, 'baseline route should reach IPO with the required three stores, not expansion spam');
assert.ok(game.g.reports.length >= 52, 'IPO route must produce at least 52 organic weekly reports');
const validation = finance.validate(game.g);
assert.equal(validation.ok, true, validation.errors.join('\n'));
const serialized = JSON.stringify(game.g);
assert.ok(serialized.length > 0, 'completed progression state must remain JSON serializable');
const serializedIssues = findStateIssues(JSON.parse(serialized)).filter(issue =>
  !issue.startsWith('g.finance.lastStatements.ratios.') &&
  !/^g\.finance\.transactions\[\d+\]\.inventoryAmount: negative quantity\/inventory\/share value$/.test(issue)
);
assert.deepEqual(serializedIssues, []);

console.log('normal-start IPO balance audit passed');
