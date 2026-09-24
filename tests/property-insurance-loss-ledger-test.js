'use strict';

// Issue #755 (P0-10): a property incident was expensed with profitEffect -baseLoss but no cash,
// asset or liability effect, so assets != liabilities + equity from the first incident on.
// Owner decision: the incident's repair or third-party compensation is paid in cash by the
// owner at the time (company and personal alike, in full even into negative cash); a covered
// claim reimburses it later. Runs against the full production script set.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}

function newGame(seed) {
  const loaded = loadGame({ headless: true, random: lcg(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Insurance', companyName: 'Insurance Co', difficulty: 'normal' });
  const finance = loaded.modules.finance;
  engine.g.companyCash = 2_000_000_000;
  engine.g.finance = finance.defaultFinanceState(engine.g);
  const land = engine.g.properties.find(p => !p.owner && p.kind === '土地' && p.price < 300_000_000);
  assert.ok(land, 'fixture needs an unowned plot of land');
  insuranceModule = loaded.modules.realEstatePropertyInsurance;
  insuranceGame = engine.g;
  return { engine, finance, insurance: insuranceModule, land };
}

function assertValid(finance, g, label) {
  const v = finance.validate(g);
  assert.equal(v.ok, true, `${label}: ${v.errors.join(' / ')}`);
}

const bsDiff = (finance, g) => finance.buildStatements(g, '52').balanceSheet.balanceDifference;
let insuranceModule = null, insuranceGame = null;
const history = g => insuranceModule.ensure(g).propertyInsuranceHistory;
const incidents = g => history(g).filter(r => r.type === 'insurance-incident');
function firstIncidentWeek(insurance, p, from) {
  // processWeek normalizes the property first (buildingCondition defaults to 85), so search on that state.
  insurance.ensure(insuranceGame);
  for (let w = from; w < from + 2000; w++) if (insurance.incidentFor(p, w)) return w;
  throw new Error('no incident week found');
}

// 1. Production loop: a company holding a building for 104 weeks, incidents without insurance.
{
  const { engine, finance, land } = newGame(3);
  const g = engine.g;
  assert.equal(engine.buyProperty(land.id, 'company'), true);
  assert.equal(engine.buildOnLand(land.id, '本社ビル'), true);
  for (let i = 0; i < 104; i++) {
    const cash = g.companyCash, rows = g.finance.transactions.length, diff = bsDiff(finance, g), seen = incidents(g).length;
    assert.notEqual(engine.advanceWeek(false), false);
    const week = g.week, added = g.finance.transactions.slice(rows);
    const ledger = added.reduce((a, t) => a + t.cashEffect, 0);
    assert.ok(Math.abs((g.companyCash - cash) - ledger) <= 0.05, `week ${week}: cash moved ${g.companyCash - cash} vs ledger ${ledger}`);
    assertValid(finance, g, `week ${week}`);
    for (const row of incidents(g).slice(seen)) {
      const loss = added.find(t => t.sourceType === 'property-insurance-loss' && t.sourceID === row.propertyID);
      assert.ok(loss, `week ${week}: incident is ledgered`);
      assert.equal(loss.cashEffect, -row.baseLoss, `week ${week}: the incident is paid in cash`);
      assert.equal(loss.profitEffect, -row.baseLoss);
      assert.ok(Math.abs(bsDiff(finance, g) - diff) < 0.01, `week ${week}: an incident keeps the books balanced`);
    }
  }
  assert.ok(incidents(g).length >= 1, 'fixture must hit at least one incident');
}

// 2. Insured company property: the incident is paid, the covered claim reimburses it, books balance.
{
  const { engine, finance, insurance, land } = newGame(755);
  const g = engine.g;
  assert.equal(engine.buyProperty(land.id, 'company'), true);
  assert.equal(engine.setPropertyInsurance(land.id, 'standard'), true);
  g.week = firstIncidentWeek(insurance, land, g.week + 1);
  const cash = g.companyCash;
  insurance.processWeek(engine);
  const row = incidents(g).at(-1), premium = history(g).filter(r => r.type === 'insurance-premium' && r.week === g.week).reduce((a, r) => a + r.premium, 0);
  assert.ok(row && row.payout > 0, 'fixture: covered incident');
  assert.equal(Math.round((cash - g.companyCash) * 100) / 100, Math.round((row.baseLoss + premium) * 100) / 100, 'company pays the premium and the incident');
  assertValid(finance, g, 'insured incident');
  const beforeClaim = g.companyCash;
  const claim = engine.claimPropertyInsurance(land.id, row.incidentID);
  assert.ok(claim && claim.payout === row.payout);
  assert.equal(g.companyCash, Math.round((beforeClaim + row.payout) * 100) / 100);
  assertValid(finance, g, 'after claim');
}

// 3. Personal property: the founder pays the incident; the company books stay untouched.
{
  const { engine, finance, insurance, land } = newGame(756);
  const g = engine.g;
  g.personalCash = 500_000_000;
  assert.equal(engine.buyProperty(land.id, 'personal'), true);
  g.week = firstIncidentWeek(insurance, land, g.week + 1);
  const personal = g.personalCash, company = g.companyCash, rows = g.finance.transactions.length;
  insurance.processWeek(engine);
  const row = incidents(g).at(-1);
  assert.equal(Math.round((personal - g.personalCash) * 100) / 100, row.baseLoss, 'personal owner pays the incident');
  assert.equal(g.companyCash, company);
  assert.equal(g.finance.transactions.length, rows, 'personal incident stays off the company ledger');
  assertValid(finance, g, 'personal incident');
}

// 4. Short of cash: the incident is paid in full into negative cash, and the books still balance.
{
  const { engine, finance, insurance, land } = newGame(757);
  const g = engine.g;
  assert.equal(engine.buyProperty(land.id, 'company'), true);
  const drain = g.companyCash - 1_000;
  g.companyCash -= drain;
  finance.event(g, 'otherOperating', drain, { cashEffect: -drain, profitEffect: -drain, sourceType: 'test', sourceID: 'drain' });
  finance.rebuildSnapshotForWeek(g, g.week);
  g.week = firstIncidentWeek(insurance, land, g.week + 1);
  insurance.processWeek(engine);
  const row = incidents(g).at(-1);
  assert.ok(row.baseLoss > 1_000);
  assert.equal(Math.round(g.companyCash * 100) / 100, Math.round((1_000 - row.baseLoss) * 100) / 100, 'paid in full, cash goes negative');
  assertValid(finance, g, 'incident into negative cash');
}

console.log('property insurance loss ledger tests passed');
