'use strict';

// Hiring, training and retaining key personnel spend company cash. Each action must write the
// matching company-ledger transaction, or finance.validate() reports a cash / balance-sheet
// mismatch for the rest of the game (#795, found through the #769 long-run fork test).

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seedValue) {
  let seed = seedValue >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
}

const loaded = loadGame({ headless: true, random: lcg(0x79500002) });
const { modules } = loaded;
const engine = new loaded.engineModule.TycoonEngine();
engine.configure({ playerName: 'Ledger', companyName: 'Ledger Co', difficulty: 'normal', scenario: 'free' });
modules.simulationRng.reseed(engine.g, 0x795795);
const contribution = 2_000_000_000 - engine.g.companyCash;
engine.g.personalCash += contribution;
assert.equal(engine.contributeFounderCapital(contribution), true, 'company cash arrives through the ledger');
engine.g.hasHeadOffice = true;
engine.g.officeCapacity = 32;

function assertValid(label) {
  const validation = modules.finance.validate(engine.g);
  assert.equal(validation.ok, true, `${label}: finance.validate: ${validation.errors.join(' / ')}`);
}

function measure(label, action) {
  const before = engine.g.companyCash;
  const ids = new Set(engine.g.finance.transactions.map(t => t.transactionID));
  assert.equal(action(), true, `${label} succeeds`);
  const added = engine.g.finance.transactions.filter(t => !ids.has(t.transactionID));
  const moved = engine.g.companyCash - before;
  const recorded = added.reduce((sum, t) => sum + t.cashEffect, 0);
  assert.ok(moved < 0, `precondition: ${label} spends company cash`);
  assert.ok(Math.abs(moved - recorded) < 1, `${label}: company cash moved ${moved} but the ledger recorded ${recorded}`);
  assert.equal(added.length, 1, `${label} writes one transaction`);
  assert.equal(added[0].profitEffect, added[0].cashEffect, `${label} is expensed`);
  assertValid(label);
  return added[0];
}

assertValid('setup');
const hire = measure('hireKeyPerson', () => engine.hireKeyPerson());
const person = engine.g.keyPersonnel.at(-1);
assert.equal(hire.category, 'payroll');
assert.equal(hire.sourceID, person.id, 'the transaction names the hired person');
const train = measure('trainKeyPerson', () => engine.trainKeyPerson(person.id));
assert.equal(train.category, 'headOfficeExpense');
assert.equal(train.sourceID, person.id);
const retain = measure('retainKeyPerson', () => engine.retainKeyPerson(person.id));
assert.equal(retain.category, 'payroll');
assert.equal(retain.sourceID, person.id);

// The weekly key-person wage is already recorded; the ledger stays valid across weeks.
for (let week = 0; week < 4; week++) assert.notEqual(engine.advanceWeek(false), false);
assertValid('four weeks later');

console.log('key person ledger tests passed');
