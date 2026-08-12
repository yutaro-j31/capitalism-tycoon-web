'use strict';
// Phase 2 for roadmap 8A.4: the unit test launches products directly, so it would still
// pass if the weekly loop never launched one, or if a launch never reached the player.
// This test plays: weeks are advanced normally until a rival launches, the player answers
// with a campaign, and the answer is checked to have reached the company's market
// position. A control run confirms launches stay rare rather than becoming weather.
const assert = require('node:assert');
const { loadGame } = require('./harness');

const HORIZON = 208;

// A fixed random value collapses every generated uuid to one string, merging unrelated
// entities. A varying deterministic source keeps them distinct and keeps the run replayable.
function lcg(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function createEngine() {
  const loaded = loadGame({ headless: true, random: lcg(7) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.g.companyCash = 500_000_000;
  engine.g.companyDebt = 0;
  delete engine.g.finance;
  engine.normalize();
  engine.g.configured = true;
  engine.g.difficulty = 'normal';
  engine.g.companyName = 'Rival Pressure Co';
  engine.g.companyCash = 500_000_000;
  return { loaded, engine };
}

function run({ answerWith }) {
  const { loaded, engine } = createEngine();
  const launches = [];
  let answeredWeek = null;
  let positionBefore = null;
  let positionAfter = null;
  let campaign = null;

  for (let index = 0; index < HORIZON; index += 1) {
    if (engine.g.gameOver) break;
    engine.advanceWeek();

    for (const product of engine.activeCompetitorProducts()) {
      if (!launches.some(row => row.id === product.id)) launches.push({ id: product.id, week: product.launchedWeek });
    }

    if (answerWith && answeredWeek === null) {
      const target = engine.activeCompetitorProducts().find(product => !product.counteredBy);
      if (target) {
        const business = engine.business(target.businessID);
        positionBefore = { price: business.price, brand: business.brand, quality: business.quality };
        assert.ok(engine.launchCounterCampaign(target.id, answerWith), 'the player can answer a live launch');
        answeredWeek = engine.g.week;
        campaign = engine.activeCounterCampaigns()[0];
      }
    }

    if (campaign && positionAfter === null && campaign.applied) {
      const business = engine.business(campaign.businessID);
      positionAfter = { price: business.price, brand: business.brand, quality: business.quality };
    }
  }

  return {
    loaded,
    engine,
    launches,
    answeredWeek,
    positionBefore,
    positionAfter,
    ledgerValid: loaded.modules.finance.validate(engine.g).ok
  };
}

// --- launches happen by playing, and stay rare ---------------------------
const answered = run({ answerWith: 'advertising' });
assert.ok(
  answered.launches.length >= 1,
  `a rival must launch a product during ${HORIZON} weeks of ordinary play`
);
assert.ok(
  answered.launches.length <= 8,
  `launches must stay rare over ${HORIZON} weeks (saw ${answered.launches.length})`
);
assert.ok(answered.launches[0].week > 1, 'nothing launches on the opening week');

// --- the player can answer, and the answer reaches the market position ---
assert.ok(answered.answeredWeek !== null, 'the player can answer a launch found by playing');
assert.ok(answered.positionAfter, 'the answer takes effect during play, not only when driven directly');
assert.ok(
  answered.positionAfter.brand > answered.positionBefore.brand,
  'advertising raises the brand the market reads'
);
assert.ok(answered.ledgerValid, 'the ledger stays valid across the whole run');

// --- a slow answer also arrives during ordinary play ---------------------
const slow = run({ answerWith: 'product' });
assert.ok(slow.answeredWeek !== null, 'a slow answer can be started');
assert.ok(slow.positionAfter, 'a slow answer still arrives inside the horizon');
assert.ok(
  slow.positionAfter.quality > slow.positionBefore.quality,
  'launching a product raises quality once development finishes'
);

// --- the control run: no answer means the rival keeps its advantage ------
const untouched = run({ answerWith: null });
assert.equal(untouched.answeredWeek, null, 'the control run never answers');
assert.equal(
  untouched.engine.activeCounterCampaigns().length,
  0,
  'no campaign appears without the player starting one'
);
assert.deepEqual(
  untouched.launches.map(row => row.week),
  answered.launches.map(row => row.week),
  'answering does not change when rivals launch'
);

// --- the run is deterministic --------------------------------------------
const again = run({ answerWith: 'advertising' });
assert.equal(again.answeredWeek, answered.answeredWeek, 'the answer week is deterministic');
assert.deepEqual(
  again.launches.map(row => row.week),
  answered.launches.map(row => row.week),
  'launch weeks are deterministic'
);

console.log(
  `competitor product reachability: ${answered.launches.length} launch(es) at weeks ` +
  `${answered.launches.map(row => row.week).join(', ')}; answered at week ${answered.answeredWeek}`
);
