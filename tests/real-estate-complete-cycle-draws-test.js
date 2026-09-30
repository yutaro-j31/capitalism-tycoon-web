'use strict';

// #812: real-estate-complete-cycle's disaster roll must be an independent weekly draw, and each game
// must have its own. The FNV-1a hash barely changed when only the week at the end of the key changed,
// and every game used seed 1: over 30 years every player got the same 34 disasters, 20 of them in
// back-to-back weeks, the first in week 204, a 989-week gap, and never a regulation event.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const WEEKS = 1560;
const TYPES = ['storm', 'fire', 'regulation', 'earthquake'];

function thirtyYears(seed) {
  const loaded = loadGame({ headless: true });
  const mod = loaded.modules.realEstateCompleteCycle;
  const engine = new loaded.engineModule.TycoonEngine();
  engine.configure({ playerName: 'Cycle', companyName: 'Cycle Co', difficulty: 'normal', scenario: 'free' });
  loaded.modules.simulationRng.reseed(engine.g, seed);
  const property = engine.g.properties[0];
  property.owner = 'company';
  engine.g.companyCash = 1e12;
  const events = [];
  for (let week = 1; week <= WEEKS; week++) {
    engine.g.week = week;
    const row = mod.processEvent(engine.g);
    if (row) events.push(row);
  }
  return { mod, events };
}

const { mod, events } = thirtyYears(0x812001);
const weeks = events.map(e => e.week);
const consecutive = weeks.filter((w, i) => i > 0 && w === weeks[i - 1] + 1).length;
const gaps = weeks.slice(1).map((w, i) => w - weeks[i]);
const longestGap = Math.max(weeks[0], ...gaps, WEEKS - weeks.at(-1));
const RATE = .027, expected = WEEKS * RATE;

// 1. The weekly rate is the configured one (binomial: mean 42, sd 6.4 over 30 years at 2.7%).
assert.ok(events.length >= expected - 3 * 6.4 && events.length <= expected + 3 * 6.4, `events in 30 years: ${events.length}, expected about ${expected.toFixed(1)}`);
// 2. Disasters do not come in runs: independent weeks give about 1.1 back-to-back pairs in 30 years.
assert.ok(consecutive <= 6, `back-to-back disaster weeks: ${consecutive} (weeks ${weeks.join(',')})`);
// 3. No decades without a disaster: the longest gap is about 150 weeks for independent weeks.
assert.ok(longestGap < 400, `longest stretch without a disaster: ${longestGap} weeks`);
// 4. All four disaster types occur.
for (const type of TYPES) assert.ok(events.some(e => e.type === type), `a ${type} event occurs in 30 years (types ${JSON.stringify(events.map(e => e.type))})`);
// 5. Each game has its own disasters; the same game seed gives the same ones.
assert.deepEqual(thirtyYears(0x812001).events.map(e => e.week), weeks, 'the same game seed gives the same disaster weeks');
assert.notDeepEqual(thirtyYears(0x812002).events.map(e => e.week), weeks, 'another game seed gives other disaster weeks');

// 6. The rate chosen by the owner: .027 keeps the expected net disaster loss where it was (#812).
assert.equal(mod.EVENT_RATE, RATE);

console.log(`real estate complete cycle draws tests passed (${events.length} disasters, ${consecutive} back-to-back, longest gap ${longestGap} weeks)`);
