'use strict';

// PE mode T10 (docs/PE_MODE_TASKS.md): finite DD slots per year (ddSlotsPerYear = 3 +
// partners/4), consumed per DD start and reset every 52 weeks.

const assert = require('node:assert/strict');
const fs = require('node:fs');

function load() {
  delete globalThis.__capitalismTycoonModules;
  globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
  globalThis.document = { addEventListener() {} };
  globalThis.window = globalThis;
  for (const m of ['../js/runtime.js', '../js/data.js', '../js/store-market-environment.js', '../js/workforce.js', '../js/supply.js', '../js/competitor.js', '../js/competitor-projects.js', '../js/competitor-entry.js', '../js/competitor-credit.js', '../js/competitor-distress.js', '../js/market.js', '../js/finance.js', '../js/engine.js', '../js/completion.js', '../js/pe-fund.js']) {
    delete require.cache[require.resolve(m)];
    require(m);
  }
  const modules = globalThis.__capitalismTycoonModules;
  return { modules, TycoonEngine: modules.engine.TycoonEngine, pf: modules.peFund };
}
const { TycoonEngine, pf } = load();

// 1. With no fund at all, ddSlotsPerYear stays at the base 3 (matches T5's original default).
{
  const e = new TycoonEngine();
  assert.equal(pf.ddSlotsPerYear(e.g), 3);
}

// 2. Formula: 3 + floor(partners/4), driven by the active fund's team capacity (T9).
{
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size: 13_200_000_000, y0: 1, terms: pf.fundTermsForScore(35) });
  assert.equal(pf.teamCapacity(fund), 12, 'sanity: this fund must have team 12 (see T9 test)');
  assert.equal(pf.ddSlotsPerYear(e.g), 3 + Math.floor(12 / 4)); // = 6
}

// 3. A closed fund's team no longer counts toward partnerCount.
{
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size: 13_200_000_000, y0: 1, terms: pf.fundTermsForScore(35) });
  fund.status = 'closed';
  assert.equal(pf.partnerCount(e.g), 0);
  assert.equal(pf.ddSlotsPerYear(e.g), 3);
}

// 4. Multiple active funds: partnerCount uses the largest team, not the sum.
{
  const e = new TycoonEngine();
  pf.createFund(e.g, { size: 2_811_000_000, y0: 1, terms: pf.fundTermsForScore(5) }); // team 2
  pf.createFund(e.g, { size: 13_200_000_000, y0: 1, terms: pf.fundTermsForScore(35) }); // team 12
  assert.equal(pf.partnerCount(e.g), 12);
}

// 5. Completion criterion: consuming slots up to the yearly budget succeeds, the next one
// fails, and ddSlotsRemaining reflects usage without itself consuming anything.
{
  const e = new TycoonEngine();
  const week = 10;
  assert.equal(pf.ddSlotsPerYear(e.g), 3);
  assert.equal(pf.ddSlotsRemaining(e.g, week), 3);
  assert.equal(pf.consumeDDSlot(e.g, week), true);
  assert.equal(pf.ddSlotsRemaining(e.g, week), 2);
  assert.equal(pf.consumeDDSlot(e.g, week + 1), true); // still within the same 52-week period
  assert.equal(pf.consumeDDSlot(e.g, week + 2), true);
  assert.equal(pf.ddSlotsRemaining(e.g, week + 2), 0);
  assert.equal(pf.consumeDDSlot(e.g, week + 3), false, 'the 4th DD in the same year must be refused');
  assert.equal(pf.ddSlotsRemaining(e.g, week + 3), 0);
}

// 6. Completion criterion: annual reset -- crossing a 52-week boundary restores the budget.
{
  const e = new TycoonEngine();
  for (let i = 0; i < 3; i++) assert.equal(pf.consumeDDSlot(e.g, 5), true);
  assert.equal(pf.consumeDDSlot(e.g, 5), false, 'sanity: budget exhausted in period 0');
  assert.equal(pf.consumeDDSlot(e.g, 51), false, 'still the same 52-week period (week 51 -> period 0)');
  assert.equal(pf.consumeDDSlot(e.g, 52), true, 'a new period (week 52 -> period 1) must restore the budget');
  assert.equal(pf.ddSlotsRemaining(e.g, 52), 2);
}

// 7. ddPeriodIndex is a pure step function of week (0..51 -> 0, 52..103 -> 1, ...).
{
  assert.equal(pf.ddPeriodIndex(0), 0);
  assert.equal(pf.ddPeriodIndex(51), 0);
  assert.equal(pf.ddPeriodIndex(52), 1);
  assert.equal(pf.ddPeriodIndex(520), 10);
}

// 8. Old T5-era save (ddSlotsPerYear:3, no ddUsage field) loads safely and gets ddUsage
// backfilled without erroring.
{
  const e = new TycoonEngine();
  e.g.peFirm = { trackRecord: { score: 0, exits: [], realizedDPI: 0 }, funds: [], ddSlotsPerYear: 3, unlocked: false };
  delete e.g.peFirm.ddUsage;
  pf.ensure(e.g);
  assert.deepEqual(e.g.peFirm.ddUsage, { period: 0, used: 0 });
  assert.equal(pf.consumeDDSlot(e.g, 1), true);
}

// 9. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-fund.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe fund DD-slot tests passed');
