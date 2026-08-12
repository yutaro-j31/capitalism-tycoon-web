'use strict';
// Phase 2 (canonical tier): a feature that passes its unit tests but cannot be reached in
// ordinary play counts as unimplemented. A full run is intended to span 40 years — the
// founder starts at 20 and the age gate opens at 60, i.e. week 2080 — which is far too
// long to simulate on every commit. This test therefore proves the two halves that make
// the age route real without simulating all of it:
//   1. the clock actually advances at the rate the gate assumes, and
//   2. the retirement path completes end to end once a gate opens.
// The uninterrupted 2080-week playthrough is covered by the long-horizon test.
const assert = require('node:assert');
const { loadGame } = require('./harness');

const START_AGE = 20;
const RETIREMENT_AGE = 60;
const WEEKS_PER_YEAR = 52;
const SAMPLE_WEEKS = 156;

function createEngine(name) {
  const loaded = loadGame({ headless: true });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.normalize();
  engine.g.configured = true;
  engine.g.difficulty = 'normal';
  engine.g.companyName = name;
  return engine;
}

// --- the founder starts at the age the 40-year arc assumes ----------------
{
  const engine = createEngine('Clock Co');
  assert.equal(engine.g.founderAge, START_AGE, 'a new founder starts at 20');
  assert.equal(
    (RETIREMENT_AGE - START_AGE) * WEEKS_PER_YEAR,
    2080,
    'the age gate opens exactly at the end of the intended 40-year arc'
  );
}

// --- the clock advances at the rate the age gate depends on ---------------
{
  const engine = createEngine('Clock Co');
  for (let index = 0; index < SAMPLE_WEEKS; index += 1) engine.advanceWeek();
  const expectedAge = START_AGE + Math.floor(SAMPLE_WEEKS / WEEKS_PER_YEAR);
  assert.equal(engine.g.founderAge, expectedAge, 'the founder ages one year every 52 weeks');
  assert.equal(engine.g.gameOver, false, 'an ordinary run survives the sampled window');
}

// --- nothing retires early in ordinary play -------------------------------
{
  const engine = createEngine('Early Retirement Guard Co');
  for (let index = 0; index < SAMPLE_WEEKS; index += 1) {
    assert.equal(
      engine.retirementEligibility().eligible,
      false,
      `retirement must not open at week ${engine.g.week} of ordinary play`
    );
    engine.advanceWeek();
  }
  assert.equal(engine.g.retirementRecords.length, 0, 'no retirement is recorded in ordinary play');
  assert.equal(engine.g.founderGeneration, 1, 'the founding generation stays in place');
}

// --- the age route completes end to end once the gate opens ---------------
{
  const engine = createEngine('Age Route Co');
  engine.g.personalCash = 50_000_000;
  assert.ok(engine.appointSuccessor('professional'), 'a successor can be groomed');
  engine.g.successorCandidate.readiness = 70;
  engine.g.founderAge = RETIREMENT_AGE;
  engine.g.week = 2080;

  const status = engine.retirementEligibility();
  assert.ok(status.eligible, 'the age gate opens at 60 with a prepared successor');
  assert.deepEqual(status.metReasonIDs, ['age'], 'age is the qualifying reason');
  assert.ok(engine.retireFounder(), 'the founder retires');
  assert.equal(engine.g.founderGeneration, 2, 'the successor takes over');
  assert.equal(engine.g.gameOver, false, 'play continues into the next generation');

  engine.advanceWeek();
  assert.equal(engine.g.gameOver, false, 'the next generation can keep playing');
  assert.equal(engine.g.retirementRecords.length, 1, 'the handover stays recorded');
}

// --- the earned route lets strong play retire before 60 -------------------
{
  const engine = createEngine('Earned Route Co');
  engine.g.personalCash = 50_000_000;
  assert.ok(engine.appointSuccessor('professional'), 'a successor can be groomed');
  engine.g.successorCandidate.readiness = 70;
  engine.g.founderAge = 35;
  engine.g.generationLegacyScore = 1000;

  const status = engine.retirementEligibility();
  assert.ok(status.eligible, 'a strong generation can retire before the age gate');
  assert.deepEqual(status.metReasonIDs, ['legacy'], 'the earned score is the qualifying reason');
  assert.ok(engine.retireFounder(), 'the founder retires early on merit');
  assert.equal(engine.g.founderGeneration, 2, 'the successor takes over');
}

console.log('founder retirement reachability tests passed');
