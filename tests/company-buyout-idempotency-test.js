'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function createGame() {
  const { engineModule } = loadGame({ headless: true });
  const engine = new engineModule.TycoonEngine();
  engine.normalize();
  engine.g.configured = true;
  engine.g.publicCompany = true; // bypass private-company minimum-size gate; isolate writer idempotency
  engine.g.personalCash = 12_345_678;
  engine.g.founderOwnershipRatio = 0.6;
  engine.g.isCompanySold = false;
  engine.g.hasSeenCompanyBuyoutEnding = true;
  return engine;
}

{
  const engine = createGame();
  const personalBefore = engine.g.personalCash;
  const recordsBefore = engine.g.pastCompanyRecords.length;
  const peExitsBefore = engine.g.peFirm.trackRecord.exits.length;
  assert.equal(engine.g.peFirm.unlocked, false, 'PE starts locked before the first whole-company exit');

  assert.equal(engine.acceptBuyoutOffer(1.2), true, 'first settings buyout succeeds');
  assert.equal(engine.g.isCompanySold, true, 'first buyout marks the company sold');
  assert.ok(engine.g.personalCash > personalBefore, 'first buyout credits founder proceeds once');
  assert.equal(engine.g.pastCompanyRecords.length, recordsBefore + 1, 'settings buyout records exactly one company exit');
  assert.equal(engine.g.pastCompanyRecords[0].exitType, 'buyout');
  assert.equal(engine.g.peFirm.trackRecord.exits.length, peExitsBefore + 1, 'settings buyout records exactly one PE track-record exit');
  assert.equal(engine.g.peFirm.trackRecord.exits.at(-1).exitType, 'buyout');
  assert.equal(engine.g.peFirm.unlocked, true, 'settings buyout unlocks PE through the canonical exit hook');

  const personalAfterFirst = engine.g.personalCash;
  const recordsAfterFirst = engine.g.pastCompanyRecords.length;
  const peExitsAfterFirst = engine.g.peFirm.trackRecord.exits.length;
  const stateAfterFirst = JSON.stringify(engine.g);

  assert.equal(engine.acceptBuyoutOffer(9.9), false, 'second buyout is rejected regardless of multiplier');
  assert.equal(engine.g.personalCash, personalAfterFirst, 'second buyout cannot credit founder proceeds again');
  assert.equal(engine.g.pastCompanyRecords.length, recordsAfterFirst, 'second buyout cannot add a second company exit record');
  assert.equal(engine.g.peFirm.trackRecord.exits.length, peExitsAfterFirst, 'second buyout cannot add a second PE exit');
  assert.equal(JSON.stringify(engine.g), stateAfterFirst, 'second buyout is state-idempotent');
}

{
  const engine = createGame();
  engine.g.isCompanySold = true;
  const before = JSON.stringify(engine.g);
  assert.equal(engine.acceptBuyoutOffer(), false, 'already-sold save is protected immediately');
  assert.equal(JSON.stringify(engine.g), before, 'already-sold guard mutates no save state');
}

console.log('company buyout idempotency tests passed');
