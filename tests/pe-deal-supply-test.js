'use strict';

// PE mode T16 (docs/PE_MODE_TASKS.md): 案件供給とDD枠の結線. Uses the full VM harness rather
// than the lightweight require-loader because js/pe-deal-supply.js wraps startMADueDiligence /
// generateMATargets, which only exist once js/app.js has called installMADealRoom -- the
// harness dispatches DOMContentLoaded at the end of its script list, which is what triggers
// this module's deferred install (same pattern js/pe-fund.js uses for completion.js).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');

function makeRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }
function freshLoad(seed) { return loadGame({ random: makeRandom(seed), isolatedLegacyIndex: true }); }

// A configured firm with an investment department, one prior exit (so PE mode is unlocked) and
// enough personal cash that formableFundSize lands well above Fund I scale unless asked otherwise.
function setupFirm(handles, { personalCash = 30_000_000_000, companyCash = 50_000_000_000 } = {}) {
  const { engineModule, modules } = handles;
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'S', companyName: 'S商事', difficulty: 'normal' });
  e.g.departments.investment = { established: true };
  e.g.departmentStaff.investment = 9;
  e.g.executives.CSO = { role: 'CSO', skill: 80 };
  e.g.executives.CFO = { role: 'CFO', skill: 80 };
  e.g.companyCash = companyCash;
  modules.peFund.recordExit(e.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
  e.g.personalCash = personalCash;
  return e;
}
function formFund(handles, e) {
  const pf = handles.modules.peFund;
  return pf.createFund(e.g, { size: pf.formableFundSize(e.g), y0: e.g.week, terms: pf.fundTermsForScore(e.g.peFirm.trackRecord.score) });
}
function peTargets(handles, e) { return e.g.acquisitionTargets.filter(t => handles.modules.peDealSupply.isPETarget(t)); }

const main = freshLoad(11);
const { modules } = main;
const ds = modules.peDealSupply, pf = modules.peFund, tiers = modules.peIndustryTiers;

// 1. The module installs its wrappers onto the prototype (deferred until installMADealRoom ran).
{
  assert.ok(ds, 'peDealSupply module must be registered');
  assert.ok(main.engineModule.TycoonEngine.prototype.__peDealSupplyInstalled, 'wrappers must be installed by DOMContentLoaded');
  assert.equal(ds.SUPPLY_INTERVAL_WEEKS, 13, '52 / 13 = 年4件');
  assert.equal(ds.isPETarget({ peTierID: 'pillar' }), true);
  assert.equal(ds.isPETarget({ id: 'ordinary' }), false);
  assert.equal(ds.isPETarget(null), false);
}

// 2. Completion criterion: 週を進めるだけでPE案件が供給される。Supply only lands on the
// 13-week cadence, never more than 4 per year, and every arrival belongs to that year's
// generateAnnualDeals() set (i.e. it is T11's supply, not something invented here).
{
  const e = setupFirm(main);
  const fund = formFund(main, e);
  const arrivals = [];
  const startWeek = e.g.week;
  for (let i = 0; i < 52; i++) {
    const before = new Set(peTargets(main, e).map(t => t.id));
    e.advanceWeek(false);
    for (const t of peTargets(main, e)) if (!before.has(t.id)) arrivals.push({ week: e.g.week, target: t });
  }
  assert.ok(arrivals.length > 0, 'advancing a year with an investing fund must supply at least one PE deal');
  assert.ok(arrivals.length <= 4, `at most 4 PE deals per year, got ${arrivals.length}`);
  for (const { week } of arrivals) assert.equal(week % ds.SUPPLY_INTERVAL_WEEKS, 1, `supply must land on the 13-week cadence, got week ${week}`);
  const ids = arrivals.map(a => a.target.peDealID);
  assert.equal(new Set(ids).size, ids.length, 'each cadence week consults a different deal index (no duplicates)');
  // Every arrival must be one of the deals T11 generated for the year it arrived in.
  for (const { week, target } of arrivals) {
    const generated = tiers.generateAnnualDeals(e.g, Math.floor(week / 52)).map(d => d.id);
    assert.ok(generated.includes(target.peDealID), `${target.peDealID} must come from generateAnnualDeals of its own year`);
  }
  assert.ok(e.g.week > startWeek);
  // 3. Completion criterion: ファンド規模に応じて打てる帯が絞られる (T11's eligibleTiers).
  const eligible = new Set(tiers.eligibleTiers(fund));
  for (const { target } of arrivals) assert.ok(eligible.has(target.peTierID), `${target.peTierID} must be an eligible tier for this fund (${[...eligible].join(',')})`);
}

// 4. No investing fund -> no PE supply at all (there is no scale to filter tiers by, and a deal
// no fund can finance is noise).
{
  const e = setupFirm(main);
  for (let i = 0; i < 40; i++) e.advanceWeek(false);
  assert.equal(peTargets(main, e).length, 0, 'PE deals must not be supplied before a fund is investing');
  assert.ok(e.g.acquisitionTargets.length > 0, 'ordinary M&A candidates must still be generated');
}
{
  // A fund that has left its investment period stops the supply too.
  const e = setupFirm(main);
  const fund = formFund(main, e);
  fund.status = 'harvesting';
  for (let i = 0; i < 40; i++) e.advanceWeek(false);
  assert.equal(peTargets(main, e).length, 0, 'a harvesting fund must not pull new deal flow');
}

// 5. Completion criterion: 同一seedで供給される案件が完全に一致する.
{
  const a = freshLoad(11), b = freshLoad(11);
  const ea = setupFirm(a), eb = setupFirm(b);
  formFund(a, ea); formFund(b, eb);
  for (let i = 0; i < 60; i++) { ea.advanceWeek(false); eb.advanceWeek(false); }
  // Joined rather than compared array-to-array: the two games live in separate vm realms, so
  // their Array prototypes differ and assert/strict's deep compare would reject identical data.
  const pa = peTargets(a, ea).map(t => JSON.stringify(t)).join('\n');
  const pb = peTargets(b, eb).map(t => JSON.stringify(t)).join('\n');
  assert.ok(pa.length > 0, 'sanity: the determinism check needs at least one supplied deal');
  assert.equal(pa, pb, 'the same seed must supply byte-identical PE targets');
}

// 6. Completion criterion: DD枠が実際に消費され、上限で拒否される。fundID is required for a PE
// target, must name a fund still in its investment period, and the slot is consumed if and only
// if the underlying DD actually started.
{
  const e = setupFirm(main);
  const fund = formFund(main, e);
  let target = null;
  for (let i = 0; i < 60 && !target; i++) { e.advanceWeek(false); target = peTargets(main, e)[0] || null; }
  assert.ok(target, 'sanity: need a supplied PE target to due-diligence');
  assert.equal(e.openMADealRoom(target.id), true);
  const deal = e.g.maDealRooms.find(d => d.targetID === target.id);

  // 期限は既存の deadline 機構に乗る（openMADealRoom が expiresWeek から deadlineWeek を導く）。
  const expectedDeadline = Math.min(Math.max(target.expiresWeek, deal.openedWeek + 6), deal.openedWeek + 16);
  assert.equal(deal.deadlineWeek, expectedDeadline, 'the PE target expiry must feed the existing deal deadline');

  const slotsBefore = pf.ddSlotsRemaining(e.g, e.g.week);
  assert.ok(slotsBefore > 0);
  assert.equal(e.startMADueDiligence(deal.id, 'screening'), false, 'a PE deal must refuse DD without a fundID');
  assert.equal(e.startMADueDiligence(deal.id, 'screening', 'no-such-fund'), false, 'an unknown fundID must be refused');
  fund.status = 'harvesting';
  assert.equal(e.startMADueDiligence(deal.id, 'screening', fund.id), false, 'a fund past its investment period must be refused');
  fund.status = 'investing';
  assert.equal(pf.ddSlotsRemaining(e.g, e.g.week), slotsBefore, 'no refused attempt may consume a DD slot');

  assert.equal(e.startMADueDiligence(deal.id, 'screening', fund.id), true);
  assert.equal(pf.ddSlotsRemaining(e.g, e.g.week), slotsBefore - 1, 'a successful DD must consume exactly one slot');
  assert.equal(deal.fundID, fund.id, 'the deal must record which fund is pursuing it');
  assert.equal(deal.status, 'diligence');
}
{
  // Exhausting the yearly budget refuses the next PE DD outright, and refusing it costs no cash.
  const e = setupFirm(main);
  const fund = formFund(main, e);
  let target = null;
  for (let i = 0; i < 60 && !target; i++) { e.advanceWeek(false); target = peTargets(main, e)[0] || null; }
  assert.ok(target);
  assert.equal(e.openMADealRoom(target.id), true);
  const deal = e.g.maDealRooms.find(d => d.targetID === target.id);
  while (pf.ddSlotsRemaining(e.g, e.g.week) > 0) pf.consumeDDSlot(e.g, e.g.week);
  const cashBefore = e.g.companyCash;
  assert.equal(e.startMADueDiligence(deal.id, 'screening', fund.id), false, 'DD must be refused once the yearly budget is spent');
  assert.equal(e.g.companyCash, cashBefore, 'a refused DD must not spend the DD fee');
  assert.equal(deal.status, 'screening', 'a refused DD must leave the deal untouched');
}
{
  // An ordinary (non-PE) target keeps working with the original 2-argument signature and never
  // touches the PE DD budget.
  const e = setupFirm(main);
  formFund(main, e);
  assert.equal(e.generateMATargets(true), true);
  const ordinary = e.g.acquisitionTargets.find(t => !ds.isPETarget(t));
  assert.ok(ordinary, 'sanity: ordinary M&A candidates must exist');
  assert.equal(e.openMADealRoom(ordinary.id), true);
  const deal = e.g.maDealRooms.find(d => d.targetID === ordinary.id);
  const slotsBefore = pf.ddSlotsRemaining(e.g, e.g.week);
  assert.equal(e.startMADueDiligence(deal.id, 'screening'), true, 'ordinary M&A DD must still work without a fundID');
  assert.equal(pf.ddSlotsRemaining(e.g, e.g.week), slotsBefore, 'ordinary M&A DD must not consume the PE DD budget');
}

// 7. generateMATargets replaces the ordinary candidate list wholesale -- PE deals must survive
// it, and the ordinary regeneration must still happen (PE deals must not crowd it out).
{
  const e = setupFirm(main);
  formFund(main, e);
  let supplied = [];
  for (let i = 0; i < 60 && !supplied.length; i++) { e.advanceWeek(false); supplied = peTargets(main, e); }
  assert.ok(supplied.length > 0);
  const peIDsBefore = supplied.map(t => t.id).sort();
  const ordinaryBefore = e.g.acquisitionTargets.filter(t => !ds.isPETarget(t)).map(t => t.id).sort();
  assert.equal(e.generateMATargets(true), true);
  const peIDsAfter = peTargets(main, e).map(t => t.id).sort();
  const ordinaryAfter = e.g.acquisitionTargets.filter(t => !ds.isPETarget(t)).map(t => t.id).sort();
  assert.deepEqual(peIDsAfter, peIDsBefore, 'PE targets must survive an ordinary candidate refresh');
  assert.notDeepEqual(ordinaryAfter, ordinaryBefore, 'the ordinary candidate list must actually have been refreshed');
}

// 8. Expiry: an unopened PE target is pruned once past its expiry, but one with an open deal is
// never pruned (js/ma-deal-room.js's processDealWeek would otherwise lose the target and leave
// the deal stranded -- the existing DEAL_DEADLINE_STATUSES path terminalises it instead).
{
  const e = setupFirm(main);
  formFund(main, e);
  let target = null;
  for (let i = 0; i < 60 && !target; i++) { e.advanceWeek(false); target = peTargets(main, e)[0] || null; }
  assert.ok(target);
  const id = target.id;
  target.expiresWeek = e.g.week - 1;
  ds.prunePETargets(e.g, e.g.week);
  assert.equal(e.g.acquisitionTargets.some(t => t.id === id), false, 'an expired unopened PE target must be pruned');
}
{
  const e = setupFirm(main);
  formFund(main, e);
  let target = null;
  for (let i = 0; i < 60 && !target; i++) { e.advanceWeek(false); target = peTargets(main, e)[0] || null; }
  assert.ok(target);
  assert.equal(e.openMADealRoom(target.id), true);
  target.expiresWeek = e.g.week - 1;
  ds.prunePETargets(e.g, e.g.week);
  assert.ok(e.g.acquisitionTargets.some(t => t.id === target.id), 'a PE target with an open deal must never be pruned');
}

// 9. Old save compatibility: a state with no peFirm.lastDealSupplyWeek (everything before T16)
// normalizes without error and starts supplying from the current week.
{
  const e = setupFirm(main);
  formFund(main, e);
  delete e.g.peFirm.lastDealSupplyWeek;
  ds.ensure(e.g);
  assert.equal(e.g.peFirm.lastDealSupplyWeek, 0);
  e.advanceWeek(false);
  assert.ok(e.g.peFirm.lastDealSupplyWeek >= e.g.week - 1);
}

// 10. processSupplyWeek is idempotent per week (calling it twice for the same week supplies once).
{
  const e = setupFirm(main);
  formFund(main, e);
  const week = 14; // on the cadence
  e.g.week = week;
  e.g.peFirm.lastDealSupplyWeek = week - 1;
  const first = ds.processSupplyWeek(e.g, week);
  const second = ds.processSupplyWeek(e.g, week);
  assert.equal(second, null, 'a second call for the same week must supply nothing');
  if (first) assert.equal(peTargets(main, e).filter(t => t.id === first.id).length, 1, 'no duplicate target');
}

// 11. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-deal-supply.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe deal supply tests passed');
