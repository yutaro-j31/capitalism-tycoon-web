'use strict';

// Integration regression for startup due-diligence terms x secondary sales.  These two
// features were originally tested separately, missing both an immediate-round-trip
// arbitrage and same-week company ledger identity collisions.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 880301) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function deterministicUnit(...parts) {
  let h = 2166136261;
  const text = parts.map(v => String(v ?? '')).join('|');
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
function liquidityDiscount(id, account, week) { return .12 + deterministicUnit('startup-secondary', id, account, week) * .16; }
function boundaryID(account, week, target) {
  assert.equal(week, 1);
  const ids = { company: { '.12': 'secondary-boundary-company-0.12-556', '.28': 'secondary-boundary-company-0.28-3093' },
    personal: { '.12': 'secondary-boundary-personal-0.12-3232', '.28': 'secondary-boundary-personal-0.28-15890' } };
  const id = ids[account][String(target).replace(/^0/, '')];
  return { id, discount: liquidityDiscount(id, account, week) };
}
function setup(seed = 880301) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 2_000_000_000;
  engine.g.companyCash = 2_000_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true);
  assert.equal(engine.establishDepartment('investment'), true);
  // Action persistence is covered explicitly below; avoiding hundreds of JSON save copies
  // keeps the 400-cycle exploit regression focused and lightweight.
  engine.save = () => {};
  engine.emit = () => {};
  engine.notify = () => {};
  return { modules, engine };
}
function startup(engine, id, ddDiscount) {
  const s = { id, name: `整合性検証-${id}`, domain: 'test', stage: 'Seed', valuation: 100_000_000,
    minTicket: 5_000_000, growth: .05, risk: .15, ownedCompany: 0, ownedPersonal: 0,
    alive: true, subsidiary: false, totalInvestedCompany: 0, totalInvestedPersonal: 0,
    ddNegotiatedOwnedCompany: 0, ddNegotiatedOwnedPersonal: 0,
    productProgress: .1, runwayWeeks: 52, reports: [], fundingRound: 'Seed', fundingOpen: true,
    dueDiligence: { done: true, week: engine.g.week, unit: 0, verdict: ddDiscount ? '危険' : '優良', discount: ddDiscount, flags: [], cost: 0 } };
  engine.g.startups.push(s);
  return s;
}
function cash(engine, account) { return engine.g[account === 'company' ? 'companyCash' : 'personalCash']; }
function ownedKey(account) { return account === 'company' ? 'ownedCompany' : 'ownedPersonal'; }
function ddOwnedKey(account) { return account === 'company' ? 'ddNegotiatedOwnedCompany' : 'ddNegotiatedOwnedPersonal'; }

// DD endpoints crossed with liquidity-discount endpoints, for both ownership accounts.
for (const account of ['company', 'personal']) for (const ddDiscount of [0, .15]) for (const target of [.12, .28]) {
  const { engine } = setup();
  const edge = boundaryID(account, engine.g.week, target);
  assert.ok(Math.abs(edge.discount - target) < .00002, `liquidity discount ${target} boundary must be exercised`);
  const s = startup(engine, edge.id, ddDiscount);
  const beginning = cash(engine, account);
  assert.equal(engine.investStartup(s.id, s.minTicket, account), true);
  assert.equal(engine.sellStartupSecondary(s.id, account), true);
  assert.ok(cash(engine, account) <= beginning, `${account}: DD ${ddDiscount}, liquidity ${edge.discount} immediate round trip must not profit`);
}

// DD is a term for future investments, not a retrospective haircut.  Identical pre-DD
// positions must receive identical proceeds whether DD was subsequently performed or not.
for (const account of ['company', 'personal']) {
  function sell(withLaterDD) {
    const { engine } = setup();
    const s = startup(engine, `pre-dd-protection-${account}`, 0);
    delete s.dueDiligence;
    assert.equal(engine.investStartup(s.id, s.minTicket, account), true);
    if (withLaterDD) s.dueDiligence = { done: true, week: engine.g.week, discount: .15 };
    const before = cash(engine, account);
    assert.equal(engine.sellStartupSecondary(s.id, account), true);
    return cash(engine, account) - before;
  }
  assert.equal(sell(true), sell(false), `${account}: later DD must not haircut pre-DD ownership`);
}

// Mixed positions retain separate valuation bases; repeated negotiated investments add only
// their actually acquired (post-cap) ownership to the DD bucket.
for (const account of ['company', 'personal']) {
  const { engine } = setup();
  const s = startup(engine, `mixed-ownership-${account}`, 0);
  delete s.dueDiligence;
  assert.equal(engine.investStartup(s.id, s.minTicket, account), true);
  const normalOwned = s[ownedKey(account)];
  s.dueDiligence = { done: true, week: engine.g.week, discount: .15 };
  assert.equal(engine.investStartup(s.id, s.minTicket, account), true);
  const firstNegotiated = s[ddOwnedKey(account)];
  assert.ok(firstNegotiated > 0);
  assert.equal(engine.investStartup(s.id, s.minTicket, account), true);
  assert.ok(s[ddOwnedKey(account)] > firstNegotiated, 'multiple post-DD investments must accumulate');
  assert.ok(Math.abs(s[ownedKey(account)] - normalOwned - s[ddOwnedKey(account)]) < 1e-12);
  const liquidity = liquidityDiscount(s.id, account, engine.g.week);
  const expected = Math.round((normalOwned * s.valuation + s[ddOwnedKey(account)] * s.valuation * .85) * (1 - liquidity));
  const before = cash(engine, account);
  assert.equal(engine.sellStartupSecondary(s.id, account), true);
  assert.equal(cash(engine, account) - before, expected, `${account}: mixed ownership must use two valuation bases`);
  assert.equal(s[ddOwnedKey(account)], 0, 'secondary sale must reset negotiated ownership');
}

// A funding round dilutes the negotiated bucket by exactly the same pre/post-money ratio as
// the pre-round total position. Follow-on contributions use round terms, not DD terms, and
// therefore do not enter the negotiated bucket.
{
  const { modules, engine } = setup();
  const s = startup(engine, 'dd-bucket-dilution', .15);
  assert.equal(engine.investStartup(s.id, s.minTicket, 'company'), true);
  assert.equal(engine.investStartup(s.id, s.minTicket, 'personal'), true);
  const before = { company: s.ddNegotiatedOwnedCompany, personal: s.ddNegotiatedOwnedPersonal };
  s.fundingOpen = true;
  assert.equal(engine.openStartupFundingRound(s), true);
  const ratio = s.activeFundingRound.preMoneyValuation / s.activeFundingRound.postMoneyValuation;
  const contribution = Math.min(engine.getStartupFundingRoundPlan(s.id).company.remaining, 1_000_000);
  assert.ok(contribution > 0);
  assert.equal(engine.participateStartupFundingRound(s.id, contribution, 'company'), true);
  assert.equal(s.ddNegotiatedOwnedCompany, before.company, 'follow-on contribution must not enter DD bucket before close');
  engine.g.week = s.activeFundingRound.closesWeek;
  assert.equal(engine.closeStartupFundingRound(s), true);
  assert.ok(Math.abs(s.ddNegotiatedOwnedCompany - before.company * ratio) < 1e-12);
  assert.ok(Math.abs(s.ddNegotiatedOwnedPersonal - before.personal * ratio) < 1e-12);
  engine.g.week = 1; // Keep the focused accounting snapshot in the transaction week.
  const validation = modules.finance.validate(engine.g);
  assert.equal(validation.ok, true, (validation.errors || []).join('\n'));
}

// Buckets are account-local, persist for mixed positions, and legacy saves without them load
// as normal ownership rather than inventing a retrospective DD haircut.
{
  const { modules, engine } = setup();
  const company = startup(engine, 'bucket-isolation-company', .15);
  assert.equal(engine.investStartup(company.id, company.minTicket, 'company'), true);
  assert.ok(company.ddNegotiatedOwnedCompany > 0);
  assert.equal(company.ddNegotiatedOwnedPersonal, 0);
  const personal = startup(engine, 'bucket-isolation-personal', .15);
  assert.equal(engine.investStartup(personal.id, personal.minTicket, 'personal'), true);
  assert.ok(personal.ddNegotiatedOwnedPersonal > 0);
  assert.equal(personal.ddNegotiatedOwnedCompany, 0);

  const mixed = startup(engine, 'mixed-save-reload', 0);
  delete mixed.dueDiligence;
  assert.equal(engine.investStartup(mixed.id, mixed.minTicket, 'company'), true);
  mixed.dueDiligence = { done: true, week: engine.g.week, discount: .15 };
  assert.equal(engine.investStartup(mixed.id, mixed.minTicket, 'company'), true);
  const expectedBucket = mixed.ddNegotiatedOwnedCompany;
  modules.engine.TycoonEngine.prototype.save.call(engine);
  const reloaded = modules.engine.TycoonEngine.load();
  const loadedMixed = reloaded.g.startups.find(x => x.id === mixed.id);
  assert.equal(loadedMixed.ddNegotiatedOwnedCompany, expectedBucket);
  const liquidity = liquidityDiscount(loadedMixed.id, 'company', reloaded.g.week);
  const expectedProceeds = Math.round(((loadedMixed.ownedCompany - expectedBucket) * loadedMixed.valuation + expectedBucket * loadedMixed.valuation * .85) * (1 - liquidity));
  const cashBefore = reloaded.g.companyCash;
  assert.equal(reloaded.sellStartupSecondary(loadedMixed.id, 'company'), true);
  assert.equal(reloaded.g.companyCash - cashBefore, expectedProceeds);
  assert.equal(modules.finance.validate(reloaded.g).ok, true);
}
{
  const { modules, engine } = setup();
  const legacy = startup(engine, 'legacy-no-bucket', .15);
  legacy.ownedCompany = .1;
  legacy.totalInvestedCompany = 10_000_000;
  delete legacy.ddNegotiatedOwnedCompany;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  const expected = Math.round(legacy.ownedCompany * legacy.valuation * (1 - liquidityDiscount(legacy.id, 'company', engine.g.week)));
  modules.engine.TycoonEngine.prototype.save.call(engine);
  const reloaded = modules.engine.TycoonEngine.load();
  const loaded = reloaded.g.startups.find(x => x.id === legacy.id);
  assert.equal(loaded.ownedCompany, .1, 'legacy ownership must survive load');
  assert.equal(loaded.ddNegotiatedOwnedCompany ?? 0, 0, 'legacy missing bucket must safely default to normal ownership');
  const before = reloaded.g.companyCash;
  assert.equal(reloaded.sellStartupSecondary(loaded.id, 'company'), true);
  assert.equal(reloaded.g.companyCash - before, expected, 'missing bucket must use normal valuation');
  assert.ok(Number.isFinite(reloaded.g.companyCash));
  assert.equal(modules.finance.validate(reloaded.g).ok, true);
}

// The historical exploit repeated hundreds of times in one week.  Both accounts must lose,
// not monotonically manufacture cash, while all 400 legitimate actions remain available.
for (const account of ['company', 'personal']) {
  const { modules, engine } = setup(20260818);
  const edge = boundaryID(account, engine.g.week, .12);
  const s = startup(engine, edge.id, .15);
  const beginning = cash(engine, account);
  for (let i = 0; i < 400; i++) {
    const before = cash(engine, account);
    assert.equal(engine.investStartup(s.id, s.minTicket, account), true);
    assert.equal(engine.sellStartupSecondary(s.id, account), true);
    assert.ok(cash(engine, account) <= before, `cycle ${i + 1} must not increase ${account} cash`);
  }
  assert.ok(cash(engine, account) < beginning, `${account}: 400 cycles must have a net cost`);
  if (account === 'company') assert.equal(modules.finance.validate(engine.g).ok, true, '400 company cycles must validate');
}

// Two valid same-startup/company sales in one week each receive a distinct deterministic
// identity, and their ledger cash effects reconcile exactly to companyCash.
{
  const { modules, engine } = setup();
  const s = startup(engine, 'same-week-company-ledger', .15);
  const cashBefore = engine.g.companyCash;
  const ledgerBefore = engine.g.finance.transactions.length;
  for (let i = 0; i < 2; i++) {
    assert.equal(engine.investStartup(s.id, s.minTicket, 'company'), true);
    assert.equal(engine.sellStartupSecondary(s.id, 'company'), true);
  }
  const rows = engine.g.finance.transactions.slice(ledgerBefore);
  const sales = rows.filter(t => t.sourceType === 'startupSecondarySale');
  assert.equal(sales.length, 2, 'both valid same-week sales must be recorded');
  assert.equal(new Set(sales.map(t => t.transactionID)).size, 2);
  assert.equal(new Set(sales.map(t => t.idempotencyKey)).size, 2);
  assert.equal(rows.reduce((sum, t) => sum + t.cashEffect, 0), engine.g.companyCash - cashBefore, 'ledger delta must equal cash delta');
  assert.equal(modules.finance.validate(engine.g).ok, true, 'multiple transactions must validate');
  modules.engine.TycoonEngine.prototype.save.call(engine);
  const reloaded = modules.engine.TycoonEngine.load();
  assert.equal(modules.finance.validate(reloaded.g).ok, true, 'save/reload must validate');
}

// Ownership/cash/ledger separation, plus failure atomicity across every relevant field.
{
  const { modules, engine } = setup();
  const company = startup(engine, 'company-separation', .15);
  const personalCash = engine.g.personalCash;
  assert.equal(engine.investStartup(company.id, company.minTicket, 'company'), true);
  assert.equal(engine.sellStartupSecondary(company.id, 'company'), true);
  assert.equal(engine.g.personalCash, personalCash);
  assert.equal(company.ownedPersonal, 0);

  const personal = startup(engine, 'personal-separation', .15);
  const companyCash = engine.g.companyCash, ledger = JSON.stringify(engine.g.finance.transactions);
  assert.equal(engine.investStartup(personal.id, personal.minTicket, 'personal'), true);
  assert.equal(engine.sellStartupSecondary(personal.id, 'personal'), true);
  assert.equal(engine.g.companyCash, companyCash);
  assert.equal(JSON.stringify(engine.g.finance.transactions), ledger);
  assert.equal(personal.ownedCompany, 0);

  const invalid = startup(engine, 'invalid-atomicity', .15);
  assert.equal(engine.investStartup(invalid.id, invalid.minTicket, 'company'), true);
  invalid.activeFundingRound = { status: 'open' };
  const before = JSON.stringify({ companyCash: engine.g.companyCash, personalCash: engine.g.personalCash,
    ownedCompany: invalid.ownedCompany, ownedPersonal: invalid.ownedPersonal, total: invalid.totalInvestedCompany,
    valuation: invalid.valuation, transactions: engine.g.finance.transactions });
  assert.equal(engine.sellStartupSecondary(invalid.id, 'company'), false);
  const after = JSON.stringify({ companyCash: engine.g.companyCash, personalCash: engine.g.personalCash,
    ownedCompany: invalid.ownedCompany, ownedPersonal: invalid.ownedPersonal, total: invalid.totalInvestedCompany,
    valuation: invalid.valuation, transactions: engine.g.finance.transactions });
  assert.equal(after, before, 'failed sale must be atomic');
  assert.equal(modules.finance.validate(engine.g).ok, true);
}

console.log('Startup secondary integrity integration tests passed');
