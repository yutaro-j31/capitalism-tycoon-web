'use strict';
const assert = require('node:assert');
const { loadGame } = require('./harness');

function createEngine() {
  const loaded = loadGame({ headless: true });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.normalize();
  engine.g.configured = true;
  engine.g.difficulty = 'normal';
  engine.g.companyName = 'Retirement Co';
  return { loaded, engine };
}

function prepareSuccessor(engine, readiness = 80) {
  engine.g.personalCash = 50_000_000;
  assert.ok(engine.appointSuccessor('internal'), 'successor can be appointed');
  engine.g.successorCandidate.readiness = readiness;
  engine.g.successorReadiness = readiness;
}

// --- defaults exist and survive normalize on an old save -------------------
{
  const { engine } = createEngine();
  assert.equal(engine.g.generationLegacyScore, 0, 'generation score starts at zero');
  assert.equal(engine.g.inheritedLegacyScore, 0, 'inherited score starts at zero');
  assert.deepEqual(engine.g.retirementRecords.length, 0, 'retirement records start empty');
  assert.equal(engine.g.lastSuccessionWeek, 0, 'last succession week starts at zero');

  delete engine.g.generationLegacyScore;
  delete engine.g.inheritedLegacyScore;
  delete engine.g.retirementRecords;
  delete engine.g.lastSuccessionWeek;
  engine.normalize();
  assert.equal(engine.g.generationLegacyScore, 0, 'old saves gain a safe generation score');
  assert.equal(engine.g.inheritedLegacyScore, 0, 'old saves gain a safe inherited score');
  assert.equal(engine.g.retirementRecords.length, 0, 'old saves gain a retirement record list');
  assert.equal(engine.g.lastSuccessionWeek, 0, 'old saves gain a last succession week');
}

// --- tier boundaries -------------------------------------------------------
{
  const { engine } = createEngine();
  assert.equal(engine.retirementTier(3000).id, 'retire_great_founder', '3000 reaches the top tier');
  assert.equal(engine.retirementTier(2999).id, 'retire_industrialist', 'just under 3000 is the middle tier');
  assert.equal(engine.retirementTier(1000).id, 'retire_industrialist', '1000 reaches the middle tier');
  assert.equal(engine.retirementTier(999).id, 'retire_quiet', 'just under 1000 is the bottom tier');
  assert.equal(engine.retirementTier(0).id, 'retire_quiet', 'zero is the bottom tier');
  assert.equal(engine.retirementTier(-5).id, 'retire_quiet', 'a negative score still resolves to a tier');
}

// --- a successor is mandatory ---------------------------------------------
{
  const { engine } = createEngine();
  engine.g.founderAge = 65;
  const status = engine.retirementEligibility();
  assert.equal(status.successorReady, false, 'no successor means not ready');
  assert.equal(status.eligible, false, 'age alone does not permit retirement');
  assert.equal(engine.retireFounder(), false, 'retiring without a successor is refused');
  assert.equal(engine.g.retirementRecords.length, 0, 'a refused retirement records nothing');
}

// --- an unprepared successor is not enough --------------------------------
{
  const { engine } = createEngine();
  engine.g.founderAge = 65;
  prepareSuccessor(engine, 69);
  assert.equal(engine.retirementEligibility().successorReady, false, 'readiness 69 is short of the bar');
  assert.equal(engine.retireFounder(), false, 'retiring with an unprepared successor is refused');
  engine.g.successorCandidate.readiness = 70;
  assert.equal(engine.retirementEligibility().successorReady, true, 'readiness 70 clears the bar');
}

// --- a prepared successor alone is not enough either -----------------------
{
  const { engine } = createEngine();
  prepareSuccessor(engine);
  engine.g.founderAge = 30;
  engine.g.generationLegacyScore = 0;
  const status = engine.retirementEligibility();
  assert.equal(status.successorReady, true, 'the successor is ready');
  assert.equal(status.eligible, false, 'readiness alone does not permit retirement');
  assert.equal(status.metReasonIDs.length, 0, 'no qualifying reason is met');
  assert.equal(engine.retireFounder(), false, 'retiring with no qualifying reason is refused');
}

// --- each qualifying reason works on its own ------------------------------
{
  const { engine } = createEngine();
  prepareSuccessor(engine);
  engine.g.founderAge = 60;
  const byAge = engine.retirementEligibility();
  assert.ok(byAge.eligible, 'age 60 qualifies');
  assert.deepEqual(byAge.metReasonIDs, ['age'], 'age is the qualifying reason');

  engine.g.founderAge = 40;
  engine.g.generationLegacyScore = 1000;
  const byScore = engine.retirementEligibility();
  assert.ok(byScore.eligible, 'a generation score of 1000 qualifies');
  assert.deepEqual(byScore.metReasonIDs, ['legacy'], 'legacy is the qualifying reason');

  engine.g.generationLegacyScore = 0;
  engine.g.founderGeneration = 2;
  engine.g.week = 600;
  engine.g.lastSuccessionWeek = 80;
  const byTenure = engine.retirementEligibility();
  assert.ok(byTenure.eligible, '520 weeks since the last handover qualifies');
  assert.deepEqual(byTenure.metReasonIDs, ['tenure'], 'tenure is the qualifying reason');
}

// --- tenure does not qualify for the first generation ---------------------
{
  const { engine } = createEngine();
  prepareSuccessor(engine);
  engine.g.founderAge = 40;
  engine.g.generationLegacyScore = 0;
  engine.g.founderGeneration = 1;
  engine.g.week = 900;
  engine.g.lastSuccessionWeek = 0;
  const status = engine.retirementEligibility();
  assert.equal(status.eligible, false, 'the founding generation cannot qualify on tenure');
}

// --- a sold company or a lost run cannot retire ---------------------------
{
  const { engine } = createEngine();
  prepareSuccessor(engine);
  engine.g.founderAge = 65;
  engine.g.gameOver = true;
  assert.equal(engine.retirementEligibility().eligible, false, 'a finished run cannot retire');
  engine.g.gameOver = false;
  engine.g.isCompanySold = true;
  assert.equal(engine.retirementEligibility().eligible, false, 'a sold company cannot retire');
}

// --- retiring records the tier, hands over, and continues play ------------
{
  const { engine } = createEngine();
  prepareSuccessor(engine);
  engine.g.week = 300;
  engine.g.founderAge = 62;
  engine.g.legacyScore = 1500;
  engine.g.generationLegacyScore = 1500;
  const successorName = engine.g.successorCandidate.name;
  const endingsBefore = engine.g.endingRecords.length;

  assert.ok(engine.retireFounder(), 'retirement succeeds once every condition is met');

  assert.equal(engine.g.retirementRecords.length, 1, 'the retirement is recorded');
  const record = engine.g.retirementRecords[0];
  assert.equal(record.id, 'retire_industrialist', 'the tier matches the generation score');
  assert.equal(record.generation, 1, 'the retiring generation is recorded');
  assert.equal(record.week, 300, 'the retirement week is recorded');
  assert.equal(record.legacyScore, 1500, 'the graded score is recorded');

  assert.equal(engine.g.endingRecords.length, endingsBefore + 1, 'an ending record is added');
  assert.ok(engine.g.unlockedEndings.includes('retire_industrialist'), 'the ending is unlocked');
  assert.ok(engine.g.playerTitles.some(title => title.id === 'retire_industrialist'), 'the title is granted');

  assert.equal(engine.g.founderGeneration, 2, 'the next generation takes over');
  assert.equal(engine.g.founderName, successorName, 'the successor becomes the founder');
  assert.equal(engine.g.successorCandidate, null, 'the successor slot is cleared');
  assert.equal(engine.g.lastSuccessionWeek, 300, 'the handover week is stored');
  assert.equal(engine.g.gameOver, false, 'play continues after retirement');
  assert.equal(engine.g.isCompanySold, false, 'the company is not sold by retiring');
}

// --- the next generation is graded on what it adds, not what it inherits --
{
  const { engine } = createEngine();
  prepareSuccessor(engine);
  engine.g.founderAge = 62;
  engine.g.legacyScore = 4000;
  engine.g.generationLegacyScore = 4000;
  assert.ok(engine.retireFounder(), 'the first generation retires at the top tier');
  assert.equal(engine.g.retirementRecords[0].id, 'retire_great_founder', 'a 4000 score is the top tier');
  assert.equal(engine.g.inheritedLegacyScore, 4000, 'the standing score is inherited');
  assert.equal(engine.g.generationLegacyScore, 0, 'the new generation starts from zero');

  engine.updateSuccessionWeekly();
  assert.equal(
    engine.g.generationLegacyScore,
    Math.max(0, engine.g.legacyScore - 4000),
    'the new generation is credited only with what it adds'
  );
  assert.ok(
    engine.g.generationLegacyScore < 4000,
    'inheriting a large company does not hand the next generation the top tier'
  );
}

// --- retirement records survive a save round trip -------------------------
{
  const { loaded, engine } = createEngine();
  prepareSuccessor(engine);
  engine.g.founderAge = 62;
  engine.g.legacyScore = 1200;
  engine.g.generationLegacyScore = 1200;
  assert.ok(engine.retireFounder(), 'retirement succeeds');

  const serialized = JSON.parse(JSON.stringify(engine.g));
  const restored = new loaded.engineModule.TycoonEngine();
  restored.g = serialized;
  restored.normalize();
  assert.equal(restored.g.retirementRecords.length, 1, 'the record survives a round trip');
  assert.equal(restored.g.retirementRecords[0].id, 'retire_industrialist', 'the tier survives');
  assert.equal(restored.g.inheritedLegacyScore, 1200, 'the inherited score survives');
  assert.equal(restored.g.founderGeneration, 2, 'the generation survives');
}

// --- the record list stays bounded ---------------------------------------
{
  const { engine } = createEngine();
  engine.g.retirementRecords = Array.from({ length: 50 }, (unused, index) => ({ id: `old_${index}` }));
  prepareSuccessor(engine);
  engine.g.founderAge = 62;
  engine.g.legacyScore = 100;
  engine.g.generationLegacyScore = 100;
  assert.ok(engine.retireFounder(), 'retirement succeeds with a full record list');
  assert.equal(engine.g.retirementRecords.length, 50, 'the record list is capped');
  assert.equal(engine.g.retirementRecords[0].id, 'retire_quiet', 'the newest record is kept at the front');
}

console.log('founder retirement tests passed');
