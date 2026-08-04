'use strict';
const assert = require('node:assert');
const { loadGame } = require('./harness');
const loaded = loadGame({ headless: true });
const engine = new loaded.engineModule.TycoonEngine();
engine.g.configured = true;
engine.g.week = 52;
engine.g.activeIndustryEvent = { id: 'energySpike', name: 'Energy shock', description: '', startedWeek: 52, remainingWeeks: 8 };
engine.normalize();
const ramenModifier = engine.getIndustrySpecificModifiers('ramen');
assert(ramenModifier.unitCost > 1);
assert(ramenModifier.supply < 1);
const appModifier = loaded.modules.industrySpecificEvents.modifiersFor('digitalBoom', 'appStudio');
assert(appModifier.technology > 1);
const before = engine.g.businesses.map(b => ({ id: b.id, demand: b.demand, unitCost: b.unitCost }));
loaded.modules.industrySpecificEvents.withAppliedModifiers(engine, () => {
  const business = engine.g.businesses.find(b => b.id === 'ramen');
  const original = before.find(b => b.id === 'ramen');
  assert(business.unitCost > original.unitCost);
});
for (const row of before) {
  const current = engine.g.businesses.find(b => b.id === row.id);
  assert.equal(current.demand, row.demand);
  assert.equal(current.unitCost, row.unitCost);
}
assert(loaded.modules.industrySpecificEvents.validate(engine.g).ok);
assert(loaded.modules.finance.validate(engine.g).ok);
const restored = new loaded.engineModule.TycoonEngine(JSON.parse(JSON.stringify(engine.g)));
restored.normalize();
assert(restored.g.industrySpecificModifiers.ramen);
restored.g.industrySpecificEventHistory = Array.from({ length: 90 }, (_, i) => ({ week: i }));
restored.normalize();
assert.equal(restored.g.industrySpecificEventHistory.length, 52);
for (const businessId of ['ramen', 'cafe', 'conveni', 'apparel', 'gym', 'appStudio']) {
  const a = loaded.modules.industrySpecificEvents.modifiersFor('inboundBoom', businessId);
  const b = loaded.modules.industrySpecificEvents.modifiersFor('inboundBoom', businessId);
  assert.deepEqual(a, b);
}
console.log('industry-specific-events-test: ok');
