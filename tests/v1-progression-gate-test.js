const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let seed = 0x51c0ffee;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const { engineModule, modules } = loadGame({ random });
const { TycoonEngine } = engineModule;
const { finance, competitor, workforce, supply } = modules;
const game = new TycoonEngine();

function checkpoint(name, condition) {
  assert.ok(condition, `progression checkpoint failed: ${name}`);
}
function validate(name) {
  assert.doesNotThrow(() => competitor.validate(game.g), `${name}: competitor validation failed`);
  assert.equal(finance.validate(game.g).ok, true, `${name}: ${finance.validate(game.g).errors.join(' / ')}`);
  assert.deepEqual(findStateIssues(game.g), [], `${name}: non-finite or malformed state`);
}
function provision(amount = 2_000_000_000) {
  game.g.companyCash = Math.max(game.g.companyCash, amount);
  game.g.personalCash = Math.max(game.g.personalCash, 100_000_000);
  finance.ensureFinance(game.g);
  game.g.finance.balanceSheet.cash = game.g.companyCash;
}

// 1. Founder setup.
assert.equal(game.configure({
  playerName: '進行テスト創業者',
  companyName: '進行テスト商事',
  difficulty: 'normal',
  scenario: 'standard',
  founderPrefID: 'tokyo',
  founderTraitID: 'merchant'
}), true);
checkpoint('configured', game.g.configured && game.g.companyName === '進行テスト商事');
provision();
validate('configured');

// 2. First ramen store and a second business/store.
const ramenTenant = game.g.tenants.find(row => row.businessID === 'ramen' && !row.occupiedBy);
assert.ok(ramenTenant, 'ramen tenant missing');
assert.equal(game.openStore({ tenantID: ramenTenant.id, businessID: 'ramen', name: '進行ラーメン1号店', operatingHours: 3 }), true);
const secondTenant = game.g.tenants.find(row => row.businessID !== 'ramen' && !row.occupiedBy);
assert.ok(secondTenant, 'second-business tenant missing');
assert.equal(game.openStore({ tenantID: secondTenant.id, businessID: secondTenant.businessID, name: '進行複合店2号店', operatingHours: 3 }), true);
for (const store of game.g.stores) {
  store.status = 'open';
  store.openingWeeksRemaining = 0;
  store.openingWeek = game.g.week;
}
supply.ensure(game.g);
workforce.ensure(game.g);
checkpoint('multi-business stores', game.g.stores.length >= 2 && new Set(game.g.stores.map(row => row.businessID)).size >= 2);
validate('stores');

// 3. Headquarters, department and board.
const office = game.g.rentalOffices.find(row => !row.contracted);
assert.ok(office, 'rental office missing');
assert.equal(game.contractOffice(office.id), true);
checkpoint('head office', game.g.hasHeadOffice && game.g.contractedOfficeID === office.id);
const departmentID = Object.keys(modules.data.DEPARTMENT_UNLOCKS || {})[0] || 'finance';
assert.equal(game.establishDepartment(departmentID), true);
checkpoint('department', Boolean(game.g.departments[departmentID]));
assert.equal(game.establishBoard(), true);
checkpoint('board', game.g.boardEstablished === true);
validate('organization');

// 4. Company VC investment converted to a subsidiary.
const startup = game.g.startups[0];
assert.ok(startup, 'startup missing');
startup.alive = true;
startup.fundingOpen = true;
startup.ownedCompany = Math.max(Number(startup.ownedCompany) || 0, 0.6);
startup.totalInvestedCompany = Math.max(Number(startup.totalInvestedCompany) || 0, 80_000_000);
startup.valuation = Math.max(Number(startup.valuation) || 0, 300_000_000);
assert.equal(game.makeSubsidiary(startup.id), true);
checkpoint('startup subsidiary', game.g.subsidiaries.some(row => row.sourceStartupID === startup.id || row.id === startup.id));
validate('startup subsidiary');

// 5. Friendly M&A creates a managed subsidiary.
game.g.departments.investment = game.g.departments.investment || { level: 3, active: true };
game.g.departmentStaff.investment = Math.max(Number(game.g.departmentStaff.investment) || 0, 3);
assert.equal(game.generateMATargets(true), true);
const target = game.g.acquisitionTargets.find(row => row.status === 'available') || game.g.acquisitionTargets[0];
assert.ok(target, 'M&A target generation failed');
provision(Math.max(2_000_000_000, (Number(target.price) || Number(target.valuation) || 0) * 3));
assert.equal(game.acquireTarget(target.id, 'friendly'), true);
checkpoint('M&A subsidiary', game.g.maSubsidiaries.length >= 1 && game.g.totalAcquisitions >= 1);
validate('M&A');

// 6. Meet the existing IPO gate without bypassing executeIPO itself.
provision(5_000_000_000);
game.g.companyReputation = Math.max(game.g.companyReputation, 85);
game.g.companyCredit = Math.max(game.g.companyCredit, 85);
game.g.employeeSatisfaction = Math.max(game.g.employeeSatisfaction, 70);
game.g.reports = Array.from({ length: 16 }, (_, index) => ({
  week: Math.max(1, game.g.week - 15 + index),
  sales: 80_000_000,
  expenses: 45_000_000,
  profit: 35_000_000
}));
game.g.lastReport = game.g.reports.at(-1);
game.g.weeklySalesHistory = game.g.reports.map(row => row.sales);
game.g.weeklyProfitHistory = game.g.reports.map(row => row.profit);
game.g.companyValueHistory = game.g.reports.map((_, index) => 5_000_000_000 + index * 100_000_000);
const missing = game.ipoMissingReasons();
assert.deepEqual(missing, [], `IPO route remains blocked: ${missing.join(' / ')}`);
assert.equal(game.executeIPO('東証グロース', 100_000), true);
checkpoint('parent IPO', game.g.publicCompany && game.g.stockPrice > 0 && game.g.externalShareholderRatio > 0);
validate('IPO');

// 7. Save/reload must preserve the complete route and all major references.
const snapshot = JSON.parse(JSON.stringify(game.g));
const migrated = engineModule.migrateSave(snapshot);
const reloaded = new TycoonEngine(migrated);
checkpoint('reload public company', reloaded.g.publicCompany === true);
checkpoint('reload stores', reloaded.g.stores.length >= 2);
checkpoint('reload multi-business', new Set(reloaded.g.stores.map(row => row.businessID)).size >= 2);
checkpoint('reload subsidiaries', reloaded.g.subsidiaries.length >= 1 && reloaded.g.maSubsidiaries.length >= 1);
checkpoint('reload organization', reloaded.g.hasHeadOffice && reloaded.g.boardEstablished);
assert.doesNotThrow(() => competitor.validate(reloaded.g));
assert.equal(finance.validate(reloaded.g).ok, true, finance.validate(reloaded.g).errors.join(' / '));
assert.deepEqual(findStateIssues(reloaded.g), []);

console.log('provisional v1 progression gate passed');
