'use strict';
// Real estate agency per-store sales agents, run by tests/real-estate-agency-pipeline-test.js (a module, not a new
// canonical entry: the retained shard-C evidence pins the canonical test count).
// Each agent adds weekly inquiries (x(1+INQUIRY_BOOST_PER_AGENT)) and pipeline slots, and costs a weekly wage booked on
// the store's payroll row. The command is one transaction, refuses to drop open deals, and a save without the field is
// unchanged. No RNG is drawn.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
function lcg(seed = 731) { let v = seed >>> 0; return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 2 ** 32; }; }
function scenario(seed = 731) {
  const loaded = loadGame({ random: lcg(seed), headless: true });
  const game = new loaded.engineModule.TycoonEngine();
  game.configure({ playerName: 'Broker', companyName: 'Pipeline Realty', difficulty: 'normal', scenario: 'free' });
  Object.assign(game.business('realEstateAgency'), { brand: 35, quality: 40, efficiency: 38, dx: 30 });
  game.g.companyCash = 200_000_000;
  game.g.finance = loaded.modules.finance.defaultFinanceState(game.g);
  Object.assign(game.g.finance, { openingCash: game.g.companyCash, openingAssets: game.g.companyCash, openingEquity: game.g.companyCash, openingRetainedEarnings: game.g.companyCash });
  assert.equal(game.openStore({ tenantID: game.g.tenants[0].id, businessID: 'realEstateAgency', name: '仲介本店' }), true);
  const store = game.g.stores.at(-1); Object.assign(store, { status: 'open', openingWeek: game.g.week, weeksToOpen: 0 });
  return { loaded, game, store, mod: loaded.modules.realEstateAgencyPipeline };
}
const plain = value => JSON.parse(JSON.stringify(value));

// 1. Unit: bounds, capacity and wage; a store without the field has no agents.
{
  const { mod } = scenario();
  assert.equal(mod.MAX_AGENTS, 3); assert.equal(mod.SLOTS_PER_AGENT, 3);
  assert.equal(mod.agentsFor({}), 0, 'a save without the field has no agents');
  for (const bad of [-1, NaN, 'x', null]) assert.equal(mod.agentsFor({ brokerageAgents: bad }), 0);
  assert.equal(mod.agentsFor({ brokerageAgents: 9 }), 3, 'clamped to the maximum');
  assert.equal(mod.capacityFor({ efficiency: 0 }), 8, 'the old call shape is unchanged');
  assert.equal(mod.capacityFor({ efficiency: 0 }, 1, 0), 8);
  assert.equal(mod.capacityFor({ efficiency: 0 }, 1, 2), 14, 'two agents add six slots');
  assert.equal(mod.agentWeeklyWage({ brokerageAgents: 2 }), 2 * mod.AGENT_WEEKLY_WAGE);
  assert.equal(mod.agentWeeklyWage({}), 0);
  console.log('sales agents unit: bounds, capacity and wage PASS');
}

// 2. Command: validation, one transaction, refusal to drop open deals.
{
  const { game, store, mod } = scenario(41);
  let saves = 0; const save = game.save; game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
  for (const bad of [-1, 4, 1.5, 'two', null]) {
    const before = JSON.stringify(game.g);
    assert.equal(game.setBrokerageAgents(store.id, bad), false, `refuses ${bad}`);
    assert.equal(JSON.stringify(game.g), before, 'a refusal writes nothing');
  }
  assert.equal(game.setBrokerageAgents('missing', 1), false);
  assert.equal(saves, 0, 'refusals never save');
  assert.notEqual(game.advanceWeek(false), false); saves = 0;
  const capacity0 = store.brokeragePipeline.capacity;
  assert.equal(game.setBrokerageAgents(store.id, 2), true);
  assert.equal(store.brokerageAgents, 2); assert.equal(store.brokeragePipeline.capacity, capacity0 + 6, 'the pipeline resizes at once');
  assert.equal(saves, 1, 'one commit');
  assert.equal(game.setBrokerageAgents(store.id, 2), false, 'no change is not a write');
  // Fill the pipeline beyond the one-agent capacity: releasing an agent would drop a deal, so it is refused.
  const pipeline = store.brokeragePipeline, template = pipeline.activeDeals[0] || { askingValue: 30_000_000, side: 'single', segment: 'residential' };
  while (pipeline.activeDeals.length < capacity0 + 4) pipeline.activeDeals.push({ ...template, id: `FILL-${pipeline.activeDeals.length}`, storeID: store.id, createdWeek: game.g.week });
  const full = JSON.stringify(game.g);
  assert.equal(game.setBrokerageAgents(store.id, 1), false, 'releasing an agent that would drop open deals is refused');
  assert.equal(JSON.stringify(game.g), full, 'and writes nothing');
  pipeline.activeDeals.length = capacity0 + 3;
  assert.equal(game.setBrokerageAgents(store.id, 1), true, 'a release that keeps every open deal is allowed');
  assert.equal(pipeline.activeDeals.length, capacity0 + 3, 'no deal is dropped');
  // Only an open agency store can hire.
  const other = { ...plain(store), id: 'not-agency', businessID: 'ramen' }; game.g.stores.push(other);
  assert.equal(game.setBrokerageAgents('not-agency', 1), false); game.g.stores.pop();
  console.log('sales agents command: validation, one commit, no dropped deals PASS');
}

// 3. Weekly economics: same seed and state, two agents vs none. The payroll row carries exactly the agent wage, inquiries
// rise, no RNG is drawn, and the ledger stays valid.
{
  const base = scenario(811), hired = scenario(811);
  assert.equal(hired.game.setBrokerageAgents(hired.store.id, 2), true);
  const rows = (s, type) => s.game.g.finance.transactions.filter(t => t.storeID === s.store.id && t.sourceType === type);
  let inquiriesBase = 0, inquiriesHired = 0;
  for (let i = 0; i < 12; i++) {
    assert.notEqual(base.game.advanceWeek(false), false); assert.notEqual(hired.game.advanceWeek(false), false);
    inquiriesBase += base.store.brokeragePipeline.lastWeek.inquiries; inquiriesHired += hired.store.brokeragePipeline.lastWeek.inquiries;
    // Both runs share the week's wage multiplier (inflation x hours x crisis), so the hired payroll row is the base row
    // scaled by (wage + 2 agents) / wage, up to the whole-yen rounding of each row.
    const wage = hired.game.business('realEstateAgency').wage, baseRow = rows(base, 'weekly-store-payroll').at(-1).amount, hiredRow = rows(hired, 'weekly-store-payroll').at(-1).amount;
    const expected = baseRow * (wage + 2 * hired.mod.AGENT_WEEKLY_WAGE) / wage;
    assert.ok(Math.abs(hiredRow - expected) <= 3, `week ${hired.game.g.week}: payroll row carries the agent wage (${hiredRow} vs ${expected})`);
    assert.equal(rows(hired, 'weekly-store-rent').at(-1).amount, rows(base, 'weekly-store-rent').at(-1).amount, 'rent unchanged');
    // The agent wage must be a real extra cost: maintenance (fixed - rent - wage) stays the same, so the store's total
    // posted cost rises by exactly the payroll difference and none of it is absorbed by the maintenance row.
    assert.equal(rows(hired, 'weekly-store-maintenance').at(-1).amount, rows(base, 'weekly-store-maintenance').at(-1).amount, 'maintenance unchanged');
    const sales = s => rows(s, 'weekly-store-revenue').at(-1).amount, cogs = s => rows(s, 'weekly-store-cogs').at(-1).amount;
    assert.equal(hired.store.lastProfit - base.store.lastProfit,
      (sales(hired) - sales(base)) - (cogs(hired) - cogs(base)) - (hiredRow - baseRow), 'store profit carries the whole agent wage');
  }
  assert.ok(inquiriesHired > inquiriesBase, `agents prospect more inquiries (${inquiriesHired} vs ${inquiriesBase})`);
  assert.equal(hired.game.g.simulationRng.draws, base.game.g.simulationRng.draws, 'agents draw no RNG');
  assert.equal(hired.loaded.modules.finance.validate(plain(hired.game.g)).ok, true, 'accounting valid');
  console.log(`sales agents weekly: payroll row carries the agent wage, inquiries ${inquiriesBase} -> ${inquiriesHired}, no RNG PASS`);
}

// 4. A save without the field: reload keeps zero agents and the same capacity; a save with agents round-trips.
{
  const s = scenario(77);
  assert.notEqual(s.game.advanceWeek(false), false);
  const legacy = plain(s.game.g); for (const st of legacy.stores) delete st.brokerageAgents;
  const reloaded = new s.loaded.engineModule.TycoonEngine(legacy);
  const st = reloaded.g.stores.find(x => x.id === s.store.id);
  assert.equal(s.mod.agentsFor(st), 0); assert.equal(st.brokeragePipeline.capacity, s.store.brokeragePipeline.capacity);
  assert.equal(s.game.setBrokerageAgents(s.store.id, 3), true);
  const again = new s.loaded.engineModule.TycoonEngine(plain(s.game.g));
  assert.equal(again.g.stores.find(x => x.id === s.store.id).brokerageAgents, 3, 'agents persist');
  console.log('sales agents save: legacy unchanged, agents persist PASS');
}
console.log('real estate agency sales agents PASS');
