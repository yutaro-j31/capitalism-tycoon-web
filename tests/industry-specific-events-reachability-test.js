'use strict';
const assert = require('node:assert');
const { loadGame } = require('./harness');

function makeRandom(initialSeed) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function run(seed) {
  const loaded = loadGame({ headless: true, random: makeRandom(seed) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.g.companyCash = 200_000_000;
  engine.g.companyDebt = 0;
  delete engine.g.finance;
  engine.normalize();
  engine.g.configured = true;
  engine.g.difficulty = 'normal';
  engine.g.scenario = 'free';
  engine.g.companyName = 'Industry Event Reachability Co';

  const neutralWeeks = [];
  const activeWeeks = [];
  const observedEvents = [];
  let nonNeutralDemandWeeks = 0;
  let nonNeutralCostWeeks = 0;

  for (let i = 0; i < 208; i += 1) {
    const progressed = engine.advanceWeek(false);
    assert.notEqual(progressed, false, `week ${engine.g.week} must advance`);

    const active = engine.g.activeIndustryEvent?.id || null;
    const modifier = engine.getIndustrySpecificModifiers('ramen');
    if (active) {
      activeWeeks.push(engine.g.week);
      observedEvents.push(active);
      if (Math.abs(modifier.demand - 1) > 1e-12) nonNeutralDemandWeeks += 1;
      if (Math.abs(modifier.unitCost / modifier.supply - 1) > 1e-12) nonNeutralCostWeeks += 1;
    } else if (engine.g.week < 26) {
      neutralWeeks.push(engine.g.week);
      assert.deepEqual(modifier, { demand:1, unitCost:1, regulation:1, technology:1, supply:1 }, 'pre-event control remains neutral');
    }
  }

  const starts = (engine.g.industryEventHistory || [])
    .filter(row => row?.type === 'industryEventStarted')
    .map(row => ({ week:row.week, eventId:row.eventId }))
    .sort((a,b) => a.week - b.week);
  const expectedStarts = [
    { week:26, eventId:'energySpike' },
    { week:52, eventId:'digitalBoom' },
    { week:78, eventId:'creditTightening' },
    { week:104, eventId:'inboundBoom' },
    { week:130, eventId:'energySpike' },
    { week:156, eventId:'digitalBoom' },
    { week:182, eventId:'creditTightening' },
    { week:208, eventId:'inboundBoom' }
  ];
  assert.deepEqual(starts, expectedStarts, 'normal 208-week play reaches every scheduled industry event');
  assert(neutralWeeks.length >= 24, 'normal control has a substantial pre-event neutral period');
  assert(activeWeeks.length > 0, 'normal play contains active industry-event weeks');
  assert(nonNeutralDemandWeeks > 0, 'active events produce non-neutral demand modifiers');
  assert(nonNeutralCostWeeks > 0, 'active events produce non-neutral effective unit-cost modifiers');
  assert((engine.g.industryEventHistory || []).length <= loaded.modules.macroCycle.EVENT_HISTORY_LIMIT, 'macro event history remains bounded');
  assert((engine.g.industrySpecificEventHistory || []).length <= loaded.modules.industrySpecificEvents.HISTORY_LIMIT, 'industry modifier history remains bounded');
  assert(loaded.modules.macroCycle.validate(engine.g).ok, JSON.stringify(loaded.modules.macroCycle.validate(engine.g)));
  assert(loaded.modules.industrySpecificEvents.validate(engine.g).ok, JSON.stringify(loaded.modules.industrySpecificEvents.validate(engine.g)));
  assert(loaded.modules.finance.validate(engine.g).ok, JSON.stringify(loaded.modules.finance.validate(engine.g)));

  const restored = new loaded.engineModule.TycoonEngine(JSON.parse(JSON.stringify(engine.g)));
  restored.normalize();
  assert(loaded.modules.finance.validate(restored.g).ok, 'save-shaped reload remains finance-valid');
  assert(loaded.modules.industrySpecificEvents.validate(restored.g).ok, 'save-shaped reload retains valid modifiers');

  return {
    starts,
    activeWeekCount:activeWeeks.length,
    observedEvents,
    nonNeutralDemandWeeks,
    nonNeutralCostWeeks,
    finalWeek:engine.g.week,
    macroHistoryLength:engine.g.industryEventHistory.length,
    modifierHistoryLength:engine.g.industrySpecificEventHistory.length
  };
}

const first = run(0x8c200001);
const second = run(0x8c200001);
assert.deepEqual(first, second, 'industry event reachability is deterministic for the same seed');
console.log(`industry-specific-events-reachability-test: ok (${first.starts.map(row => `${row.week}:${row.eventId}`).join(', ')}; activeWeeks=${first.activeWeekCount}; demandWeeks=${first.nonNeutralDemandWeeks}; costWeeks=${first.nonNeutralCostWeeks})`);
