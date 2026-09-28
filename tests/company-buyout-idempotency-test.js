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

  assert.equal(engine.acceptBuyoutOffer(1.2), true, 'first buyout succeeds');
  assert.equal(engine.g.isCompanySold, true, 'first buyout marks the company sold');
  assert.ok(engine.g.personalCash > personalBefore, 'first buyout credits founder proceeds once');

  const personalAfterFirst = engine.g.personalCash;
  const stateAfterFirst = JSON.stringify(engine.g);

  assert.equal(engine.acceptBuyoutOffer(9.9), false, 'second buyout is rejected regardless of multiplier');
  assert.equal(engine.g.personalCash, personalAfterFirst, 'second buyout cannot credit founder proceeds again');
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
